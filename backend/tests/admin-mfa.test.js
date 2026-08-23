'use strict';
/**
 * NODE E4J-RC1.2 item 3 — unit tests for real TOTP enrollment + login, over an
 * in-memory fake db. Proves the RC1.1 defect is fixed: enrollment is recorded
 * ONLY after a cryptographic code check, wrong/replayed codes enroll NOTHING,
 * and login re-verifies a live, non-replayed code.
 */
const totp = require('../src/lib/totp');

const KEY = 'admin-mfa-unit-test-key-0123456789abcdef';
process.env.ADMIN_MFA_WRAP_KEY = KEY;

const { beginTotpEnrollment, confirmTotpEnrollment, verifyTotpLogin } = require('../src/lib/admin-mfa');

function makeFakeDb() {
  const state = { users: new Map(), secrets: [], audit: [], seq: 1 };
  async function query(sql, params = []) {
    const s = sql.trim();
    if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') return { rows: [] };
    if (s.startsWith('INSERT INTO admin_activation_audit')) {
      const [admin_user_id, email_fingerprint, event, outcome] = params;
      state.audit.push({ admin_user_id, event, outcome });
      return { rows: [], rowCount: 1 };
    }
    if (s.startsWith('UPDATE admin_mfa_secrets SET revoked_at')) {
      const [when, adminId] = params;
      let n = 0;
      for (const r of state.secrets) {
        if (r.admin_user_id === adminId && !r.confirmed_at && !r.revoked_at) { r.revoked_at = when; n++; }
      }
      return { rows: [], rowCount: n };
    }
    if (s.startsWith('INSERT INTO admin_mfa_secrets')) {
      const [admin_user_id, secret_wrapped, created_at] = params;
      state.secrets.push({ id: `sec-${state.seq++}`, admin_user_id, secret_wrapped, created_at, confirmed_at: null, revoked_at: null, last_totp_step: null });
      return { rows: [], rowCount: 1 };
    }
    if (s.startsWith('SELECT') && s.includes('FROM admin_mfa_secrets') && s.includes('confirmed_at IS NULL')) {
      const [adminId] = params;
      const rows = state.secrets
        .filter((r) => r.admin_user_id === adminId && !r.confirmed_at && !r.revoked_at)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: rows.length ? [rows[0]] : [] };
    }
    if (s.startsWith('SELECT') && s.includes('FROM admin_mfa_secrets') && s.includes('confirmed_at IS NOT NULL')) {
      const [adminId] = params;
      const rows = state.secrets
        .filter((r) => r.admin_user_id === adminId && r.confirmed_at && !r.revoked_at)
        .sort((a, b) => new Date(b.confirmed_at) - new Date(a.confirmed_at));
      return { rows: rows.length ? [rows[0]] : [] };
    }
    if (s.startsWith('UPDATE admin_mfa_secrets SET confirmed_at')) {
      const [confirmed_at, last_step, id] = params;
      const r = state.secrets.find((x) => x.id === id);
      if (r) { r.confirmed_at = confirmed_at; r.last_totp_step = last_step; }
      return { rows: [], rowCount: r ? 1 : 0 };
    }
    if (s.startsWith('UPDATE admin_mfa_secrets SET last_totp_step')) {
      const [last_step, id] = params;
      const r = state.secrets.find((x) => x.id === id);
      if (r) r.last_totp_step = last_step;
      return { rows: [], rowCount: r ? 1 : 0 };
    }
    if (s.startsWith('UPDATE users SET admin_mfa_enrolled_at')) {
      const [when, id] = params;
      const u = state.users.get(id);
      if (u && u.role === 'admin') u.admin_mfa_enrolled_at = when;
      return { rows: [], rowCount: u ? 1 : 0 };
    }
    throw new Error('FakeDb unhandled: ' + s.slice(0, 60));
  }
  return { query, state };
}

const ADMIN = 'admin-uuid-mfa';
function seed(db) {
  db.state.users.set(ADMIN, { id: ADMIN, role: 'admin', admin_mfa_enrolled_at: null });
}

describe('admin-mfa enrollment', () => {
  test('begin creates a pending (unconfirmed) wrapped secret; nothing enrolled yet', async () => {
    const db = makeFakeDb(); seed(db);
    const r = await beginTotpEnrollment({ db, adminUserId: ADMIN });
    expect(r.ok).toBe(true);
    expect(typeof r.secret).toBe('string');
    expect(r.otpauthUri).toContain('otpauth://');
    expect(db.state.secrets).toHaveLength(1);
    expect(db.state.secrets[0].confirmed_at).toBeNull();
    // stored secret is wrapped, not plaintext
    expect(db.state.secrets[0].secret_wrapped).not.toContain(r.secret);
    expect(db.state.users.get(ADMIN).admin_mfa_enrolled_at).toBeNull();
  });

  test('confirm with a WRONG code enrolls nothing', async () => {
    const db = makeFakeDb(); seed(db);
    await beginTotpEnrollment({ db, adminUserId: ADMIN });
    const r = await confirmTotpEnrollment({ db, adminUserId: ADMIN, code: '000000' });
    expect(r.ok).toBe(false);
    expect(db.state.secrets[0].confirmed_at).toBeNull();
    expect(db.state.users.get(ADMIN).admin_mfa_enrolled_at).toBeNull();
  });

  test('confirm with the CORRECT code enrolls (sets confirmed_at + users column)', async () => {
    const db = makeFakeDb(); seed(db);
    const now = new Date();
    const b = await beginTotpEnrollment({ db, adminUserId: ADMIN, now });
    const code = totp.totpCode(b.secret, now.getTime());
    const r = await confirmTotpEnrollment({ db, adminUserId: ADMIN, code, now });
    expect(r.ok).toBe(true);
    expect(db.state.secrets[0].confirmed_at).toEqual(now);
    expect(db.state.users.get(ADMIN).admin_mfa_enrolled_at).toEqual(now);
  });

  test('a confirmed code cannot be replayed at login (same step rejected)', async () => {
    const db = makeFakeDb(); seed(db);
    const now = new Date();
    const b = await beginTotpEnrollment({ db, adminUserId: ADMIN, now });
    const code = totp.totpCode(b.secret, now.getTime());
    await confirmTotpEnrollment({ db, adminUserId: ADMIN, code, now });
    // Same code (same time-step) must NOT authenticate a login.
    const replay = await verifyTotpLogin({ db, adminUserId: ADMIN, code, now });
    expect(replay.ok).toBe(false);
  });

  test('login succeeds with a fresh code from a later step, then that step is also replay-protected', async () => {
    const db = makeFakeDb(); seed(db);
    const t0 = new Date();
    const b = await beginTotpEnrollment({ db, adminUserId: ADMIN, now: t0 });
    await confirmTotpEnrollment({ db, adminUserId: ADMIN, code: totp.totpCode(b.secret, t0.getTime()), now: t0 });
    const t1 = new Date(t0.getTime() + 60 * 1000); // +2 steps
    const code1 = totp.totpCode(b.secret, t1.getTime());
    expect((await verifyTotpLogin({ db, adminUserId: ADMIN, code: code1, now: t1 })).ok).toBe(true);
    expect((await verifyTotpLogin({ db, adminUserId: ADMIN, code: code1, now: t1 })).ok).toBe(false); // replay
  });

  test('verifyTotpLogin fails closed when no confirmed factor exists', async () => {
    const db = makeFakeDb(); seed(db);
    const r = await verifyTotpLogin({ db, adminUserId: ADMIN, code: '123456' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_factor');
  });
});

'use strict';
/**
 * Node E4J-RC1.1 item 3 — complete admin activation flow tests.
 *
 * These are PURE unit tests over an in-memory fake `db`. They exercise the full
 * activation flow, second-factor gating, recovery/revocation, rate limiting,
 * audit boundaries, and admin route authorization — WITHOUT a real database and
 * WITHOUT ever creating an admin. Includes negative + authz + concurrency cases.
 */
const bcrypt = require('bcryptjs');
const {
  adminPasswordPolicy,
  activateAdmin,
  revokeOutstandingTokens,
  adminSessionAllowed,
  ACTIVATION_MAX_ATTEMPTS,
} = require('../src/lib/admin-activation-flow');
const { generateActivationToken, hashToken } = require('../src/lib/admin-activation');
const { adminOnly } = require('../src/middleware/admin-only');

const GOOD_PW = 'Str0ng-Admin-Pass!2026';

/**
 * Minimal in-memory Postgres stand-in. Recognizes exactly the queries the
 * activation flow issues and mutates in-memory state accordingly.
 */
function makeFakeDb() {
  const state = {
    users: new Map(),
    tokens: [],       // {id, admin_user_id, token_hash, purpose, expires_at, used_at, revoked_at}
    rate: new Map(),  // key -> {hits, reset_at}
    audit: [],        // {admin_user_id, email_fingerprint, event, outcome, actor_fingerprint, detail}
    committed: 0,
    rolledback: 0,
  };
  async function query(sql, params = []) {
    const s = sql.trim();
    if (s === 'BEGIN') return { rows: [] };
    if (s === 'COMMIT') { state.committed++; return { rows: [] }; }
    if (s === 'ROLLBACK') { state.rolledback++; return { rows: [] }; }

    if (s.startsWith('INSERT INTO rate_limit_hits')) {
      const [key, nowIso, windowMs] = params;
      const now = new Date(nowIso).getTime();
      let b = state.rate.get(key);
      if (!b || new Date(b.reset_at).getTime() <= now) {
        b = { hits: 1, reset_at: new Date(now + Number(windowMs)).toISOString() };
      } else {
        b = { hits: b.hits + 1, reset_at: b.reset_at };
      }
      state.rate.set(key, b);
      return { rows: [{ hits: b.hits }], rowCount: 1 };
    }

    if (s.startsWith('INSERT INTO admin_activation_audit')) {
      const [admin_user_id, email_fingerprint, event, outcome, actor_fingerprint, detail] = params;
      state.audit.push({ admin_user_id, email_fingerprint, event, outcome, actor_fingerprint, detail });
      return { rows: [], rowCount: 1 };
    }

    if (s.startsWith('SELECT') && s.includes('FROM admin_activation_tokens') && s.includes('FOR UPDATE')) {
      const [tokenHash] = params;
      const row = state.tokens.find((t) => t.token_hash === tokenHash) || undefined;
      return { rows: row ? [{ ...row }] : [], rowCount: row ? 1 : 0 };
    }

    if (s.startsWith('SELECT') && s.includes('email_verified_at') && s.includes('FROM users')) {
      const [id] = params;
      const u = state.users.get(id);
      return { rows: u ? [{ role: u.role, email_verified_at: u.email_verified_at, deleted_at: u.deleted_at || null }] : [], rowCount: u ? 1 : 0 };
    }

    if (s.startsWith('UPDATE users') && s.includes('password_hash')) {
      const [password_hash, activatedAt, id] = params;
      const u = state.users.get(id);
      if (u) { u.password_hash = password_hash; u.must_change_password = false; u.admin_activated_at = activatedAt; }
      return { rows: [], rowCount: u ? 1 : 0 };
    }

    if (s.startsWith('UPDATE admin_activation_tokens SET used_at')) {
      const [usedAt, id] = params;
      const t = state.tokens.find((x) => x.id === id);
      if (t) t.used_at = usedAt;
      return { rows: [], rowCount: t ? 1 : 0 };
    }

    if (s.startsWith('UPDATE admin_activation_tokens') && s.includes('id <> $3')) {
      const [revokedAt, adminId, keepId] = params;
      let n = 0;
      for (const t of state.tokens) {
        if (t.admin_user_id === adminId && t.id !== keepId && !t.used_at && !t.revoked_at) {
          t.revoked_at = revokedAt; n++;
        }
      }
      return { rows: [], rowCount: n };
    }

    if (s.startsWith('UPDATE admin_activation_tokens') && s.includes('used_at IS NULL AND revoked_at IS NULL')) {
      const [revokedAt, adminId] = params;
      let n = 0;
      for (const t of state.tokens) {
        if (t.admin_user_id === adminId && !t.used_at && !t.revoked_at) { t.revoked_at = revokedAt; n++; }
      }
      return { rows: [], rowCount: n };
    }

    if (s.startsWith('UPDATE users SET') && (s.includes('admin_mfa_enrolled_at') || s.includes('admin_passkey_enrolled_at'))) {
      const [when, id] = params;
      const u = state.users.get(id);
      if (u && u.role === 'admin') {
        if (s.includes('admin_mfa_enrolled_at')) u.admin_mfa_enrolled_at = when;
        else u.admin_passkey_enrolled_at = when;
      }
      return { rows: [], rowCount: u ? 1 : 0 };
    }

    throw new Error('FakeDb: unhandled query: ' + s.slice(0, 80));
  }
  return { query, state };
}

function seedAdminWithToken(db, { ttlMinutes = 30, now = new Date(), used = false, revoked = false, purpose = 'admin_activation' } = {}) {
  const adminId = 'admin-uuid-1';
  db.state.users.set(adminId, {
    id: adminId, role: 'admin', password_hash: null, must_change_password: true,
    admin_activated_at: null, admin_mfa_enrolled_at: null, admin_passkey_enrolled_at: null,
    email_verified_at: now, deleted_at: null,
  });
  const { token, tokenHash, expiresAt } = generateActivationToken(now, ttlMinutes);
  db.state.tokens.push({
    id: 'tok-1', admin_user_id: adminId, token_hash: tokenHash, purpose,
    expires_at: expiresAt, used_at: used ? now : null, revoked_at: revoked ? now : null,
  });
  return { adminId, token };
}

// ---------------------------------------------------------------------------
describe('adminPasswordPolicy', () => {
  test('rejects weak passwords with specific reasons', () => {
    expect(adminPasswordPolicy('short').ok).toBe(false);
    expect(adminPasswordPolicy('alllowercase12!x').reason).toBe('need_uppercase');
    expect(adminPasswordPolicy('ALLUPPERCASE12!X').reason).toBe('need_lowercase');
    expect(adminPasswordPolicy('NoDigitsHere!!xx').reason).toBe('need_digit');
    expect(adminPasswordPolicy('NoSymbol1234abcd').reason).toBe('need_symbol');
    expect(adminPasswordPolicy(null).ok).toBe(false);
  });
  test('accepts a strong password', () => {
    expect(adminPasswordPolicy(GOOD_PW)).toEqual({ ok: true, reason: 'ok' });
  });
});

describe('activateAdmin — happy path (atomic, single-use, competing-token revoke)', () => {
  test('sets password, consumes token, revokes competing tokens, audits, WITHHOLDS session', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { adminId, token } = seedAdminWithToken(db, { now });
    // add a competing outstanding token for the same admin
    const competing = generateActivationToken(now, 30);
    db.state.tokens.push({ id: 'tok-2', admin_user_id: adminId, token_hash: competing.tokenHash, purpose: 'admin_activation', expires_at: competing.expiresAt, used_at: null, revoked_at: null });

    const res = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, actor: '203.0.113.9', now });

    expect(res.ok).toBe(true);
    expect(res.sessionGranted).toBe(false);            // session withheld until 2FA
    expect(res.mustEnrollSecondFactor).toBe(true);
    const u = db.state.users.get(adminId);
    expect(u.must_change_password).toBe(false);
    expect(u.admin_activated_at).toBeTruthy();
    expect(await bcrypt.compare(GOOD_PW, u.password_hash)).toBe(true); // real bcrypt hash stored
    expect(db.state.tokens.find((t) => t.id === 'tok-1').used_at).toBeTruthy(); // single-use consumed
    expect(db.state.tokens.find((t) => t.id === 'tok-2').revoked_at).toBeTruthy(); // competing revoked
    expect(db.state.committed).toBeGreaterThan(0);
    expect(db.state.rolledback).toBe(0);
    // audit contains success with NO raw secrets
    const ok = db.state.audit.find((a) => a.event === 'activate_success');
    expect(ok.outcome).toBe('ok');
    const blob = JSON.stringify(db.state.audit);
    expect(blob).not.toContain(token);
    expect(blob).not.toContain(GOOD_PW);
  });
});

describe('activateAdmin — negative / fail-closed cases', () => {
  test('expired token -> expired', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    const { token } = seedAdminWithToken(db, { now: past, ttlMinutes: 1 }); // already expired
    const res = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    expect(res).toMatchObject({ ok: false, reason: 'expired', sessionGranted: false });
  });
  test('already-used token -> already_used', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { token } = seedAdminWithToken(db, { now, used: true });
    const res = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    expect(res.reason).toBe('already_used');
  });
  test('revoked token -> revoked', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { token } = seedAdminWithToken(db, { now, revoked: true });
    const res = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    expect(res.reason).toBe('revoked');
  });
  test('unknown/malformed token -> not_found (no user mutated)', async () => {
    const db = makeFakeDb();
    const now = new Date();
    seedAdminWithToken(db, { now });
    const res = await activateAdmin({ db, presentedToken: 'not-a-real-token', newPassword: GOOD_PW, now });
    expect(res.reason).toBe('not_found');
    expect(db.state.users.get('admin-uuid-1').password_hash).toBeNull();
  });
  test('empty token -> no_token, no DB touched', async () => {
    const db = makeFakeDb();
    const res = await activateAdmin({ db, presentedToken: '', newPassword: GOOD_PW });
    expect(res.reason).toBe('no_token');
    expect(db.state.audit.length).toBe(0);
  });
  test('weak password rejected BEFORE any token consumption', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { token } = seedAdminWithToken(db, { now });
    const res = await activateAdmin({ db, presentedToken: token, newPassword: 'weak', now });
    expect(res.reason).toMatch(/^password_/);
    expect(db.state.tokens[0].used_at).toBeNull(); // token NOT consumed
  });
  test('wrong purpose token -> wrong_purpose', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { token } = seedAdminWithToken(db, { now, purpose: 'password_reset' });
    const res = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    expect(res.reason).toBe('wrong_purpose');
  });
});

describe('activateAdmin — reuse / concurrency', () => {
  test('second activation of the same token fails (single-use enforced)', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { token } = seedAdminWithToken(db, { now });
    const first = await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    expect(first.ok).toBe(true);
    const second = await activateAdmin({ db, presentedToken: token, newPassword: 'An0ther-Valid-Pass!x', now });
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_used');
  });
});

describe('activateAdmin — brute-force rate limiting', () => {
  test('repeated wrong attempts on the same token trip the limiter', async () => {
    const db = makeFakeDb();
    const now = new Date();
    seedAdminWithToken(db, { now });
    // Craft a wrong token that maps to a stable rate-limit key.
    const wrong = 'wrong-but-well-formed-token-value';
    let last;
    for (let i = 0; i < ACTIVATION_MAX_ATTEMPTS + 1; i++) {
      last = await activateAdmin({ db, presentedToken: wrong, newPassword: GOOD_PW, actor: '198.51.100.7', now });
    }
    expect(last.reason).toBe('rate_limited');
    expect(db.state.audit.some((a) => a.outcome === 'rate_limited')).toBe(true);
  });
});

describe('recovery / revocation', () => {
  test('revokeOutstandingTokens invalidates all unused tokens and audits count', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { adminId } = seedAdminWithToken(db, { now });
    const extra = generateActivationToken(now, 30);
    db.state.tokens.push({ id: 'tok-3', admin_user_id: adminId, token_hash: extra.tokenHash, purpose: 'admin_activation', expires_at: extra.expiresAt, used_at: null, revoked_at: null });
    const n = await revokeOutstandingTokens({ db, adminUserId: adminId, now });
    expect(n).toBe(2);
    expect(db.state.tokens.every((t) => t.revoked_at)).toBe(true);
    expect(db.state.audit.some((a) => a.event === 'tokens_revoked')).toBe(true);
  });
});

describe('second-factor gating (adminSessionAllowed)', () => {
  test('activated but no 2FA -> session denied', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { adminId, token } = seedAdminWithToken(db, { now });
    await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    const u = db.state.users.get(adminId);
    expect(adminSessionAllowed(u)).toMatchObject({ allowed: false, reason: 'second_factor_required' });
  });
  test('after MFA enrollment (real TOTP confirm sets the column) -> session allowed', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { adminId, token } = seedAdminWithToken(db, { now });
    await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    // The real flow flips this via admin-mfa.confirmTotpEnrollment after a
    // cryptographic code check (covered by the route-integration suite). Here we
    // assert only the gating predicate on canonical state.
    db.state.users.get(adminId).admin_mfa_enrolled_at = now;
    expect(adminSessionAllowed(db.state.users.get(adminId)).allowed).toBe(true);
  });
  test('after passkey enrollment -> session allowed', async () => {
    const db = makeFakeDb();
    const now = new Date();
    const { adminId, token } = seedAdminWithToken(db, { now });
    await activateAdmin({ db, presentedToken: token, newPassword: GOOD_PW, now });
    db.state.users.get(adminId).admin_passkey_enrolled_at = now;
    expect(adminSessionAllowed(db.state.users.get(adminId)).allowed).toBe(true);
  });
  test('non-admin never allowed; must_change_password blocks; not-activated blocks', () => {
    expect(adminSessionAllowed({ role: 'patient' }).reason).toBe('not_admin');
    expect(adminSessionAllowed({ role: 'admin', admin_activated_at: null }).reason).toBe('not_activated');
    expect(adminSessionAllowed({ role: 'admin', admin_activated_at: new Date(), must_change_password: true }).reason).toBe('must_change_password');
  });
});

describe('authorization — adminOnly middleware (RC1.2: canonical + amr required)', () => {
  // A fully-provisioned admin session: canonical DB state says session-eligible
  // AND the JWT was raised with a second factor (amr includes 'totp').
  const fullAdmin = () => ({
    role: 'admin',
    amr: ['pwd', 'totp'],
    canonical: {
      role: 'admin', deleted_at: null, must_change_password: false,
      admin_activated_at: new Date(), admin_mfa_enrolled_at: new Date(),
      admin_passkey_enrolled_at: null,
    },
  });
  function runMw(user) {
    const req = { user };
    let status = null, body = null, nexted = false;
    const res = { status: (c) => { status = c; return res; }, json: (b) => { body = b; return res; } };
    adminOnly(req, res, () => { nexted = true; });
    return { status, body, nexted };
  }
  test('no user -> 403', () => { const r = runMw(undefined); expect(r.status).toBe(403); expect(r.nexted).toBe(false); });
  test('patient -> 403', () => { const r = runMw({ role: 'patient', canonical: { role: 'patient' } }); expect(r.status).toBe(403); });
  test('practitioner -> 403', () => { const r = runMw({ role: 'practitioner', canonical: { role: 'practitioner' } }); expect(r.status).toBe(403); });
  test('role=admin JWT WITHOUT canonical -> 403 (JWT claim alone insufficient)', () => {
    const r = runMw({ role: 'admin', amr: ['pwd', 'totp'] });
    expect(r.status).toBe(403);
  });
  test('admin activated but NO second factor -> 403', () => {
    const u = fullAdmin();
    u.canonical.admin_mfa_enrolled_at = null;
    const r = runMw(u);
    expect(r.status).toBe(403);
  });
  test('admin session WITHOUT amr totp -> 403 (password-only cannot reach admin route)', () => {
    const u = fullAdmin();
    u.amr = ['pwd'];
    const r = runMw(u);
    expect(r.status).toBe(403);
  });
  test('fully-provisioned admin with amr totp -> passes', () => {
    const r = runMw(fullAdmin());
    expect(r.nexted).toBe(true); expect(r.status).toBeNull();
  });
});

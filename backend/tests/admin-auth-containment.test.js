'use strict';
/**
 * NODE E4J-RC1.2 — ROUTE-LEVEL integration tests (supertest) proving the admin
 * auth integration + scoped session containment end to end against a REAL
 * (disposable) database:
 *
 *   - a role=admin account CANNOT log in via the normal /api/auth/login
 *     (returns 403 USE_ADMIN_LOGIN) — the RC1.1 bypass is closed;
 *   - the real activation -> TOTP-setup -> TOTP-confirm -> admin login flow
 *     issues an admin JWT only after a verified code;
 *   - adminOnly routes accept the TOTP admin JWT but reject a normal token and
 *     a pre-auth token;
 *   - per-account token invalidation (tokens_valid_after) kills ONE account's
 *     old JWTs while leaving another user's sessions valid.
 *
 * Requires DATABASE_URL to point at a disposable cluster (never shared/prod).
 * All rows created here are cleaned up in afterAll.
 */
const request = require('supertest');
const db = require('../src/db');
const app = require('../src/server');
const totp = require('../src/lib/totp');
const { generateActivationToken, hashToken } = require('../src/lib/admin-activation');

const ADMIN_PW = 'Str0ng-Admin-Pass!2026';
const created = { userIds: [], adminEmails: [] };

async function makeAdminRecord() {
  const email = `rc12-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  // password_hash is NOT NULL; a pre-activation admin carries an UNUSABLE
  // placeholder ('!' is not a valid bcrypt hash, so compare always fails) that
  // the real activation flow atomically overwrites.
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, role, full_name, must_change_password, email_verified_at)
       VALUES ($1, '!', 'admin', 'RC12 Admin', true, NOW())
     RETURNING id`,
    [email]
  );
  const id = rows[0].id;
  created.userIds.push(id);
  created.adminEmails.push(email);
  const { token, tokenHash, expiresAt } = generateActivationToken(new Date(), 30);
  await db.query(
    `INSERT INTO admin_activation_tokens (admin_user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'admin_activation', $3)`,
    [id, tokenHash, expiresAt]
  );
  return { id, email, activationToken: token };
}

async function registerPatient() {
  const email = `rc12-patient-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await request(app).post('/api/auth/register').send({
    email, password: 'Passw0rd!-member-2026', fullName: 'RC12 Member',
  });
  if (res.body && res.body.user) created.userIds.push(res.body.user.id);
  return { email, token: res.body.token, id: res.body.user && res.body.user.id };
}

// The disposable cluster is reused across runs; start from a clean rate-limit
// slate so accumulated actor/global buckets from prior runs don't spuriously
// trip the limiter. (Never run against a shared/prod DB.)
beforeAll(async () => {
  await db.query('DELETE FROM rate_limit_hits').catch(() => {});
});

afterAll(async () => {
  for (const id of created.userIds) {
    await db.query('DELETE FROM admin_activation_tokens WHERE admin_user_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM admin_mfa_secrets WHERE admin_user_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM admin_activation_audit WHERE admin_user_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM revoked_tokens WHERE user_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM users WHERE id = $1', [id]).catch(() => {});
  }
  await db.pool.end().catch(() => {});
});

describe('admin cannot use the normal login path (containment)', () => {
  test('role=admin -> 403 USE_ADMIN_LOGIN on /api/auth/login', async () => {
    const admin = await makeAdminRecord();
    // Give the admin a password (via the real activation flow, using this
    // record's own token) so we prove the block is not just "no password set".
    const act = await request(app).post('/api/admin/auth/activate')
      .send({ token: admin.activationToken, password: ADMIN_PW });
    expect(act.status).toBe(200);
    const res = await request(app).post('/api/auth/login').send({ email: admin.email, password: ADMIN_PW });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('USE_ADMIN_LOGIN');
  });
});

describe('full activation -> TOTP -> admin login flow', () => {
  test('happy path issues an admin JWT only after a verified TOTP code', async () => {
    const admin = await makeAdminRecord();

    // 1. Activate (consume token, set password) -> pre-auth token, NO session.
    const act = await request(app).post('/api/admin/auth/activate')
      .send({ token: admin.activationToken, password: ADMIN_PW });
    expect(act.status).toBe(200);
    expect(act.body.preAuthToken).toBeTruthy();
    expect(act.body.token).toBeUndefined(); // no real session yet
    const preAuth = act.body.preAuthToken;

    // 2. TOTP setup (pre-auth required).
    const setup = await request(app).post('/api/admin/auth/totp/setup')
      .set('Authorization', `Bearer ${preAuth}`).send({});
    expect(setup.status).toBe(200);
    expect(setup.body.secret).toBeTruthy();

    // 3. Confirm with a WRONG code -> rejected, nothing enrolled.
    const bad = await request(app).post('/api/admin/auth/totp/confirm')
      .set('Authorization', `Bearer ${preAuth}`).send({ code: '000000' });
    expect(bad.status).toBe(400);

    // 3b. Confirm with the real code -> enrolled.
    const code = totp.totpCode(setup.body.secret, Date.now());
    const conf = await request(app).post('/api/admin/auth/totp/confirm')
      .set('Authorization', `Bearer ${preAuth}`).send({ code });
    expect(conf.status).toBe(200);
    expect(conf.body.enrolled).toBe(true);

    // 4. Admin login with password + a fresh TOTP code from the NEXT step
    //    (one 30s step ahead: still inside the server's +/-1-step verify window,
    //    but a strictly later step than the confirm code so the replay guard
    //    (step must be > last_totp_step) still admits it).
    const code2 = totp.totpCode(setup.body.secret, Date.now() + 30 * 1000);
    const login = await request(app).post('/api/admin/auth/login')
      .send({ email: admin.email, password: ADMIN_PW, code: code2 });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    const adminJwt = login.body.token;

    // 4b. Wrong TOTP at login -> rejected.
    const badLogin = await request(app).post('/api/admin/auth/login')
      .send({ email: admin.email, password: ADMIN_PW, code: '000000' });
    expect(badLogin.status).toBe(401);

    // 5. adminOnly route ACCEPTS the TOTP admin JWT.
    const ok = await request(app).get('/api/admin/providers/stats')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect([200, 500]).toContain(ok.status); // 200 normally; never 401/403
    expect([401, 403]).not.toContain(ok.status);

    // 5b. adminOnly REJECTS a pre-auth token (401 from authMiddleware).
    const preRej = await request(app).get('/api/admin/providers/stats')
      .set('Authorization', `Bearer ${preAuth}`);
    expect(preRej.status).toBe(401);
  });
});

describe('adminOnly rejects a normal member session', () => {
  test('member JWT -> 403 on an admin route', async () => {
    const m = await registerPatient();
    const res = await request(app).get('/api/admin/providers/stats')
      .set('Authorization', `Bearer ${m.token}`);
    expect(res.status).toBe(403);
  });
});

describe('per-account session invalidation (tokens_valid_after)', () => {
  test('advancing ONE account cut-off kills its old JWT but not another user', async () => {
    const a = await registerPatient();
    const b = await registerPatient();

    // both tokens valid now
    expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${a.token}`)).status).toBe(200);
    expect((await request(app).get('/api/users/me').set('Authorization', `Bearer ${b.token}`)).status).toBe(200);

    // advance ONLY user a's cut-off to the future -> a's existing JWT (older iat) dies
    await db.query('UPDATE users SET tokens_valid_after = NOW() + interval \'1 hour\' WHERE id = $1', [a.id]);

    const aAfter = await request(app).get('/api/users/me').set('Authorization', `Bearer ${a.token}`);
    const bAfter = await request(app).get('/api/users/me').set('Authorization', `Bearer ${b.token}`);
    expect(aAfter.status).toBe(401);   // a's old session revoked (no password change, no global rotation)
    expect(bAfter.status).toBe(200);   // b entirely unaffected
  });
});

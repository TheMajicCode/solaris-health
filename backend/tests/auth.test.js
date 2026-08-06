/**
 * Authentication tests — registration, login, JWT issuance and the auth
 * middleware contract. Registers throwaway users with unique emails and
 * cleans them up afterwards so the live dev database is never polluted.
 *
 * S1A-P0-FAIL-CLOSED additions:
 * - Mock-auth endpoints return 410 (no side effects)
 * - authMiddleware: missing-jti → 401; store failure → 503
 */
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { authMiddleware } = require('../src/middleware/auth');

const createdUserIds = [];

async function cleanupUser(userId) {
  if (!userId) return;
  await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
}

afterAll(async () => {
  for (const id of createdUserIds) {
    await cleanupUser(id);
  }
});

describe('POST /api/auth/register', () => {
  it('creates a new user and returns a user + token', async () => {
    const payload = global.makeUserPayload();
    const res = await request(app).post('/api/auth/register').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(payload.email.toLowerCase ? payload.email : payload.email);
    // password hash must never be leaked back to the client
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password_hash).toBeUndefined();

    if (res.body.user.id) createdUserIds.push(res.body.user.id);
  });

  it('issues a JWT that decodes to the registered user', async () => {
    const payload = global.makeUserPayload();
    const res = await request(app).post('/api/auth/register').send(payload);
    if (res.body.user.id) createdUserIds.push(res.body.user.id);

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(decoded.userId).toBe(res.body.user.id);
    expect(decoded.email).toBeDefined();
  });

  it('rejects duplicate email registration', async () => {
    const payload = global.makeUserPayload();
    const first = await request(app).post('/api/auth/register').send(payload);
    if (first.body.user && first.body.user.id) createdUserIds.push(first.body.user.id);

    const second = await request(app).post('/api/auth/register').send(payload);
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
  });

  it('rejects registration with missing required fields', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'incomplete@test.local' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('POST /api/auth/login', () => {
  let creds;

  beforeAll(async () => {
    creds = global.makeUserPayload();
    const res = await request(app).post('/api/auth/register').send(creds);
    if (res.body.user && res.body.user.id) createdUserIds.push(res.body.user.id);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
  });

  it('rejects an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'WrongPassword!' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.token).toBeUndefined();
  });

  it('rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: global.uniqueEmail('nobody'), password: 'whatever' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('auth middleware', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = res.body.token;
    if (res.body.user && res.body.user.id) createdUserIds.push(res.body.user.id);
  });

  it('allows access to a protected route with a valid token', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a protected route with no token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('rejects a protected route with an invalid token', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// S1A-P0-FAIL-CLOSED: Mock-auth endpoints must return 410 with no side effects.
describe('S1A mock-auth 410', () => {
  it('POST /api/auth/nostr-mock returns 410 ENDPOINT_REMOVED with no token', async () => {
    const testNpub = 'npub1s1atest00000000000000000000000000000000000000000000000000';
    const before = Date.now();
    const querySpy = jest.spyOn(db, 'query');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/auth/nostr-mock')
        .send({ npub: testNpub });
      expect(res.status).toBe(410);
      expect(res.body).toEqual({ error: 'ENDPOINT_REMOVED', endpoint: 'mock_auth', removed: true });
      expect(res.body.token).toBeUndefined();
      expect(res.body.user).toBeUndefined();
      expect(querySpy).not.toHaveBeenCalled();
      expect(JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls])).not.toContain(testNpub);
    } finally {
      querySpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
    // No user row created for the synthetic nostr.mock email
    const check = await db.query(
      "SELECT COUNT(*) FROM users WHERE email LIKE '%nostr.mock%' AND created_at >= to_timestamp($1 / 1000.0)",
      [before]
    );
    expect(Number(check.rows[0].count)).toBe(0);
  });

  it('POST /api/auth/google-mock returns 410 ENDPOINT_REMOVED with no token', async () => {
    const testEmail = 's1a.test.synthetic.s1a@gmail.mock';
    const querySpy = jest.spyOn(db, 'query');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(app)
        .post('/api/auth/google-mock')
        .send({ email: testEmail, name: 'S1A Test' });
      expect(res.status).toBe(410);
      expect(res.body).toEqual({ error: 'ENDPOINT_REMOVED', endpoint: 'mock_auth', removed: true });
      expect(res.body.token).toBeUndefined();
      expect(res.body.user).toBeUndefined();
      expect(querySpy).not.toHaveBeenCalled();
      expect(JSON.stringify([...warnSpy.mock.calls, ...errorSpy.mock.calls])).not.toContain(testEmail);
    } finally {
      querySpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
    // No user row created
    const check = await db.query(
      'SELECT COUNT(*) FROM users WHERE email = $1',
      [testEmail]
    );
    expect(Number(check.rows[0].count)).toBe(0);
  });

  it('register and login still work (regression)', async () => {
    const payload = global.makeUserPayload();
    const reg = await request(app).post('/api/auth/register').send(payload);
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();
    if (reg.body.user && reg.body.user.id) createdUserIds.push(reg.body.user.id);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: payload.password });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeDefined();
  });
});

// S1A-P0-FAIL-CLOSED: authMiddleware fail-closed cases.
describe('S1A authMiddleware fail-closed', () => {
  function responseDouble() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  }

  it('rejects a token without jti before DB or downstream handler access', async () => {
    const tokenMarker = 'nojti-s1a-marker@test.local';
    const noJtiToken = jwt.sign(
      { userId: 99999, email: tokenMarker, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${noJtiToken}` } };
    const res = responseDouble();
    const next = jest.fn();
    const querySpy = jest.spyOn(db, 'query');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await authMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'TOKEN_REQUIRES_RELOGIN' });
      expect(next).not.toHaveBeenCalled();
      expect(querySpy).not.toHaveBeenCalled();
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(tokenMarker);
    } finally {
      querySpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('returns typed 503 and never calls next on revocation-store failure', async () => {
    const tokenMarker = 'revocation-s1a-marker@test.local';
    const errorMarker = 'S1A_STORE_DETAIL_MUST_NOT_LEAK';
    const storeToken = jwt.sign(
      { userId: 99998, email: tokenMarker, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '1h', jwtid: 's1a-revocation-jti' }
    );
    const req = { headers: { authorization: `Bearer ${storeToken}` } };
    const res = responseDouble();
    const next = jest.fn();
    const querySpy = jest.spyOn(db, 'query').mockRejectedValueOnce(
      Object.assign(new Error(errorMarker), { code: '57P01' })
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await authMiddleware(req, res, next);
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
      expect(next).not.toHaveBeenCalled();
      const captured = JSON.stringify([res.json.mock.calls, warnSpy.mock.calls]);
      expect(captured).not.toContain(tokenMarker);
      expect(captured).not.toContain(errorMarker);
      expect(captured).not.toContain('57P01');
    } finally {
      querySpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

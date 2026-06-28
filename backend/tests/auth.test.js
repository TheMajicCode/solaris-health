/**
 * Authentication tests — registration, login, JWT issuance and the auth
 * middleware contract. Registers throwaway users with unique emails and
 * cleans them up afterwards so the live dev database is never polluted.
 */
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

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

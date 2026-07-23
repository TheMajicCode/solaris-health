/**
 * READ_ONLY_MODE (incident write-freeze) tests.
 *
 * Verifies the middleware documented in docs/INCIDENT_RESPONSE.md:
 * - normal mode: mutations pass through untouched
 * - read-only mode: mutating API requests get 503, reads keep working,
 *   login stays allowed so operators can still authenticate.
 *
 * The flag is read per-request, so we can toggle process.env in-process.
 */
const request = require('supertest');
const app = require('../src/server');

describe('READ_ONLY_MODE write-freeze', () => {
  const original = process.env.READ_ONLY_MODE;
  afterEach(() => {
    if (original === undefined) delete process.env.READ_ONLY_MODE;
    else process.env.READ_ONLY_MODE = original;
  });

  test('when OFF (default), mutating requests are not blocked by the freeze', async () => {
    delete process.env.READ_ONLY_MODE;
    const res = await request(app).post('/api/auth/register').send({});
    // Reaches the route (validation 400), NOT the freeze (503).
    expect(res.status).not.toBe(503);
  });

  test('when ON, mutating API requests are rejected with 503 + readOnly flag', async () => {
    process.env.READ_ONLY_MODE = 'true';
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(503);
    expect(res.body.readOnly).toBe(true);
    expect(res.body.error).toMatch(/read-only/i);
  });

  test('when ON, GET requests keep working (health probe)', async () => {
    process.env.READ_ONLY_MODE = 'true';
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status); // 503 only if DB itself is down
    expect(res.body.service).toBe('luca-passport-backend');
  });

  test('when ON, login is still allowed (operators can authenticate)', async () => {
    process.env.READ_ONLY_MODE = 'true';
    const res = await request(app).post('/api/auth/login').send({});
    // Reaches the auth route (400/401 for missing creds), NOT the freeze.
    expect(res.status).not.toBe(503);
  });

  test('flag value must be exactly "true" — other values leave writes open', async () => {
    process.env.READ_ONLY_MODE = '1';
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).not.toBe(503);
  });
});

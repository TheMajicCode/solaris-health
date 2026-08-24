/**
 * NODE K1.1 §3 — invite-only UI + backend agreement (real disposable Postgres).
 *
 * Proves the public config endpoint and the /register gate read the SAME env and
 * therefore can never disagree:
 *   - GET /api/config exposes only { inviteOnly, spanishPreview, waitlistUrl? }
 *     and NO secrets; waitlistUrl appears only for a valid absolute URL.
 *   - When invite-only is ON, POST /api/auth/register returns 403 BEFORE any DB
 *     work; config.inviteOnly is true.
 *   - When invite-only is OFF, register succeeds (201) and config.inviteOnly is
 *     false.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

const createdUsers = [];
afterAll(async () => {
  for (const id of createdUsers) {
    await db.query('DELETE FROM users WHERE id=$1', [id]).catch(() => {});
  }
  delete process.env.BETA_INVITE_ONLY;
  delete process.env.BETA_WAITLIST_URL;
  delete process.env.BETA_SPANISH_PREVIEW;
  await db.pool.end();
});

describe('K1.1 §3 — public config endpoint', () => {
  it('exposes only the three non-sensitive fields and no secrets', async () => {
    delete process.env.BETA_INVITE_ONLY;
    delete process.env.BETA_WAITLIST_URL;
    delete process.env.BETA_SPANISH_PREVIEW;
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    // Only the allowed keys; waitlistUrl omitted when unset.
    expect(Object.keys(res.body).sort()).toEqual(['inviteOnly', 'spanishPreview']);
    expect(res.body.inviteOnly).toBe(false);
    expect(res.body.spanishPreview).toBe(false);
    const blob = JSON.stringify(res.body).toLowerCase();
    for (const secret of ['secret', 'password', 'token', 'jwt', 'database_url', 'apikey', 'api_key']) {
      expect(blob).not.toContain(secret);
    }
  });

  it('includes waitlistUrl only when a valid absolute URL is configured', async () => {
    process.env.BETA_WAITLIST_URL = 'not-a-url';
    let res = await request(app).get('/api/config');
    expect(res.body.waitlistUrl).toBeUndefined();

    process.env.BETA_WAITLIST_URL = 'https://solaris.health/waitlist';
    res = await request(app).get('/api/config');
    expect(res.body.waitlistUrl).toBe('https://solaris.health/waitlist');
    delete process.env.BETA_WAITLIST_URL;
  });

  it('reflects spanishPreview flag', async () => {
    process.env.BETA_SPANISH_PREVIEW = 'true';
    const res = await request(app).get('/api/config');
    expect(res.body.spanishPreview).toBe(true);
    delete process.env.BETA_SPANISH_PREVIEW;
  });
});

describe('K1.1 §3 — invite-only gate agrees with config', () => {
  it('invite-only ON: config.inviteOnly true AND register returns 403 (before DB work)', async () => {
    process.env.BETA_INVITE_ONLY = 'true';
    const cfg = await request(app).get('/api/config');
    expect(cfg.body.inviteOnly).toBe(true);

    const before = await db.query('SELECT count(*)::int AS n FROM users');
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    expect(reg.status).toBe(403);
    const after = await db.query('SELECT count(*)::int AS n FROM users');
    expect(after.rows[0].n).toBe(before.rows[0].n); // no user row created
    delete process.env.BETA_INVITE_ONLY;
  });

  it('invite-only OFF: config.inviteOnly false AND register succeeds (201)', async () => {
    delete process.env.BETA_INVITE_ONLY;
    const cfg = await request(app).get('/api/config');
    expect(cfg.body.inviteOnly).toBe(false);

    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    expect(reg.status).toBe(201);
    if (reg.body.user && reg.body.user.id) createdUsers.push(reg.body.user.id);
  });
});

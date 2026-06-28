/**
 * Health timeline tests — auth gating, the user's own aggregated timeline,
 * pagination shape, role restrictions on staff/admin views, and the vault
 * export endpoint.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

describe('timeline routes', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('rejects GET /api/timeline/me without auth', async () => {
    const res = await request(app).get('/api/timeline/me');
    expect(res.status).toBe(401);
  });

  it('returns a paginated timeline for the authed user', async () => {
    const res = await request(app).get('/api/timeline/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('events');
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body).toHaveProperty('limit');
    expect(res.body).toHaveProperty('offset');
  });

  it('honours the limit query parameter', async () => {
    const res = await request(app)
      .get('/api/timeline/me?limit=5')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.events.length).toBeLessThanOrEqual(5);
  });

  it('forbids a patient from viewing the admin system timeline', async () => {
    const res = await request(app).get('/api/timeline/system').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('forbids a patient from viewing another patient timeline (staff only)', async () => {
    const res = await request(app)
      .get('/api/timeline/patient/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('exports the user vault via POST /api/timeline/export', async () => {
    const res = await request(app)
      .post('/api/timeline/export')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    // Either a JSON manifest or a downloadable archive — must not error/401.
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(400);
  });
});

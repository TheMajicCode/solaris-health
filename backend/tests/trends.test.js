/**
 * Trends / vitals tests — auth gating, the vitals payload shape, range
 * filtering, and the role guard preventing a patient from reading another
 * user's vitals.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

describe('GET /api/trends/vitals', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM daily_checkins WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('rejects access without auth', async () => {
    const res = await request(app).get('/api/trends/vitals');
    expect(res.status).toBe(401);
  });

  it('returns the vitals payload shape for the authed user', async () => {
    const res = await request(app).get('/api/trends/vitals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('range');
    expect(res.body).toHaveProperty('points');
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body).toHaveProperty('metrics');
  });

  it('reflects the requested range in the response', async () => {
    const res = await request(app)
      .get('/api/trends/vitals?range=7d')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.range).toBe('7d');
  });

  it('records a check-in and surfaces it in the vitals points', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await db.query(
      `INSERT INTO daily_checkins (user_id, checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes)
       VALUES ($1, $2, 7, 8, 7.5, 6, 30)
       ON CONFLICT DO NOTHING`,
      [userId, today]
    );
    const res = await request(app).get('/api/trends/vitals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.points.length).toBeGreaterThanOrEqual(1);
    const point = res.body.points.find((p) => p.date === today);
    expect(point).toBeDefined();
    expect(point.energy).toBe(7);
  });

  it('forbids a patient from reading another user vitals', async () => {
    const res = await request(app)
      .get('/api/trends/vitals?userId=999999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

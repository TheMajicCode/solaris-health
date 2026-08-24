/**
 * NODE K1.3 §4 — Personalized-journey seed endpoint (DB-backed).
 *
 * POST /api/journey/todos/seed-plan writes an approved personalized journey into
 * the SAME member_todos pipeline as a guided journey. Must be idempotent (double
 * approve / reload never duplicates), validate action_type against the allowlist,
 * and add NO new table (reuses member_todos → no migration this node).
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

describe('NODE K1.3 personalized journey seed-plan', () => {
  let token;
  let userId;

  const steps = [
    { step_key: 'personalized_daily_0', title: '20 min — move your body.', cadence: 'today' },
    { step_key: 'personalized_daily_1', title: 'A one-line private check-in.', cadence: 'today' },
    { step_key: 'personalized_weekly_0', title: '5 intentional days on Body & Heart.', cadence: 'week' },
    { step_key: 'personalized_monthly_0', title: 'Revisit your goals.', cadence: 'month' },
  ];

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM member_todos WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('seeds personalized steps into member_todos and returns the full list', async () => {
    const res = await request(app)
      .post('/api/journey/todos/seed-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ journeyType: 'personalized', steps });
    expect(res.status).toBe(200);
    expect(res.body.seeded).toBe(steps.length);
    const seededRows = res.body.todos.filter((t) => t.journey_type === 'personalized');
    expect(seededRows.length).toBe(steps.length);
  });

  it('is idempotent — a re-approve / reload adds zero duplicates', async () => {
    const before = await db.query(
      "SELECT count(*)::int AS n FROM member_todos WHERE user_id=$1 AND journey_type='personalized'", [userId]);
    const res = await request(app)
      .post('/api/journey/todos/seed-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ journeyType: 'personalized', steps });
    expect(res.status).toBe(200);
    expect(res.body.seeded).toBe(0);
    const after = await db.query(
      "SELECT count(*)::int AS n FROM member_todos WHERE user_id=$1 AND journey_type='personalized'", [userId]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(after.rows[0].n).toBe(steps.length);
  });

  it('maps cadence to a kind that groups Today / This week / This month', async () => {
    const rows = (await db.query(
      "SELECT step_key, kind FROM member_todos WHERE user_id=$1 AND journey_type='personalized'", [userId])).rows;
    const byKey = Object.fromEntries(rows.map((r) => [r.step_key, r.kind]));
    expect(byKey['personalized_daily_0']).toBe('habit');     // → today
    expect(byKey['personalized_weekly_0']).toBe('activity');  // → week
    expect(byKey['personalized_monthly_0']).toBe('navigate'); // → month
  });

  it('rejects a non-allowlisted action_type (stored as non-actionable)', async () => {
    const res = await request(app)
      .post('/api/journey/todos/seed-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({
        journeyType: 'personalized',
        steps: [{ step_key: 'personalized_evil_0', title: 'Bad action.', cadence: 'week',
                  action_type: 'delete_account', action_target: 'x' }],
      });
    expect(res.status).toBe(200);
    const row = (await db.query(
      "SELECT action_type, action_target FROM member_todos WHERE user_id=$1 AND step_key='personalized_evil_0'",
      [userId])).rows[0];
    expect(row.action_type).toBeNull();
    expect(row.action_target).toBeNull();
  });

  it('requires auth and a non-empty steps array', async () => {
    const noAuth = await request(app).post('/api/journey/todos/seed-plan').send({ steps });
    expect(noAuth.status).toBe(401);
    const empty = await request(app)
      .post('/api/journey/todos/seed-plan')
      .set('Authorization', `Bearer ${token}`)
      .send({ journeyType: 'personalized', steps: [] });
    expect(empty.status).toBe(400);
  });
});

/**
 * Guided journey + enriched check-in tests.
 *
 * Covers the new daily check-in measurements (nutrition score, meal notes,
 * hydration), the curated guided-journey task list, LUCA suggestion padding,
 * and the vault export of check-in history. Uses the offline mock AI provider.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { buildVaultExport } = require('../src/lib/vault-export');

describe('daily check-in with sleep, water and nutrition', () => {
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
      await db.query('DELETE FROM daily_checkins WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM luca_messages WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('accepts and returns nutritionScore, mealNotes, water and sleep', async () => {
    const res = await request(app)
      .post('/api/journey/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({
        energyScore: 7,
        moodScore: 8,
        sleepHours: 6.5,
        hydrationGlasses: 5,
        nutritionScore: 8,
        mealNotes: 'Green smoothie and a warm grain bowl',
      });
    expect(res.status).toBe(201);
    expect(res.body.checkin).toBeDefined();
    expect(Number(res.body.checkin.sleep_hours)).toBeCloseTo(6.5);
    expect(res.body.checkin.hydration_glasses).toBe(5);
    expect(res.body.checkin.nutrition_score).toBe(8);
    expect(res.body.checkin.meal_notes).toContain('grain bowl');
  });

  it('preserves nutrition fields when the same day is upserted without them', async () => {
    const res = await request(app)
      .post('/api/journey/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({ energyScore: 6 });
    expect(res.status).toBe(201);
    expect(res.body.checkin.nutrition_score).toBe(8);
    expect(res.body.checkin.meal_notes).toContain('grain bowl');
  });

  it('serves a guided task list with the daily check-in first', async () => {
    const res = await request(app)
      .get('/api/journey/tasks')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.tasks.length).toBeGreaterThanOrEqual(3);
    expect(res.body.tasks[0].id).toBe('daily-checkin');
    expect(res.body.tasks[0].done).toBe(true); // checked in above
    expect(res.body.checkedInToday).toBe(true);
    const water = res.body.tasks.find((t) => t.id === 'water-goal');
    expect(water).toBeDefined();
    expect(water.done).toBe(false); // only 5 of 8 glasses
    for (const t of res.body.tasks) {
      expect(typeof t.label).toBe('string');
      expect(t.action && typeof t.action.type).toBe('string');
    }
  });

  it('requires auth for the task list', async () => {
    const res = await request(app).get('/api/journey/tasks');
    expect(res.status).toBe(401);
  });

  it('pads LUCA suggestions to exactly three actionable chips', async () => {
    const res = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'What should I focus on today?' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions).toHaveLength(3);
    for (const s of res.body.suggestions) {
      expect(typeof s.label).toBe('string');
      expect(s.label.length).toBeGreaterThan(0);
      expect(typeof s.action).toBe('string');
    }
  });
});

describe('vault export of check-in history', () => {
  const record = {
    user: { id: 9, email: 'ci@test.local', role: 'patient' },
    assessment: null,
    contributions: [],
    messages: [],
    credentials: [],
    checkins: [
      {
        checkin_date: '2026-07-26',
        energy_score: 7,
        mood_score: 8,
        sleep_hours: 7.5,
        hydration_glasses: 8,
        movement_minutes: 30,
        mind_score: 7,
        body_score: 8,
        heart_score: 9,
        spirit_score: 8,
        nutrition_score: 9,
        meal_notes: 'Slow lunch outdoors',
        notes: 'Felt grounded',
      },
    ],
  };

  it('includes health/checkins.md with the new measurements', () => {
    const files = buildVaultExport(record);
    const f = files.find((x) => x.path === 'health/checkins.md');
    expect(f).toBeDefined();
    expect(f.contents).toMatch(/7\/26\/2026|2026-07-26/); // locale-formatted date heading
    expect(f.contents).toMatch(/Water/i);
    expect(f.contents).toMatch(/Nutrition/i);
    expect(f.contents).toContain('Slow lunch outdoors');
  });

  it('omits the check-ins file when there are none', () => {
    const files = buildVaultExport({ ...record, checkins: [] });
    expect(files.find((x) => x.path === 'health/checkins.md')).toBeUndefined();
  });
});

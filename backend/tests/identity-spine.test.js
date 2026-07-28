/**
 * M1 — Identity spine + audit four-W tests.
 *
 * Verifies (A2 §1, A1 §7):
 *   - The JWT carries `sub` = the permanent Solaris subject public_ref.
 *   - A domain write (check-in) is stamped with the member's subject_id.
 *   - audit() persists purpose + consent_scope + actor_subject_id.
 */
process.env.LUCA_AI_MODE = 'mock';

const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { audit } = require('../src/lib/helpers');

describe('identity spine + audit four-W', () => {
  let token;
  let userId;
  let subjectId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
    const s = await db.query('SELECT subject_id FROM solaris_subjects WHERE user_id=$1', [userId]);
    subjectId = s.rows[0] && s.rows[0].subject_id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM daily_checkins WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('issues a JWT whose sub is the Solaris subject public_ref', () => {
    const decoded = jwt.decode(token);
    expect(subjectId).toMatch(/^sol_[0-9a-f]{32}$/);
    expect(decoded.sub).toBe(subjectId);
    expect(decoded.userId).toBe(userId); // internal id kept for compatibility
  });

  it('stamps subject_id on a domain write (check-in)', async () => {
    await request(app)
      .post('/api/journey/checkins')
      .set('Authorization', `Bearer ${token}`)
      .send({ energyScore: 6, moodScore: 6, sleepHours: 7 })
      .expect(201);
    const row = await db.query(
      'SELECT subject_id FROM daily_checkins WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    expect(row.rows[0].subject_id).toBe(subjectId);
  });

  it('audit() writes purpose, consent_scope and actor_subject_id', async () => {
    await audit({
      actorId: userId,
      action: 'test.identity.spine',
      resourceType: 'test',
      resourceId: userId,
      purpose: 'unit_test',
      consentScope: 'private',
    });
    const row = await db.query(
      "SELECT purpose, consent_scope, actor_subject_id FROM audit_logs WHERE actor_id=$1 AND action='test.identity.spine' LIMIT 1",
      [userId]
    );
    expect(row.rows[0].purpose).toBe('unit_test');
    expect(row.rows[0].consent_scope).toBe('private');
    expect(row.rows[0].actor_subject_id).toBe(subjectId);
  });
});

/**
 * Admin finance + GPS settlement endpoint tests (Sprint F).
 *
 * Verifies the new admin-only reconciliation and settlement-queue endpoints
 * return well-formed, simulated payloads for an admin, and are refused for a
 * regular member. Nothing here moves real money.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

describe('admin finance + GPS settlement endpoints', () => {
  let adminToken;
  let adminId;
  let memberToken;
  let memberId;

  beforeAll(async () => {
    const admin = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    adminToken = admin.body.token;
    adminId = admin.body.user && admin.body.user.id;
    await db.query("UPDATE users SET role='admin' WHERE id=$1", [adminId]);
    // Re-login so the JWT carries the elevated role.
    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.body.user.email, password: 'Test1234!' });
    adminToken = relogin.body.token || adminToken;

    const member = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    memberToken = member.body.token;
    memberId = member.body.user && member.body.user.id;
  });

  afterAll(async () => {
    for (const id of [adminId, memberId]) {
      if (!id) continue;
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [id]);
      await db.query('DELETE FROM users WHERE id = $1', [id]);
    }
  });

  it('returns a simulated finance reconciliation for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/finance')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.intents)).toBe(true);
    expect(typeof res.body.totalUsd).toBe('number');
    expect(typeof res.body.paidUsd).toBe('number');
    expect(res.body.simulated).toBe(true);
  });

  it('returns the GPS settlement queue for an admin', async () => {
    const res = await request(app)
      .get('/api/admin/gps-settlements')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.receipts)).toBe(true);
    expect(typeof res.body.pending).toBe('number');
    expect(typeof res.body.envelopeUsd).toBe('number');
  });

  it('rejects an unknown settlement state', async () => {
    const res = await request(app)
      .patch('/api/admin/gps-settlements/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ settlementState: 'NONSENSE' });
    expect(res.status).toBe(400);
  });

  it('forbids a non-admin member from the finance endpoint', async () => {
    const res = await request(app)
      .get('/api/admin/finance')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});

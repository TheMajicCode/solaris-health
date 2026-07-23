/**
 * Sovereignty status tests (Slice 6) — GET /api/passport/sovereignty-status.
 *
 * Registers a throwaway member, seeds one AI receipt, and verifies the
 * endpoint answers the six sovereignty questions in plain language, keeps
 * raw identifiers under `advanced`, and never leaks anything without auth.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { recordAIReceipt } = require('../src/lib/ai/receipts');

let token;
let userId;

beforeAll(async () => {
  const payload = global.makeUserPayload();
  const res = await request(app).post('/api/auth/register').send(payload);
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (userId) {
    await db.query('DELETE FROM ai_execution_receipts WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await db.pool.end();
});

describe('GET /api/passport/sovereignty-status', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/passport/sovereignty-status');
    expect(res.status).toBe(401);
  });

  it('answers the six sovereignty questions in plain language', async () => {
    const res = await request(app)
      .get('/api/passport/sovereignty-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const b = res.body;
    // 1. Who am I?
    expect(b.identity.plain).toMatch(/sovereign/i);
    expect(b.identity.role).toBeDefined();
    // 2. Which identity methods are connected?
    const methods = b.identityMethods.map((m) => m.method);
    expect(methods).toEqual(expect.arrayContaining(['email', 'did', 'nostr', 'wallet']));
    expect(b.identityMethods.find((m) => m.method === 'email').connected).toBe(true);
    // 3. Who has access? (fresh member: no one)
    expect(b.access.practitioners).toEqual([]);
    expect(b.access.plain).toMatch(/no one else/i);
    // 4. Where is my data stored?
    expect(b.storage.plain).toMatch(/PostgreSQL/);
    // 5. AI — fresh member has no receipts yet
    expect(b.ai.provider).toBeNull();
    expect(b.ai.plain).toMatch(/not talked with LUCA/i);
    // 6. Export / revoke
    expect(b.rights.export.api).toBe('/api/export/me');
    expect(b.rights.revokeConsent).toContain('/api/consent');
  });

  it('surfaces the latest AI receipt provider and compute target', async () => {
    await recordAIReceipt({
      userId,
      eventType: 'luca.member.chat',
      ai: { id: 'abacus:gpt-5.5-mini' },
      requestedModel: 'gpt-5.5-mini',
      inputText: 'hello luca',
      resultText: 'hello member',
      latencyMs: 42,
      dataClass: 'health_context',
      consentBasis: 'member_self_query',
    });

    const res = await request(app)
      .get('/api/passport/sovereignty-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ai.provider).toBe('abacus');
    expect(res.body.ai.computeTarget).toBe('managed_cloud');
    expect(res.body.ai.plain).toMatch(/cloud AI provider/i);
  });

  it('keeps raw identifiers out of the plain-language layer (advanced only)', async () => {
    const res = await request(app)
      .get('/api/passport/sovereignty-status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.advanced.subjectId).toBe(userId);
    // No plain string exposes the raw UUID.
    const plains = [
      res.body.identity.plain,
      res.body.access.plain,
      res.body.storage.plain,
      res.body.ai.plain,
      res.body.rights.plain,
    ].join(' ');
    expect(plains).not.toContain(userId);
  });
});

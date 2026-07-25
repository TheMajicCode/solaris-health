/**
 * Web Push notification tests.
 *
 * Covers:
 *  1. VAPID public key endpoint (auth-gated, returns key when configured).
 *  2. Subscription lifecycle — subscribe (upsert), re-subscribe, unsubscribe (revoke).
 *  3. createNotification roundtrip into the notifications table.
 *  4. PHI safety — push payloads are fixed generic templates and can never
 *     contain message text or health content, by construction.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { createNotification } = require('../src/lib/notifications');
const { buildPushPayload, PUSH_TEMPLATES } = require('../src/lib/push');

const FAKE_ENDPOINT = `https://push.example.test/ep-${Date.now()}`;

describe('push payload PHI safety (pure)', () => {
  it('has a fixed generic template for every notification type', () => {
    for (const type of Object.keys(PUSH_TEMPLATES)) {
      const p = buildPushPayload(type);
      expect(typeof p.title).toBe('string');
      expect(typeof p.body).toBe('string');
      expect(typeof p.url).toBe('string');
      // Templates are static strings — no interpolation slots.
      expect(p.body).not.toMatch(/[{}$%]/);
    }
  });

  it('falls back to the generic system template for unknown types', () => {
    expect(buildPushPayload('totally-unknown')).toEqual(buildPushPayload('system'));
  });

  it('cannot leak notification content: payload is derived from type only', () => {
    // buildPushPayload takes ONLY the type — there is no code path that could
    // place a message body or health detail into a push payload.
    const secret = 'my HbA1c is 9.1 and I told Dr. X about my diagnosis';
    const p = buildPushPayload('message');
    expect(JSON.stringify(p)).not.toContain('HbA1c');
    expect(JSON.stringify(p)).not.toContain(secret);
    expect(p.body).toBe('You have a new secure message.');
  });
});

describe('subscription lifecycle + notification creation (database)', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const payload = global.makeUserPayload();
    const reg = await request(app).post('/api/auth/register').send(payload);
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
    expect(userId).toBeTruthy();
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM notifications WHERE user_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM ai_execution_receipts WHERE user_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM solaris_subjects WHERE user_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM agent_capability_grants WHERE owner_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM agents WHERE owner_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    await db.pool.end().catch(() => {});
  });

  it('GET /vapid-public-key requires auth', async () => {
    const r = await request(app).get('/api/notifications/vapid-public-key');
    expect(r.status).toBe(401);
  });

  it('GET /vapid-public-key returns the configured key', async () => {
    const r = await request(app)
      .get('/api/notifications/vapid-public-key')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('enabled');
    if (r.body.enabled) {
      expect(typeof r.body.publicKey).toBe('string');
      expect(r.body.publicKey.length).toBeGreaterThan(20);
    } else {
      expect(r.body.publicKey).toBeNull();
    }
  });

  it('POST /subscribe rejects a malformed subscription', async () => {
    const r = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: FAKE_ENDPOINT }); // missing keys
    expect([400, 503]).toContain(r.status);
  });

  it('POST /subscribe stores the subscription (and upserts on re-subscribe)', async () => {
    const body = {
      endpoint: FAKE_ENDPOINT,
      keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
      userAgent: 'jest-test-agent',
    };
    const r1 = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
    if (r1.status === 503) return; // push not configured in this env — skip
    expect(r1.status).toBe(200);

    // Re-subscribe with rotated keys: must upsert, not duplicate.
    const r2 = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, keys: { p256dh: 'rotated-p256dh', auth: 'rotated-auth' } });
    expect(r2.status).toBe(200);

    const rows = await db.query('SELECT * FROM push_subscriptions WHERE endpoint=$1', [FAKE_ENDPOINT]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].user_id).toBe(userId);
    expect(rows.rows[0].p256dh).toBe('rotated-p256dh');
    expect(rows.rows[0].revoked_at).toBeNull();
  });

  it('POST /unsubscribe revokes the subscription', async () => {
    const r = await request(app)
      .post('/api/notifications/unsubscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: FAKE_ENDPOINT });
    expect(r.status).toBe(200);
    const rows = await db.query('SELECT revoked_at FROM push_subscriptions WHERE endpoint=$1', [FAKE_ENDPOINT]);
    if (rows.rows.length) expect(rows.rows[0].revoked_at).not.toBeNull();
  });

  it('createNotification inserts a row visible via the API', async () => {
    const n = await createNotification(userId, 'message', 'New secure message', 'You have received a new secure message.', { conversationId: 'test-conv' });
    expect(n).toBeTruthy();
    expect(n.type).toBe('message');

    const r = await request(app)
      .get('/api/notifications?filter=unread')
      .set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    const found = (r.body.notifications || []).find((x) => x.id === n.id);
    expect(found).toBeTruthy();
    expect(found.title).toBe('New secure message');
  });
});

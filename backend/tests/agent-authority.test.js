/**
 * Agent authority tests (Slice 7).
 *
 * Proves the core promise: one user-owned LUCA agent with scoped, revocable,
 * expirable capability grants — and disabling LUCA never deletes the user,
 * their data, or their session.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const {
  ensureLucaAgent,
  checkCapability,
  setLucaActive,
  revokeGrant,
  exportAgentAuthority,
} = require('../src/lib/agent-authority');

let token;
let userId;

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (userId) {
    await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]);
    await db.query('DELETE FROM agent_capability_grants WHERE owner_id = $1', [userId]);
    await db.query('DELETE FROM agents WHERE owner_id = $1', [userId]);
    await db.query('DELETE FROM luca_messages WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  }
  await db.pool.end();
});

describe('agent-authority lib', () => {
  it('ensureLucaAgent is idempotent and seeds default grants', async () => {
    const a1 = await ensureLucaAgent(userId);
    const a2 = await ensureLucaAgent(userId);
    expect(a1.id).toBe(a2.id);
    expect(a1.name).toBe('LUCA');
    const grants = await db.query(
      'SELECT capability FROM agent_capability_grants WHERE agent_id=$1', [a1.id]
    );
    const caps = grants.rows.map((g) => g.capability);
    expect(caps).toEqual(expect.arrayContaining(['luca.chat', 'passport.read.summary']));
  });

  it('checkCapability allows an active grant and blocks a disabled agent', async () => {
    let check = await checkCapability(userId, 'luca.chat');
    expect(check.allowed).toBe(true);

    await setLucaActive(userId, false);
    check = await checkCapability(userId, 'luca.chat');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('agent_disabled');

    await setLucaActive(userId, true);
    check = await checkCapability(userId, 'luca.chat');
    expect(check.allowed).toBe(true);
  });

  it('blocks unknown capabilities, revoked grants, and expired grants', async () => {
    const none = await checkCapability(userId, 'wallet.spend');
    expect(none.allowed).toBe(false);
    expect(none.reason).toBe('no_grant');

    const agent = await ensureLucaAgent(userId);
    const g = await db.query(
      `SELECT id FROM agent_capability_grants WHERE agent_id=$1 AND capability='passport.read.summary'`,
      [agent.id]
    );
    const grantId = g.rows[0].id;

    // Expired grant
    await db.query(
      `UPDATE agent_capability_grants SET expires_at = NOW() - INTERVAL '1 hour' WHERE id=$1`,
      [grantId]
    );
    let check = await checkCapability(userId, 'passport.read.summary');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('grant_expired');

    // Revoked grant
    await db.query(
      `UPDATE agent_capability_grants SET expires_at = NULL WHERE id=$1`, [grantId]
    );
    const revoked = await revokeGrant(userId, grantId);
    expect(revoked.status).toBe('revoked');
    check = await checkCapability(userId, 'passport.read.summary');
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe('grant_revoked');
  });

  it('export representation includes agent + grants and nothing PHI-shaped', async () => {
    const rep = await exportAgentAuthority(userId);
    expect(rep.agents.length).toBeGreaterThanOrEqual(1);
    expect(rep.grants.length).toBeGreaterThanOrEqual(2);
    const dumped = JSON.stringify(rep);
    expect(dumped).not.toMatch(/password/i);
    expect(dumped).not.toContain('@'); // no emails
  });
});

describe('LUCA agent HTTP routes', () => {
  it('GET /api/agents/luca returns identity, kill-switch state and grants', async () => {
    const res = await request(app)
      .get('/api/agents/luca').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('LUCA');
    expect(typeof res.body.active).toBe('boolean');
    expect(res.body.grants.length).toBeGreaterThanOrEqual(2);
  });

  it('disabling LUCA blocks chat with 403 but the user stays logged in with data intact', async () => {
    const off = await request(app)
      .post('/api/agents/luca/disable').set('Authorization', `Bearer ${token}`);
    expect(off.status).toBe(200);
    expect(off.body.active).toBe(false);

    // Chat is refused, politely, without deleting anything.
    const chat = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hello?' });
    expect(chat.status).toBe(403);
    expect(chat.body.agentDisabled).toBe(true);

    // Same token still works — the user was NOT logged out or deleted.
    const me = await request(app)
      .get('/api/passport/sovereignty-status').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);

    // The member-facing toggle reads this endpoint — it must reflect the paused state.
    const state = await request(app)
      .get('/api/agents/luca').set('Authorization', `Bearer ${token}`);
    expect(state.status).toBe(200);
    expect(state.body.active).toBe(false);

    // Re-enable brings LUCA back.
    const on = await request(app)
      .post('/api/agents/luca/enable').set('Authorization', `Bearer ${token}`);
    expect(on.status).toBe(200);
    expect(on.body.active).toBe(true);
  });

  it('audits grant use into audit_logs when LUCA chats', async () => {
    const chat = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'One small habit for better sleep?' });
    expect(chat.status).toBe(200);

    // recordGrantUse is fire-and-forget — give it a beat.
    await new Promise((r) => setTimeout(r, 250));
    const audit = await db.query(
      `SELECT * FROM audit_logs WHERE actor_id=$1 AND action='agent.grant.used'`,
      [userId]
    );
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
    expect(audit.rows[0].new_values.capability).toBe('luca.chat');
  });
});

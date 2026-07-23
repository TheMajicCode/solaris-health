/**
 * LUCA AI concierge tests.
 *
 * Covers the pure rule-based mock provider (non-diagnostic, deterministic), provider
 * selection, and the chat HTTP routes. Forces LUCA_AI_MODE=mock so the suite is fully
 * offline and never incurs a cloud LLM call.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { createMockReply } = require('../src/lib/ai/mock');
const { getAIProvider, requestTimeoutMs } = require('../src/lib/ai');

describe('AI provider factory', () => {
  it('selects Abacus RouteLLM explicitly without making a network call', () => {
    const provider = getAIProvider({
      LUCA_AI_MODE: 'abacus',
      LUCA_AI_API_KEY: 'test-key',
      LUCA_AI_MODEL: 'claude-sonnet-4-6',
    });

    expect(provider.id).toBe('abacus:claude-sonnet-4-6');
    expect(provider.degraded).toBeUndefined();
  });

  it('degrades Abacus mode to mock when its key is missing', () => {
    const provider = getAIProvider({ LUCA_AI_MODE: 'abacus' });

    expect(provider.id).toBe('mock:luca-reflex-v0');
    expect(provider.degraded).toMatch(/Abacus RouteLLM/);
  });

  it('keeps local mode keyless and provider-specific', () => {
    const provider = getAIProvider({
      LUCA_AI_MODE: 'local',
      LUCA_AI_MODEL: 'local-test-model',
    });

    expect(provider.id).toBe('local:local-test-model');
    expect(provider.degraded).toBeUndefined();
  });

  it('uses a safe timeout default and accepts a positive override', () => {
    expect(requestTimeoutMs({})).toBe(20000);
    expect(requestTimeoutMs({ LUCA_AI_TIMEOUT_MS: '12500' })).toBe(12500);
    expect(requestTimeoutMs({ LUCA_AI_TIMEOUT_MS: '-1' })).toBe(20000);
  });
});

describe('createMockReply (rule-based fallback)', () => {
  it('responds to sleep-related prompts with sleep guidance', () => {
    const reply = createMockReply('I cannot sleep at night', '');
    expect(reply.toLowerCase()).toContain('sleep');
  });

  it('responds to hydration prompts', () => {
    const reply = createMockReply('how much water should I drink', '');
    expect(reply.toLowerCase()).toMatch(/hydrat|water/);
  });

  it('responds to stress prompts with breathing guidance', () => {
    const reply = createMockReply('I feel so anxious and stressed', '');
    expect(reply.toLowerCase()).toMatch(/breath/);
  });

  it('uses vitality score from context when asked about results', () => {
    const reply = createMockReply('what is my vitality score', 'Vitality: 82\nFocus areas: Sleep');
    expect(reply).toContain('82');
  });

  it('never returns an empty string for arbitrary input', () => {
    const reply = createMockReply('tell me something random xyz', '');
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });

  it('is non-diagnostic — points to guidance, not diagnosis', () => {
    const reply = createMockReply('do I have a disease', '');
    expect(reply.toLowerCase()).not.toContain('you have been diagnosed');
  });
});

describe('LUCA chat routes', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
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
  });

  it('rejects message access without auth', async () => {
    const res = await request(app).get('/api/luca/messages');
    expect(res.status).toBe(401);
  });

  it('returns an (initially empty) message history', async () => {
    const res = await request(app)
      .get('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('rejects an empty message', async () => {
    const res = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });
    expect(res.status).toBe(400);
  });

  it('posts a message and gets a non-empty reply', async () => {
    const res = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'I am having trouble sleeping' });
    expect(res.status).toBe(200);
    expect(typeof res.body.reply).toBe('string');
    expect(res.body.reply.length).toBeGreaterThan(0);
  });

  it('persists the conversation so history grows', async () => {
    const res = await request(app)
      .get('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // user message + assistant reply from the previous test
    expect(res.body.messages.length).toBeGreaterThanOrEqual(2);
  });
});

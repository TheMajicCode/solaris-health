/**
 * AI execution receipt tests (Slice 2).
 *
 * Verifies that every LUCA chat turn writes one ai_execution_receipts row with
 * provenance metadata and NON-REVERSIBLE hashes only — never the raw prompt,
 * the raw reply, or any passport context — and that receipts flow into the
 * sovereign vault export as ai/execution-receipts.jsonl.
 *
 * Fully offline: LUCA_AI_MODE=mock.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { sha256, describeProvider, recordAIReceipt } = require('../src/lib/ai/receipts');
const { buildVaultExport } = require('../src/lib/vault-export');

describe('receipts helpers (pure)', () => {
  it('sha256 is deterministic and non-reversible-shaped (64 hex chars)', () => {
    expect(sha256('hello')).toBe(sha256('hello'));
    expect(sha256('hello')).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256('hello')).not.toContain('hello');
  });

  it('describeProvider maps provider ids to compute targets', () => {
    expect(describeProvider({ id: 'abacus:claude-sonnet-4-6' })).toEqual({
      provider: 'abacus', actualModel: 'claude-sonnet-4-6', computeTarget: 'managed_cloud',
    });
    expect(describeProvider({ id: 'local:Qwen2.5-7B-Instruct' }).computeTarget).toBe('local');
    expect(describeProvider({ id: 'mock:luca-reflex-v0' }).computeTarget).toBe('in_process');
  });
});

describe('receipt written per LUCA chat turn', () => {
  let token;
  let userId;
  const SENSITIVE_MESSAGE = 'I have been having chest pains and poor sleep RECEIPT_CANARY_9Z';

  beforeAll(async () => {
    const reg = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM ai_execution_receipts WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]);
      await db.query('DELETE FROM agent_capability_grants WHERE owner_id = $1', [userId]);
      await db.query('DELETE FROM agents WHERE owner_id = $1', [userId]);
      await db.query('DELETE FROM luca_messages WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM reward_events WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('POST /api/luca/messages writes exactly one receipt with hashes, provider, latency', async () => {
    const res = await request(app)
      .post('/api/luca/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: SENSITIVE_MESSAGE });
    expect(res.status).toBe(200);

    const r = await db.query(
      'SELECT * FROM ai_execution_receipts WHERE user_id=$1 ORDER BY created_at DESC',
      [userId]
    );
    expect(r.rows.length).toBe(1);
    const receipt = r.rows[0];
    expect(receipt.event_type).toBe('luca.member.chat');
    expect(receipt.agent_id).toBe('sol_agent_luca');
    expect(receipt.provider).toBe('mock');
    expect(receipt.compute_target).toBe('in_process');
    expect(receipt.data_class).toBe('health_context');
    expect(receipt.consent_basis).toBe('member_self_query');
    expect(receipt.policy_version).toBe('v0');
    expect(receipt.latency_ms).toBeGreaterThanOrEqual(0);
    expect(receipt.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.result_hash).toMatch(/^[a-f0-9]{64}$/);
    // input_hash is exactly the digest of the user message — provable provenance
    expect(receipt.input_hash).toBe(sha256(SENSITIVE_MESSAGE));
  });

  it('receipt row contains NO raw prompt, reply, or PHI copy-through', async () => {
    const r = await db.query(
      'SELECT * FROM ai_execution_receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const serialized = JSON.stringify(r.rows[0]).toLowerCase();
    expect(serialized).not.toContain('chest pains');
    expect(serialized).not.toContain('receipt_canary_9z');
    expect(serialized).not.toContain('sleep'); // no fragment of the message either
  });

  it('receipts appear in the vault export as ai/execution-receipts.jsonl (roundtrip)', async () => {
    const res = await request(app)
      .get('/api/export/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const file = res.body.files.find((f) => f.path === 'ai/execution-receipts.jsonl');
    expect(file).toBeDefined();
    const lines = file.contents.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const rec = lines[lines.length - 1];
    expect(rec.event_type).toBe('luca.member.chat');
    expect(rec.provider).toBe('mock');
    expect(rec.input_hash).toBe(sha256(SENSITIVE_MESSAGE));
    // export copy is also PHI-free
    expect(file.contents.toLowerCase()).not.toContain('chest pains');
    // and the manifest lists the file
    expect(res.body.manifest.files).toContain('ai/execution-receipts.jsonl');
  });

  it('recordAIReceipt never throws even when the insert fails', async () => {
    // user_id violates FK -> insert fails -> helper must swallow and return null
    const id = await recordAIReceipt({
      userId: -999999,
      eventType: 'luca.member.chat',
      ai: { id: 'mock:luca-reflex-v0' },
      inputText: 'x',
      resultText: 'y',
    });
    expect(id).toBeNull();
  });
});

describe('vault export builder handles receipts (pure)', () => {
  it('omits the ai file when there are no receipts and includes it when present', () => {
    const base = { user: { id: 1, email: 'a@b.c', full_name: 'A', role: 'patient' } };
    const without = buildVaultExport({ ...base });
    expect(without.find((f) => f.path === 'ai/execution-receipts.jsonl')).toBeUndefined();

    const withReceipts = buildVaultExport({
      ...base,
      aiReceipts: [{
        event_type: 'luca.member.chat', agent_id: 'sol_agent_luca', provider: 'abacus',
        requested_model: 'claude-sonnet-4-6', actual_model: 'claude-sonnet-4-6',
        compute_target: 'managed_cloud', data_class: 'health_context',
        consent_basis: 'member_self_query', latency_ms: 812,
        input_hash: 'a'.repeat(64), result_hash: 'b'.repeat(64),
        degraded: false, error_class: null, policy_version: 'v0',
        created_at: '2026-07-23T00:00:00Z',
      }],
    });
    const file = withReceipts.find((f) => f.path === 'ai/execution-receipts.jsonl');
    expect(file).toBeDefined();
    expect(JSON.parse(file.contents.trim()).provider).toBe('abacus');
  });
});

/**
 * Solaris ID tests (ADR 001).
 *
 * Covers:
 *  1. Backfill correctness — every user has exactly one subject.
 *  2. Subject id shape — non-PII by construction.
 *  3. Binding lookup + hash-only email bindings (no PII duplication).
 *  4. Receipt stamping — new AI execution receipts carry the subject id.
 *  5. GPS end-address setter (validated, simulated, resettable).
 *  6. /api/identity/me summary + vault-export roundtrip of the identity block.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const identity = require('../src/lib/identity');
const { recordAIReceipt } = require('../src/lib/ai/receipts');
const { buildVaultExport } = require('../src/lib/vault-export');

describe('subject id shape (pure)', () => {
  it('generates sol_ + 32 lowercase hex, unique per call', () => {
    const a = identity.newSubjectId();
    const b = identity.newSubjectId();
    expect(a).toMatch(identity.SUBJECT_ID_RE);
    expect(b).toMatch(identity.SUBJECT_ID_RE);
    expect(a).not.toBe(b);
  });

  it('shortens for display without exposing the middle', () => {
    const id = 'sol_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d';
    const short = identity.shortSubjectId(id);
    expect(short.startsWith('sol_1a2b')).toBe(true);
    expect(short.endsWith('5c6d')).toBe(true);
    expect(short.length).toBeLessThan(id.length);
  });
});

describe('backfill + lifecycle against the database', () => {
  let token;
  let userId;
  let email;

  beforeAll(async () => {
    const payload = global.makeUserPayload();
    email = payload.email;
    const reg = await request(app).post('/api/auth/register').send(payload);
    token = reg.body.token;
    userId = reg.body.user && reg.body.user.id;
    expect(userId).toBeTruthy();
  });

  afterAll(async () => {
    if (userId) {
      await db.query('DELETE FROM ai_execution_receipts WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM solaris_subjects WHERE user_id = $1', [userId]); // bindings cascade
      await db.query('DELETE FROM audit_logs WHERE actor_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM agent_capability_grants WHERE owner_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM agents WHERE owner_id = $1', [userId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  it('every user has exactly one subject (backfill + lazy creation)', async () => {
    // Lazily ensure for the fresh user, twice — must stay one row.
    const s1 = await identity.ensureSubjectForUser(userId);
    const s2 = await identity.ensureSubjectForUser(userId);
    expect(s1.subject_id).toBe(s2.subject_id);

    const orphans = await db.query(
      `SELECT count(*)::int AS n FROM users u
       LEFT JOIN solaris_subjects s ON s.user_id = u.id WHERE s.id IS NULL`
    );
    expect(orphans.rows[0].n).toBe(0);

    const dupes = await db.query(
      `SELECT count(*)::int AS n FROM (
         SELECT user_id FROM solaris_subjects GROUP BY user_id HAVING count(*) > 1
       ) d`
    );
    expect(dupes.rows[0].n).toBe(0);
  });

  it('subject id is non-PII: valid shape, no email or user-uuid fragments', async () => {
    const s = await identity.getSubjectByUser(userId);
    expect(s.subject_id).toMatch(/^sol_[0-9a-f]{32}$/);
    expect(s.subject_id).not.toContain(email.split('@')[0].toLowerCase());
    expect(s.subject_id.slice(4)).not.toBe(String(userId).replace(/-/g, ''));
  });

  it('binding lookup returns the hash-only email binding (no PII value)', async () => {
    const s = await identity.getSubjectByUser(userId);
    const bindings = await identity.listBindings(s.subject_id);
    const emailBinding = bindings.find((b) => b.binding_type === 'email');
    expect(emailBinding).toBeTruthy();
    expect(emailBinding.binding_value).toBeNull();
    expect(emailBinding.binding_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailBinding.binding_hash).toBe(identity.sha256hex(email.toLowerCase()));
    expect(emailBinding.status).toBe('active');
  });

  it('new AI execution receipts are stamped with the subject id', async () => {
    const receiptId = await recordAIReceipt({
      userId,
      eventType: 'test.identity.stamp',
      ai: { id: 'mock:luca-reflex-v0' },
      inputText: 'stamp test',
      resultText: 'ok',
    });
    expect(receiptId).toBeTruthy();
    const r = await db.query('SELECT subject_id FROM ai_execution_receipts WHERE id = $1', [receiptId]);
    const s = await identity.getSubjectByUser(userId);
    expect(r.rows[0].subject_id).toBe(s.subject_id);
  });

  it('GPS end-address setter validates, saves and resets (simulated config only)', async () => {
    await expect(identity.setGpsEndAddress(userId, 'not an address')).rejects.toMatchObject({ status: 400 });

    const set = await identity.setGpsEndAddress(userId, 'Owner@GetAlby.com');
    expect(set.gps_end_address).toBe('owner@getalby.com');
    expect(set.gps_end_address_type).toBe('lightning_address');

    const reset = await identity.setGpsEndAddress(userId, '');
    expect(reset.gps_end_address).toBe('solaris_default');
    expect(reset.gps_end_address_type).toBe('solaris_default');
  });

  it('GET /api/identity/me returns the plain-language summary', async () => {
    const res = await request(app)
      .get('/api/identity/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.solarisId).toMatch(/^sol_[0-9a-f]{32}$/);
    expect(res.body.solarisIdShort).toContain('sol_');
    expect(Array.isArray(res.body.bindings)).toBe(true);
    expect(res.body.gps.simulated).toBe(true);
    expect(res.body.agentAuthority.note).toMatch(/never holds/i);
    const emailB = res.body.bindings.find((b) => b.type === 'email');
    expect(emailB.value).toBeNull(); // no PII in the summary either
  });

  it('PUT /api/identity/me/end-address works over HTTP and rejects bad shapes', async () => {
    const bad = await request(app)
      .put('/api/identity/me/end-address')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'nope' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .put('/api/identity/me/end-address')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: 'owner@ln.test.io' });
    expect(ok.status).toBe(200);
    expect(ok.body.simulated).toBe(true);
    expect(ok.body.gps.endAddress).toBe('owner@ln.test.io');

    // reset for cleanliness
    await request(app)
      .put('/api/identity/me/end-address')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '' });
  });

  it('vault export roundtrips the identity block (identity/solaris-id.md)', async () => {
    const solarisIdentity = await identity.exportIdentity(userId);
    expect(solarisIdentity.solarisId).toMatch(/^sol_[0-9a-f]{32}$/);

    const files = buildVaultExport({
      user: { id: userId, email, full_name: 'Test User', role: 'patient' },
      solarisIdentity,
    });
    const idFile = files.find((f) => f.path === 'identity/solaris-id.md');
    expect(idFile).toBeTruthy();
    expect(idFile.contents).toContain(solarisIdentity.solarisId);
    expect(idFile.contents).not.toContain(email); // PHI/PII never in the identity file
    expect(idFile.contents).toContain('hash only');

    const manifest = JSON.parse(files.find((f) => f.path === 'manifest.json').contents);
    expect(manifest.files).toContain('identity/solaris-id.md');

    const log = files.find((f) => f.path === 'events/log.jsonl');
    const exportEvent = log.contents.trim().split('\n').map(JSON.parse).find((e) => e.action === 'exported_vault');
    expect(exportEvent.counts.identity_bindings).toBe(solarisIdentity.bindings.length);
  });
});

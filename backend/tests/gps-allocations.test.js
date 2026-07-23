/**
 * GPS evidence-before-payment tests (Slice 8).
 *
 * Verifies that a simulated allocation can be explained from evidence
 * (receipt with sha256 evidence hash + policy version + shadow flag),
 * that a human participant can dispute it, that an admin can resolve
 * it to `corrected`, and that non-participants are locked out.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const {
  buildEvidence, canonicalJSON, recordAllocationReceipt, verifyReceipt, GPS_POLICY_VERSION,
} = require('../src/lib/gps-receipts');
const crypto = require('crypto');

let patientToken; let patientId;
let strangerToken; let strangerId;
let adminToken; let adminId;
let txId;

beforeAll(async () => {
  // Patient (participant in the allocation).
  const p = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  patientToken = p.body.token; patientId = p.body.user.id;

  // Stranger (no relationship to the allocation).
  const s = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  strangerToken = s.body.token; strangerId = s.body.user.id;

  // Admin (human resolver). Promote then re-login so the JWT carries the role.
  const a = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  adminId = a.body.user.id;
  await db.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminId]);
  const emailRow = await db.query('SELECT email FROM users WHERE id=$1', [adminId]);
  const login = await request(app).post('/api/auth/login')
    .send({ email: emailRow.rows[0].email, password: 'Test1234!' });
  adminToken = login.body.token;

  // A simulated GPS allocation (no booking needed — evidence is structural).
  const tx = await db.query(
    `INSERT INTO gps_transactions
       (total_amount, currency, provider_share, contributor_share, infrastructure_share,
        treasury_share, software_share, user_reward_share, patient_id, status, split_template)
     VALUES (100, 'USD', 85, 5, 3, 3, 2, 2, $1, 'pending', 'default')
     RETURNING id`,
    [patientId]
  );
  txId = tx.rows[0].id;
});

afterAll(async () => {
  await db.query(
    `DELETE FROM gps_allocation_disputes WHERE receipt_id IN
       (SELECT id FROM gps_allocation_receipts WHERE transaction_id=$1)`, [txId]);
  await db.query('DELETE FROM gps_allocation_receipts WHERE transaction_id=$1', [txId]);
  await db.query('DELETE FROM gps_transactions WHERE id=$1', [txId]);
  for (const uid of [patientId, strangerId, adminId]) {
    if (!uid) continue;
    await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [uid]);
    await db.query('DELETE FROM agent_capability_grants WHERE agent_id IN (SELECT id FROM agents WHERE owner_id=$1)', [uid]);
    await db.query('DELETE FROM agents WHERE owner_id=$1', [uid]);
    await db.query('DELETE FROM users WHERE id=$1', [uid]);
  }
  await db.pool.end();
});

describe('gps-receipts library', () => {
  it('builds PHI-free evidence and a stable sha256 hash', async () => {
    const tx = (await db.query('SELECT * FROM gps_transactions WHERE id=$1', [txId])).rows[0];
    const evidence = buildEvidence(tx);
    // Structural facts only.
    expect(evidence.policyVersion).toBe(GPS_POLICY_VERSION);
    expect(evidence.totalAmount).toBe(100);
    expect(evidence.shares.provider).toBe(85);
    const str = JSON.stringify(evidence).toLowerCase();
    expect(str).not.toMatch(/name|email|diagnos|symptom/);
    // Deterministic hash.
    const h1 = crypto.createHash('sha256').update(canonicalJSON(evidence), 'utf8').digest('hex');
    const h2 = crypto.createHash('sha256').update(canonicalJSON(buildEvidence(tx)), 'utf8').digest('hex');
    expect(h1).toBe(h2);
  });

  it('recordAllocationReceipt is idempotent and verifiable', async () => {
    const tx = (await db.query('SELECT * FROM gps_transactions WHERE id=$1', [txId])).rows[0];
    const r1 = await recordAllocationReceipt(tx);
    const r2 = await recordAllocationReceipt(tx);
    expect(r1.id).toBe(r2.id);
    expect(r1.shadow).toBe(true);
    expect(r1.allocation_state).toBe('proposed');
    expect(verifyReceipt(r1)).toBe(true);
  });
});

describe('GET /api/gps/allocations/:id/explain', () => {
  it('explains a simulated allocation from evidence to a participant', async () => {
    const res = await request(app)
      .get(`/api/gps/allocations/${txId}/explain`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.receipt.policyVersion).toBe(GPS_POLICY_VERSION);
    expect(res.body.receipt.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.receipt.evidenceVerified).toBe(true);
    expect(res.body.receipt.shadow).toBe(true);
    expect(res.body.plain).toMatch(/no real money/i);
    // Six explained legs, each with a human "because".
    expect(res.body.explanation).toHaveLength(6);
    expect(res.body.explanation[0].because).toMatch(/practitioner/i);
    expect(res.body.canDispute).toBe(true);
  });

  it('locks out non-participants', async () => {
    const res = await request(app)
      .get(`/api/gps/allocations/${txId}/explain`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
  });
});

describe('dispute → resolve lifecycle', () => {
  it('lets a participant dispute; state becomes disputed and is audited', async () => {
    const res = await request(app)
      .post(`/api/gps/allocations/${txId}/dispute`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'The provider share looks wrong for this booking.' });
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('disputed');

    const rec = (await db.query(
      'SELECT * FROM gps_allocation_receipts WHERE transaction_id=$1', [txId])).rows[0];
    expect(rec.allocation_state).toBe('disputed');

    const audit = await db.query(
      `SELECT * FROM audit_logs WHERE actor_id=$1 AND action='gps.allocation.disputed'`, [patientId]);
    expect(audit.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty dispute reasons', async () => {
    const res = await request(app)
      .post(`/api/gps/allocations/${txId}/dispute`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: '' });
    expect(res.status).toBe(400);
  });

  it('admin resolves the dispute; state becomes corrected', async () => {
    const res = await request(app)
      .post(`/api/gps/allocations/${txId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution: 'Reviewed: split matches policy gps-split-v1. No correction needed.' });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('corrected');

    const d = await db.query(
      `SELECT * FROM gps_allocation_disputes WHERE receipt_id IN
         (SELECT id FROM gps_allocation_receipts WHERE transaction_id=$1)`, [txId]);
    expect(d.rows[0].status).toBe('resolved');
    expect(d.rows[0].resolution).toMatch(/Reviewed/);
  });

  it('non-admin cannot resolve', async () => {
    const res = await request(app)
      .post(`/api/gps/allocations/${txId}/resolve`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ resolution: 'trying to self-resolve' });
    expect(res.status).toBe(403);
  });
});

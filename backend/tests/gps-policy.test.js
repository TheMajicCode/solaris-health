/**
 * GPS protocol policy seam tests.
 *
 * The policy endpoint is the single source of truth for every GPS number
 * shown in the UI. These tests pin the constitutional invariants of the
 * GPS Protocol Suite v1.0 showcase:
 *   - provider ALWAYS receives 90% (9000 bps);
 *   - the GPS ecosystem envelope never exceeds the 10% cap (1000 bps);
 *   - the envelope subdivision sums exactly to the envelope;
 *   - everything is clearly marked as simulated;
 *   - the engine's legacy 6-way split derives from the same config.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const {
  getGpsPolicy, ENVELOPE_RECIPIENTS, LEGACY_COLUMN_BPS, POLICY_HASH,
} = require('../src/lib/gps/protocol-config');
const { GPS_SPLIT, computeSplit } = require('../src/lib/gps-engine');
const { GPS_POLICY_VERSION } = require('../src/lib/gps-receipts');

afterAll(async () => {
  await db.pool.end();
});

describe('GET /api/gps/policy', () => {
  it('serves the simulated protocol policy snapshot (no auth required)', async () => {
    const res = await request(app).get('/api/gps/policy');
    expect(res.status).toBe(200);
    expect(res.body.simulation).toBe(true);
    expect(res.body.providerShareBps).toBe(9000);
    expect(res.body.policy.envelopeCapBps).toBe(1000);
    expect(res.body.policy.id).toBe('gps:policy:solaris:aura-consultation:v0.1');
    expect(res.body.policy.hash).toBe(POLICY_HASH);
    expect(res.body.protocol.receiptVersion).toBe('gps-receipt/1.0');
    expect(res.body.disclosure).toMatch(/simulated/i);
  });

  it('envelope subdivision sums exactly to the envelope and respects the 10% cap', async () => {
    const res = await request(app).get('/api/gps/policy');
    const sum = res.body.envelopeRecipients.reduce((s, r) => s + r.shareBps, 0);
    expect(sum).toBe(res.body.envelopeBps);
    expect(res.body.envelopeBps).toBeLessThanOrEqual(res.body.policy.envelopeCapBps);
    expect(res.body.providerShareBps + res.body.envelopeBps).toBe(10000);
  });
});

describe('protocol config seam', () => {
  it('drives the legacy 6-way engine split (90% provider hero fact)', () => {
    expect(GPS_SPLIT.provider).toBe(0.9);
    const sum = Object.values(GPS_SPLIT).reduce((s, f) => s + f, 0);
    expect(sum).toBeCloseTo(1, 10);
    // Legacy column mapping covers the whole envelope exactly.
    const legacySum = Object.values(LEGACY_COLUMN_BPS).reduce((s, b) => s + b, 0);
    expect(legacySum).toBe(10000);
  });

  it('computeSplit gives the provider exactly 90% and conserves the total', () => {
    const split = computeSplit(200);
    expect(split.provider).toBe(180);
    const parts = split.contributor + split.infrastructure + split.treasury
      + split.software + split.userReward;
    expect(split.provider + parts).toBeCloseTo(split.total, 2);
  });

  it('receipts inherit the policy id from the config seam', () => {
    expect(GPS_POLICY_VERSION).toBe(getGpsPolicy().policy.id);
  });

  it('every envelope recipient explains what it regenerates', () => {
    for (const r of ENVELOPE_RECIPIENTS) {
      expect(r.label).toBeTruthy();
      expect(r.purpose).toBeTruthy();
      expect(r.regenerates).toBeTruthy();
      expect(r.categoryId).toMatch(/^gps:category:/);
      expect(r.recipientId).toMatch(/^gps:identity:/);
    }
  });
});

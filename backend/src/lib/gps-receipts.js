'use strict';
/**
 * gps-receipts.js — evidence-before-payment for the Generative Prosperity
 * System (Slice 8).
 *
 * Every GPS allocation gets an allocation receipt:
 *   - a canonical, PHI-free evidence document (UUIDs, amounts, fractions,
 *     timestamps only — never names or health data);
 *   - a sha256 evidence hash so the allocation can be re-verified later;
 *   - the split policy version that produced it;
 *   - a lifecycle state: proposed → disputed → corrected;
 *   - shadow = true always: these are SHADOW allocations. No real money
 *     moves, and nothing in this module can trigger settlement.
 *
 * The split policy itself lives in gps-engine.js (GPS_SPLIT) and is fully
 * visible — there are no hidden protocol royalties.
 */

const crypto = require('crypto');
const db = require('../db');
const { GPS_SPLIT } = require('./gps-engine');

/** Version tag for the split policy encoded in GPS_SPLIT (85/5/3/3/2/2). */
const GPS_POLICY_VERSION = 'gps-split-v1';

/** Stable stringify (sorted keys) so the evidence hash is deterministic. */
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/**
 * Build the canonical evidence document for a gps_transactions row.
 * Structural facts only — no names, no service descriptions, no PHI.
 */
function buildEvidence(tx) {
  return {
    kind: 'gps.allocation.evidence',
    policyVersion: GPS_POLICY_VERSION,
    transactionId: tx.id,
    bookingId: tx.booking_id || null,
    currency: tx.currency || 'USD',
    totalAmount: Number(tx.total_amount),
    shares: {
      provider: Number(tx.provider_share),
      contributor: Number(tx.contributor_share),
      infrastructure: Number(tx.infrastructure_share),
      treasury: Number(tx.treasury_share),
      software: Number(tx.software_share),
      userReward: Number(tx.user_reward_share),
    },
    policyFractions: { ...GPS_SPLIT },
    participants: {
      patientId: tx.patient_id || null,
      providerId: tx.provider_id || null,
      contributorId: tx.contributor_id || null,
    },
    transactionCreatedAt: tx.created_at ? new Date(tx.created_at).toISOString() : null,
  };
}

/**
 * Record (or return the existing) allocation receipt for a transaction.
 * Idempotent on transaction_id. Best-effort callers may catch failures —
 * a receipt failure must never break the underlying booking flow.
 */
async function recordAllocationReceipt(tx) {
  const existing = await db.query(
    'SELECT * FROM gps_allocation_receipts WHERE transaction_id=$1', [tx.id]
  );
  if (existing.rows.length) return existing.rows[0];

  const evidence = buildEvidence(tx);
  const hash = sha256(canonicalJSON(evidence));
  const ins = await db.query(
    `INSERT INTO gps_allocation_receipts (transaction_id, policy_version, evidence, evidence_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (transaction_id) DO NOTHING
     RETURNING *`,
    [tx.id, GPS_POLICY_VERSION, JSON.stringify(evidence), hash]
  );
  if (ins.rows.length) return ins.rows[0];
  const again = await db.query(
    'SELECT * FROM gps_allocation_receipts WHERE transaction_id=$1', [tx.id]
  );
  return again.rows[0];
}

/** Re-verify a receipt: recompute the hash from stored evidence. */
function verifyReceipt(receipt) {
  const evidence = typeof receipt.evidence === 'string'
    ? JSON.parse(receipt.evidence) : receipt.evidence;
  return sha256(canonicalJSON(evidence)) === receipt.evidence_hash;
}

/**
 * Explain an allocation in plain language from its evidence document.
 * Returns an array of { role, amount, pct, because } lines.
 */
function explainAllocation(evidence) {
  const e = typeof evidence === 'string' ? JSON.parse(evidence) : evidence;
  const cur = e.currency === 'USD' ? '$' : `${e.currency} `;
  const money = (n) => `${cur}${Number(n).toFixed(2)}`;
  const pct = (f) => `${Math.round(f * 1000) / 10}%`;
  const lines = [
    {
      role: 'provider',
      amount: e.shares.provider,
      pct: pct(e.policyFractions.provider),
      because: `The practitioner delivered the service, so ${pct(e.policyFractions.provider)} (${money(e.shares.provider)}) is proposed as their sovereign income.`,
    },
    {
      role: 'contributor',
      amount: e.shares.contributor,
      pct: pct(e.policyFractions.contributor),
      because: e.participants.contributorId
        ? `Someone referred this member into the ecosystem, so ${pct(e.policyFractions.contributor)} (${money(e.shares.contributor)}) is proposed for that contributor.`
        : `No referrer exists for this member, so the ${pct(e.policyFractions.contributor)} contributor share (${money(e.shares.contributor)}) stays with the platform pool.`,
    },
    {
      role: 'infrastructure',
      amount: e.shares.infrastructure,
      pct: pct(e.policyFractions.infrastructure),
      because: `Local node operators keep the network running, so ${pct(e.policyFractions.infrastructure)} (${money(e.shares.infrastructure)}) is proposed for infrastructure.`,
    },
    {
      role: 'treasury',
      amount: e.shares.treasury,
      pct: pct(e.policyFractions.treasury),
      because: `${pct(e.policyFractions.treasury)} (${money(e.shares.treasury)}) is proposed for the regenerative community treasury (health, food, education and resilience funds).`,
    },
    {
      role: 'software',
      amount: e.shares.software,
      pct: pct(e.policyFractions.software),
      because: `${pct(e.policyFractions.software)} (${money(e.shares.software)}) is proposed for software and open-source maintenance.`,
    },
    {
      role: 'userReward',
      amount: e.shares.userReward,
      pct: pct(e.policyFractions.userReward),
      because: `${pct(e.policyFractions.userReward)} (${money(e.shares.userReward)}) flows back to the member as LOVE reciprocity credits.`,
    },
  ];
  return lines;
}

module.exports = {
  GPS_POLICY_VERSION,
  buildEvidence,
  canonicalJSON,
  recordAllocationReceipt,
  verifyReceipt,
  explainAllocation,
};

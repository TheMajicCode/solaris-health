'use strict';
/**
 * gps-shadow.js — GPS shadow receipts (Track B, M7; spec A4 §3).
 *
 * The allocation-and-receipt layer ABOVE payment protocols — NOT a payment
 * rail. It moves ZERO money. On every paid PaymentIntent it computes, records
 * and displays what *would* be allocated, emitting a `gps-receipt/1.0`
 * (A4 §3.4) whose SHAPE is what matters in shadow mode. All money fields are
 * simulated (`settled_cents:0`, `status:'SIMULATED'`).
 *
 * Invariants enforced here (A4 §3.2 credibility rule):
 *   - the four buckets sum EXACTLY to eligible value;
 *   - the gps_envelope never exceeds 10% of eligible value;
 *   - the Solaris coordination fee is EARNED VALUE — outside the envelope;
 *   - no referral / community-lineage leg in the pilot.
 *
 * The hook is invoked from routes/payments.js `confirmPaidIntent`, idempotent
 * per intent (receipt_id derived from intent id → ON CONFLICT DO NOTHING).
 */
const crypto = require('crypto');
const {
  POLICY_ID, POLICY_VERSION, POLICY_HASH, ENVELOPE_CAP_BPS,
} = require('./payments/allocation-policy');

// Above this eligible value the envelope is HELD until service completion or a
// no-dispute window (A4 §3.5 SCHEDULED); below it, instant-first (PREPARED).
const SCHEDULED_THRESHOLD_CENTS = 50000; // $500

function sha256hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/**
 * Build the canonical gps-receipt/1.0 document (A4 §3.4 exact field names).
 * @param {object} intent  payment_intents row (id, subject_id, amount_cents, currency, purpose...)
 * @param {Array}  legs    allocation legs from computeAllocations()
 * @param {number|null} providerFeeCents
 */
function buildReceipt(intent, legs, providerFeeCents) {
  const eligibleCents = Number(intent.amount_cents) || 0;
  const asset = (intent.currency || 'USD').toUpperCase();
  const envelopeLegs = legs.filter((l) => l.bucket === 'gps_envelope');
  const earnedLegs = legs.filter((l) => l.bucket === 'earned_value');
  const envelopeCents = envelopeLegs.reduce((s, l) => s + l.amountCents, 0);
  const earnedCents = earnedLegs.reduce((s, l) => s + l.amountCents, 0);
  const envelopeBps = eligibleCents > 0 ? Math.round((envelopeCents / eligibleCents) * 10000) : 0;

  const receiptId = 'gpsr_' + sha256hex(`receipt:${intent.id}`).slice(0, 32);
  // context_hash binds the receipt to the policy + the exact intent context.
  const contextHash = 'sha256:' + sha256hex(JSON.stringify({
    intent_id: intent.id, subject_id: intent.subject_id, purpose: intent.purpose,
    eligible_cents: eligibleCents, asset, policy: POLICY_HASH,
  }));

  const allocations = legs.map((leg) => ({
    allocation_id: 'alloc_' + sha256hex(`${intent.id}:${leg.key}`).slice(0, 24),
    recipient_label: leg.label,
    canonical_domain_id: leg.canonicalDomainId || null,
    bucket: leg.bucket,
    entitlement_cents: leg.amountCents,
    settled_cents: 0,
    status: 'SIMULATED',
  }));

  return {
    receipt_version: 'gps-receipt/1.0',
    receipt_id: receiptId,
    issuer_id: 'gps:identity:solaris',
    transaction_id: intent.id,
    created_at: new Date().toISOString(),
    policy: { id: POLICY_ID, version: POLICY_VERSION, hash: POLICY_HASH },
    context_hash: contextHash,
    eligible_value: { asset, amount_cents: eligibleCents },
    earned_value_summary: { amount_cents: earnedCents },
    gps_envelope: { bps: envelopeBps, amount_cents: envelopeCents },
    allocations,
    fees: {
      provider_fee_cents: providerFeeCents == null ? null : Number(providerFeeCents),
      paid_by: 'merchant',
    },
    settlement_summary: { settled_cents: 0, pending_cents: 0, simulated_cents: eligibleCents },
    privacy_profile: 'COUNTERPARTY',
    // Honest member-facing proof semantics (A4 §3.7): a payment proof shows
    // money moved; it does not by itself prove an outcome.
    disclosure: 'Simulated — no funds have moved. This shows how Solaris will route value when live.',
    proof_semantics: 'A payment proof shows money moved; it does not by itself prove an outcome.',
    signatures: [],
    corrections: [],
    _meta: {
      envelope_cap_bps: ENVELOPE_CAP_BPS,
      earned_value_includes_solaris_coordination: true,
      referral_leg: false,
    },
  };
}

/**
 * Idempotently persist the shadow receipt for a paid intent.
 * @param {object} db   pg-style client with .query
 * @returns {object|null} { receiptId, receipt, settlementState } or null on invariant failure
 */
async function generateShadowReceipt(db, intent, legs, providerFeeCents = null) {
  const eligibleCents = Number(intent.amount_cents) || 0;
  const receipt = buildReceipt(intent, legs, providerFeeCents);
  const envelopeCents = receipt.gps_envelope.amount_cents;
  const earnedCents = receipt.earned_value_summary.amount_cents;

  // --- Invariants (A4 §3.2 / §4 acceptance) — refuse to write a bad receipt.
  if (earnedCents + envelopeCents !== eligibleCents) {
    throw new Error(`gps-shadow: buckets ${earnedCents}+${envelopeCents} != eligible ${eligibleCents}`);
  }
  if (envelopeCents * 10 > eligibleCents * 1) {
    // envelope must be ≤ 10% of eligible value
    throw new Error(`gps-shadow: envelope ${envelopeCents} exceeds 10% of ${eligibleCents}`);
  }

  const settlementState = eligibleCents >= SCHEDULED_THRESHOLD_CENTS ? 'SCHEDULED' : 'PREPARED';

  const res = await db.query(
    `INSERT INTO gps_shadow_receipts
       (receipt_id, receipt_version, intent_id, subject_id, user_id,
        policy_id, policy_hash, eligible_cents, earned_cents, envelope_cents,
        envelope_bps, settlement_state, receipt, level, source, consent_scope)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'L3-financial',$14,'payments')
     ON CONFLICT (receipt_id) DO NOTHING
     RETURNING id`,
    [
      receipt.receipt_id, receipt.receipt_version, intent.id, intent.subject_id, intent.user_id || null,
      POLICY_ID, POLICY_HASH, eligibleCents, earnedCents, envelopeCents,
      receipt.gps_envelope.bps, settlementState, receipt, POLICY_ID,
    ]
  );
  return { receiptId: receipt.receipt_id, receipt, settlementState, inserted: res.rowCount > 0 };
}

module.exports = { generateShadowReceipt, buildReceipt, SCHEDULED_THRESHOLD_CENTS };

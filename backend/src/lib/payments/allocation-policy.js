'use strict';
/**
 * allocation-policy.js — the GPS v0.1 fixed table for the Aura consultation
 * pilot (spec A4 §3.2/§3.3). A PLAIN TABLE, not a score: two people reading it
 * compute the same result (the exit test). The nine scoring factors are
 * recorded on contribution events elsewhere but MUST NOT affect allocation
 * until a ratified v0.2.
 *
 * The four buckets (A4 §3.2), all shares of ELIGIBLE VALUE:
 *
 *   earned_value  — Aura clinic (service) + Solaris coordination
 *   gps_envelope  — third-party + regenerative recipients, ≤ 10% of eligible
 *   obligation    — taxes / pass-through (0 in the pilot; seam kept)
 *   voluntary     — separately stated (0 in the pilot; seam kept)
 *
 * CREDIBILITY RULE: the Solaris coordination fee is EARNED VALUE — OUTSIDE the
 * 10% envelope. The envelope contains only third-party and regenerative
 * recipients, so "10% nourishes people and systems beyond the clinic and
 * beyond Solaris" is literally true. Do not blend them.
 *
 * No referral / community-lineage leg in the first pilot (highest legal risk;
 * waits for the anti-pyramid + tax memo).
 *
 * Amounts are integer cents; largest-remainder rounding keeps the sum exact.
 */
const crypto = require('crypto');

const POLICY_ID = 'gps:policy:aura-consultation:v0.1';
const POLICY_VERSION = '0.1';

// share_bps are basis points of eligible value (10000 = 100%).
const TABLE = [
  { key: 'aura_service',      bucket: 'earned_value', label: 'Aura clinic (service)',              shareBps: 8600, canonicalDomainId: null },
  { key: 'solaris_coord',     bucket: 'earned_value', label: 'Solaris coordination',              shareBps: 400,  canonicalDomainId: null },
  { key: 'user_sovereignty',  bucket: 'gps_envelope', label: 'User sovereignty savings',          shareBps: 200,  canonicalDomainId: 'gps:domain:user_sovereignty' },
  { key: 'regenerative',      bucket: 'gps_envelope', label: 'Regenerative health fund',          shareBps: 200,  canonicalDomainId: 'gps:domain:regenerative_health' },
  { key: 'infrastructure',    bucket: 'gps_envelope', label: 'Infrastructure & open technology',  shareBps: 300,  canonicalDomainId: 'gps:domain:sovereign_infrastructure' },
  { key: 'local_community',   bucket: 'gps_envelope', label: 'Local community / chosen cause',    shareBps: 300,  canonicalDomainId: 'gps:domain:local_public_goods' },
];

const ENVELOPE_CAP_BPS = 1000; // constitutional 10% maximum of eligible value

/** Deterministic policy hash — binds every receipt to the exact table. */
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
const POLICY_HASH = 'sha256:' + crypto.createHash('sha256')
  .update(canonical({ id: POLICY_ID, version: POLICY_VERSION, table: TABLE, cap: ENVELOPE_CAP_BPS }))
  .digest('hex');

/**
 * Compute allocations for an eligible value (cents). Largest-remainder
 * rounding so the per-leg cents sum EXACTLY to eligibleCents.
 * @returns {{ legs: Array, envelopeBps:number, envelopeCents:number,
 *             earnedValueCents:number, eligibleCents:number }}
 */
function computeAllocations(eligibleCents) {
  const gross = Math.max(0, Math.round(Number(eligibleCents) || 0));
  const raw = TABLE.map((r) => ({ ...r, exact: (gross * r.shareBps) / 10000 }));
  const floored = raw.map((r) => ({ ...r, amountCents: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let distributed = floored.reduce((s, r) => s + r.amountCents, 0);
  let remainder = gross - distributed;
  // hand out the leftover cents to the largest fractional remainders first
  const order = [...floored].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < order.length && remainder > 0; i++, remainder--) order[i].amountCents += 1;
  const legs = floored.map((r) => ({
    key: r.key,
    bucket: r.bucket,
    label: r.label,
    shareBps: r.shareBps,
    amountCents: r.amountCents,
    canonicalDomainId: r.canonicalDomainId,
    settlementStatus: 'SIMULATED',
  }));
  const envelopeCents = legs.filter((l) => l.bucket === 'gps_envelope').reduce((s, l) => s + l.amountCents, 0);
  const earnedValueCents = legs.filter((l) => l.bucket === 'earned_value').reduce((s, l) => s + l.amountCents, 0);
  const envelopeBps = TABLE.filter((r) => r.bucket === 'gps_envelope').reduce((s, r) => s + r.shareBps, 0);
  return { legs, envelopeBps, envelopeCents, earnedValueCents, eligibleCents: gross };
}

module.exports = {
  POLICY_ID, POLICY_VERSION, POLICY_HASH, TABLE, ENVELOPE_CAP_BPS,
  computeAllocations, canonical,
};

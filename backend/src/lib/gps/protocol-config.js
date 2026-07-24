'use strict';
/**
 * protocol-config.js — single source of truth for the Solaris GPS showcase.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  MOCK PROTOCOL ADAPTER (hexagonal port)
 * ─────────────────────────────────────────────────────────────────────────
 * GPS ("Global Prosperous Split") is an open protocol — "a Lightning-native,
 * identity-aware and agent-ready protocol for regenerative value routing"
 * (GPS Protocol Suite v1.0, Working Draft, July 2026). Solaris runs it in
 * SHADOW MODE: every number below is simulated and illustrative; no real
 * money, tokens or Lightning payments move.
 *
 * This module is the *port*. Today it returns a static policy snapshot (the
 * suite's Aura pilot launch profile, whitepaper §19.1). When a real GPS
 * implementation exists, swap the body of `getGpsPolicy()` for an adapter
 * that resolves the policy from a live GPS policy resolver / registry —
 * everything downstream (gps-engine, gps-receipts, /api/gps/policy, the
 * frontend `src/lib/gps-policy.js`) consumes only the shape returned here.
 *
 * Protocol facts encoded below (see docs/GPS_PROTOCOL_NOTES.md):
 *  - The GPS ecosystem envelope MUST NOT exceed 10% of eligible value
 *    (Constitution §5, `envelope_cap_bps: 1000`). The provider always
 *    receives the remaining 90% under the Solaris default profile.
 *  - Percentages are stored as integer basis points, never floating-point
 *    money (Terminology §4). 100 bps = 1%.
 *  - Identity sits above replaceable payment endpoints: the Solaris ID holds
 *    the GPS configuration; recipients default to Solaris-governed accounts
 *    until the user sets their own end address (Lightning today, more rails
 *    later).
 */

const crypto = require('crypto');

/** Stable stringify (sorted keys) → deterministic policy hash. */
function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJSON(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** Protocol metadata (from GPS Protocol Suite v1.0). */
const PROTOCOL = {
  name: 'GPS — Global Prosperous Split',
  tagline: 'A Lightning-native, identity-aware and agent-ready protocol for regenerative value routing.',
  suiteVersion: '1.0',
  status: 'Working Draft — simulated in Solaris (shadow mode)',
  receiptVersion: 'gps-receipt/1.0',
  openProtocol: true,
};

/** The exact allocation policy this showcase simulates. */
const POLICY = {
  id: 'gps:policy:solaris:aura-consultation:v0.1',
  version: '0.1',
  algorithm: 'gps-score-v0.1',
  envelopeCapBps: 1000, // constitutional maximum: 10% of eligible value
  rounding: 'largest_remainder',
};

/** Provider earned-value share — the hero fact: 90%, always. */
const PROVIDER_SHARE_BPS = 9000;

/**
 * The 10% GPS ecosystem envelope, subdivided per the suite's Aura pilot
 * launch profile (whitepaper §19.1 — "an illustrative launch profile, not
 * the universal GPS standard"). share_bps are of ELIGIBLE VALUE and sum to
 * exactly 1000 (= the envelope). Recipients are Solaris defaults until the
 * user sets their own end address.
 */
const ENVELOPE_RECIPIENTS = [
  {
    key: 'solaris_coordination',
    shareBps: 400,
    label: 'Solaris coordination',
    categoryId: 'gps:category:open_technology',
    recipientId: 'gps:identity:solaris',
    purpose: 'Journey coordination, support, software and protocol operations.',
    regenerates: 'The people and systems that coordinate your care journey.',
  },
  {
    key: 'regenerative_health',
    shareBps: 150,
    label: 'Regenerative health',
    categoryId: 'gps:category:regenerative_health',
    recipientId: 'gps:identity:solaris:health-fund',
    purpose: 'Prevention and patient assistance.',
    regenerates: 'Preventive care and assistance for patients who need it.',
  },
  {
    key: 'referral_lineage',
    shareBps: 100,
    label: 'Referral & community lineage',
    categoryId: 'gps:category:referral_lineage',
    recipientId: 'gps:identity:solaris:referrer-pool',
    purpose: 'Verified onboarding, education and community lineage.',
    regenerates: 'The people who welcomed you into the ecosystem.',
  },
  {
    key: 'user_sovereignty',
    shareBps: 100,
    label: 'User sovereignty',
    categoryId: 'gps:category:user_sovereignty',
    recipientId: 'gps:identity:solaris:user-passport',
    purpose: 'Savings/reward in the user passport.',
    regenerates: 'Your own savings and rewards — value flows back to you.',
  },
  {
    key: 'infrastructure_open_tech',
    shareBps: 100,
    label: 'Infrastructure & open technology',
    categoryId: 'gps:category:sovereign_infrastructure',
    recipientId: 'gps:identity:solaris:infra-commons',
    purpose: 'Nodes, open-source software and the protocol commons.',
    regenerates: 'The open rails everyone rides on — nodes, code, security.',
  },
  {
    key: 'local_community_cause',
    shareBps: 100,
    label: 'Local community / chosen cause',
    categoryId: 'gps:category:local_public_goods',
    recipientId: 'gps:identity:solaris:community-fund',
    purpose: 'Place-based public goods or a user-selected cause.',
    regenerates: 'The place you live in — or a cause you choose.',
  },
  {
    key: 'education_intelligence',
    shareBps: 50,
    label: 'Education & intelligence',
    categoryId: 'gps:category:education',
    recipientId: 'gps:identity:solaris:education-fund',
    purpose: 'Education, LUCA and the knowledge commons.',
    regenerates: 'Learning and shared intelligence for the whole ecosystem.',
  },
];

/**
 * Mapping of the 8 protocol shares onto the 6 legacy gps_transactions
 * columns (additive — the DB schema is unchanged):
 *
 *   provider (9000)  ← provider earned value
 *   contributor (100)← referral_lineage
 *   infrastructure (100) ← infrastructure_open_tech
 *   treasury (250)   ← regenerative_health (150) + local_community_cause (100)
 *   software (450)   ← solaris_coordination (400) + education_intelligence (50)
 *   userReward (100) ← user_sovereignty
 *
 * Sum = 10000 bps exactly.
 */
const LEGACY_COLUMN_BPS = {
  provider: PROVIDER_SHARE_BPS,
  contributor: 100,
  infrastructure: 100,
  treasury: 250,
  software: 450,
  userReward: 100,
};

/** Settlement semantics (Settlement & Failure Policy). */
const SETTLEMENT = {
  primaryRail: 'bitcoin_lightning',
  mode: 'instant_first',
  failureState: 'recipient_owned_pending',
  futureRails: ['spark', 'taproot_assets'],
  states: ['PREPARED', 'PRIMARY_RECEIVED', 'SETTLED', 'PENDING_RETRY', 'REFUNDED', 'DISPUTED'],
};

/** Identity-first configuration surface. */
const IDENTITY = {
  scheme: 'solaris_id',
  principle: 'Identity is stable above replaceable payment endpoints.',
  endAddress: {
    current: 'solaris_default',
    label: 'Solaris default — set your own end address (coming soon)',
    railsToday: ['lightning_address'],
    railsLater: ['nwc', 'spark'],
  },
};

/** Deterministic hash of the allocation rules (binds receipts to policy). */
const POLICY_HASH = sha256(canonicalJSON({
  policy: POLICY, providerShareBps: PROVIDER_SHARE_BPS, envelope: ENVELOPE_RECIPIENTS,
}));

/**
 * Return the full policy snapshot consumed by the engine, receipts, the
 * /api/gps/policy endpoint and the frontend. ← REAL ADAPTER PLUGS IN HERE.
 */
function getGpsPolicy() {
  return {
    simulation: true,
    protocol: PROTOCOL,
    policy: { ...POLICY, hash: POLICY_HASH },
    providerShareBps: PROVIDER_SHARE_BPS,
    envelopeBps: ENVELOPE_RECIPIENTS.reduce((s, r) => s + r.shareBps, 0),
    envelopeRecipients: ENVELOPE_RECIPIENTS,
    legacyColumnBps: LEGACY_COLUMN_BPS,
    settlement: SETTLEMENT,
    identity: IDENTITY,
    disclosure: 'Simulated — illustrative values. GPS runs in shadow mode: no real money moves.',
  };
}

/** Legacy 6-way fractions (sum to 1.0) derived from LEGACY_COLUMN_BPS. */
function getLegacySplitFractions() {
  const out = {};
  for (const [k, bps] of Object.entries(LEGACY_COLUMN_BPS)) out[k] = bps / 10000;
  return out;
}

module.exports = {
  PROTOCOL,
  POLICY,
  POLICY_HASH,
  PROVIDER_SHARE_BPS,
  ENVELOPE_RECIPIENTS,
  LEGACY_COLUMN_BPS,
  SETTLEMENT,
  IDENTITY,
  getGpsPolicy,
  getLegacySplitFractions,
  canonicalJSON,
};

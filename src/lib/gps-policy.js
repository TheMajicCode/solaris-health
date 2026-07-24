/**
 * gps-policy.js — frontend seam for the GPS (Global Prosperous Split)
 * protocol policy. Single source of truth for every GPS number, label and
 * recipient shown in the UI.
 *
 * The live snapshot comes from GET /api/gps/policy (served by the backend's
 * mock protocol adapter, backend/src/lib/gps/protocol-config.js). The
 * STATIC_GPS_POLICY below is a byte-compatible fallback so the showcase
 * renders instantly and offline (PWA). Both encode the GPS Protocol Suite
 * v1.0 Aura pilot profile: provider ALWAYS receives 90%; the GPS ecosystem
 * envelope is capped at 10% of eligible value (1000 bps). Everything is
 * simulated — no real money moves.
 */

import { api } from './api';

/** Static fallback — mirrors backend protocol-config.js exactly. */
export const STATIC_GPS_POLICY = {
  simulation: true,
  protocol: {
    name: 'GPS — Global Prosperous Split',
    tagline: 'A Lightning-native, identity-aware and agent-ready protocol for regenerative value routing.',
    suiteVersion: '1.0',
    status: 'Working Draft — simulated in Solaris (shadow mode)',
    receiptVersion: 'gps-receipt/1.0',
    openProtocol: true,
  },
  policy: {
    id: 'gps:policy:solaris:aura-consultation:v0.1',
    version: '0.1',
    algorithm: 'gps-score-v0.1',
    envelopeCapBps: 1000,
    rounding: 'largest_remainder',
    hash: null, // filled from the live endpoint when available
  },
  providerShareBps: 9000,
  envelopeBps: 1000,
  envelopeRecipients: [
    {
      key: 'solaris_coordination', shareBps: 400, label: 'Solaris coordination',
      categoryId: 'gps:category:open_technology', recipientId: 'gps:identity:solaris',
      purpose: 'Journey coordination, support, software and protocol operations.',
      regenerates: 'The people and systems that coordinate your care journey.',
    },
    {
      key: 'regenerative_health', shareBps: 150, label: 'Regenerative health',
      categoryId: 'gps:category:regenerative_health', recipientId: 'gps:identity:solaris:health-fund',
      purpose: 'Prevention and patient assistance.',
      regenerates: 'Preventive care and assistance for patients who need it.',
    },
    {
      key: 'referral_lineage', shareBps: 100, label: 'Referral & community lineage',
      categoryId: 'gps:category:referral_lineage', recipientId: 'gps:identity:solaris:referrer-pool',
      purpose: 'Verified onboarding, education and community lineage.',
      regenerates: 'The people who welcomed you into the ecosystem.',
    },
    {
      key: 'user_sovereignty', shareBps: 100, label: 'User sovereignty',
      categoryId: 'gps:category:user_sovereignty', recipientId: 'gps:identity:solaris:user-passport',
      purpose: 'Savings/reward in the user passport.',
      regenerates: 'Your own savings and rewards — value flows back to you.',
    },
    {
      key: 'infrastructure_open_tech', shareBps: 100, label: 'Infrastructure & open technology',
      categoryId: 'gps:category:sovereign_infrastructure', recipientId: 'gps:identity:solaris:infra-commons',
      purpose: 'Nodes, open-source software and the protocol commons.',
      regenerates: 'The open rails everyone rides on — nodes, code, security.',
    },
    {
      key: 'local_community_cause', shareBps: 100, label: 'Local community / chosen cause',
      categoryId: 'gps:category:local_public_goods', recipientId: 'gps:identity:solaris:community-fund',
      purpose: 'Place-based public goods or a user-selected cause.',
      regenerates: 'The place you live in — or a cause you choose.',
    },
    {
      key: 'education_intelligence', shareBps: 50, label: 'Education & intelligence',
      categoryId: 'gps:category:education', recipientId: 'gps:identity:solaris:education-fund',
      purpose: 'Education, LUCA and the knowledge commons.',
      regenerates: 'Learning and shared intelligence for the whole ecosystem.',
    },
  ],
  legacyColumnBps: {
    provider: 9000, contributor: 100, infrastructure: 100,
    treasury: 250, software: 450, userReward: 100,
  },
  settlement: {
    primaryRail: 'bitcoin_lightning',
    mode: 'instant_first',
    failureState: 'recipient_owned_pending',
    futureRails: ['spark', 'taproot_assets'],
    states: ['PREPARED', 'PRIMARY_RECEIVED', 'SETTLED', 'PENDING_RETRY', 'REFUNDED', 'DISPUTED'],
  },
  identity: {
    scheme: 'solaris_id',
    principle: 'Identity is stable above replaceable payment endpoints.',
    endAddress: {
      current: 'solaris_default',
      label: 'Solaris default — set your own end address (coming soon)',
      railsToday: ['lightning_address'],
      railsLater: ['nwc', 'spark'],
    },
  },
  disclosure: 'Simulated — illustrative values. GPS runs in shadow mode: no real money moves.',
};

let cachedPolicy = null;
let inflight = null;

/**
 * Load the live GPS policy snapshot (cached for the session). Falls back to
 * STATIC_GPS_POLICY when the API is unreachable, so the showcase always
 * renders. Never throws.
 */
export function loadGpsPolicy() {
  if (cachedPolicy) return Promise.resolve(cachedPolicy);
  if (inflight) return inflight;
  inflight = api.request('/gps/policy')
    .then((data) => {
      // Sanity-check the shape before trusting it.
      if (data && data.providerShareBps && Array.isArray(data.envelopeRecipients)) {
        cachedPolicy = data;
      } else {
        cachedPolicy = STATIC_GPS_POLICY;
      }
      return cachedPolicy;
    })
    .catch(() => {
      cachedPolicy = STATIC_GPS_POLICY;
      return cachedPolicy;
    })
    .finally(() => { inflight = null; });
  return inflight;
}

/** Format basis points as a human percentage: 9000 → "90%", 150 → "1.5%". */
export function bpsToPercent(bps) {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1).replace(/\.0$/, '')}%`;
}

/**
 * Split an amount across the policy exactly (largest-remainder rounding in
 * cents, per Terminology §4 — never floating-point money). Returns
 * { provider, envelope, parts: [{...recipient, amount}] } where all values
 * are in the same currency unit as `amount` and sum exactly to it.
 */
export function splitAmount(amount, policy = STATIC_GPS_POLICY) {
  const totalCents = Math.round((Number(amount) || 0) * 100);
  const legs = [
    { key: 'provider', shareBps: policy.providerShareBps },
    ...policy.envelopeRecipients,
  ].map((r) => {
    const exact = (totalCents * r.shareBps) / 10000;
    return { ...r, cents: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  const allocated = legs.reduce((s, l) => s + l.cents, 0);
  let remainder = totalCents - allocated;
  const order = [...legs].sort((a, b) => b.frac - a.frac);
  for (let i = 0; remainder > 0; i += 1, remainder -= 1) order[i % order.length].cents += 1;
  const parts = legs.map(({ cents, frac: _frac, ...rest }) => ({ ...rest, amount: cents / 100 }));
  const provider = parts.find((p) => p.key === 'provider');
  const envelopeParts = parts.filter((p) => p.key !== 'provider');
  return {
    total: totalCents / 100,
    provider,
    envelope: envelopeParts.reduce((s, p) => s + p.amount, 0),
    parts: envelopeParts,
  };
}

export default { STATIC_GPS_POLICY, loadGpsPolicy, bpsToPercent, splitAmount };

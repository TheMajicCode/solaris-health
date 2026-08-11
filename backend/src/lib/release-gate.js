'use strict';
/**
 * release-gate.js — single source of truth for the Beta V1 booking-only gate
 * (S1B-R2). Online payments are HARD-DISABLED for this release. Both the payment
 * adapter factory and the payment routes consume `onlinePaymentsEnabled()`; when
 * it returns false the Wompi branch is code-unreachable and checkout/webhook
 * return the typed disabled response before any provider call or DB write.
 *
 * This is NOT a configuration flip. For Beta the function returns a hard-coded
 * `false` constant: even `ONLINE_PAYMENTS_ENABLED=true` in the environment CANNOT
 * turn online payments on. Re-enabling requires a new L2 contract, explicit Majd
 * authorization, a code change, tests, and release review (§15) — never config
 * alone. The env var is read only for documentation/telemetry parity; a false,
 * missing, malformed, or unknown value all resolve to disabled, and a truthy
 * value is still overridden by the Beta constant below.
 */

// Hard-disabled constant for Beta V1. Do not wire this to configuration.
const BETA_ONLINE_PAYMENTS_HARD_DISABLED = true;

/**
 * @returns {boolean} true only if online payments are enabled for this release.
 *   In Beta this is ALWAYS false — config cannot flip it on.
 */
function onlinePaymentsEnabled() {
  if (BETA_ONLINE_PAYMENTS_HARD_DISABLED) return false;
  // Unreachable in Beta. Retained to document the intended future contract:
  // even here, only an explicit "true" enables; anything else stays disabled.
  const raw = String((process.env.ONLINE_PAYMENTS_ENABLED || '')).trim().toLowerCase();
  return raw === 'true';
}

module.exports = { onlinePaymentsEnabled };

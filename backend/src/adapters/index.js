'use strict';
/**
 * Payment adapter factory — the composition edge (spec A4 §2.2).
 *
 * The domain/route asks for a PaymentProvider; this factory decides which
 * concrete adapter to inject based on the environment. Wompi when configured,
 * otherwise the Mock adapter (tests, local dev, and graceful degradation so a
 * missing sandbox key never 500s the booking flow).
 *
 * PAYMENT_PROVIDER env can force a choice ('wompi' | 'mock').
 */
const { WompiAdapter } = require('./WompiAdapter');
const { MockPaymentAdapter } = require('./MockPaymentAdapter');
const { onlinePaymentsEnabled } = require('../lib/release-gate');

let cached = null;

function getPaymentProvider(env = process.env) {
  if (cached && !env.__forceRebuild) return cached;
  // Beta booking-only gate (S1B-R2): online payments are hard-disabled. The
  // Wompi branch below is code-unreachable while the shared release gate is
  // false — even with Wompi credentials, PAYMENT_PROVIDER='wompi', and
  // ONLINE_PAYMENTS_ENABLED=true the factory always returns the Mock adapter.
  if (!onlinePaymentsEnabled()) {
    cached = new MockPaymentAdapter({ eventsSecret: env.WOMPI_EVENTS_SECRET });
    return cached;
  }
  const choice = (env.PAYMENT_PROVIDER || '').toLowerCase();
  if (choice === 'mock') {
    cached = new MockPaymentAdapter({ eventsSecret: env.WOMPI_EVENTS_SECRET });
    return cached;
  }
  const wompi = new WompiAdapter(env);
  if (choice === 'wompi' || wompi.configured) {
    cached = wompi;
    return cached;
  }
  // No live credentials -> mock adapter (safe default; nothing settles anyway).
  cached = new MockPaymentAdapter({ eventsSecret: env.WOMPI_EVENTS_SECRET });
  return cached;
}

// test seam
function _resetProviderCache() { cached = null; }

module.exports = { getPaymentProvider, _resetProviderCache };

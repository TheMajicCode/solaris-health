'use strict';
/**
 * PaymentProvider — the portable core port (spec A4 §2.2).
 *
 * The domain never talks to Wompi (or any rail) directly. It talks to this
 * port; a concrete adapter is injected at the edge. "Own the record, rent the
 * rail" — Solaris owns the intent/allocation/receipt information; the adapter
 * owns the money movement. Milestone 6 ships exactly one live adapter
 * (WompiAdapter) plus a MockPaymentAdapter for tests/local dev. Everything
 * else is a documented stub.
 *
 * Contract (all methods async):
 *
 *   createCheckout({ intentId, amount, currency, description, returnUrl, metadata })
 *     -> { providerRef, checkoutUrl }
 *   verifyWebhook(rawBody, headers)   -> { valid: boolean, event: object|null }
 *   getStatus(providerRef)            -> { status, paidAt, providerFee }
 *   refund(providerRef, amount, reason) -> { refundRef, status }
 *
 * `amount` is always an integer number of minor units (cents). No adapter ever
 * stores card data — hosted checkout only.
 */

class PaymentProvider {
  /* eslint-disable no-unused-vars */
  async createCheckout(params) {
    throw new Error('PaymentProvider.createCheckout not implemented');
  }
  async verifyWebhook(rawBody, headers) {
    throw new Error('PaymentProvider.verifyWebhook not implemented');
  }
  async getStatus(providerRef) {
    throw new Error('PaymentProvider.getStatus not implemented');
  }
  async refund(providerRef, amount, reason) {
    throw new Error('PaymentProvider.refund not implemented');
  }
  /* eslint-enable no-unused-vars */
}

module.exports = { PaymentProvider };

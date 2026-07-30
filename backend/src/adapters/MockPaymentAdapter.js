'use strict';
/**
 * MockPaymentAdapter — the offline PaymentProvider used by tests and local dev
 * (spec A4 §2.2). No network, deterministic. It fabricates a checkout URL and
 * a provider ref, and can produce a well-formed signed webhook event so the
 * webhook path is testable end-to-end without Wompi.
 */
const crypto = require('crypto');
const { PaymentProvider } = require('../ports/PaymentProvider');

class MockPaymentAdapter extends PaymentProvider {
  constructor(opts = {}) {
    super();
    this.secret = opts.eventsSecret || 'mock_events_secret';
    this.name = 'mock';
  }

  async createCheckout({ intentId, amount, currency, returnUrl }) {
    const providerRef = 'mock_txn_' + crypto.randomBytes(8).toString('hex');
    const url = `https://checkout.mock.local/pay/${providerRef}` +
      `?amount=${amount}&currency=${currency || 'USD'}` +
      (returnUrl ? `&redirect=${encodeURIComponent(returnUrl)}` : '');
    return { providerRef, checkoutUrl: url };
  }

  /**
   * Build a signed TRANSACTION.UPDATED event body the way Wompi would, so tests
   * can POST it to the webhook and exercise signature verification.
   */
  buildSignedEvent({ providerRef, reference, status = 'APPROVED', amountCents, currency = 'USD' }) {
    const timestamp = Math.floor(Date.now() / 1000);
    const data = {
      transaction: {
        id: providerRef,
        reference,
        status,
        amount_in_cents: amountCents,
        currency,
        payment_method_type: 'CARD',
      },
    };
    // Wompi checksum = SHA256( concat(values of signature.properties) + timestamp + secret )
    const properties = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
    const concatenated = properties
      .map((p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), data))
      .join('') + timestamp + this.secret;
    const checksum = crypto.createHash('sha256').update(concatenated).digest('hex');
    return {
      event: 'transaction.updated',
      data,
      sent_at: new Date(timestamp * 1000).toISOString(),
      timestamp,
      signature: { properties, checksum },
    };
  }

  async verifyWebhook(rawBody, _headers) {
    let body;
    try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody; }
    catch { return { valid: false, event: null }; }
    const sig = body && body.signature;
    if (!sig || !Array.isArray(sig.properties) || !sig.checksum) return { valid: false, event: null };
    const concatenated = sig.properties
      .map((p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), body.data))
      .join('') + body.timestamp + this.secret;
    const expected = crypto.createHash('sha256').update(concatenated).digest('hex');
    const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig.checksum)));
    return { valid, event: valid ? body : null };
  }

  async getStatus(providerRef) {
    return { status: 'APPROVED', paidAt: new Date().toISOString(), providerFee: 0, providerRef };
  }

  async refund(providerRef, amount, reason) {
    return { refundRef: 'mock_refund_' + crypto.randomBytes(6).toString('hex'), status: 'PENDING', providerRef, amount, reason };
  }
}

module.exports = { MockPaymentAdapter };

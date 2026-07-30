'use strict';
/**
 * WompiAdapter — the ONLY live PaymentProvider adapter (spec A4 §2.1/2.2).
 *
 * Wompi is the payment processor and Aura is the merchant of record; Solaris
 * never holds funds and never stores card data (hosted Web Checkout only).
 *
 * Credentials come from the environment ONLY (never hardcoded):
 *   WOMPI_PUBLIC_KEY      — pub_test_… (sandbox)
 *   WOMPI_PRIVATE_KEY     — prv_test_… (sandbox; used for status/refund API)
 *   WOMPI_EVENTS_SECRET   — webhook checksum secret
 *   WOMPI_INTEGRITY_SECRET— (optional) signature:integrity for Web Checkout
 *   WOMPI_BASE_URL        — defaults to sandbox https://sandbox.wompi.co/v1
 *   WOMPI_CHECKOUT_URL    — defaults to https://checkout.wompi.co/p/
 *
 * Web Checkout redirect (no server call needed to build it): Wompi renders a
 * hosted page from query params; the integrity signature is
 *   SHA256(reference + amountInCents + currency + integritySecret).
 * The webhook checksum is
 *   SHA256(concat(values at signature.properties) + timestamp + eventsSecret).
 */
const crypto = require('crypto');
const { PaymentProvider } = require('../ports/PaymentProvider');

class WompiAdapter extends PaymentProvider {
  constructor(env = process.env) {
    super();
    this.publicKey = env.WOMPI_PUBLIC_KEY || '';
    this.privateKey = env.WOMPI_PRIVATE_KEY || '';
    this.eventsSecret = env.WOMPI_EVENTS_SECRET || '';
    this.integritySecret = env.WOMPI_INTEGRITY_SECRET || '';
    this.baseUrl = (env.WOMPI_BASE_URL || 'https://sandbox.wompi.co/v1').replace(/\/$/, '');
    this.checkoutUrl = env.WOMPI_CHECKOUT_URL || 'https://checkout.wompi.co/p/';
    this.name = 'wompi';
  }

  get configured() {
    return Boolean(this.publicKey && this.eventsSecret);
  }

  /**
   * Build the hosted Web Checkout redirect URL. `reference` is the Solaris
   * intent id — the webhook echoes it back so we can reconcile.
   */
  async createCheckout({ intentId, amount, currency = 'USD', description, returnUrl, metadata }) {
    if (!this.configured) {
      const err = new Error('WompiAdapter not configured (set WOMPI_PUBLIC_KEY / WOMPI_EVENTS_SECRET)');
      err.status = 503;
      throw err;
    }
    const reference = String(intentId);
    const params = new URLSearchParams();
    params.set('public-key', this.publicKey);
    params.set('currency', currency);
    params.set('amount-in-cents', String(amount));
    params.set('reference', reference);
    if (returnUrl) params.set('redirect-url', returnUrl);
    if (description) params.set('collect-shipping', 'false');
    if (this.integritySecret) {
      const raw = `${reference}${amount}${currency}${this.integritySecret}`;
      const signature = crypto.createHash('sha256').update(raw).digest('hex');
      params.set('signature:integrity', signature);
    }
    if (metadata && metadata.customerEmail) params.set('customer-data:email', metadata.customerEmail);
    const checkoutUrl = `${this.checkoutUrl}?${params.toString()}`;
    // providerRef is the reference until Wompi assigns a transaction id via webhook.
    return { providerRef: reference, checkoutUrl };
  }

  async verifyWebhook(rawBody, _headers) {
    let body;
    try { body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody; }
    catch { return { valid: false, event: null }; }
    const sig = body && body.signature;
    if (!sig || !Array.isArray(sig.properties) || !sig.checksum || !this.eventsSecret) {
      return { valid: false, event: null };
    }
    const concatenated = sig.properties
      .map((p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), body.data))
      .join('') + body.timestamp + this.eventsSecret;
    const expected = crypto.createHash('sha256').update(concatenated).digest('hex');
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(sig.checksum)));
    } catch { valid = false; }
    return { valid, event: valid ? body : null };
  }

  async getStatus(providerRef) {
    if (!this.privateKey) return { status: 'UNKNOWN', paidAt: null, providerFee: null, providerRef };
    try {
      const r = await fetch(`${this.baseUrl}/transactions/${encodeURIComponent(providerRef)}`, {
        headers: { Authorization: `Bearer ${this.privateKey}` },
      });
      const j = await r.json();
      const t = (j && j.data) || {};
      return {
        status: t.status || 'UNKNOWN',
        paidAt: t.finalized_at || null,
        providerFee: t.payment_method && t.payment_method.fee_in_cents ? t.payment_method.fee_in_cents : null,
        providerRef,
      };
    } catch (e) {
      return { status: 'UNKNOWN', paidAt: null, providerFee: null, providerRef, error: e.message };
    }
  }

  async refund(providerRef, amount, reason) {
    // Refunds are informational in this build (spec A4 §2.4/§2.5 — refund
    // produces a CORRECTION record, not executed from the UI). We surface the
    // request shape; real execution is out of scope.
    return { refundRef: null, status: 'NOT_ENABLED', providerRef, amount, reason,
      note: 'Refunds are informational in the MVP; a correction record is written instead.' };
  }
}

module.exports = { WompiAdapter };

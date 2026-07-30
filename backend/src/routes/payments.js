'use strict';
/**
 * payments.js — Payments MVP (spec A4 §2), mounted at /api/payments.
 *
 * Flow (A4 §2.1): member books → Solaris creates a PaymentIntent → redirect to
 * Wompi hosted checkout → Wompi webhook confirms → Solaris confirms the booking
 * exactly once and writes the allocation ledger → money settles to Aura (the
 * merchant of record). Solaris never holds funds and never stores card data.
 *
 *   POST /api/payments/checkout        (auth)  create intent + checkout URL
 *   POST /api/payments/webhook         (public, signed)  idempotent confirm
 *   GET  /api/payments/intents         (auth)  member's intents + allocations
 *   GET  /api/payments/intents/:id     (auth)  one intent + allocations + receipt
 *   GET  /api/payments/reconciliation  (auth, admin)  intents-by-day view
 *
 * All ecosystem allocation amounts are SIMULATED (settlement_status='SIMULATED');
 * only the gross charge is a real Wompi sandbox transaction.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { audit } = require('../lib/helpers');
const { createNotification } = require('../lib/notifications');
const { subjectIdForUser } = require('../lib/identity');
const { getPaymentProvider } = require('../adapters');
const { computeAllocations, POLICY_ID } = require('../lib/payments/allocation-policy');

const router = express.Router();

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------
// POST /checkout — create a PaymentIntent and a hosted-checkout URL.
// ---------------------------------------------------------------------------
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      appointmentId = null, amountCents, currency = 'USD',
      purpose = 'consultation', description, returnUrl, idempotencyKey,
    } = req.body || {};

    const amount = parseInt(amountCents, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amountCents must be a positive integer' });
    }
    if (!['consultation', 'deposit', 'treatment', 'membership'].includes(purpose)) {
      return res.status(400).json({ error: 'invalid purpose' });
    }

    const subjectId = await subjectIdForUser(userId);
    if (!subjectId) return res.status(404).json({ error: 'subject not found' });

    // Idempotency: one key per intent. Reuse the existing intent if replayed.
    const key = String(idempotencyKey || `chk_${userId}_${appointmentId || 'na'}_${amount}_${Date.now()}`);
    const existing = await db.query('SELECT * FROM payment_intents WHERE idempotency_key=$1', [key]);
    if (existing.rows.length) {
      const it = existing.rows[0];
      return res.json({ intentId: it.id, checkoutUrl: it.checkout_url, status: it.status, reused: true });
    }

    // Validate appointment ownership if supplied.
    let apptSubject = subjectId;
    if (appointmentId) {
      const a = await db.query('SELECT id, subject_id, patient_id FROM appointments WHERE id=$1', [appointmentId]);
      if (!a.rows.length) return res.status(404).json({ error: 'appointment not found' });
      apptSubject = a.rows[0].subject_id || subjectId;
    }

    const ins = await db.query(
      `INSERT INTO payment_intents
         (subject_id, user_id, appointment_id, amount_cents, currency, purpose, description, status, provider, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'created',$8,$9)
       RETURNING *`,
      [apptSubject, userId, appointmentId, amount, currency, purpose, description || null,
       getPaymentProvider().name, key]
    );
    const intent = ins.rows[0];

    const provider = getPaymentProvider();
    const userRow = await db.query('SELECT email FROM users WHERE id=$1', [userId]);
    let checkout;
    try {
      checkout = await provider.createCheckout({
        intentId: intent.id,
        amount,
        currency,
        description: description || 'Solaris booking',
        returnUrl: returnUrl || null,
        metadata: { customerEmail: userRow.rows[0] && userRow.rows[0].email },
      });
    } catch (e) {
      await db.query('UPDATE payment_intents SET status=$1 WHERE id=$2', ['failed', intent.id]);
      return res.status(e.status || 502).json({ error: e.message || 'checkout unavailable' });
    }

    await db.query(
      'UPDATE payment_intents SET provider_ref=$1, checkout_url=$2, status=$3 WHERE id=$4',
      [checkout.providerRef, checkout.checkoutUrl, 'pending', intent.id]
    );
    await db.query(
      `INSERT INTO payment_events (intent_id, kind, payload, provider_signature_valid)
       VALUES ($1,'checkout.created',$2,NULL)`,
      [intent.id, JSON.stringify({ providerRef: checkout.providerRef, amount, currency })]
    );
    await audit({
      actorId: userId, action: 'payment.checkout_created', resourceType: 'payment_intent',
      resourceId: intent.id, newValues: { amount, currency, purpose }, purpose: 'payments', consentScope: 'payments',
      ip: req.ip,
    });

    res.status(201).json({
      intentId: intent.id,
      checkoutUrl: checkout.checkoutUrl,
      providerRef: checkout.providerRef,
      amountCents: amount,
      currency,
      status: 'pending',
      provider: provider.name,
      note: 'Booking is confirmed by the payment webhook, not by this redirect.',
    });
  } catch (err) {
    console.error('[payments] checkout error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Idempotent confirmation: write allocations + confirm booking exactly once.
// Exposed for reuse (M7 hooks the GPS shadow receipt here).
// ---------------------------------------------------------------------------
async function confirmPaidIntent(intent, providerFeeCents = null) {
  // Guard: only transition to paid once (replay-safe).
  const fresh = await db.query('SELECT * FROM payment_intents WHERE id=$1', [intent.id]);
  const it = fresh.rows[0];
  if (!it) return { confirmed: false, reason: 'missing' };
  if (it.status === 'paid') return { confirmed: false, reason: 'already_paid', intent: it };

  await db.query(
    'UPDATE payment_intents SET status=$1, paid_at=NOW(), provider_fee_cents=$2 WHERE id=$3',
    ['paid', providerFeeCents, it.id]
  );

  // Allocation ledger (A4 §2.3/§3): eligible value = gross here (no obligations
  // in the pilot). SIMULATED — no money moves from this table.
  const { legs } = computeAllocations(it.amount_cents);
  for (const leg of legs) {
    await db.query(
      `INSERT INTO allocations
         (intent_id, subject_id, recipient_label, bucket, canonical_domain_id, share_bps, amount_cents, settlement_status, source, consent_scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'SIMULATED',$8,'payments')`,
      [it.id, it.subject_id, leg.label, leg.bucket, leg.canonicalDomainId, leg.shareBps, leg.amountCents, POLICY_ID]
    );
  }

  // Confirm the booking (idempotent — status already defaults confirmed).
  if (it.appointment_id) {
    await db.query("UPDATE appointments SET status='confirmed' WHERE id=$1", [it.appointment_id]);
  }

  // M7 hook: generate the GPS shadow receipt (added in M7; safe no-op if absent).
  try {
    const gps = require('../lib/gps-shadow');
    if (gps && typeof gps.generateShadowReceipt === 'function') {
      await gps.generateShadowReceipt(db, it, legs, providerFeeCents);
    }
  } catch (_) { /* M7 not yet loaded */ }

  // Receipt in the member inbox + push (PHI-free).
  if (it.user_id) {
    await createNotification(
      it.user_id, 'payment',
      'Payment received',
      `Your ${it.purpose} payment of ${money(it.amount_cents)} is confirmed. Tap to see where your payment goes.`,
      { intentId: it.id, amountCents: it.amount_cents, currency: it.currency, kind: 'receipt' }
    );
  }

  await audit({
    actorId: it.user_id, action: 'payment.confirmed', resourceType: 'payment_intent',
    resourceId: it.id, newValues: { amount: it.amount_cents, allocations: legs.length },
    purpose: 'payments', consentScope: 'payments',
  });

  return { confirmed: true, intent: { ...it, status: 'paid' }, allocations: legs };
}

// ---------------------------------------------------------------------------
// POST /webhook — Wompi TRANSACTION.UPDATED. Public + signature-verified.
// ---------------------------------------------------------------------------
router.post('/webhook', async (req, res) => {
  const provider = getPaymentProvider();
  let verification;
  try {
    verification = await provider.verifyWebhook(req.body, req.headers);
  } catch (e) {
    verification = { valid: false, event: null };
  }
  const body = req.body || {};
  const txn = (body.data && body.data.transaction) || {};
  const reference = txn.reference || null; // = our intent id

  // Best-effort: log the event even if signature invalid (never trust it).
  let intent = null;
  if (reference) {
    const r = await db.query('SELECT * FROM payment_intents WHERE id=$1', [reference]).catch(() => ({ rows: [] }));
    intent = r.rows[0] || null;
  }
  if (!intent && txn.id) {
    const r = await db.query('SELECT * FROM payment_intents WHERE provider_ref=$1', [txn.id]).catch(() => ({ rows: [] }));
    intent = r.rows[0] || null;
  }

  if (intent) {
    await db.query(
      `INSERT INTO payment_events (intent_id, kind, payload, provider_signature_valid)
       VALUES ($1,$2,$3,$4)`,
      [intent.id, body.event || 'transaction.updated', JSON.stringify(body), !!verification.valid]
    ).catch(() => {});
  }

  // Always 200 to the provider so it stops retrying; but only ACT on valid sigs.
  if (!verification.valid) {
    return res.status(200).json({ received: true, processed: false, reason: 'invalid_signature' });
  }
  if (!intent) {
    return res.status(200).json({ received: true, processed: false, reason: 'unknown_reference' });
  }

  const status = String(txn.status || '').toUpperCase();
  try {
    if (status === 'APPROVED') {
      const fee = txn.payment_method && txn.payment_method.fee_in_cents ? txn.payment_method.fee_in_cents : null;
      const result = await confirmPaidIntent(intent, fee);
      return res.status(200).json({ received: true, processed: true, confirmed: result.confirmed, reason: result.reason || 'ok' });
    }
    if (['DECLINED', 'ERROR', 'VOIDED'].includes(status)) {
      if (intent.status !== 'paid') {
        await db.query('UPDATE payment_intents SET status=$1 WHERE id=$2', ['failed', intent.id]);
      }
      return res.status(200).json({ received: true, processed: true, status: 'failed' });
    }
    return res.status(200).json({ received: true, processed: true, status: 'noop', providerStatus: status });
  } catch (err) {
    console.error('[payments] webhook processing error:', err);
    return res.status(200).json({ received: true, processed: false, reason: 'server_error' });
  }
});

// ---------------------------------------------------------------------------
// GET /intents — the member's payment intents + allocations (receipts).
// ---------------------------------------------------------------------------
router.get('/intents', authMiddleware, async (req, res) => {
  try {
    const subjectId = await subjectIdForUser(req.user.userId);
    const its = await db.query(
      'SELECT * FROM payment_intents WHERE subject_id=$1 ORDER BY created_at DESC LIMIT 50',
      [subjectId]
    );
    const out = [];
    for (const it of its.rows) {
      const al = await db.query(
        'SELECT recipient_label, bucket, canonical_domain_id, share_bps, amount_cents, settlement_status FROM allocations WHERE intent_id=$1 ORDER BY bucket, share_bps DESC',
        [it.id]
      );
      out.push(shapeIntent(it, al.rows));
    }
    res.json({ intents: out });
  } catch (err) {
    console.error('[payments] intents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/intents/:id', authMiddleware, async (req, res) => {
  try {
    const subjectId = await subjectIdForUser(req.user.userId);
    const r = await db.query('SELECT * FROM payment_intents WHERE id=$1 AND subject_id=$2', [req.params.id, subjectId]);
    if (!r.rows.length) return res.status(404).json({ error: 'not found' });
    const it = r.rows[0];
    const al = await db.query(
      'SELECT recipient_label, bucket, canonical_domain_id, share_bps, amount_cents, settlement_status FROM allocations WHERE intent_id=$1 ORDER BY bucket, share_bps DESC',
      [it.id]
    );
    res.json({ intent: shapeIntent(it, al.rows) });
  } catch (err) {
    console.error('[payments] intent detail error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

function shapeIntent(it, allocations) {
  const envelope = allocations.filter((a) => a.bucket === 'gps_envelope');
  const earned = allocations.filter((a) => a.bucket === 'earned_value');
  return {
    id: it.id,
    amountCents: Number(it.amount_cents),
    currency: it.currency,
    purpose: it.purpose,
    description: it.description,
    status: it.status,
    provider: it.provider,
    level: it.level,
    consentScope: it.consent_scope,
    createdAt: it.created_at,
    paidAt: it.paid_at,
    checkoutUrl: it.status === 'pending' ? it.checkout_url : null,
    refundStatus: it.status === 'refunded' ? 'refunded' : (it.status === 'disputed' ? 'disputed' : 'none'),
    allocations: allocations.map((a) => ({
      label: a.recipient_label, bucket: a.bucket, canonicalDomainId: a.canonical_domain_id,
      shareBps: a.share_bps, amountCents: Number(a.amount_cents), settlementStatus: a.settlement_status,
    })),
    earnedValueCents: earned.reduce((s, a) => s + Number(a.amount_cents), 0),
    envelopeCents: envelope.reduce((s, a) => s + Number(a.amount_cents), 0),
    simulated: true,
    simulatedNote: 'Simulated — no funds have moved. This shows how Solaris will route value when live.',
  };
}

module.exports = router;
module.exports.confirmPaidIntent = confirmPaidIntent;

'use strict';
/**
 * Simulated payments + GPS split (Solaris sprint).
 *   POST /api/payments/simulate  { orgId, amountSats, description?, treatmentPlanId? }
 *     -> creates a simulated payment, executes the data-driven split policy,
 *        records a split_receipt with per-leg amounts + recipient identity +
 *        mock proof hashes, credits the patient-education leg to the payer's
 *        wallet, and returns animated-receipt-ready data.
 *
 * All values are simulated. No real money moves.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getSplitPolicy, computePolicyLegs } = require('../lib/gps-engine');

const router = express.Router();

// Resolve each split leg's recipient to a human-readable identity (mock).
async function resolveRecipients(legs, ctx) {
  const out = [];
  for (const leg of legs) {
    let label = leg.role;
    let identity = leg.recipient_ref;
    try {
      if (leg.role === 'provider') {
        label = ctx.org?.name || 'Provider';
        identity = ctx.org?.npub_mock || leg.recipient_ref;
      } else if (leg.role === 'onboarder') {
        if (ctx.onboarder) {
          label = ctx.onboarder.display_name || ctx.onboarder.full_name || 'Onboarder';
          identity = ctx.onboarder.nostr_npub || leg.recipient_ref;
        } else { label = 'Onboarder (unassigned)'; }
      } else if (leg.role === 'community_treasury') {
        label = ctx.community?.name ? `${ctx.community.name} treasury` : 'Community treasury';
        identity = ctx.community?.treasury_wallet_mock || leg.recipient_ref;
      } else if (leg.role === 'patient_education') {
        label = 'Your education credit';
        identity = ctx.payer?.nostr_npub || leg.recipient_ref;
      } else if (leg.role === 'infrastructure') {
        label = 'Network infrastructure';
      } else if (leg.role === 'software') {
        label = 'Software / protocol';
      }
    } catch (e) { /* keep defaults */ }
    out.push({
      role: leg.role,
      label,
      identity,
      shareBps: leg.share_bps,
      sharePct: leg.share_bps / 100,
      amountSats: leg.amount_sats,
      immutable: !!leg.immutable,
      locationRouting: leg.location_routing || null,
      proofMock: leg.proof_mock || 'proof_' + crypto.randomBytes(6).toString('hex'),
    });
  }
  return out;
}

// POST /api/payments/simulate
router.post('/simulate', authMiddleware, async (req, res) => {
  try {
    const { orgId, amountSats, description, treatmentPlanId } = req.body || {};
    const amount = parseInt(amountSats, 10);
    if (!orgId) return res.status(400).json({ error: 'orgId is required' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amountSats must be a positive integer' });

    const orgRes = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    if (!orgRes.rows.length) return res.status(404).json({ error: 'Organization not found' });
    const org = orgRes.rows[0];

    const payerRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
    const payer = payerRes.rows[0];

    // Context for identity resolution
    let onboarder = null;
    if (payer && payer.onboarder_user_id) {
      const o = await db.query('SELECT id, display_name, full_name, nostr_npub FROM users WHERE id = $1', [payer.onboarder_user_id]);
      onboarder = o.rows[0] || null;
    }
    let community = null;
    if (org.community_id) {
      const c = await db.query('SELECT * FROM communities WHERE id = $1', [org.community_id]);
      community = c.rows[0] || null;
    }

    // Data-driven split
    const policy = await getSplitPolicy(orgId);
    const legs = computePolicyLegs(amount, policy.recipients);

    // Create the payment
    const invoiceMock = 'lnbc_mock_' + crypto.randomBytes(8).toString('hex');
    const payIns = await db.query(
      `INSERT INTO payments (payer_user_id, org_id, amount_sats, status, invoice_mock, description)
       VALUES ($1,$2,$3,'simulated_settled',$4,$5) RETURNING id, created_at`,
      [payer.id, orgId, amount, invoiceMock, description || 'Simulated payment']
    );
    const paymentId = payIns.rows[0].id;

    // Receipt hash (mock, deterministic-ish)
    const receiptHash = 'rcpt_' + crypto.createHash('sha256')
      .update(paymentId + ':' + amount + ':' + Date.now()).digest('hex').slice(0, 32);

    const recIns = await db.query(
      `INSERT INTO split_receipts (payment_id, policy_id, payer_user_id, org_id, amount_sats, legs, receipt_hash_mock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
      [paymentId, policy.policyId, payer.id, orgId, amount, JSON.stringify(legs), receiptHash]
    );
    const receiptId = recIns.rows[0].id;
    await db.query('UPDATE payments SET split_receipt_id = $1 WHERE id = $2', [receiptId, paymentId]);

    // Credit the patient-education leg to the payer's simulated wallet
    const eduLeg = legs.find((l) => l.role === 'patient_education');
    let educationCreditSats = 0;
    if (eduLeg) {
      educationCreditSats = eduLeg.amount_sats;
      const w = await db.query(
        `UPDATE wallets SET balance_sats_simulated = balance_sats_simulated + $1, updated_at = NOW()
         WHERE owner_type = 'user' AND owner_id = $2 RETURNING id`,
        [educationCreditSats, payer.id]
      );
      if (!w.rows.length) {
        await db.query(
          `INSERT INTO wallets (owner_type, owner_id, balance_sats_simulated, lightning_address_mock)
           VALUES ('user',$1,$2,$3)`,
          [payer.id, educationCreditSats, (payer.email || 'user').split('@')[0] + '@solaris.mock']
        );
      }
    }

    // Optionally mark a treatment plan as paid
    if (treatmentPlanId) {
      await db.query(`UPDATE treatment_plans SET status='paid', updated_at=NOW() WHERE id=$1 AND patient_id=$2`,
        [treatmentPlanId, payer.id]);
    }

    const resolved = await resolveRecipients(legs, { org, payer, onboarder, community });

    res.status(201).json({
      payment: {
        id: paymentId,
        orgId,
        orgName: org.name,
        amountSats: amount,
        status: 'simulated_settled',
        invoiceMock,
        description: description || 'Simulated payment',
        createdAt: payIns.rows[0].created_at,
      },
      receipt: {
        id: receiptId,
        policyId: policy.policyId,
        policyName: policy.name,
        amountSats: amount,
        receiptHashMock: receiptHash,
        legs: resolved,
        createdAt: recIns.rows[0].created_at,
      },
      educationCreditSats,
      simulated: true,
      message: 'Simulated payment settled. Value routed to everyone who created it.',
    });
  } catch (err) {
    console.error('payment simulate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/mine — payer's simulated payments + receipts
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, r.legs, r.receipt_hash_mock, r.id AS receipt_id, o.name AS org_name
       FROM payments p
       LEFT JOIN split_receipts r ON r.id = p.split_receipt_id
       LEFT JOIN organizations o ON o.id = p.org_id
       WHERE p.payer_user_id = $1 ORDER BY p.created_at DESC`,
      [req.user.userId]
    );
    res.json({
      payments: result.rows.map((p) => ({
        id: p.id,
        orgId: p.org_id,
        orgName: p.org_name,
        amountSats: p.amount_sats,
        status: p.status,
        description: p.description,
        receiptId: p.receipt_id,
        receiptHashMock: p.receipt_hash_mock,
        legs: typeof p.legs === 'string' ? JSON.parse(p.legs) : (p.legs || []),
        createdAt: p.created_at,
      })),
    });
  } catch (err) {
    console.error('payments mine error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

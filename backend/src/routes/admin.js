const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Admin access only' });
  next();
}

// Overview stats for the admin dashboard
router.get('/overview', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [users, patients, practitioners, listings, bookings, assessments, points] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS c FROM users'),
      db.query("SELECT COUNT(*)::int AS c FROM users WHERE role='patient'"),
      db.query("SELECT COUNT(*)::int AS c FROM users WHERE role='practitioner'"),
      db.query('SELECT COUNT(*)::int AS c FROM listings'),
      db.query('SELECT COUNT(*)::int AS c FROM booking_requests'),
      db.query('SELECT COUNT(*)::int AS c FROM assessment_responses'),
      db.query('SELECT COALESCE(SUM(love_points),0)::int AS c FROM users'),
    ]);
    res.json({
      stats: {
        users: users.rows[0].c,
        patients: patients.rows[0].c,
        practitioners: practitioners.rows[0].c,
        listings: listings.rows[0].c,
        bookings: bookings.rows[0].c,
        assessments: assessments.rows[0].c,
        lovePoints: points.rows[0].c,
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Users list
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  const r = await db.query(
    `SELECT id, email, full_name, role, onboarding_status, love_points, country, city, created_at
     FROM users ORDER BY created_at DESC LIMIT 200`);
  res.json({ users: r.rows });
});

// Listings list (including pending review)
router.get('/listings', authMiddleware, requireAdmin, async (req, res) => {
  const r = await db.query(
    `SELECT id, title, listing_type, specialty, status, city, country, rating, trust_score, created_at
     FROM listings ORDER BY created_at DESC LIMIT 200`);
  res.json({ listings: r.rows });
});

// Approve / reject a listing
router.patch('/listings/:id', authMiddleware, requireAdmin, async (req, res) => {
  const { status } = req.body;
  const r = await db.query('UPDATE listings SET status=$1, updated_at=now() WHERE id=$2 RETURNING *',
    [status, req.params.id]);
  res.json({ listing: r.rows[0] });
});

// Bookings list
router.get('/bookings', authMiddleware, requireAdmin, async (req, res) => {
  const r = await db.query(
    `SELECT b.*, u.full_name AS patient_name, l.title AS listing_title
     FROM booking_requests b
     LEFT JOIN users u ON u.id = b.user_id
     LEFT JOIN listings l ON l.id = b.listing_id
     ORDER BY b.created_at DESC LIMIT 200`);
  res.json({ bookings: r.rows });
});

// ---- Finance reconciliation (SIMULATED — Wompi sandbox + GPS shadow ledger) ----
// Every payment intent observed on the platform, with the member + provider it
// belongs to. This is a read-only reconciliation view for the admin demo.
router.get('/finance', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT pi.id, pi.amount_cents, pi.currency, pi.purpose, pi.description,
              pi.status, pi.provider, pi.merchant_label, pi.created_at, pi.paid_at,
              u.full_name AS member_name, prov.full_name AS provider_name
         FROM payment_intents pi
         LEFT JOIN users u ON u.id = pi.user_id
         LEFT JOIN users prov ON prov.id = pi.provider_id
        ORDER BY pi.created_at DESC
        LIMIT 200`);
    const intents = r.rows.map((row) => ({
      id: row.id,
      amountUsd: (Number(row.amount_cents) || 0) / 100,
      currency: row.currency,
      purpose: row.purpose,
      description: row.description,
      status: row.status,
      provider: row.provider,
      merchantLabel: row.merchant_label,
      memberName: row.member_name || 'A member',
      providerName: row.provider_name || null,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    }));
    const totalUsd = intents.reduce((s, i) => s + i.amountUsd, 0);
    const paidUsd = intents.filter((i) => i.status === 'paid' || i.status === 'approved')
      .reduce((s, i) => s + i.amountUsd, 0);
    res.json({ intents, totalUsd, paidUsd, simulated: true });
  } catch (err) { console.error('admin finance', err); res.status(500).json({ error: 'Server error' }); }
});

// GPS settlement queue — the shadow receipts awaiting settlement. The admin can
// mark an entry SETTLED to demonstrate the settlement flow (nothing moves real money).
router.get('/gps-settlements', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT g.id, g.receipt_id, g.subject_id, g.eligible_cents, g.earned_cents,
              g.envelope_cents, g.envelope_bps, g.settlement_state, g.created_at,
              u.full_name AS member_name, pi.merchant_label
         FROM gps_shadow_receipts g
         LEFT JOIN users u ON u.id = g.user_id
         LEFT JOIN payment_intents pi ON pi.id = g.intent_id
        ORDER BY g.created_at DESC
        LIMIT 200`);
    const receipts = r.rows.map((row) => ({
      id: row.id,
      receiptId: row.receipt_id,
      subjectId: row.subject_id,
      memberName: row.member_name || 'A member',
      merchantLabel: row.merchant_label || 'Aura clinic',
      eligibleUsd: (Number(row.eligible_cents) || 0) / 100,
      earnedUsd: (Number(row.earned_cents) || 0) / 100,
      envelopeUsd: (Number(row.envelope_cents) || 0) / 100,
      envelopeBps: row.envelope_bps,
      settlementState: row.settlement_state,
      createdAt: row.created_at,
    }));
    const pending = receipts.filter((r2) => r2.settlementState !== 'SETTLED').length;
    const envelopeUsd = receipts.reduce((s, r2) => s + r2.envelopeUsd, 0);
    res.json({ receipts, pending, envelopeUsd, simulated: true });
  } catch (err) { console.error('admin gps-settlements', err); res.status(500).json({ error: 'Server error' }); }
});

// Mark a GPS shadow receipt as settled (demo action — writes settlement_state only).
router.patch('/gps-settlements/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const state = (req.body && req.body.settlementState) || 'SETTLED';
    const ALLOWED = new Set(['PREPARED', 'SETTLED']);
    if (!ALLOWED.has(state)) return res.status(400).json({ error: 'Unsupported settlement state' });
    const r = await db.query(
      `UPDATE gps_shadow_receipts SET settlement_state=$1 WHERE id=$2
       RETURNING id, settlement_state`,
      [state, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Receipt not found' });
    res.json({ id: r.rows[0].id, settlementState: r.rows[0].settlement_state, simulated: true });
  } catch (err) { console.error('admin gps-settle patch', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

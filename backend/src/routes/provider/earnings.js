/**
 * provider/earnings.js — the practitioner's GPS earnings ledger.
 * Mounted at /api/provider/earnings.
 *
 * Reads the payment_splits table (see migration 014). Every value is clearly
 * SIMULATED — this demonstrates how the Generative Prosperity System routes value
 * back to the practitioner, and is never real money movement.
 */

const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();

// GET /api/provider/earnings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const providerId = req.user.userId;
    const r = await db.query(
      `SELECT ps.id, ps.amount_sats, ps.amount_usd_cents, ps.split_type, ps.status,
              ps.note, ps.created_at, ps.booking_id,
              u.full_name AS patient_name
         FROM payment_splits ps
         LEFT JOIN users u ON u.id = ps.patient_id
        WHERE ps.provider_id = $1
        ORDER BY ps.created_at DESC`,
      [providerId]
    );

    const earnings = r.rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      patientName: row.patient_name || 'A member',
      amountSats: Number(row.amount_sats) || 0,
      amountUsd: (Number(row.amount_usd_cents) || 0) / 100,
      splitType: row.split_type,
      status: row.status,
      note: row.note,
      createdAt: row.created_at,
      simulated: true,
    }));

    const totalSimulatedSats = earnings.reduce((s, e) => s + e.amountSats, 0);
    const totalSimulatedUsd = earnings.reduce((s, e) => s + e.amountUsd, 0);

    res.json({ earnings, totalSimulatedSats, totalSimulatedUsd, simulated: true });
  } catch (err) {
    console.error('provider earnings', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

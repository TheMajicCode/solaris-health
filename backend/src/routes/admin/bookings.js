/**
 * admin/bookings.js — platform-wide booking oversight.
 * Mounted at /api/admin/bookings (all routes require admin).
 *
 *   GET  /            list all bookings with filters
 *   GET  /stats       platform booking statistics
 *   PUT  /:id/resolve resolve a dispute / force a status
 */

const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/admin-only');
const { createNotification } = require('../../lib/notifications');

const router = express.Router();
router.use(authMiddleware, adminOnly);

/* ------------------------------ list ------------------------------ */
router.get('/', async (req, res) => {
  try {
    const params = [];
    const where = [];
    if (req.query.status) { params.push(req.query.status); where.push(`b.status = $${params.length}`); }
    if (req.query.providerId) { params.push(req.query.providerId); where.push(`b.provider_id = $${params.length}`); }
    if (req.query.patientId) { params.push(req.query.patientId); where.push(`b.patient_id = $${params.length}`); }
    if (req.query.from) { params.push(req.query.from); where.push(`b.booking_date >= $${params.length}`); }
    if (req.query.to) { params.push(req.query.to); where.push(`b.booking_date <= $${params.length}`); }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    params.push(limit); params.push(offset);

    const r = await db.query(
      `SELECT b.*, s.service_name, p.business_name,
              u.full_name AS patient_name, u.email AS patient_email
         FROM bookings b
         LEFT JOIN provider_services s ON s.id = b.service_id
         LEFT JOIN provider_profiles p ON p.id = b.provider_id
         LEFT JOIN users u ON u.id = b.patient_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY b.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ bookings: r.rows });
  } catch (err) {
    console.error('admin bookings list', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------------ stats ------------------------------ */
router.get('/stats', async (_req, res) => {
  try {
    const r = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status='pending')::int AS pending,
         COUNT(*) FILTER (WHERE status='confirmed')::int AS confirmed,
         COUNT(*) FILTER (WHERE status='completed')::int AS completed,
         COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
         COUNT(*) FILTER (WHERE status='no_show')::int AS no_show,
         COALESCE(SUM(total_price) FILTER (WHERE status='completed'),0)::numeric AS gross_volume,
         COALESCE(SUM(platform_fee) FILTER (WHERE status='completed'),0)::numeric AS platform_revenue
       FROM bookings`
    );
    const s = r.rows[0];
    const decided = s.completed + s.cancelled + s.no_show;
    s.completionRate = decided ? Math.round((s.completed / decided) * 100) : 0;
    s.cancellationRate = decided ? Math.round((s.cancelled / decided) * 100) : 0;
    res.json({ stats: s });
  } catch (err) {
    console.error('admin booking stats', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------------- resolve ----------------------------- */
// PUT /api/admin/bookings/:id/resolve  body: { status, reason }
router.put('/:id/resolve', async (req, res) => {
  try {
    const valid = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];
    const status = req.body?.status;
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const reason = req.body?.reason || 'Resolved by admin';

    const cur = await db.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Not found' });

    const upd = await db.query(
      `UPDATE bookings SET status=$2, updated_at=now(),
              cancellation_reason = CASE WHEN $2='cancelled' THEN $3 ELSE cancellation_reason END
        WHERE id=$1 RETURNING *`,
      [req.params.id, status, reason]
    );
    await db.query(
      `INSERT INTO booking_status_history (booking_id, status, changed_by, reason) VALUES ($1,$2,$3,$4)`,
      [req.params.id, status, req.user.userId, `[admin] ${reason}`]
    );
    await createNotification(cur.rows[0].patient_id, 'booking', '⚖️ Booking Updated by Support',
      `Your booking status was updated to "${status}" by Solaris Health support. ${reason}`,
      { bookingId: req.params.id, role: 'patient' });

    res.json({ booking: upd.rows[0] });
  } catch (err) {
    console.error('admin resolve booking', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

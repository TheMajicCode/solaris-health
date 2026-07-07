/**
 * provider/bookings.js — provider-side booking management.
 * Mounted at /api/provider/bookings.
 */

const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { createNotification } = require('../../lib/notifications');
const { sendBookingEmail } = require('../../lib/booking-emails');
const { processGPSSplit } = require('../../lib/gps-engine');

const router = express.Router();

/** Load a booking and confirm the caller owns its provider profile. */
async function loadOwnedBooking(req, id) {
  const r = await db.query(
    `SELECT b.*, s.service_name, p.business_name, p.address, p.user_id AS provider_user_id,
            u.full_name AS patient_name, u.email AS patient_email
       FROM bookings b
       LEFT JOIN provider_services s ON s.id = b.service_id
       LEFT JOIN provider_profiles p ON p.id = b.provider_id
       LEFT JOIN users u ON u.id = b.patient_id
      WHERE b.id=$1`,
    [id]
  );
  const booking = r.rows[0];
  if (!booking) return { error: 404 };
  if (booking.provider_user_id !== req.user.userId && req.user.role !== 'admin') return { error: 403 };
  return { booking };
}

/* ------------------------------ GET me ------------------------------ */
// GET /api/provider/bookings/me?view=today|pending|upcoming|past&providerId=
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const params = [req.user.userId];
    let where = 'p.user_id = $1';
    if (req.query.providerId) { params.push(req.query.providerId); where += ` AND b.provider_id = $${params.length}`; }

    const view = req.query.view;
    if (view === 'today') where += " AND b.booking_date = CURRENT_DATE AND b.status IN ('pending','confirmed')";
    else if (view === 'pending') where += " AND b.status = 'pending'";
    else if (view === 'upcoming') where += " AND b.booking_date >= CURRENT_DATE AND b.status IN ('pending','confirmed')";
    else if (view === 'past') where += " AND (b.booking_date < CURRENT_DATE OR b.status IN ('completed','cancelled','no_show'))";

    const r = await db.query(
      `SELECT b.*, s.service_name, s.duration_minutes,
              u.full_name AS patient_name, u.email AS patient_email,
              p.business_name
         FROM bookings b
         LEFT JOIN provider_services s ON s.id = b.service_id
         LEFT JOIN users u ON u.id = b.patient_id
         JOIN provider_profiles p ON p.id = b.provider_id
        WHERE ${where}
        ORDER BY b.booking_date ${view === 'past' ? 'DESC' : 'ASC'}, b.start_time ASC`,
      params
    );
    const pending = r.rows.filter((b) => b.status === 'pending').length;
    res.json({ bookings: r.rows, pending });
  } catch (err) {
    console.error('provider bookings/me', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ----------------------------- GET stats ---------------------------- */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE b.status='pending')::int AS pending,
         COUNT(*) FILTER (WHERE b.status='confirmed')::int AS confirmed,
         COUNT(*) FILTER (WHERE b.status='completed')::int AS completed,
         COUNT(*) FILTER (WHERE b.status='cancelled')::int AS cancelled,
         COUNT(*) FILTER (WHERE b.status='no_show')::int AS no_show,
         COALESCE(SUM(b.provider_payout) FILTER (WHERE b.status='completed'),0)::numeric AS earned,
         COUNT(*) FILTER (WHERE b.booking_date >= CURRENT_DATE AND b.status IN ('pending','confirmed'))::int AS upcoming
       FROM bookings b JOIN provider_profiles p ON p.id=b.provider_id
       WHERE p.user_id=$1`,
      [req.user.userId]
    );
    const s = r.rows[0];
    const decided = s.completed + s.cancelled + s.no_show;
    s.completionRate = decided ? Math.round((s.completed / decided) * 100) : 0;
    s.cancellationRate = decided ? Math.round((s.cancelled / decided) * 100) : 0;
    res.json({ stats: s });
  } catch (err) {
    console.error('provider booking stats', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------- status changes -------------------------- */
async function transition(req, res, { id, next, requireFrom, reasonDefault, notify }) {
  const { booking, error } = await loadOwnedBooking(req, id);
  if (error) return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'Not found' });
  if (requireFrom && !requireFrom.includes(booking.status)) {
    return res.status(400).json({ error: `Cannot mark a ${booking.status} booking as ${next}.` });
  }
  const reason = (req.body && req.body.reason) || reasonDefault;
  const stamp = next === 'confirmed' ? 'confirmed_at' : next === 'completed' ? 'completed_at' : next === 'cancelled' ? 'cancelled_at' : null;

  const sets = ['status=$2', 'updated_at=now()'];
  const vals = [id, next];
  if (stamp) sets.push(`${stamp}=now()`);
  if (next === 'cancelled') { vals.push(reason); sets.push(`cancellation_reason=$${vals.length}`); }
  if (next === 'completed' && req.body?.clinicalNotes) { vals.push(req.body.clinicalNotes); sets.push(`clinical_notes=$${vals.length}`); }

  const upd = await db.query(`UPDATE bookings SET ${sets.join(', ')} WHERE id=$1 RETURNING *`, vals);
  await db.query(
    `INSERT INTO booking_status_history (booking_id, status, changed_by, reason) VALUES ($1,$2,$3,$4)`,
    [id, next, req.user.userId, reason]
  );
  // Free the slot when the appointment is no longer active.
  if (['cancelled', 'no_show', 'completed'].includes(next)) {
    await db.query(
      `UPDATE provider_time_slots SET status=CASE WHEN $2 THEN 'available' ELSE status END, booking_id=NULL WHERE booking_id=$1`,
      [id, next === 'cancelled']
    );
  }
  if (notify) await notify(booking);

  // GPS — route value through the ecosystem when a booking completes.
  let gps = null;
  if (next === 'completed') {
    try { gps = await processGPSSplit(upd.rows[0]); }
    catch (e) { console.warn('[gps] split on complete failed (non-fatal):', e.message); }
  }

  res.json({ booking: upd.rows[0], gps: gps ? gps.split : null });
}

// PUT confirm
router.put('/:id/confirm', authMiddleware, (req, res) => transition(req, res, {
  id: req.params.id, next: 'confirmed', requireFrom: ['pending'], reasonDefault: 'Confirmed by provider',
  notify: async (b) => {
    await createNotification(b.patient_id, 'booking', '✅ Appointment Confirmed',
      `Your ${b.service_name || 'appointment'} with ${b.business_name} on ${String(b.booking_date).slice(0, 10)} at ${b.start_time} is confirmed.`,
      { bookingId: b.id, role: 'patient' });
    await sendBookingEmail({ userId: b.patient_id, toEmail: b.patient_email, template: 'booking_confirmed',
      vars: { businessName: b.business_name, serviceName: b.service_name, date: b.booking_date, startTime: b.start_time, endTime: b.end_time, address: b.address } });
  },
}));

// PUT cancel (by provider)
router.put('/:id/cancel', authMiddleware, (req, res) => transition(req, res, {
  id: req.params.id, next: 'cancelled', requireFrom: ['pending', 'confirmed'], reasonDefault: 'Cancelled by provider',
  notify: async (b) => {
    const reason = (req.body && req.body.reason) || 'Cancelled by provider';
    const declined = b.status === 'pending';
    await createNotification(b.patient_id, 'booking',
      declined ? '❌ Booking Declined' : '🚫 Appointment Cancelled',
      `Your ${b.service_name || 'appointment'} on ${String(b.booking_date).slice(0, 10)} was ${declined ? 'declined' : 'cancelled'} by ${b.business_name}.${reason ? ' Reason: ' + reason : ''}`,
      { bookingId: b.id, role: 'patient' });
    await sendBookingEmail({ userId: b.patient_id, toEmail: b.patient_email,
      template: declined ? 'booking_declined' : 'booking_cancelled',
      vars: { patientName: b.patient_name, recipientName: b.patient_name, byWhom: 'provider', serviceName: b.service_name, date: b.booking_date, startTime: b.start_time, reason } });
  },
}));

// PUT complete
router.put('/:id/complete', authMiddleware, (req, res) => transition(req, res, {
  id: req.params.id, next: 'completed', requireFrom: ['confirmed', 'pending'], reasonDefault: 'Marked completed',
  notify: async (b) => {
    await createNotification(b.patient_id, 'booking', '🌿 Appointment Completed',
      `Your ${b.service_name || 'appointment'} with ${b.business_name} is complete. We'd love your review!`,
      { bookingId: b.id, role: 'patient', providerId: b.provider_id, prompt: 'review' });
    await sendBookingEmail({ userId: b.patient_id, toEmail: b.patient_email, template: 'booking_completed',
      vars: { patientName: b.patient_name, businessName: b.business_name, serviceName: b.service_name } });
  },
}));

// PUT no-show
router.put('/:id/no-show', authMiddleware, (req, res) => transition(req, res, {
  id: req.params.id, next: 'no_show', requireFrom: ['confirmed', 'pending'], reasonDefault: 'Patient did not show',
}));

module.exports = router;

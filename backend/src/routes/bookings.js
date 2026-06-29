/**
 * bookings.js — patient-facing booking API (mounted at /api/bookings).
 *
 * Available slots are computed on-the-fly from a provider's weekly
 * availability + service duration + buffer, minus existing bookings and any
 * blocked slots. This means booking works even before a provider explicitly
 * "generates" slots, while still respecting blocks and conflicts.
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { sendBookingEmail } = require('../lib/booking-emails');
const {
  generateSlots, priceSplit, withinBookingWindow, hoursUntil, ymd, timeToMinutes,
} = require('../lib/time-slots');

const router = express.Router();

const MIN_ADVANCE_HOURS = 2;
const MAX_ADVANCE_DAYS = 90;
const DEFAULT_DURATION = 30;
const DEFAULT_BUFFER = 15;

/* ----------------------------- helpers ----------------------------- */

function overlaps(aStart, aEnd, bStart, bEnd) {
  const a1 = timeToMinutes(aStart); const a2 = timeToMinutes(aEnd);
  const b1 = timeToMinutes(bStart); const b2 = timeToMinutes(bEnd);
  return a1 < b2 && b1 < a2;
}

async function loadBookingFull(id) {
  const r = await db.query(
    `SELECT b.*, s.service_name, s.duration_minutes,
            p.business_name, p.address, p.city, p.phone AS provider_phone,
            p.user_id AS provider_user_id, p.profile_photo_url,
            u.full_name AS patient_name, u.email AS patient_email
       FROM bookings b
       LEFT JOIN provider_services s ON s.id = b.service_id
       LEFT JOIN provider_profiles p ON p.id = b.provider_id
       LEFT JOIN users u ON u.id = b.patient_id
      WHERE b.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

/* ------------------------ GET available slots ----------------------- */
// GET /api/bookings/available-slots/:providerId/:serviceId
router.get('/available-slots/:providerId/:serviceId', authMiddleware, async (req, res) => {
  try {
    const { providerId, serviceId } = req.params;
    const days = Math.min(parseInt(req.query.days, 10) || 60, MAX_ADVANCE_DAYS);

    const svc = await db.query('SELECT * FROM provider_services WHERE id=$1 AND provider_id=$2', [serviceId, providerId]);
    const service = svc.rows[0] || null;
    const duration = (service && service.duration_minutes) || DEFAULT_DURATION;

    const prof = await db.query('SELECT booking_buffer_minutes FROM provider_profiles WHERE id=$1', [providerId]);
    if (!prof.rows.length) return res.status(404).json({ error: 'Provider not found' });
    const buffer = prof.rows[0].booking_buffer_minutes != null ? prof.rows[0].booking_buffer_minutes : DEFAULT_BUFFER;

    const [availRes, blockedRes, bookedRes] = await Promise.all([
      db.query('SELECT day_of_week, start_time, end_time, is_available FROM provider_availability WHERE provider_id=$1', [providerId]),
      db.query(`SELECT slot_date, start_time, end_time FROM provider_time_slots
                 WHERE provider_id=$1 AND status='blocked' AND slot_date >= CURRENT_DATE`, [providerId]),
      db.query(`SELECT booking_date, start_time, end_time FROM bookings
                 WHERE provider_id=$1 AND status IN ('pending','confirmed') AND booking_date >= CURRENT_DATE`, [providerId]),
    ]);

    const byDay = {};
    for (const a of availRes.rows) {
      if (a.is_available === false) continue;
      (byDay[Number(a.day_of_week)] = byDay[Number(a.day_of_week)] || []).push(a);
    }
    // Index blocks + bookings by date string for quick overlap checks.
    const blocksByDate = {};
    for (const b of blockedRes.rows) {
      const k = ymd(new Date(b.slot_date));
      (blocksByDate[k] = blocksByDate[k] || []).push(b);
    }
    const bookedByDate = {};
    for (const b of bookedRes.rows) {
      const k = ymd(new Date(b.booking_date));
      (bookedByDate[k] = bookedByDate[k] || []).push(b);
    }

    const today = new Date();
    const dates = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dow = d.getDay();
      const windows = byDay[dow];
      if (!windows || !windows.length) continue;
      const dateStr = ymd(d);
      let slots = [];
      for (const w of windows) {
        slots = slots.concat(generateSlots(w.start_time, w.end_time, duration, buffer));
      }
      const blocks = blocksByDate[dateStr] || [];
      const booked = bookedByDate[dateStr] || [];
      const free = slots.filter((s) => {
        if (!withinBookingWindow(dateStr, s.start, { minHours: MIN_ADVANCE_HOURS, maxDays: MAX_ADVANCE_DAYS })) return false;
        if (blocks.some((b) => overlaps(s.start, s.end, b.start_time, b.end_time))) return false;
        if (booked.some((b) => overlaps(s.start, s.end, b.start_time, b.end_time))) return false;
        return true;
      });
      if (free.length) dates.push({ date: dateStr, slots: free });
    }

    res.json({ service, duration, buffer, dates });
  } catch (err) {
    console.error('available-slots', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------- POST request --------------------------- */
// POST /api/bookings/request
router.post('/request', authMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const b = req.body || {};
    const providerId = b.providerId || b.provider_id;
    const serviceId = b.serviceId || b.service_id;
    const date = (b.date || b.booking_date || '').slice(0, 10);
    const startTime = b.startTime || b.start_time;
    if (!providerId || !date || !startTime) {
      return res.status(400).json({ error: 'providerId, date and startTime are required' });
    }
    if (!withinBookingWindow(date, startTime, { minHours: MIN_ADVANCE_HOURS, maxDays: MAX_ADVANCE_DAYS })) {
      return res.status(400).json({ error: `Bookings must be at least ${MIN_ADVANCE_HOURS} hours in advance and within ${MAX_ADVANCE_DAYS} days.` });
    }

    const prof = await db.query(
      'SELECT id, business_name, address, user_id, auto_confirm_bookings FROM provider_profiles WHERE id=$1',
      [providerId]
    );
    if (!prof.rows.length) return res.status(404).json({ error: 'Provider not found' });
    const provider = prof.rows[0];

    let service = null;
    if (serviceId) {
      const sv = await db.query('SELECT * FROM provider_services WHERE id=$1 AND provider_id=$2', [serviceId, providerId]);
      service = sv.rows[0] || null;
    }
    const duration = (service && service.duration_minutes) || DEFAULT_DURATION;
    let endTime = b.endTime || b.end_time;
    if (!endTime) {
      const endM = timeToMinutes(startTime) + duration;
      endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;
    }
    const price = service && service.price != null ? Number(service.price) : 0;
    const split = priceSplit(price);

    await client.query('BEGIN');
    // Conflict check (lock provider's same-day bookings).
    const clash = await client.query(
      `SELECT id, start_time, end_time FROM bookings
        WHERE provider_id=$1 AND booking_date=$2 AND status IN ('pending','confirmed') FOR UPDATE`,
      [providerId, date]
    );
    const conflict = clash.rows.some((r) => overlaps(startTime, endTime, r.start_time, r.end_time));
    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'That time slot was just taken. Please pick another time.' });
    }

    const autoConfirm = provider.auto_confirm_bookings === true;
    const status = autoConfirm ? 'confirmed' : 'pending';
    const ins = await client.query(
      `INSERT INTO bookings
         (patient_id, provider_id, service_id, booking_date, start_time, end_time,
          status, total_price, platform_fee, provider_payout, currency,
          patient_notes, patient_phone, confirmed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        req.user.userId, providerId, serviceId || null, date, startTime, endTime,
        status, split.total, split.platformFee, split.providerPayout,
        (service && service.currency) || 'USD',
        b.patientNotes || b.patient_notes || null, b.patientPhone || b.patient_phone || null,
        autoConfirm ? new Date() : null,
      ]
    );
    const booking = ins.rows[0];

    await client.query(
      `INSERT INTO booking_status_history (booking_id, status, changed_by, reason)
       VALUES ($1,$2,$3,$4)`,
      [booking.id, status, req.user.userId, autoConfirm ? 'Auto-confirmed' : 'Requested by patient']
    );

    // Mark a matching pre-generated slot as booked, if one exists.
    await client.query(
      `UPDATE provider_time_slots SET status='booked', booking_id=$1
        WHERE provider_id=$2 AND slot_date=$3 AND start_time=$4 AND status='available'`,
      [booking.id, providerId, date, startTime]
    );

    await client.query('COMMIT');

    // --- Side effects (best-effort, outside the txn) ---
    const patient = await db.query('SELECT full_name, email FROM users WHERE id=$1', [req.user.userId]);
    const patientName = patient.rows[0]?.full_name || 'A patient';
    const serviceName = service?.service_name || 'Consultation';

    // Notify the provider of the new request.
    if (provider.user_id) {
      await createNotification(
        provider.user_id, 'booking',
        autoConfirm ? '📅 New Confirmed Booking' : '📅 New Booking Request',
        `${patientName} ${autoConfirm ? 'booked' : 'requested'} ${serviceName} on ${date} at ${startTime}.`,
        { bookingId: booking.id, role: 'provider', date, startTime }
      );
      await sendBookingEmail({
        userId: provider.user_id, toEmail: null, template: 'booking_request',
        vars: { patientName, serviceName, date, startTime, endTime, notes: booking.patient_notes },
      });
    }

    if (autoConfirm) {
      await createNotification(
        req.user.userId, 'booking', '✅ Appointment Confirmed',
        `Your ${serviceName} with ${provider.business_name} on ${date} at ${startTime} is confirmed.`,
        { bookingId: booking.id, role: 'patient', date, startTime }
      );
      await sendBookingEmail({
        userId: req.user.userId, toEmail: patient.rows[0]?.email, template: 'booking_confirmed',
        vars: { businessName: provider.business_name, serviceName, date, startTime, endTime, address: provider.address },
      });
    }

    res.status(201).json({ booking, reference: booking.id.slice(0, 8).toUpperCase(), autoConfirmed: autoConfirm });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('booking request', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

/* ----------------------------- GET me ------------------------------- */
// GET /api/bookings/me  (?status=upcoming|pending|past)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT b.*, s.service_name, s.duration_minutes,
              p.business_name, p.address, p.city, p.phone AS provider_phone,
              p.profile_photo_url, p.latitude, p.longitude
         FROM bookings b
         LEFT JOIN provider_services s ON s.id = b.service_id
         LEFT JOIN provider_profiles p ON p.id = b.provider_id
        WHERE b.patient_id = $1
        ORDER BY b.booking_date DESC, b.start_time DESC`,
      [req.user.userId]
    );
    res.json({ bookings: r.rows });
  } catch (err) {
    console.error('my bookings', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ---------------------------- GET :id ------------------------------- */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await loadBookingFull(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });
    const isOwner = booking.patient_id === req.user.userId
      || booking.provider_user_id === req.user.userId
      || req.user.role === 'admin';
    if (!isOwner) return res.status(403).json({ error: 'Forbidden' });
    res.json({ booking });
  } catch (err) {
    console.error('booking detail', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------- PUT :id/cancel -------------------------- */
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const booking = await loadBookingFull(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });
    if (booking.patient_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot cancel a ${booking.status} booking.` });
    }
    const reason = (req.body && req.body.reason) || 'Cancelled by patient';
    const lateNotice = hoursUntil(booking.booking_date, booking.start_time) < 24;

    const upd = await db.query(
      `UPDATE bookings SET status='cancelled', cancellation_reason=$2, cancelled_at=now(), updated_at=now()
        WHERE id=$1 RETURNING *`,
      [booking.id, reason]
    );
    await db.query(
      `INSERT INTO booking_status_history (booking_id, status, changed_by, reason) VALUES ($1,'cancelled',$2,$3)`,
      [booking.id, req.user.userId, reason]
    );
    await db.query(
      `UPDATE provider_time_slots SET status='available', booking_id=NULL WHERE booking_id=$1`,
      [booking.id]
    );

    if (booking.provider_user_id) {
      await createNotification(
        booking.provider_user_id, 'booking', '🚫 Booking Cancelled',
        `${booking.patient_name || 'A patient'} cancelled their ${booking.service_name || 'appointment'} on ${String(booking.booking_date).slice(0, 10)}.`,
        { bookingId: booking.id, role: 'provider' }
      );
      await sendBookingEmail({
        userId: booking.provider_user_id, toEmail: null, template: 'booking_cancelled',
        vars: { recipientName: booking.business_name, byWhom: 'patient', serviceName: booking.service_name, date: booking.booking_date, startTime: booking.start_time, reason },
      });
    }

    res.json({ booking: upd.rows[0], lateNotice });
  } catch (err) {
    console.error('cancel booking', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------ PUT :id/reschedule ------------------------ */
router.put('/:id/reschedule', authMiddleware, async (req, res) => {
  try {
    const booking = await loadBookingFull(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Not found' });
    if (booking.patient_id !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (['cancelled', 'completed', 'no_show'].includes(booking.status)) {
      return res.status(400).json({ error: `Cannot reschedule a ${booking.status} booking.` });
    }
    const b = req.body || {};
    const date = (b.date || b.booking_date || '').slice(0, 10);
    const startTime = b.startTime || b.start_time;
    if (!date || !startTime) return res.status(400).json({ error: 'date and startTime are required' });
    if (!withinBookingWindow(date, startTime, { minHours: MIN_ADVANCE_HOURS, maxDays: MAX_ADVANCE_DAYS })) {
      return res.status(400).json({ error: `New time must be at least ${MIN_ADVANCE_HOURS} hours in advance.` });
    }
    const duration = booking.duration_minutes || DEFAULT_DURATION;
    const endM = timeToMinutes(startTime) + duration;
    const endTime = `${String(Math.floor(endM / 60)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`;

    // Conflict check against other active bookings.
    const clash = await db.query(
      `SELECT start_time, end_time FROM bookings
        WHERE provider_id=$1 AND booking_date=$2 AND status IN ('pending','confirmed') AND id<>$3`,
      [booking.provider_id, date, booking.id]
    );
    if (clash.rows.some((r) => overlaps(startTime, endTime, r.start_time, r.end_time))) {
      return res.status(409).json({ error: 'That time is no longer available.' });
    }

    // Free the old slot, set booking back to pending (provider re-confirms).
    await db.query(`UPDATE provider_time_slots SET status='available', booking_id=NULL WHERE booking_id=$1`, [booking.id]);
    const upd = await db.query(
      `UPDATE bookings SET booking_date=$2, start_time=$3, end_time=$4, status='pending',
              confirmed_at=NULL, updated_at=now()
        WHERE id=$1 RETURNING *`,
      [booking.id, date, startTime, endTime]
    );
    await db.query(
      `INSERT INTO booking_status_history (booking_id, status, changed_by, reason) VALUES ($1,'pending',$2,$3)`,
      [booking.id, req.user.userId, `Rescheduled to ${date} ${startTime}`]
    );
    await db.query(
      `UPDATE provider_time_slots SET status='booked', booking_id=$1
        WHERE provider_id=$2 AND slot_date=$3 AND start_time=$4 AND status='available'`,
      [booking.id, booking.provider_id, date, startTime]
    );

    if (booking.provider_user_id) {
      await createNotification(
        booking.provider_user_id, 'booking', '🔄 Booking Rescheduled',
        `${booking.patient_name || 'A patient'} rescheduled to ${date} at ${startTime}.`,
        { bookingId: booking.id, role: 'provider' }
      );
    }
    res.json({ booking: upd.rows[0] });
  } catch (err) {
    console.error('reschedule booking', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

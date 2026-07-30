/**
 * providers.js — public provider endpoints (mounted at /api/providers).
 *
 * GET /api/providers/:id/available-slots?date=YYYY-MM-DD&days=14
 *   Expands a provider's weekly availability template (provider_availability)
 *   into concrete, bookable ISO datetime slots for the next `days` days,
 *   removing any slots that overlap an existing (non-cancelled) booking.
 *
 *   Response: [{ datetime:"2026-07-31T09:00:00", end:"2026-07-31T10:00:00", available:true }]
 *
 * No auth required — this is read-only availability used to render the
 * booking calendar before a patient commits to a request.
 */

const express = require('express');
const db = require('../db');
const { generateSlots, ymd, timeToMinutes } = require('../lib/time-slots');

const router = express.Router();

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const DEFAULT_SLOT_MINUTES = 60; // 1-hour slots by default (spec)

function overlaps(aStart, aEnd, bStart, bEnd) {
  const a1 = timeToMinutes(aStart); const a2 = timeToMinutes(aEnd);
  const b1 = timeToMinutes(bStart); const b2 = timeToMinutes(bEnd);
  return a1 < b2 && b1 < a2;
}

// GET /api/providers/:id/available-slots
router.get('/:id/available-slots', async (req, res) => {
  try {
    const providerId = req.params.id;
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || DEFAULT_DAYS, 1), MAX_DAYS);
    // Optional explicit slot length (minutes); default 1-hour slots.
    const slotMinutes = Math.max(5, parseInt(req.query.duration, 10) || DEFAULT_SLOT_MINUTES);

    const prof = await db.query('SELECT id, booking_buffer_minutes FROM provider_profiles WHERE id=$1', [providerId]);
    if (!prof.rows.length) return res.status(404).json({ error: 'Provider not found' });
    const buffer = prof.rows[0].booking_buffer_minutes != null ? prof.rows[0].booking_buffer_minutes : 0;

    // Start date: explicit ?date= or today.
    const dateParam = (req.query.date || '').slice(0, 10);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? new Date(`${dateParam}T00:00:00`)
      : new Date();

    const [availRes, bookedRes] = await Promise.all([
      db.query('SELECT day_of_week, start_time, end_time, is_available FROM provider_availability WHERE provider_id=$1', [providerId]),
      db.query(`SELECT booking_date, start_time, end_time FROM bookings
                 WHERE provider_id=$1 AND status <> 'cancelled' AND booking_date >= CURRENT_DATE`, [providerId]),
    ]);

    // Index the weekly template by day_of_week (0=Sun .. 6=Sat, matches JS getDay()).
    const byDay = {};
    for (const a of availRes.rows) {
      if (a.is_available === false) continue;
      (byDay[Number(a.day_of_week)] = byDay[Number(a.day_of_week)] || []).push(a);
    }
    // Index existing bookings by date string.
    const bookedByDate = {};
    for (const b of bookedRes.rows) {
      const k = ymd(new Date(b.booking_date));
      (bookedByDate[k] = bookedByDate[k] || []).push(b);
    }

    const now = new Date();
    const out = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const windows = byDay[d.getDay()];
      if (!windows || !windows.length) continue;
      const dateStr = ymd(d);
      const booked = bookedByDate[dateStr] || [];
      for (const w of windows) {
        for (const s of generateSlots(w.start_time, w.end_time, slotMinutes, buffer)) {
          // Skip slots already in the past.
          const startAt = new Date(`${dateStr}T${s.start}:00`);
          if (startAt.getTime() <= now.getTime()) continue;
          const taken = booked.some((b) => overlaps(s.start, s.end, b.start_time, b.end_time));
          if (taken) continue;
          out.push({
            datetime: `${dateStr}T${s.start}:00`,
            end: `${dateStr}T${s.end}:00`,
            available: true,
          });
        }
      }
    }

    res.json(out);
  } catch (err) {
    console.error('available-slots (public)', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

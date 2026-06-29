/**
 * provider/availability.js — provider availability & calendar API.
 * Mounted at /api/provider/availability.
 *
 * A provider user may own more than one provider_profile; endpoints accept an
 * optional ?providerId= and otherwise default to the caller's first profile.
 */

const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { projectSlots, ymd } = require('../../lib/time-slots');

const router = express.Router();

const DEFAULT_DURATION = 30;
const DEFAULT_BUFFER = 15;

/** Resolve the provider_profile the caller may manage. */
async function resolveOwnedProvider(req) {
  const wanted = req.query.providerId || req.body?.providerId;
  if (wanted) {
    const r = await db.query('SELECT * FROM provider_profiles WHERE id=$1', [wanted]);
    const p = r.rows[0];
    if (!p) return { error: 404 };
    if (p.user_id !== req.user.userId && req.user.role !== 'admin') return { error: 403 };
    return { provider: p };
  }
  const r = await db.query('SELECT * FROM provider_profiles WHERE user_id=$1 ORDER BY created_at LIMIT 1', [req.user.userId]);
  if (!r.rows.length) return { error: 404 };
  return { provider: r.rows[0] };
}

/* ------------------------- GET availability/me ------------------------- */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { provider, error } = await resolveOwnedProvider(req);
    if (error) return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'No provider profile found' });
    const a = await db.query(
      'SELECT * FROM provider_availability WHERE provider_id=$1 ORDER BY day_of_week, start_time',
      [provider.id]
    );
    res.json({
      providerId: provider.id,
      autoConfirm: provider.auto_confirm_bookings === true,
      bufferMinutes: provider.booking_buffer_minutes != null ? provider.booking_buffer_minutes : DEFAULT_BUFFER,
      availability: a.rows,
    });
  } catch (err) {
    console.error('availability/me', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ------------------------- PUT availability/me ------------------------- */
// Body: { providerId?, availability:[{day_of_week,start_time,end_time}], autoConfirm?, bufferMinutes? }
router.put('/me', authMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { provider, error } = await resolveOwnedProvider(req);
    if (error) { client.release(); return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'No provider profile found' }); }

    const rows = Array.isArray(req.body?.availability) ? req.body.availability : [];
    await client.query('BEGIN');
    await client.query('DELETE FROM provider_availability WHERE provider_id=$1', [provider.id]);
    for (const r of rows) {
      const dow = Number(r.day_of_week);
      if (Number.isNaN(dow) || dow < 0 || dow > 6) continue;
      if (!r.start_time || !r.end_time) continue;
      await client.query(
        `INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1,$2,$3,$4,$5)`,
        [provider.id, dow, r.start_time, r.end_time, r.is_available !== false]
      );
    }
    // Optional settings.
    if (typeof req.body?.autoConfirm === 'boolean' || req.body?.bufferMinutes != null) {
      await client.query(
        `UPDATE provider_profiles
            SET auto_confirm_bookings = COALESCE($2, auto_confirm_bookings),
                booking_buffer_minutes = COALESCE($3, booking_buffer_minutes),
                updated_at = now()
          WHERE id=$1`,
        [provider.id,
          typeof req.body.autoConfirm === 'boolean' ? req.body.autoConfirm : null,
          req.body.bufferMinutes != null ? parseInt(req.body.bufferMinutes, 10) : null]
      );
    }
    await client.query('COMMIT');

    const a = await db.query(
      'SELECT * FROM provider_availability WHERE provider_id=$1 ORDER BY day_of_week, start_time',
      [provider.id]
    );
    res.json({ providerId: provider.id, availability: a.rows });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('availability PUT', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

/* ----------------------- POST time-slots (generate) -------------------- */
// Body: { providerId?, serviceId?, startDate?, days? }
router.post('/time-slots', authMiddleware, async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { provider, error } = await resolveOwnedProvider(req);
    if (error) { client.release(); return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'No provider profile found' }); }

    const startDate = (req.body?.startDate || ymd(new Date())).slice(0, 10);
    const days = Math.min(parseInt(req.body?.days, 10) || 30, 90);
    let duration = DEFAULT_DURATION;
    let serviceId = req.body?.serviceId || null;
    if (serviceId) {
      const sv = await db.query('SELECT duration_minutes FROM provider_services WHERE id=$1 AND provider_id=$2', [serviceId, provider.id]);
      if (sv.rows.length && sv.rows[0].duration_minutes) duration = sv.rows[0].duration_minutes;
    }
    const buffer = provider.booking_buffer_minutes != null ? provider.booking_buffer_minutes : DEFAULT_BUFFER;

    const availRes = await db.query('SELECT day_of_week, start_time, end_time, is_available FROM provider_availability WHERE provider_id=$1', [provider.id]);
    if (!availRes.rows.length) {
      client.release();
      return res.status(400).json({ error: 'Set your weekly availability before generating slots.' });
    }
    const planned = projectSlots({ startDate, days, availability: availRes.rows, duration, buffer });

    await client.query('BEGIN');
    let created = 0;
    for (const s of planned) {
      const r = await client.query(
        `INSERT INTO provider_time_slots (provider_id, service_id, slot_date, start_time, end_time, status)
         VALUES ($1,$2,$3,$4,$5,'available')
         ON CONFLICT (provider_id, slot_date, start_time) DO NOTHING`,
        [provider.id, serviceId, s.date, s.start, s.end]
      );
      created += r.rowCount;
    }
    await client.query('COMMIT');
    res.json({ ok: true, created, planned: planned.length, startDate, days });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    console.error('time-slots generate', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

/* --------------------------- GET calendar ----------------------------- */
// GET /api/provider/availability/calendar?providerId=&from=&to=
router.get('/calendar', authMiddleware, async (req, res) => {
  try {
    const { provider, error } = await resolveOwnedProvider(req);
    if (error) return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'No provider profile found' });
    const from = (req.query.from || ymd(new Date())).slice(0, 10);
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 45);
    const to = (req.query.to || ymd(toDate)).slice(0, 10);

    const [bookings, blocked, availability] = await Promise.all([
      db.query(
        `SELECT b.id, b.booking_date, b.start_time, b.end_time, b.status,
                s.service_name, u.full_name AS patient_name
           FROM bookings b
           LEFT JOIN provider_services s ON s.id = b.service_id
           LEFT JOIN users u ON u.id = b.patient_id
          WHERE b.provider_id=$1 AND b.booking_date BETWEEN $2 AND $3
          ORDER BY b.booking_date, b.start_time`,
        [provider.id, from, to]
      ),
      db.query(
        `SELECT DISTINCT slot_date FROM provider_time_slots
          WHERE provider_id=$1 AND status='blocked' AND slot_date BETWEEN $2 AND $3`,
        [provider.id, from, to]
      ),
      db.query('SELECT day_of_week FROM provider_availability WHERE provider_id=$1 AND is_available=TRUE', [provider.id]),
    ]);

    res.json({
      providerId: provider.id,
      from, to,
      bookings: bookings.rows,
      blockedDates: blocked.rows.map((r) => ymd(new Date(r.slot_date))),
      availableDays: [...new Set(availability.rows.map((r) => Number(r.day_of_week)))],
    });
  } catch (err) {
    console.error('calendar', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------- PUT block/:date --------------------------- */
// Toggle a blocked day. Body: { providerId?, block?:boolean }
router.put('/block/:date', authMiddleware, async (req, res) => {
  try {
    const { provider, error } = await resolveOwnedProvider(req);
    if (error) return res.status(error).json({ error: error === 403 ? 'Forbidden' : 'No provider profile found' });
    const date = req.params.date.slice(0, 10);
    const block = req.body?.block !== false; // default: block

    if (block) {
      // Represent a full-day block as a single 00:00–23:59 blocked slot.
      await db.query(
        `INSERT INTO provider_time_slots (provider_id, slot_date, start_time, end_time, status)
         VALUES ($1,$2,'00:00','23:59','blocked')
         ON CONFLICT (provider_id, slot_date, start_time) DO UPDATE SET status='blocked'`,
        [provider.id, date]
      );
    } else {
      await db.query(
        `DELETE FROM provider_time_slots WHERE provider_id=$1 AND slot_date=$2 AND status='blocked'`,
        [provider.id, date]
      );
    }
    res.json({ ok: true, date, blocked: block });
  } catch (err) {
    console.error('block date', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

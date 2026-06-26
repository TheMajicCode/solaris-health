const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { award } = require('../lib/helpers');

const router = express.Router();

// ---------- BOOKINGS ----------
router.get('/bookings', authMiddleware, async (req, res) => {
  const r = await db.query(
    `SELECT b.*, l.title AS listing_title, l.listing_type, l.specialty, l.cover_image_url, l.city
     FROM booking_requests b LEFT JOIN listings l ON l.id = b.listing_id
     WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [req.user.userId]);
  res.json({ bookings: r.rows });
});

router.post('/bookings', authMiddleware, async (req, res) => {
  try {
    const { listingId, preferredDate, preferredTime, note } = req.body;
    const r = await db.query(
      `INSERT INTO booking_requests (user_id,listing_id,preferred_date,preferred_time,note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.userId, listingId, preferredDate || null, preferredTime || null, note || null]
    );
    await award(req.user.userId, 'booking_request', 30, 'engagement', 'Requested a booking');
    res.status(201).json({ booking: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- DAILY CHECK-INS ----------
router.get('/checkins', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 30', [req.user.userId]);
  res.json({ checkins: r.rows });
});

router.post('/checkins', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const r = await db.query(
      `INSERT INTO daily_checkins (user_id,energy_score,mood_score,sleep_hours,hydration_glasses,movement_minutes,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.userId, b.energyScore, b.moodScore, b.sleepHours, b.hydrationGlasses, b.movementMinutes, b.notes]
    );
    await award(req.user.userId, 'daily_checkin', 5, 'habit', 'Daily check-in');
    res.status(201).json({ checkin: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- REWARDS ----------
router.get('/rewards', authMiddleware, async (req, res) => {
  const events = await db.query('SELECT * FROM reward_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.userId]);
  const total = await db.query('SELECT COALESCE(SUM(points),0) AS total FROM reward_events WHERE user_id=$1', [req.user.userId]);
  res.json({ events: events.rows, total: Number(total.rows[0].total) });
});

// ---------- DOCUMENTS (labs / photos) ----------
router.get('/documents', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT id,document_type,file_name,mime_type,description,visibility,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC', [req.user.userId]);
  res.json({ documents: r.rows });
});

router.get('/documents/:id', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ document: r.rows[0] });
});

router.post('/documents', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const r = await db.query(
      `INSERT INTO documents (user_id,document_type,file_name,file_data,mime_type,description,visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,document_type,file_name,mime_type,description,created_at`,
      [req.user.userId, b.documentType || 'lab', b.fileName, b.fileData || null, b.mimeType, b.description, b.visibility || 'private']
    );
    res.status(201).json({ document: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

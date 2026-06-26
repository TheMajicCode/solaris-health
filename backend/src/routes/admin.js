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

module.exports = router;

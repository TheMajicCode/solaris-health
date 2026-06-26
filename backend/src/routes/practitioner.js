const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function requirePractitioner(req, res, next) {
  if (req.user.role !== 'practitioner' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Practitioner access only' });
  next();
}

// GET practitioner profile + linked listing
router.get('/profile', authMiddleware, requirePractitioner, async (req, res) => {
  const p = await db.query('SELECT * FROM practitioner_profiles WHERE user_id=$1', [req.user.userId]);
  let listing = null;
  if (p.rows[0]?.listing_id) {
    const l = await db.query('SELECT * FROM listings WHERE id=$1', [p.rows[0].listing_id]);
    listing = l.rows[0] || null;
  }
  res.json({ profile: p.rows[0] || null, listing });
});

// PUT practitioner onboarding (creates/links a listing)
router.put('/profile', authMiddleware, requirePractitioner, async (req, res) => {
  try {
    const b = req.body;
    // upsert practitioner profile
    const existing = await db.query('SELECT * FROM practitioner_profiles WHERE user_id=$1', [req.user.userId]);
    let profile = existing.rows[0];
    if (!profile) {
      const ins = await db.query('INSERT INTO practitioner_profiles (user_id) VALUES ($1) RETURNING *', [req.user.userId]);
      profile = ins.rows[0];
    }

    // Create or update linked listing
    let listingId = profile.listing_id;
    if (!listingId) {
      const u = await db.query('SELECT full_name FROM users WHERE id=$1', [req.user.userId]);
      const l = await db.query(
        `INSERT INTO listings (listing_type,node_type,status,title,specialty,short_description,full_description,
          city,country,price,duration_minutes,focus_areas_json,owner_user_id,created_by_admin,trust_score,rating)
         VALUES ('practitioner','practitioner_node','review',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,60,0) RETURNING id`,
        [b.title || u.rows[0].full_name, b.specialty, b.shortDescription, b.bio, b.city, b.country,
         b.price || null, b.durationMinutes || 60, JSON.stringify(b.focusAreas || [])]
      );
      listingId = l.rows[0].id;
    } else {
      await db.query(
        `UPDATE listings SET specialty=$1, short_description=$2, full_description=$3, city=$4, country=$5,
          price=$6, focus_areas_json=$7, updated_at=now() WHERE id=$8`,
        [b.specialty, b.shortDescription, b.bio, b.city, b.country, b.price || null,
         JSON.stringify(b.focusAreas || []), listingId]
      );
    }

    const upd = await db.query(
      `UPDATE practitioner_profiles SET specialty=$1, credentials_text=$2, years_experience=$3, bio=$4,
        treatment_philosophy=$5, listing_id=$6, onboarding_status='submitted', updated_at=now()
       WHERE user_id=$7 RETURNING *`,
      [b.specialty, b.credentialsText, b.yearsExperience || null, b.bio, b.treatmentPhilosophy, listingId, req.user.userId]
    );
    res.json({ profile: upd.rows[0], listingId });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET bookings for this practitioner's listings
router.get('/bookings', authMiddleware, requirePractitioner, async (req, res) => {
  const r = await db.query(
    `SELECT b.*, u.full_name AS patient_name, l.title AS listing_title
     FROM booking_requests b
     JOIN listings l ON l.id = b.listing_id
     LEFT JOIN users u ON u.id = b.user_id
     WHERE l.owner_user_id=$1 ORDER BY b.created_at DESC`, [req.user.userId]);
  res.json({ bookings: r.rows });
});

module.exports = router;

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/listings?type=practitioner&q=&featured=
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, q, featured } = req.query;
    const where = ["status='published'"];
    const vals = [];
    let i = 1;
    if (type && type !== 'all') { where.push(`listing_type = $${i++}`); vals.push(type); }
    if (featured === 'true') { where.push('featured = true'); }
    if (q) { where.push(`(title ILIKE $${i} OR specialty ILIKE $${i} OR short_description ILIKE $${i})`); vals.push(`%${q}%`); i++; }
    const result = await db.query(
      `SELECT * FROM listings WHERE ${where.join(' AND ')} ORDER BY featured DESC, rating DESC, created_at DESC`, vals
    );
    res.json({ listings: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/listings/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM listings WHERE id=$1', [req.params.id]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ listing: r.rows[0] });
});

// POST /api/listings (admin / practitioner create)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const r = await db.query(
      `INSERT INTO listings (listing_type,node_type,status,title,slug,tagline,short_description,full_description,
        specialty,cover_image_url,city,region,country,price,currency,duration_minutes,focus_areas_json,
        supports_systems_json,rating,trust_score,featured,owner_user_id,created_by_admin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
      [b.listingType, b.nodeType, b.status || 'published', b.title, b.slug, b.tagline, b.shortDescription,
       b.fullDescription, b.specialty, b.coverImageUrl, b.city, b.region, b.country, b.price, b.currency || 'USD',
       b.durationMinutes, JSON.stringify(b.focusAreas || []), JSON.stringify(b.supportsSystems || []),
       b.rating || 0, b.trustScore || 0, b.featured || false, req.user.role === 'practitioner' ? req.user.userId : null,
       req.user.role === 'admin']
    );
    res.status(201).json({ listing: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

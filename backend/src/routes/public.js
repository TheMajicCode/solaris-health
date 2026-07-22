const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * Public practitioner directory — NO authentication required.
 *
 * Surfaces active, visible providers from the marketplace so anyone can
 * discover integrative, root-cause practitioners before creating an account.
 *
 * GET /api/public/practitioners?q=&type=&city=&limit=
 */
router.get('/practitioners', async (req, res) => {
  try {
    const { q, type, city, limit = 40 } = req.query;

    const where = ["status='active'", 'hidden=false'];
    const vals = [];
    let i = 1;

    if (type && type !== 'all') {
      const types = String(type).split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length) {
        where.push(`provider_type = ANY($${i++})`);
        vals.push(types);
      }
    }
    if (city && city !== 'all') { where.push(`city ILIKE $${i++}`); vals.push(city); }
    if (q) {
      where.push(`(business_name ILIKE $${i} OR description ILIKE $${i} OR city ILIKE $${i})`);
      vals.push(`%${q}%`);
      i++;
    }

    const lim = Math.min(parseInt(limit, 10) || 40, 60);

    const sql = `
      SELECT id, business_name, provider_type, description, city, country,
             specialties, price_range, rating, review_count,
             profile_photo_url, cover_photo_url, verified, vtv_certified, featured
        FROM provider_profiles
       WHERE ${where.join(' AND ')}
       ORDER BY featured DESC, rating DESC, review_count DESC
       LIMIT $${i}`;
    vals.push(lim);

    const result = await db.query(sql, vals);
    res.json({ practitioners: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('public practitioners', err);
    res.status(500).json({ error: 'Could not load practitioners' });
  }
});

/**
 * GET /api/public/practitioner-types -> distinct active provider types with counts
 */
router.get('/practitioner-types', async (_req, res) => {
  try {
    const result = await db.query(
      "SELECT provider_type, COUNT(*)::int AS n FROM provider_profiles WHERE status='active' AND hidden=false GROUP BY provider_type ORDER BY n DESC"
    );
    res.json({ types: result.rows });
  } catch (err) {
    console.error('public practitioner-types', err);
    res.status(500).json({ error: 'Could not load types' });
  }
});

module.exports = router;

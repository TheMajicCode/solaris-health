const express = require('express');
const db = require('../db');
const { authMiddleware, verifyToken } = require('../middleware/auth');
const { audit } = require('../lib/helpers');
const { haversineKm, boundingBox } = require('../lib/distance');
const { geocode } = require('../lib/geocoding');

const router = express.Router();

// Provider type catalogue (kept in sync with the frontend)
const PROVIDER_TYPES = [
  { id: 'clinic', label: 'Clinic', icon: 'Building2' },
  { id: 'doctor', label: 'Doctor', icon: 'Stethoscope' },
  { id: 'dentist', label: 'Dentist', icon: 'Smile' },
  { id: 'nutritionist', label: 'Nutritionist', icon: 'Apple' },
  { id: 'therapist', label: 'Therapist', icon: 'Brain' },
  { id: 'wellness', label: 'Wellness Center', icon: 'Sparkles' },
  { id: 'gym', label: 'Gym & Fitness', icon: 'Dumbbell' },
  { id: 'spa', label: 'Spa & Recovery', icon: 'Flower2' },
  { id: 'farm', label: 'Organic Farm', icon: 'Leaf' },
  { id: 'workshop', label: 'Workshop', icon: 'Hammer' },
];

// Optional auth: populates req.user if a valid token is present, else continues.
function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const decoded = verifyToken(authHeader.slice(7));
    if (decoded) req.user = decoded;
  }
  next();
}

async function recomputeRating(providerId) {
  const r = await db.query(
    'SELECT COUNT(*)::int AS n, COALESCE(AVG(rating),0) AS avg FROM provider_ratings WHERE provider_id=$1',
    [providerId]
  );
  const n = r.rows[0].n;
  const avg = n > 0 ? Math.round(parseFloat(r.rows[0].avg) * 10) / 10 : 0;
  await db.query('UPDATE provider_profiles SET review_count=$1, rating=$2, updated_at=NOW() WHERE id=$3', [n, avg, providerId]);
  return { review_count: n, rating: avg };
}

async function ownsProvider(req, providerId) {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  const r = await db.query('SELECT user_id FROM provider_profiles WHERE id=$1', [providerId]);
  if (r.rows.length === 0) return false;
  return r.rows[0].user_id === req.user.userId;
}

/* ----------------------------- PUBLIC ROUTES ----------------------------- */

// GET /api/marketplace/categories  -> provider types with live counts
router.get('/categories', async (_req, res) => {
  try {
    const counts = await db.query(
      "SELECT provider_type, COUNT(*)::int AS n FROM provider_profiles WHERE status='active' AND hidden=false GROUP BY provider_type"
    );
    const map = Object.fromEntries(counts.rows.map((r) => [r.provider_type, r.n]));
    const categories = PROVIDER_TYPES.map((t) => ({ ...t, count: map[t.id] || 0 }));
    const total = counts.rows.reduce((s, r) => s + r.n, 0);
    res.json({ categories, total });
  } catch (err) {
    console.error('categories', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/providers  -> filtered, sorted, paginated list
// query: type, city, q, minRating, verified, vtv, featured, lat, lon, radius, sort, limit, offset
router.get('/providers', async (req, res) => {
  try {
    const {
      type, city, q, minRating, verified, vtv, featured,
      lat, lon, radius, sort = 'rating', limit = 60, offset = 0,
    } = req.query;

    const where = ["status='active'", "hidden=false"];
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
      where.push(`(business_name ILIKE $${i} OR description ILIKE $${i} OR address ILIKE $${i})`);
      vals.push(`%${q}%`); i++;
    }
    if (minRating) { where.push(`rating >= $${i++}`); vals.push(parseFloat(minRating)); }
    if (verified === 'true') where.push('verified = true');
    if (vtv === 'true') where.push('vtv_certified = true');
    if (featured === 'true') where.push('featured = true');

    // Geo bounding-box pre-filter
    const hasGeo = lat && lon && radius;
    if (hasGeo) {
      const box = boundingBox(parseFloat(lat), parseFloat(lon), parseFloat(radius));
      where.push(`latitude BETWEEN $${i} AND $${i + 1}`); vals.push(box.minLat, box.maxLat); i += 2;
      where.push(`longitude BETWEEN $${i} AND $${i + 1}`); vals.push(box.minLon, box.maxLon); i += 2;
    }

    let orderBy = 'featured DESC, rating DESC, review_count DESC';
    if (sort === 'newest') orderBy = 'created_at DESC';
    else if (sort === 'reviews') orderBy = 'review_count DESC, rating DESC';

    const lim = Math.min(parseInt(limit, 10) || 60, 200);
    const off = parseInt(offset, 10) || 0;

    const sql = `SELECT * FROM provider_profiles WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT $${i} OFFSET $${i + 1}`;
    vals.push(lim, off);
    const result = await db.query(sql, vals);

    let rows = result.rows;

    // App-layer precise distance + optional distance sort
    if (hasGeo) {
      const plat = parseFloat(lat), plon = parseFloat(lon), prad = parseFloat(radius);
      rows = rows
        .map((p) => ({ ...p, distance_km: haversineKm(plat, plon, p.latitude, p.longitude) }))
        .filter((p) => p.distance_km == null || p.distance_km <= prad);
      if (sort === 'distance') {
        rows.sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
      }
    }

    res.json({ providers: rows, count: rows.length });
  } catch (err) {
    console.error('providers list', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/search  -> map-focused geo search within a bounding box
// query: north, south, east, west (map bounds) OR lat/lon/radius; plus type, q
router.get('/search', async (req, res) => {
  try {
    const { north, south, east, west, lat, lon, radius, type, q, limit = 200 } = req.query;
    const where = ["status='active'", "hidden=false", 'latitude IS NOT NULL', 'longitude IS NOT NULL'];
    const vals = [];
    let i = 1;

    if (north && south && east && west) {
      where.push(`latitude BETWEEN $${i} AND $${i + 1}`); vals.push(parseFloat(south), parseFloat(north)); i += 2;
      where.push(`longitude BETWEEN $${i} AND $${i + 1}`); vals.push(parseFloat(west), parseFloat(east)); i += 2;
    } else if (lat && lon && radius) {
      const box = boundingBox(parseFloat(lat), parseFloat(lon), parseFloat(radius));
      where.push(`latitude BETWEEN $${i} AND $${i + 1}`); vals.push(box.minLat, box.maxLat); i += 2;
      where.push(`longitude BETWEEN $${i} AND $${i + 1}`); vals.push(box.minLon, box.maxLon); i += 2;
    }
    if (type && type !== 'all') {
      const types = String(type).split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length) { where.push(`provider_type = ANY($${i++})`); vals.push(types); }
    }
    if (q) { where.push(`(business_name ILIKE $${i} OR description ILIKE $${i})`); vals.push(`%${q}%`); i++; }

    const lim = Math.min(parseInt(limit, 10) || 200, 500);
    const sql = `SELECT id, business_name, provider_type, latitude, longitude, rating, review_count, verified, vtv_certified, featured, price_range, city, profile_photo_url, address FROM provider_profiles WHERE ${where.join(' AND ')} ORDER BY featured DESC, rating DESC LIMIT $${i}`;
    vals.push(lim);
    const result = await db.query(sql, vals);

    let rows = result.rows;
    if (lat && lon) {
      const plat = parseFloat(lat), plon = parseFloat(lon);
      rows = rows.map((p) => ({ ...p, distance_km: haversineKm(plat, plon, p.latitude, p.longitude) }));
    }
    res.json({ providers: rows, count: rows.length });
  } catch (err) {
    console.error('search', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/providers/:id  -> full detail with children
router.get('/providers/:id', optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const p = await db.query('SELECT * FROM provider_profiles WHERE id=$1', [id]);
    if (p.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // Hidden (unapproved) profiles are only visible to their owner or an admin.
    const prof = p.rows[0];
    const isOwnerOrAdmin = req.user
      ? (req.user.role === 'admin' || prof.user_id === req.user.userId)
      : false;
    if (prof.hidden && !isOwnerOrAdmin) {
      return res.status(404).json({ error: 'Not found' });
    }

    const [services, credentials, photos, reviews] = await Promise.all([
      db.query('SELECT * FROM provider_services WHERE provider_id=$1 ORDER BY category, service_name', [id]),
      db.query('SELECT * FROM provider_credentials WHERE provider_id=$1 ORDER BY issued_date DESC NULLS LAST', [id]),
      db.query('SELECT * FROM provider_photos WHERE provider_id=$1 ORDER BY sort_order, id', [id]),
      db.query('SELECT * FROM provider_ratings WHERE provider_id=$1 ORDER BY created_at DESC LIMIT 50', [id]),
    ]);

    const provider = p.rows[0];
    provider.is_owner = req.user
      ? (req.user.role === 'admin' || provider.user_id === req.user.userId)
      : false;

    res.json({
      provider,
      services: services.rows,
      credentials: credentials.rows,
      photos: photos.rows,
      reviews: reviews.rows,
    });
  } catch (err) {
    console.error('provider detail', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/providers/:id/reviews
router.get('/providers/:id/reviews', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM provider_ratings WHERE provider_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, Math.min(parseInt(req.query.limit, 10) || 50, 200), parseInt(req.query.offset, 10) || 0]
    );
    res.json({ reviews: r.rows });
  } catch (err) {
    console.error('reviews', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* -------------------------- AUTHENTICATED ROUTES ------------------------- */

// POST /api/marketplace/providers  -> create a provider profile (claims ownership)
router.post('/providers', authMiddleware, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.business_name || !b.provider_type) {
      return res.status(400).json({ error: 'business_name and provider_type are required' });
    }

    let lat = b.latitude != null ? parseFloat(b.latitude) : null;
    let lon = b.longitude != null ? parseFloat(b.longitude) : null;

    // Geocode if coordinates were not supplied but an address was
    if ((lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) && b.address) {
      const g = await geocode(b.address, { city: b.city, country: b.country });
      if (g) { lat = g.lat; lon = g.lon; }
    }

    const result = await db.query(
      `INSERT INTO provider_profiles
        (user_id, provider_type, business_name, description, address, city, country,
         latitude, longitude, phone, website, email, profile_photo_url, cover_photo_url,
         hours_of_operation, specialties, price_range, status, claimed)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'El Salvador'),$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',true)
       RETURNING *`,
      [
        req.user.userId, b.provider_type, b.business_name, b.description || null,
        b.address || null, b.city || null, b.country || null,
        lat, lon, b.phone || null, b.website || null, b.email || null,
        b.profile_photo_url || null, b.cover_photo_url || null,
        b.hours_of_operation ? JSON.stringify(b.hours_of_operation) : null,
        b.specialties ? JSON.stringify(b.specialties) : null,
        b.price_range || null,
      ]
    );
    const provider = result.rows[0];

    // Insert nested services if provided
    if (Array.isArray(b.services)) {
      for (const s of b.services) {
        if (!s || !s.service_name) continue;
        await db.query(
          `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [provider.id, s.service_name, s.description || null, s.price || null, s.currency || 'USD', s.duration_minutes || null, s.category || null]
        );
      }
    }
    if (Array.isArray(b.photos)) {
      let order = 0;
      for (const ph of b.photos) {
        const url = typeof ph === 'string' ? ph : ph && ph.photo_url;
        if (!url) continue;
        await db.query(
          'INSERT INTO provider_photos (provider_id, photo_url, caption, sort_order) VALUES ($1,$2,$3,$4)',
          [provider.id, url, (ph && ph.caption) || null, order++]
        );
      }
    }

    audit({ actorId: req.user.userId, action: 'provider.create', resourceType: 'provider', resourceId: provider.id, newValues: { business_name: provider.business_name }, ip: req.ip });
    res.status(201).json({ provider });
  } catch (err) {
    console.error('create provider', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/marketplace/providers/:id  -> update (owner or admin)
router.put('/providers/:id', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await ownsProvider(req, id))) return res.status(403).json({ error: 'Forbidden' });

    const allowed = [
      'provider_type', 'business_name', 'description', 'address', 'city', 'country',
      'latitude', 'longitude', 'phone', 'website', 'email', 'profile_photo_url',
      'cover_photo_url', 'hours_of_operation', 'specialties', 'price_range', 'status',
      'hidden',
    ];
    const sets = [];
    const vals = [];
    let i = 1;
    for (const k of allowed) {
      if (k in (req.body || {})) {
        let v = req.body[k];
        if ((k === 'hours_of_operation' || k === 'specialties') && v != null && typeof v !== 'string') {
          v = JSON.stringify(v);
        }
        sets.push(`${k}=$${i++}`); vals.push(v);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    // Guard: a non-admin owner may only un-hide an already-approved profile.
    if ('hidden' in (req.body || {}) && req.body.hidden === false && req.user.role !== 'admin') {
      const chk = await db.query('SELECT approval_status FROM provider_profiles WHERE id=$1', [id]);
      if (chk.rows[0]?.approval_status !== 'approved') {
        return res.status(403).json({ error: 'Listing must be approved before it can be made visible.' });
      }
    }

    sets.push('updated_at=NOW()');
    vals.push(id);
    const result = await db.query(`UPDATE provider_profiles SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    audit({ actorId: req.user.userId, action: 'provider.update', resourceType: 'provider', resourceId: id, ip: req.ip });
    res.json({ provider: result.rows[0] });
  } catch (err) {
    console.error('update provider', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/providers/:id/photos
router.post('/providers/:id/photos', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await ownsProvider(req, id))) return res.status(403).json({ error: 'Forbidden' });
    const { photo_url, caption, sort_order } = req.body || {};
    if (!photo_url) return res.status(400).json({ error: 'photo_url required' });
    const r = await db.query(
      'INSERT INTO provider_photos (provider_id, photo_url, caption, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, photo_url, caption || null, sort_order || 0]
    );
    res.status(201).json({ photo: r.rows[0] });
  } catch (err) {
    console.error('add photo', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/providers/:id/services
router.post('/providers/:id/services', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    if (!(await ownsProvider(req, id))) return res.status(403).json({ error: 'Forbidden' });
    const { service_name, description, price, currency, duration_minutes, category } = req.body || {};
    if (!service_name) return res.status(400).json({ error: 'service_name required' });
    const r = await db.query(
      `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, service_name, description || null, price || null, currency || 'USD', duration_minutes || null, category || null]
    );
    res.status(201).json({ service: r.rows[0] });
  } catch (err) {
    console.error('add service', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/providers/:id/reviews  -> add/replace a review, recompute rating
router.post('/providers/:id/reviews', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const { rating, review_text, author_name } = req.body || {};
    const r = parseInt(rating, 10);
    if (!r || r < 1 || r > 5) return res.status(400).json({ error: 'rating must be 1-5' });

    const exists = await db.query('SELECT id FROM provider_profiles WHERE id=$1', [id]);
    if (exists.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    // Resolve author name from the users table if not supplied
    let name = author_name;
    if (!name) {
      const u = await db.query('SELECT full_name, first_name FROM users WHERE id=$1', [req.user.userId]);
      name = u.rows[0]?.full_name || u.rows[0]?.first_name || 'Member';
    }

    const ins = await db.query(
      `INSERT INTO provider_ratings (provider_id, user_id, author_name, rating, review_text)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (provider_id, user_id)
       DO UPDATE SET rating=EXCLUDED.rating, review_text=EXCLUDED.review_text, author_name=EXCLUDED.author_name, created_at=NOW()
       RETURNING *`,
      [id, req.user.userId, name, r, review_text || null]
    );
    const agg = await recomputeRating(id);
    audit({ actorId: req.user.userId, action: 'provider.review', resourceType: 'provider', resourceId: id, newValues: { rating: r }, ip: req.ip });
    res.status(201).json({ review: ins.rows[0], ...agg });
  } catch (err) {
    console.error('add review', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/providers/:id/claim  -> claim an unowned listing
router.post('/providers/:id/claim', authMiddleware, async (req, res) => {
  try {
    const id = req.params.id;
    const p = await db.query('SELECT user_id, claimed FROM provider_profiles WHERE id=$1', [id]);
    if (p.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (p.rows[0].user_id && p.rows[0].claimed) {
      return res.status(409).json({ error: 'Already claimed' });
    }
    const r = await db.query(
      'UPDATE provider_profiles SET user_id=$1, claimed=true, updated_at=NOW() WHERE id=$2 RETURNING *',
      [req.user.userId, id]
    );
    audit({ actorId: req.user.userId, action: 'provider.claim', resourceType: 'provider', resourceId: id, ip: req.ip });
    res.json({ provider: r.rows[0] });
  } catch (err) {
    console.error('claim', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/my-providers  -> providers owned by the current user
router.get('/my-providers', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM provider_profiles WHERE user_id=$1 ORDER BY created_at DESC', [req.user.userId]);
    res.json({ providers: r.rows });
  } catch (err) {
    console.error('my-providers', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

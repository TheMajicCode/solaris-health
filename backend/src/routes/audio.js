const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/audio/library — all tracks with unlock status + practitioner info
router.get('/library', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.listing_id, a.title, a.description, a.audio_url, a.cover_image_url,
              a.duration_seconds, a.is_free, a.tags_json, a.sort_order,
              l.title AS practitioner_name, l.specialty AS practitioner_specialty,
              l.cover_image_url AS practitioner_avatar,
              (ua.id IS NOT NULL) AS unlocked
         FROM audio_library a
         LEFT JOIN listings l ON l.id = a.listing_id
         LEFT JOIN user_audio ua ON ua.audio_id = a.id AND ua.user_id = $1
        ORDER BY a.sort_order ASC, a.created_at ASC`,
      [req.user.userId]
    );
    res.json({ tracks: rows });
  } catch (err) {
    console.error('[audio] library error', err);
    res.status(500).json({ error: 'Failed to load audio library' });
  }
});

// GET /api/audio/my — only unlocked tracks
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.listing_id, a.title, a.description, a.audio_url, a.cover_image_url,
              a.duration_seconds, a.is_free, a.tags_json,
              l.title AS practitioner_name, l.specialty AS practitioner_specialty,
              ua.unlocked_at
         FROM user_audio ua
         JOIN audio_library a ON a.id = ua.audio_id
         LEFT JOIN listings l ON l.id = a.listing_id
        WHERE ua.user_id = $1
        ORDER BY ua.unlocked_at DESC`,
      [req.user.userId]
    );
    res.json({ tracks: rows });
  } catch (err) {
    console.error('[audio] my error', err);
    res.status(500).json({ error: 'Failed to load your audio' });
  }
});

// POST /api/audio/accept/:listingId — unlock all FREE tracks from a practitioner listing
router.post('/accept/:listingId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id FROM audio_library WHERE listing_id = $1 AND is_free = true`,
      [req.params.listingId]
    );
    if (!rows.length) return res.status(404).json({ error: 'No free tracks found for this practitioner' });

    let unlocked = 0;
    for (const t of rows) {
      const r = await db.query(
        `INSERT INTO user_audio (user_id, audio_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, audio_id) DO NOTHING`,
        [req.user.userId, t.id]
      );
      unlocked += r.rowCount;
    }
    res.json({ ok: true, unlocked });
  } catch (err) {
    console.error('[audio] accept error', err);
    res.status(500).json({ error: 'Failed to add tracks to your library' });
  }
});

// POST /api/audio/unlock/:audioId — unlock a single free track
router.post('/unlock/:audioId', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, is_free FROM audio_library WHERE id = $1`,
      [req.params.audioId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Track not found' });
    if (!rows[0].is_free) {
      return res.status(402).json({ error: 'This is a premium track. Book a session with the practitioner to unlock it.' });
    }
    await db.query(
      `INSERT INTO user_audio (user_id, audio_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, audio_id) DO NOTHING`,
      [req.user.userId, req.params.audioId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[audio] unlock error', err);
    res.status(500).json({ error: 'Failed to unlock track' });
  }
});

// GET /api/audio/practitioner — the current practitioner's own published tracks
// (scoped by listings.owner_user_id — reliable, no client-side ID guessing).
router.get('/practitioner', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.listing_id, a.title, a.description, a.audio_url,
              a.duration_seconds, a.is_free, a.tags_json, a.created_at,
              l.title AS listing_title
         FROM audio_library a
         JOIN listings l ON l.id = a.listing_id AND l.owner_user_id = $1
        ORDER BY a.created_at DESC`,
      [req.user.userId]
    );
    res.json({ tracks: rows });
  } catch (err) {
    console.error('[audio] practitioner list error', err);
    res.status(500).json({ error: 'Failed to load your tracks' });
  }
});

// POST /api/audio/upload — a practitioner publishes a track to their own listing.
// Metadata-only: the audio file itself is handled client-side; we store its filename
// as audio_url. Requires the caller to be a provider who owns a listing.
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Must be a provider
    const u = await db.query('SELECT is_provider FROM users WHERE id=$1', [userId]);
    if (!u.rows.length || !u.rows[0].is_provider) {
      return res.status(403).json({ error: 'Only practitioners can upload audio' });
    }

    const {
      title,
      description,
      tags_json,
      duration_seconds,
      is_free,
      audio_url,
      listingId,
    } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    // Resolve the practitioner's listing (their own only)
    let targetListingId = listingId;
    if (targetListingId) {
      const owned = await db.query(
        'SELECT id FROM listings WHERE id=$1 AND owner_user_id=$2',
        [targetListingId, userId]
      );
      if (!owned.rows.length) return res.status(403).json({ error: 'That listing is not yours' });
    } else {
      const l = await db.query(
        'SELECT id FROM listings WHERE owner_user_id=$1 ORDER BY created_at ASC LIMIT 1',
        [userId]
      );
      if (!l.rows.length) return res.status(400).json({ error: 'You have no listing to attach audio to' });
      targetListingId = l.rows[0].id;
    }

    // Normalize tags into a JSON array
    let tags = tags_json;
    if (typeof tags === 'string') {
      tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(tags)) tags = [];

    // audio_library.audio_url is NOT NULL. If no file reference was provided,
    // derive a stable slug placeholder from the title so the insert is valid.
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const resolvedAudioUrl = (audio_url && String(audio_url).trim()) || `${slug || 'track'}.mp3`;

    const { rows } = await db.query(
      `INSERT INTO audio_library (listing_id, title, description, audio_url, duration_seconds, is_free, tags_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, listing_id, title, description, audio_url, duration_seconds, is_free, tags_json, created_at`,
      [
        targetListingId,
        title.trim(),
        description || null,
        resolvedAudioUrl,
        Number.isFinite(+duration_seconds) ? +duration_seconds : null,
        is_free === true || is_free === 'true',
        JSON.stringify(tags),
      ]
    );
    res.json({ track: rows[0] });
  } catch (err) {
    console.error('[audio] upload error', err);
    res.status(500).json({ error: 'Failed to upload audio' });
  }
});

module.exports = router;

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

module.exports = router;

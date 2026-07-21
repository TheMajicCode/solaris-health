const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const ALLOWED_MOODS = ['great', 'good', 'okay', 'low', 'stormy'];

// GET /api/journal — last 30 entries for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, mood, content, created_at
         FROM journal_entries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 30`,
      [req.user.userId]
    );
    res.json({ entries: rows });
  } catch (err) {
    console.error('[journal] list error', err);
    res.status(500).json({ error: 'Failed to load journal entries' });
  }
});

// POST /api/journal — create an entry
router.post('/', authMiddleware, async (req, res) => {
  try {
    const content = (req.body?.content || '').trim();
    let mood = (req.body?.mood || '').trim().toLowerCase();
    if (!content) return res.status(400).json({ error: 'Entry content is required' });
    if (content.length > 5000) return res.status(400).json({ error: 'Entry is too long' });
    if (mood && !ALLOWED_MOODS.includes(mood)) mood = null;

    const { rows } = await db.query(
      `INSERT INTO journal_entries (user_id, mood, content)
       VALUES ($1, $2, $3)
       RETURNING id, mood, content, created_at`,
      [req.user.userId, mood || null, content]
    );
    res.status(201).json({ entry: rows[0] });
  } catch (err) {
    console.error('[journal] create error', err);
    res.status(500).json({ error: 'Failed to save journal entry' });
  }
});

// DELETE /api/journal/:id — delete own entry
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM journal_entries WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[journal] delete error', err);
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});

module.exports = router;

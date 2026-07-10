'use strict';
/**
 * Leaderboard (Solaris sprint) — Top contributors by level points.
 *   GET /api/leaderboard        -> top members with level/band (Top-500 style)
 *   GET /api/leaderboard/me     -> the authenticated user's rank
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { levelFor } = require('../lib/levels');

const router = express.Router();

function shapeEntry(row, rank) {
  const level = levelFor(row.level_points || 0);
  return {
    rank,
    userId: row.id,
    name: row.display_name || row.full_name || (row.email ? row.email.split('@')[0] : 'Member'),
    npub: row.nostr_npub,
    role: row.role,
    points: row.level_points || 0,
    level: level.level,
    band: level.band,
    color: level.color,
  };
}

// GET /api/leaderboard?limit=500
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 500);
    const result = await db.query(
      `SELECT id, email, display_name, full_name, nostr_npub, role, level_points
       FROM users
       WHERE deleted_at IS NULL AND COALESCE(level_points,0) > 0
       ORDER BY level_points DESC, created_at ASC
       LIMIT $1`,
      [limit]
    );
    const entries = result.rows.map((r, i) => shapeEntry(r, i + 1));
    res.json({ leaderboard: entries, count: entries.length });
  } catch (err) {
    console.error('leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/leaderboard/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const meRes = await db.query(
      'SELECT id, email, display_name, full_name, nostr_npub, role, level_points FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!meRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const me = meRes.rows[0];
    const myPoints = me.level_points || 0;
    const rankRes = await db.query(
      `SELECT COUNT(*)::int AS ahead FROM users
       WHERE deleted_at IS NULL AND COALESCE(level_points,0) > $1`,
      [myPoints]
    );
    const rank = rankRes.rows[0].ahead + 1;
    res.json({ me: shapeEntry(me, rank) });
  } catch (err) {
    console.error('leaderboard me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

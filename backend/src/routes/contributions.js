const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all contributions for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
        v.full_name as verifier_name
      FROM contributions c
      LEFT JOIN users v ON c.verifier_id = v.id
      WHERE c.user_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get contributions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create contribution
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { eventType, category, description, impact, rewardSats, isPublic } = req.body;

    const result = await db.query(
      `INSERT INTO contributions (user_id, event_type, category, description, impact, reward_sats, public, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [req.user.userId, eventType, category, description, impact, rewardSats || 0, isPublic !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create contribution error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

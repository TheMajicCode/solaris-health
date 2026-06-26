const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all agents for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM agents 
       WHERE owner_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get agents error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create agent
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, purpose, permissions, walletPermission, trustScore, permissionLevel } = req.body;

    const result = await db.query(
      `INSERT INTO agents (owner_id, name, purpose, permissions, wallet_permission, trust_score, permission_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.userId, name, purpose, JSON.stringify(permissions || []), walletPermission || 'none', trustScore || 0, permissionLevel || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create agent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update agent permission level
router.patch('/:id/permission', authMiddleware, async (req, res) => {
  try {
    const { permissionLevel } = req.body;

    const result = await db.query(
      `UPDATE agents 
       SET permission_level = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [permissionLevel, req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update agent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

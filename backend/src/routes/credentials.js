const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get all credentials for authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, 
        i.full_name as issuer_name,
        h.full_name as holder_name
      FROM credentials c
      LEFT JOIN users i ON c.issuer_id = i.id
      LEFT JOIN users h ON c.holder_id = h.id
      WHERE c.holder_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get credentials error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create credential (for issuers)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { holderId, credentialType, credentialName, isPublic } = req.body;

    const result = await db.query(
      `INSERT INTO credentials (issuer_id, holder_id, credential_type, credential_name, public, verified_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.user.userId, holderId, credentialType, credentialName, isPublic || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create credential error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

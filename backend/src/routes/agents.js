const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  ensureLucaAgent,
  setLucaActive,
  revokeGrant,
} = require('../lib/agent-authority');
const { createNotification } = require('../lib/notifications');

const router = express.Router();

// ---- LUCA agent authority (Slice 7) ----
// The user-owned LUCA agent: identity, kill-switch and capability grants.
// Disabling LUCA never deletes the user, their data, or their session.

// GET /api/agents/luca — the caller's LUCA agent + its grants
router.get('/luca', authMiddleware, async (req, res) => {
  try {
    const agent = await ensureLucaAgent(req.user.userId);
    const grants = await db.query(
      `SELECT id, capability, scope, requires_human_approval, status,
              granted_at, expires_at, revoked_at
         FROM agent_capability_grants
        WHERE agent_id=$1 ORDER BY granted_at`,
      [agent.id]
    );
    res.json({
      id: agent.id,
      name: agent.name,
      purpose: agent.purpose,
      active: agent.active,
      grants: grants.rows,
    });
  } catch (err) {
    console.error('Get LUCA agent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/luca/disable | /enable — owner kill-switch
router.post('/luca/:action(disable|enable)', authMiddleware, async (req, res) => {
  try {
    const active = req.params.action === 'enable';
    const agent = await setLucaActive(req.user.userId, active);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    // Record the state change in the notification center (system type,
    // in-app; the generic push template carries no detail).
    createNotification(
      req.user.userId,
      'system',
      active ? 'LUCA re-enabled' : 'LUCA paused',
      active
        ? 'Your LUCA companion is active again.'
        : 'Your LUCA companion is switched off. Your data and Passport are untouched.',
      { agentId: agent.id }
    ).catch(() => {});
    res.json({
      id: agent.id,
      active: agent.active,
      message: active
        ? 'LUCA is back by your side.'
        : 'LUCA is switched off. Your data, Passport and session are untouched.',
    });
  } catch (err) {
    console.error('Toggle LUCA agent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/grants/:id/revoke — owner revokes one capability grant
router.patch('/grants/:id/revoke', authMiddleware, async (req, res) => {
  try {
    const grant = await revokeGrant(req.user.userId, req.params.id);
    if (!grant) return res.status(404).json({ error: 'Grant not found or already revoked' });
    res.json(grant);
  } catch (err) {
    console.error('Revoke grant error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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

'use strict';
/**
 * identity.js — Solaris ID endpoints (ADR 001). Mounted at /api/identity.
 *
 * GET /api/identity/me           — plain-language identity summary
 *                                  (Solaris ID, bindings, GPS end address,
 *                                  agent authority state).
 * PUT /api/identity/me/end-address — set/reset the GPS end address on the
 *                                  subject (Lightning-address shape;
 *                                  configuration only — simulated, no real
 *                                  payments).
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const identity = require('../lib/identity');

const router = express.Router();

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const summary = await identity.getIdentitySummary(req.user.userId);
    if (!summary) return res.status(404).json({ error: 'Identity not found' });
    res.json(summary);
  } catch (err) {
    console.error('[identity] GET /me failed:', err.message);
    res.status(500).json({ error: 'Failed to load identity' });
  }
});

router.put('/me/end-address', authMiddleware, async (req, res) => {
  try {
    const { address } = req.body || {};
    await identity.setGpsEndAddress(req.user.userId, address);
    const summary = await identity.getIdentitySummary(req.user.userId);
    res.json({
      ok: true,
      simulated: true,
      note: 'End address saved as configuration only. This showcase makes no real payments.',
      gps: summary.gps,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[identity] PUT /me/end-address failed:', err.message);
    res.status(status).json({ error: err.message || 'Failed to update end address' });
  }
});

module.exports = router;

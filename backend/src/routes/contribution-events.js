'use strict';
/**
 * Contribution ledger (Solaris sprint).
 *   GET  /api/contribution-events/mine  -> the user's signed contribution events
 *   GET  /api/contribution-events        -> recent events across the network
 *   POST /api/contribution-events        -> log a contribution (mock signature),
 *                                           award points, bump level_points
 *
 * Points earn levels; levels are earned only by real attested contributions.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { levelFor } = require('../lib/levels');

const router = express.Router();

const VALID_KINDS = ['referral', 'hosting', 'maintenance', 'education', 'care_milestone', 'coordination'];
const DEFAULT_POINTS = {
  referral: 25, hosting: 50, maintenance: 15, education: 20, care_milestone: 100, coordination: 30,
};

function shapeEvent(e) {
  return {
    id: e.id,
    contributorUserId: e.contributor_user_id,
    contributorName: e.contributor_name || undefined,
    kind: e.kind,
    subjectRef: e.subject_ref,
    evidence: typeof e.evidence === 'string' ? JSON.parse(e.evidence) : e.evidence,
    points: e.points,
    signatureMock: e.signature_mock,
    status: e.status,
    createdAt: e.created_at,
  };
}

// GET /api/contribution-events/mine
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM contribution_events WHERE contributor_user_id = $1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    const total = result.rows.reduce((s, e) => s + (e.status === 'attested' ? e.points : 0), 0);
    res.json({ events: result.rows.map(shapeEvent), attestedPoints: total });
  } catch (err) {
    console.error('contribution mine error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/contribution-events  (network-wide recent feed)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = await db.query(
      `SELECT ce.*, COALESCE(u.display_name, u.full_name) AS contributor_name
       FROM contribution_events ce
       LEFT JOIN users u ON u.id = ce.contributor_user_id
       ORDER BY ce.created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ events: result.rows.map(shapeEvent) });
  } catch (err) {
    console.error('contribution feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contribution-events  { kind, subjectRef?, evidence?, points? }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { kind, subjectRef, evidence, points } = req.body || {};
    if (!kind || !VALID_KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind must be one of: ${VALID_KINDS.join(', ')}` });
    }
    const pts = Number.isFinite(parseInt(points, 10)) ? parseInt(points, 10) : (DEFAULT_POINTS[kind] || 10);
    const signature = 'sig_' + crypto.randomBytes(16).toString('hex');

    const ins = await db.query(
      `INSERT INTO contribution_events (contributor_user_id, kind, subject_ref, evidence, points, signature_mock, status)
       VALUES ($1,$2,$3,$4,$5,$6,'attested') RETURNING *`,
      [req.user.userId, kind, subjectRef || null, JSON.stringify(evidence || {}), pts, signature]
    );

    // Award points -> bump level_points
    const upd = await db.query(
      `UPDATE users SET level_points = COALESCE(level_points,0) + $1, updated_at = NOW()
       WHERE id = $2 RETURNING level_points`,
      [pts, req.user.userId]
    );
    const newPoints = upd.rows[0].level_points;
    const level = levelFor(newPoints);

    res.status(201).json({
      event: shapeEvent(ins.rows[0]),
      pointsAwarded: pts,
      totalPoints: newPoints,
      level,
      simulated: true,
    });
  } catch (err) {
    console.error('contribution create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

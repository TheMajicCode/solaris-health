'use strict';
/**
 * LUCA context endpoint (Solaris sprint, spec §7).
 *   GET /api/luca/context            -> context for the authenticated user
 *   GET /api/luca/context?user_id=   -> optional assertion of the same account
 *
 * Returns: role, name, level/points, pending items (appointments/follow-ups/
 * receipts), last 5 ledger events, and the §6 guidance row for that role.
 * The chat panel prepends this to the bot conversation.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { levelFor } = require('../lib/levels');

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && value.length === 36 && UUID_PATTERN.test(value);
}

router.get('/context', authMiddleware, async (req, res) => {
  try {
    // The validated session is the only authority for these private records.
    const userId = req.user && req.user.userId;
    if (!isUuid(userId)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const requestedUserId = req.query.user_id;
    if (requestedUserId !== undefined) {
      if (!isUuid(requestedUserId)) {
        return res.status(400).json({ error: 'Invalid user_id' });
      }
      if (requestedUserId.toLowerCase() !== userId.toLowerCase()) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (!userRes.rows.length) return res.status(404).json({ error: 'User not found' });
    const u = userRes.rows[0];
    const name = u.display_name || u.full_name || (u.email ? u.email.split('@')[0] : 'friend');
    const points = u.level_points || 0;
    const level = levelFor(points);

    // Guidance row for the role
    const gRes = await db.query('SELECT * FROM luca_guidance WHERE role = $1', [u.role]);
    let guidance = gRes.rows[0] || null;
    if (guidance) {
      guidance = {
        role: guidance.role,
        job: guidance.job,
        firstMessageTemplate: guidance.first_message_template,
        topActions: typeof guidance.top_actions === 'string' ? JSON.parse(guidance.top_actions) : guidance.top_actions,
        tone: guidance.tone,
      };
    }

    // Pending items
    const apptRes = await db.query(
      `SELECT a.id, a.title, a.scheduled_at, a.status, a.follow_up_status, o.name AS org_name
       FROM appointments a LEFT JOIN organizations o ON o.id = a.org_id
       WHERE (a.patient_id = $1 OR a.practitioner_id = $1) AND a.scheduled_at >= NOW() - interval '1 day'
       ORDER BY a.scheduled_at ASC LIMIT 10`,
      [userId]
    );
    const followUpsRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM appointments
       WHERE practitioner_id = $1 AND follow_up_status = 'draft'`,
      [userId]
    );
    const receiptsRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM split_receipts WHERE payer_user_id = $1`,
      [userId]
    );

    // Last 5 ledger (contribution) events
    const ledgerRes = await db.query(
      `SELECT id, kind, points, status, created_at FROM contribution_events
       WHERE contributor_user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    res.json({
      user: {
        id: u.id,
        name,
        role: u.role,
        npub: u.nostr_npub,
        did: u.did,
        keyCustody: u.key_custody,
      },
      level: {
        points,
        level: level.level,
        band: level.band,
        color: level.color,
        pointsToNext: level.pointsToNext,
        progress: level.progress,
      },
      pending: {
        appointments: apptRes.rows.map((a) => ({
          id: a.id, title: a.title, scheduledAt: a.scheduled_at,
          status: a.status, followUpStatus: a.follow_up_status, orgName: a.org_name,
        })),
        followUpsPending: followUpsRes.rows[0].c,
        receiptsCount: receiptsRes.rows[0].c,
      },
      recentLedger: ledgerRes.rows.map((e) => ({
        id: e.id, kind: e.kind, points: e.points, status: e.status, createdAt: e.created_at,
      })),
      guidance,
      simulated: true,
    });
  } catch (_err) {
    console.error('[luca-context] context unavailable');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

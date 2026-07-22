'use strict';
/**
 * consent.js — consent-gated Passport sharing between members and practitioners.
 *
 * A practitioner may *request* access to a member's Passport. The member alone
 * decides — grant or decline — and may revoke at any time. Nothing about a
 * member's health data is ever visible to a practitioner without an active,
 * member-granted consent row. This is the sovereignty guarantee, enforced in code.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');

const router = express.Router();

const DEFAULT_SECTIONS = ['assessment', 'checkins'];

// POST /api/consent/request — practitioner requests access to a member's Passport.
// Body: { memberId, sections?: string[] }
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const practitionerId = req.user.userId;
    const { memberId } = req.body;
    let { sections } = req.body;
    if (!memberId) return res.status(400).json({ error: 'memberId is required' });
    if (memberId === practitionerId) return res.status(400).json({ error: 'Cannot request your own Passport' });
    if (!Array.isArray(sections) || !sections.length) sections = DEFAULT_SECTIONS;

    const practitioner = await db.query(
      'SELECT full_name, first_name FROM users WHERE id=$1',
      [practitionerId]
    );
    const pName =
      practitioner.rows[0]?.full_name || practitioner.rows[0]?.first_name || 'A practitioner';

    // Upsert: a fresh request re-opens a previously revoked/declined consent as pending.
    const r = await db.query(
      `INSERT INTO passport_consents (member_id, practitioner_id, granted_sections, status, requested_at, responded_at)
       VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP, NULL)
       ON CONFLICT (member_id, practitioner_id)
       DO UPDATE SET status='pending', granted_sections=$3, requested_at=CURRENT_TIMESTAMP, responded_at=NULL
       RETURNING id, member_id, practitioner_id, granted_sections, status, requested_at`,
      [memberId, practitionerId, JSON.stringify(sections)]
    );

    await createNotification(
      memberId,
      'consent_request',
      'Passport access request',
      `${pName} would like to view parts of your Sovereign Passport. You decide whether to grant access.`,
      { consentId: r.rows[0].id, practitionerId, sections }
    );

    res.json({ consent: r.rows[0] });
  } catch (err) {
    console.error('[consent] request error', err);
    res.status(500).json({ error: 'Failed to request Passport access' });
  }
});

// GET /api/consent/my-requests — a member's incoming consent requests (all statuses).
router.get('/my-requests', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT pc.id, pc.practitioner_id, pc.granted_sections, pc.status,
              pc.requested_at, pc.responded_at, pc.expires_at,
              u.full_name AS practitioner_name, u.first_name AS practitioner_first_name,
              (SELECT l.title FROM listings l WHERE l.owner_user_id = pc.practitioner_id
                 ORDER BY l.created_at ASC LIMIT 1) AS practitioner_listing
         FROM passport_consents pc
         JOIN users u ON u.id = pc.practitioner_id
        WHERE pc.member_id = $1
        ORDER BY pc.requested_at DESC`,
      [req.user.userId]
    );
    res.json({ requests: rows });
  } catch (err) {
    console.error('[consent] my-requests error', err);
    res.status(500).json({ error: 'Failed to load consent requests' });
  }
});

// PUT /api/consent/:id/grant — member grants a pending request (their own only).
router.put('/:id/grant', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE passport_consents
          SET status='granted', responded_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND member_id=$2
        RETURNING id, member_id, practitioner_id, status`,
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Consent request not found' });

    const member = await db.query('SELECT full_name, first_name FROM users WHERE id=$1', [req.user.userId]);
    const mName = member.rows[0]?.full_name || member.rows[0]?.first_name || 'A member';
    await createNotification(
      rows[0].practitioner_id,
      'consent_granted',
      'Passport access granted',
      `${mName} granted you access to their Sovereign Passport.`,
      { consentId: rows[0].id, memberId: req.user.userId }
    );

    res.json({ consent: rows[0] });
  } catch (err) {
    console.error('[consent] grant error', err);
    res.status(500).json({ error: 'Failed to grant access' });
  }
});

// PUT /api/consent/:id/revoke — member revokes/declines (their own only).
router.put('/:id/revoke', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE passport_consents
          SET status='revoked', responded_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND member_id=$2
        RETURNING id, member_id, practitioner_id, status`,
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Consent request not found' });
    res.json({ consent: rows[0] });
  } catch (err) {
    console.error('[consent] revoke error', err);
    res.status(500).json({ error: 'Failed to revoke access' });
  }
});

// GET /api/consent/granted/:memberId — practitioner reads a member's Passport,
// but ONLY when the member has an active granted consent for this practitioner.
router.get('/granted/:memberId', authMiddleware, async (req, res) => {
  try {
    const practitionerId = req.user.userId;
    const memberId = req.params.memberId;

    const consent = await db.query(
      `SELECT id, granted_sections, status, responded_at
         FROM passport_consents
        WHERE member_id=$1 AND practitioner_id=$2 AND status='granted'`,
      [memberId, practitionerId]
    );
    if (!consent.rows.length) {
      return res.status(403).json({ error: 'No active consent for this member' });
    }
    const sections = consent.rows[0].granted_sections || DEFAULT_SECTIONS;

    const member = await db.query(
      'SELECT id, full_name, first_name, email, love_points FROM users WHERE id=$1',
      [memberId]
    );
    if (!member.rows.length) return res.status(404).json({ error: 'Member not found' });

    const passport = {
      member: {
        id: member.rows[0].id,
        name: member.rows[0].full_name || member.rows[0].first_name || 'Member',
        email: member.rows[0].email,
        lovePoints: member.rows[0].love_points || 0,
      },
      grantedSections: sections,
    };

    if (sections.includes('assessment')) {
      const a = await db.query(
        `SELECT vitality_score, mental_score, physical_score, emotional_score, spiritual_score,
                top_focus_areas_json, completed_at
           FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
        [memberId]
      );
      passport.assessment = a.rows[0] || null;
    }

    if (sections.includes('checkins')) {
      const c = await db.query(
        `SELECT checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes
           FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 14`,
        [memberId]
      );
      passport.checkins = c.rows;
    }

    res.json({ passport });
  } catch (err) {
    console.error('[consent] granted error', err);
    res.status(500).json({ error: 'Failed to load Passport' });
  }
});

module.exports = router;

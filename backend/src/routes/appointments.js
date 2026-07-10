'use strict';
/**
 * Appointments (Solaris sprint) — clinic node (Aura) ops.
 *   GET  /api/appointments                 -> appointments for the user
 *                                             (as patient or practitioner), or
 *                                             ?orgId= for a clinic admin view
 *   POST /api/appointments/:id/follow-up    -> draft / approve / send a
 *                                             follow-up message (AI suggests,
 *                                             human approves; sending is mocked)
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function shapeAppt(a) {
  return {
    id: a.id,
    orgId: a.org_id,
    orgName: a.org_name || undefined,
    patientId: a.patient_id,
    patientName: a.patient_name || undefined,
    practitionerId: a.practitioner_id,
    practitionerName: a.practitioner_name || undefined,
    title: a.title,
    scheduledAt: a.scheduled_at,
    status: a.status,
    notes: a.notes,
    followUpStatus: a.follow_up_status,
    followUpDraft: a.follow_up_draft,
    createdAt: a.created_at,
  };
}

// GET /api/appointments  (?orgId=&status=)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { orgId, status } = req.query;
    const params = [];
    const clauses = [];
    if (orgId) {
      params.push(orgId); clauses.push(`a.org_id = $${params.length}`);
    } else {
      params.push(req.user.userId);
      clauses.push(`(a.patient_id = $${params.length} OR a.practitioner_id = $${params.length})`);
    }
    if (status) { params.push(status); clauses.push(`a.status = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT a.*, o.name AS org_name,
              COALESCE(pt.display_name, pt.full_name) AS patient_name,
              COALESCE(pr.display_name, pr.full_name) AS practitioner_name
       FROM appointments a
       LEFT JOIN organizations o ON o.id = a.org_id
       LEFT JOIN users pt ON pt.id = a.patient_id
       LEFT JOIN users pr ON pr.id = a.practitioner_id
       ${where}
       ORDER BY a.scheduled_at ASC`,
      params
    );
    res.json({ appointments: result.rows.map(shapeAppt) });
  } catch (err) {
    console.error('appointments list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/appointments/:id/follow-up  { action: 'draft'|'approve'|'send', draft? }
router.post('/:id/follow-up', authMiddleware, async (req, res) => {
  try {
    const { action, draft } = req.body || {};
    const apptRes = await db.query('SELECT * FROM appointments WHERE id = $1', [req.params.id]);
    if (!apptRes.rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = apptRes.rows[0];

    let followUpStatus = appt.follow_up_status;
    let followUpDraft = appt.follow_up_draft;

    if (action === 'draft') {
      // AI suggests a draft (mock, deterministic template). Human approves next.
      followUpDraft = draft || `Hi ${'{patient}'}, thank you for visiting us. `
        + `Following your "${appt.title}" appointment, remember to rest, hydrate, and follow the aftercare guidance we discussed. `
        + `This is educational only — reply here or contact us with any concerns. Warmly, your care team.`;
      followUpStatus = 'draft';
    } else if (action === 'approve') {
      if (!appt.follow_up_draft && !draft) return res.status(400).json({ error: 'Nothing to approve — create a draft first' });
      if (draft) followUpDraft = draft;
      followUpStatus = 'approved';
    } else if (action === 'send') {
      // Sending is simulated. Requires an approved (or provided) draft.
      if (draft) followUpDraft = draft;
      followUpStatus = 'sent';
    } else {
      return res.status(400).json({ error: "action must be 'draft', 'approve', or 'send'" });
    }

    const upd = await db.query(
      `UPDATE appointments SET follow_up_status = $1, follow_up_draft = $2
       WHERE id = $3 RETURNING *`,
      [followUpStatus, followUpDraft, appt.id]
    );

    res.json({
      appointment: shapeAppt(upd.rows[0]),
      action,
      simulated: action === 'send',
      message: action === 'send' ? 'Follow-up marked as sent (simulated).'
        : action === 'approve' ? 'Follow-up approved — ready to send.'
        : 'Draft created — review and approve before sending.',
    });
  } catch (err) {
    console.error('appointment follow-up error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

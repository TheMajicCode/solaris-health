/**
 * intake.js — New-patient intake forms + lightweight patient inbox.
 * Mounted at /api/intake.
 *
 *   GET    /api/intake/templates                     List active templates
 *   GET    /api/intake/templates/:id                 One template (with fields)
 *   GET    /api/intake/my-submissions                Patient: my intake submissions
 *   GET    /api/intake/submissions/:id               One submission (patient owns, or provider/admin)
 *   POST   /api/intake/submit                         Patient: submit answers
 *   PUT    /api/intake/submissions/:id/review         Provider/admin: mark reviewed + notes
 *   GET    /api/intake/provider/:patientId            Provider: a patient's submissions (consent-gated)
 *   GET    /api/intake/settings                        Provider: my intake settings
 *   PUT    /api/intake/settings                        Provider: update my intake settings
 *
 *   GET    /api/intake/inbox                            My messages (patient inbox)
 *   GET    /api/intake/inbox/unread-count               Unread count (for nav badge)
 *   PUT    /api/intake/inbox/:id/read                   Mark a message read
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ------------------------------ templates ------------------------------ */

router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, clinic_type, name, description, is_system
         FROM intake_form_templates WHERE is_active=TRUE ORDER BY is_system DESC, name ASC`
    );
    res.json({ templates: r.rows });
  } catch (err) { console.error('intake/templates', err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/templates/:id', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM intake_form_templates WHERE id=$1', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: r.rows[0] });
  } catch (err) { console.error('intake/templates/:id', err); res.status(500).json({ error: 'Server error' }); }
});

/* ---------------------------- submissions ------------------------------ */

// A patient's own submissions, with template + practitioner names.
router.get('/my-submissions', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT s.id, s.status, s.template_id, s.provider_id, s.booking_id,
              s.submitted_at, s.reviewed_at, s.created_at,
              t.name AS template_name, t.clinic_type,
              pu.full_name AS provider_name
         FROM patient_intake_submissions s
         LEFT JOIN intake_form_templates t ON t.id=s.template_id
         LEFT JOIN users pu ON pu.id=s.provider_id
        WHERE s.patient_id=$1
        ORDER BY s.created_at DESC`,
      [req.user.userId]
    );
    res.json({ submissions: r.rows });
  } catch (err) { console.error('intake/my-submissions', err); res.status(500).json({ error: 'Server error' }); }
});

// One submission — patient owner, its provider, or admin. Includes template fields.
router.get('/submissions/:id', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT s.*, t.name AS template_name, t.clinic_type, t.fields_json,
              pu.full_name AS provider_name, cu.full_name AS patient_name
         FROM patient_intake_submissions s
         LEFT JOIN intake_form_templates t ON t.id=s.template_id
         LEFT JOIN users pu ON pu.id=s.provider_id
         LEFT JOIN users cu ON cu.id=s.patient_id
        WHERE s.id=$1`,
      [req.params.id]
    );
    const sub = r.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    const isOwner = sub.patient_id === req.user.userId;
    const isProvider = sub.provider_id === req.user.userId;
    if (!isOwner && !isProvider && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });
    res.json({ submission: sub });
  } catch (err) { console.error('intake/submissions/:id', err); res.status(500).json({ error: 'Server error' }); }
});

// Submit intake answers. If submissionId is given, fill that pending request;
// otherwise create a fresh submission (self-initiated).
router.post('/submit', authMiddleware, async (req, res) => {
  try {
    const { submissionId, templateId, providerId, responses } = req.body || {};
    if (!responses || typeof responses !== 'object')
      return res.status(400).json({ error: 'responses object is required' });

    if (submissionId) {
      const cur = await db.query('SELECT * FROM patient_intake_submissions WHERE id=$1', [submissionId]);
      const sub = cur.rows[0];
      if (!sub) return res.status(404).json({ error: 'Submission not found' });
      if (sub.patient_id !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
      const upd = await db.query(
        `UPDATE patient_intake_submissions
            SET responses_json=$2, status='submitted', submitted_at=now()
          WHERE id=$1 RETURNING *`,
        [submissionId, JSON.stringify(responses)]
      );
      // Resolve any open intake-request message for this submission.
      await db.query(
        `UPDATE patient_messages SET is_read=TRUE WHERE related_intake_id=$1 AND recipient_id=$2`,
        [submissionId, req.user.userId]
      ).catch(() => {});
      return res.json({ submission: upd.rows[0] });
    }

    if (!templateId) return res.status(400).json({ error: 'templateId is required for a new submission' });
    const ins = await db.query(
      `INSERT INTO patient_intake_submissions (patient_id, provider_id, template_id, responses_json, status, submitted_at)
       VALUES ($1,$2,$3,$4,'submitted',now()) RETURNING *`,
      [req.user.userId, providerId || null, templateId, JSON.stringify(responses)]
    );
    res.json({ submission: ins.rows[0] });
  } catch (err) { console.error('intake/submit', err); res.status(500).json({ error: 'Server error' }); }
});

// Provider/admin marks a submission reviewed.
router.put('/submissions/:id/review', authMiddleware, async (req, res) => {
  try {
    const cur = await db.query('SELECT * FROM patient_intake_submissions WHERE id=$1', [req.params.id]);
    const sub = cur.rows[0];
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    if (sub.provider_id !== req.user.userId && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Forbidden' });
    const upd = await db.query(
      `UPDATE patient_intake_submissions SET status='reviewed', reviewed_at=now(), review_notes=$2 WHERE id=$1 RETURNING *`,
      [req.params.id, (req.body && req.body.notes) || null]
    );
    res.json({ submission: upd.rows[0] });
  } catch (err) { console.error('intake/review', err); res.status(500).json({ error: 'Server error' }); }
});

// Provider view of a patient's submissions — gated by an approved passport consent.
router.get('/provider/:patientId', authMiddleware, async (req, res) => {
  try {
    if (!['practitioner', 'admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role !== 'admin') {
      const consent = await db.query(
        `SELECT 1 FROM passport_consents
          WHERE member_id=$1 AND practitioner_id=$2 AND status='approved'
            AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`,
        [req.params.patientId, req.user.userId]
      );
      // Also allow a provider to see submissions explicitly directed to them.
      const direct = await db.query(
        `SELECT 1 FROM patient_intake_submissions WHERE patient_id=$1 AND provider_id=$2 LIMIT 1`,
        [req.params.patientId, req.user.userId]
      );
      if (!consent.rows[0] && !direct.rows[0])
        return res.status(403).json({ error: 'No active consent for this patient' });
    }
    const r = await db.query(
      `SELECT s.*, t.name AS template_name, t.clinic_type, t.fields_json
         FROM patient_intake_submissions s
         LEFT JOIN intake_form_templates t ON t.id=s.template_id
        WHERE s.patient_id=$1 AND (s.provider_id=$2 OR $3='admin')
        ORDER BY s.created_at DESC`,
      [req.params.patientId, req.user.userId, req.user.role]
    );
    res.json({ submissions: r.rows });
  } catch (err) { console.error('intake/provider/:patientId', err); res.status(500).json({ error: 'Server error' }); }
});

/* --------------------------- provider settings -------------------------- */

router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM provider_intake_settings WHERE provider_id=$1', [req.user.userId]);
    res.json({ settings: r.rows[0] || {
      provider_id: req.user.userId, send_intake_on_first_booking: true,
      preferred_template_id: null, custom_message: null,
    } });
  } catch (err) { console.error('intake/settings GET', err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    if (!['practitioner', 'admin'].includes(req.user.role))
      return res.status(403).json({ error: 'Only practitioners can set intake preferences' });
    const { sendIntakeOnFirstBooking, preferredTemplateId, customMessage } = req.body || {};
    const r = await db.query(
      `INSERT INTO provider_intake_settings (provider_id, send_intake_on_first_booking, preferred_template_id, custom_message, updated_at)
       VALUES ($1,$2,$3,$4,now())
       ON CONFLICT (provider_id) DO UPDATE SET
         send_intake_on_first_booking=EXCLUDED.send_intake_on_first_booking,
         preferred_template_id=EXCLUDED.preferred_template_id,
         custom_message=EXCLUDED.custom_message,
         updated_at=now()
       RETURNING *`,
      [req.user.userId, sendIntakeOnFirstBooking !== false, preferredTemplateId || null, customMessage || null]
    );
    res.json({ settings: r.rows[0] });
  } catch (err) { console.error('intake/settings PUT', err); res.status(500).json({ error: 'Server error' }); }
});

/* ------------------------------- inbox --------------------------------- */

router.get('/inbox', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, sender_name, subject, body, message_type, related_booking_id,
              related_intake_id, is_read, action_url, action_label, created_at
         FROM patient_messages WHERE recipient_id=$1 ORDER BY created_at DESC`,
      [req.user.userId]
    );
    res.json({ messages: r.rows });
  } catch (err) { console.error('intake/inbox', err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/inbox/unread-count', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT COUNT(*)::int AS count FROM patient_messages WHERE recipient_id=$1 AND is_read=FALSE',
      [req.user.userId]
    );
    res.json({ count: r.rows[0].count });
  } catch (err) { console.error('intake/inbox/unread-count', err); res.status(500).json({ error: 'Server error' }); }
});

router.put('/inbox/:id/read', authMiddleware, async (req, res) => {
  try {
    const upd = await db.query(
      'UPDATE patient_messages SET is_read=TRUE WHERE id=$1 AND recipient_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!upd.rows[0]) return res.status(404).json({ error: 'Message not found' });
    res.json({ ok: true });
  } catch (err) { console.error('intake/inbox/:id/read', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

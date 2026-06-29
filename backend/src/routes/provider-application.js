/**
 * provider-application.js — provider onboarding application flow.
 *
 * Mounted at /api/provider
 *
 *   POST /apply              create a new application (status=pending)
 *   POST /apply/documents    attach verification documents (base64)
 *   GET  /apply/status       latest application for the current user
 *   GET  /applications/me    full application history for the user
 *   PUT  /apply/:id          update / resubmit a rejected application
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { audit, shapeUser } = require('../lib/helpers');
const { sendEmail } = require('../lib/email');

const router = express.Router();

const MEDICAL_TYPES = ['doctor', 'dentist', 'therapist', 'nutritionist'];
const VALID_TYPES = [
  'clinic', 'doctor', 'dentist', 'nutritionist', 'therapist',
  'wellness', 'gym', 'spa', 'farm', 'workshop',
];
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB (decoded)
const AGREEMENT_TYPES = [
  'commission', 'platform_terms', 'accuracy', 'professional_responsibility',
  'document_retention', 'liability_waiver', 'code_of_conduct',
];

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

/* Estimate decoded byte length of a base64 (data-URL or raw) string. */
function base64Bytes(str) {
  if (!str) return 0;
  const idx = str.indexOf('base64,');
  const b64 = idx >= 0 ? str.slice(idx + 7) : str;
  const len = b64.length;
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/* --------------------------------------------------------------------- */
/* POST /apply — create a new provider application                        */
/* --------------------------------------------------------------------- */
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const b = req.body || {};
    const providerType = b.provider_type;
    const businessName = (b.business_name || '').trim();

    if (!providerType || !VALID_TYPES.includes(providerType)) {
      return res.status(400).json({ error: 'A valid provider_type is required' });
    }
    if (!businessName) {
      return res.status(400).json({ error: 'business_name is required' });
    }

    // Block duplicate in-flight applications + simple 1/day rate limit.
    const existing = await db.query(
      `SELECT id, status, submitted_at FROM provider_applications
        WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 1`,
      [userId]
    );
    if (existing.rows.length) {
      const last = existing.rows[0];
      if (last.status === 'pending') {
        return res.status(409).json({
          error: 'You already have an application under review.',
          applicationId: last.id,
        });
      }
      if (last.status === 'approved') {
        return res.status(409).json({ error: 'You are already an approved provider.' });
      }
      // rejected -> allow new application, but rate-limit to once per day
      const submitted = new Date(last.submitted_at).getTime();
      if (Date.now() - submitted < 24 * 60 * 60 * 1000 && last.status !== 'rejected') {
        return res.status(429).json({ error: 'Please wait before submitting another application.' });
      }
    }

    const isMedical = MEDICAL_TYPES.includes(providerType);
    const appData = {
      ...(b.application_data || {}),
      is_medical: isMedical,
    };

    const ins = await db.query(
      `INSERT INTO provider_applications
         (user_id, provider_type, business_name, status, application_data, submitted_at)
       VALUES ($1,$2,$3,'pending',$4, now())
       RETURNING *`,
      [userId, providerType, businessName, JSON.stringify(appData)]
    );
    const application = ins.rows[0];

    // Persist agreement acceptances with IP capture.
    const ip = clientIp(req);
    const agreements = Array.isArray(b.agreements) ? b.agreements : [];
    for (const a of agreements) {
      const type = a && a.agreement_type;
      if (!type || !AGREEMENT_TYPES.includes(type)) continue;
      await db.query(
        `INSERT INTO provider_agreements (application_id, agreement_type, agreed, ip_address, agreed_at)
         VALUES ($1,$2,$3,$4, now())`,
        [application.id, type, a.agreed === true, ip]
      );
    }

    // Best-effort confirmation email.
    const u = await db.query('SELECT email, first_name FROM users WHERE id=$1', [userId]);
    if (u.rows.length) {
      await sendEmail({
        userId,
        toEmail: u.rows[0].email,
        template: 'application_received',
        vars: {
          name: u.rows[0].first_name,
          businessName,
          providerType,
          medical: isMedical,
        },
      });
    }

    await audit({
      actorId: userId,
      action: 'provider.application.submit',
      resourceType: 'provider_application',
      resourceId: application.id,
      newValues: { providerType, businessName },
      result: 'success',
      ip,
    });

    res.status(201).json({ application });
  } catch (err) {
    console.error('apply', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* POST /apply/documents — attach verification documents                 */
/* --------------------------------------------------------------------- */
router.post('/apply/documents', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const b = req.body || {};
    const applicationId = b.application_id;
    const documents = Array.isArray(b.documents) ? b.documents : [];

    if (!applicationId) return res.status(400).json({ error: 'application_id is required' });
    if (!documents.length) return res.status(400).json({ error: 'No documents provided' });

    // Ownership check.
    const own = await db.query(
      'SELECT id, status FROM provider_applications WHERE id=$1 AND user_id=$2',
      [applicationId, userId]
    );
    if (!own.rows.length) return res.status(404).json({ error: 'Application not found' });

    const saved = [];
    for (const d of documents) {
      if (!d || !d.document_type) continue;
      const data = d.document_data || null;

      // Validate file documents (some "documents" are just text fields, e.g. website/phone).
      if (data) {
        const mime = (d.mime_type || '').toLowerCase();
        if (mime && !ALLOWED_MIME.includes(mime)) {
          return res.status(400).json({ error: `Unsupported file type: ${mime}. Use PDF, JPG or PNG.` });
        }
        if (base64Bytes(data) > MAX_DOC_BYTES) {
          return res.status(400).json({ error: `File "${d.document_name || d.document_type}" exceeds the 10 MB limit.` });
        }
      }

      const r = await db.query(
        `INSERT INTO provider_documents
           (application_id, document_type, document_name, document_data, mime_type, field_value, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, document_type, document_name, mime_type, field_value, expiry_date, uploaded_at`,
        [
          applicationId,
          d.document_type,
          d.document_name || null,
          data,
          d.mime_type || null,
          d.field_value || null,
          d.expiry_date || null,
        ]
      );
      saved.push(r.rows[0]);
    }

    res.status(201).json({ documents: saved, count: saved.length });
  } catch (err) {
    console.error('apply/documents', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* GET /apply/status — latest application for the current user            */
/* --------------------------------------------------------------------- */
router.get('/apply/status', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, provider_type, business_name, status, rejection_reason,
              reviewed_at, submitted_at, application_data
         FROM provider_applications
        WHERE user_id=$1
        ORDER BY submitted_at DESC LIMIT 1`,
      [req.user.userId]
    );
    res.json({ application: r.rows[0] || null });
  } catch (err) {
    console.error('apply/status', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* GET /applications/me — full history                                    */
/* --------------------------------------------------------------------- */
router.get('/applications/me', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, provider_type, business_name, status, rejection_reason,
              reviewed_at, submitted_at
         FROM provider_applications
        WHERE user_id=$1
        ORDER BY submitted_at DESC`,
      [req.user.userId]
    );
    res.json({ applications: r.rows });
  } catch (err) {
    console.error('applications/me', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* PUT /apply/:id — update / resubmit (only owner, only if rejected)      */
/* --------------------------------------------------------------------- */
router.put('/apply/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const id = req.params.id;
    const b = req.body || {};

    const own = await db.query(
      'SELECT * FROM provider_applications WHERE id=$1 AND user_id=$2',
      [id, userId]
    );
    if (!own.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = own.rows[0];
    if (app.status === 'approved') {
      return res.status(409).json({ error: 'Approved applications cannot be modified.' });
    }

    const providerType = b.provider_type || app.provider_type;
    const businessName = (b.business_name || app.business_name || '').trim();
    const isMedical = MEDICAL_TYPES.includes(providerType);
    const appData = b.application_data
      ? { ...b.application_data, is_medical: isMedical }
      : app.application_data;

    const upd = await db.query(
      `UPDATE provider_applications
          SET provider_type=$1, business_name=$2, application_data=$3,
              status='pending', rejection_reason=NULL,
              reviewed_by=NULL, reviewed_at=NULL,
              submitted_at=now(), updated_at=now()
        WHERE id=$4
        RETURNING *`,
      [providerType, businessName, JSON.stringify(appData), id]
    );

    await audit({
      actorId: userId,
      action: 'provider.application.resubmit',
      resourceType: 'provider_application',
      resourceId: id,
      result: 'success',
      ip: clientIp(req),
    });

    res.json({ application: upd.rows[0] });
  } catch (err) {
    console.error('apply/:id update', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

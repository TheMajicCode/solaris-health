/**
 * admin/providers.js — admin provider-approval dashboard API.
 *
 * Mounted at /api/admin/providers   (all routes require admin)
 *
 *   GET  /pending        list applications (filters, search, sort, pagination)
 *   GET  /stats          dashboard counters
 *   GET  /:id/review     full application detail + documents + agreements
 *   POST /:id/approve    approve -> create/unhide provider profile, flag user
 *   POST /:id/reject     reject -> store reason, notify applicant
 */

const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/admin-only');
const { audit } = require('../../lib/helpers');
const { sendEmail } = require('../../lib/email');

const router = express.Router();

const MEDICAL_TYPES = ['doctor', 'dentist', 'therapist', 'nutritionist'];

// All admin-provider routes require an authenticated admin.
router.use(authMiddleware, adminOnly);

function clientIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
}

/* --------------------------------------------------------------------- */
/* GET /stats                                                            */
/* --------------------------------------------------------------------- */
router.get('/stats', async (_req, res) => {
  try {
    const r = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')::int  AS pending,
        COUNT(*) FILTER (WHERE status='approved' AND reviewed_at::date = now()::date)::int AS approved_today,
        COUNT(*) FILTER (WHERE status='rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE status='approved')::int AS approved_total
      FROM provider_applications
    `);
    const prov = await db.query(
      "SELECT COUNT(*)::int AS n FROM provider_profiles WHERE hidden=false AND status='active'"
    );
    const row = r.rows[0] || {};
    res.json({
      pending: row.pending || 0,
      approvedToday: row.approved_today || 0,
      rejected: row.rejected || 0,
      approvedTotal: row.approved_total || 0,
      totalProviders: prov.rows[0]?.n || 0,
    });
  } catch (err) {
    console.error('admin providers stats', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* GET /pending — list with filters                                      */
/* query: status(all|pending|approved|rejected), category(medical|non-medical),
 *        q (search), sort(newest|oldest), limit, offset                  */
/* --------------------------------------------------------------------- */
router.get('/pending', async (req, res) => {
  try {
    const {
      status = 'pending', category, q, sort = 'newest',
      limit = 50, offset = 0,
    } = req.query;

    const where = [];
    const vals = [];
    let i = 1;

    if (status && status !== 'all') {
      where.push(`a.status = $${i++}`);
      vals.push(status);
    }
    if (category === 'medical') {
      where.push(`a.provider_type = ANY($${i++})`);
      vals.push(MEDICAL_TYPES);
    } else if (category === 'non-medical') {
      where.push(`NOT (a.provider_type = ANY($${i++}))`);
      vals.push(MEDICAL_TYPES);
    }
    if (q) {
      where.push(`(a.business_name ILIKE $${i} OR u.email ILIKE $${i} OR u.first_name ILIKE $${i} OR u.last_name ILIKE $${i})`);
      vals.push(`%${q}%`); i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = sort === 'oldest' ? 'a.submitted_at ASC' : 'a.submitted_at DESC';
    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;

    const sql = `
      SELECT a.id, a.provider_type, a.business_name, a.status, a.rejection_reason,
             a.submitted_at, a.reviewed_at,
             u.id AS user_id, u.first_name, u.last_name, u.email, u.avatar_url,
             (SELECT COUNT(*)::int FROM provider_documents d WHERE d.application_id = a.id) AS document_count
        FROM provider_applications a
        JOIN users u ON u.id = a.user_id
        ${whereSql}
        ORDER BY ${orderBy}
        LIMIT $${i} OFFSET $${i + 1}`;
    vals.push(lim, off);
    const result = await db.query(sql, vals);

    const countSql = `
      SELECT COUNT(*)::int AS n
        FROM provider_applications a
        JOIN users u ON u.id = a.user_id
        ${whereSql}`;
    const countRes = await db.query(countSql, vals.slice(0, vals.length - 2));

    const applications = result.rows.map((a) => ({
      ...a,
      is_medical: MEDICAL_TYPES.includes(a.provider_type),
    }));

    res.json({ applications, total: countRes.rows[0]?.n || 0 });
  } catch (err) {
    console.error('admin providers pending', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* GET /:id/review — full detail                                         */
/* --------------------------------------------------------------------- */
router.get('/:id/review', async (req, res) => {
  try {
    const id = req.params.id;
    const a = await db.query(
      `SELECT a.*, u.first_name, u.last_name, u.email, u.avatar_url, u.country, u.city, u.phone
         FROM provider_applications a
         JOIN users u ON u.id = a.user_id
        WHERE a.id=$1`,
      [id]
    );
    if (!a.rows.length) return res.status(404).json({ error: 'Application not found' });

    const [docs, agreements] = await Promise.all([
      db.query(
        `SELECT id, document_type, document_name, document_data, mime_type,
                field_value, expiry_date, verified, uploaded_at
           FROM provider_documents WHERE application_id=$1 ORDER BY uploaded_at`,
        [id]
      ),
      db.query(
        `SELECT agreement_type, agreed, ip_address, agreed_at
           FROM provider_agreements WHERE application_id=$1 ORDER BY agreed_at`,
        [id]
      ),
    ]);

    const application = a.rows[0];
    application.is_medical = MEDICAL_TYPES.includes(application.provider_type);

    res.json({
      application,
      documents: docs.rows,
      agreements: agreements.rows,
    });
  } catch (err) {
    console.error('admin providers review', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* POST /:id/approve                                                     */
/* --------------------------------------------------------------------- */
router.post('/:id/approve', async (req, res) => {
  try {
    const adminId = req.user.userId;
    const id = req.params.id;
    const notes = (req.body && req.body.admin_notes) || null;

    const a = await db.query('SELECT * FROM provider_applications WHERE id=$1', [id]);
    if (!a.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = a.rows[0];
    if (app.status === 'approved') {
      return res.status(409).json({ error: 'Application is already approved.' });
    }

    // Mark application approved.
    await db.query(
      `UPDATE provider_applications
          SET status='approved', reviewed_by=$1, reviewed_at=now(),
              admin_notes=COALESCE($2, admin_notes), rejection_reason=NULL, updated_at=now()
        WHERE id=$3`,
      [adminId, notes, id]
    );

    const data = app.application_data || {};

    // Create or unhide the provider profile.
    const existing = await db.query(
      'SELECT id FROM provider_profiles WHERE application_id=$1 OR (user_id=$2 AND business_name=$3) LIMIT 1',
      [id, app.user_id, app.business_name]
    );

    let providerId;
    if (existing.rows.length) {
      providerId = existing.rows[0].id;
      await db.query(
        `UPDATE provider_profiles
            SET hidden=false, approval_status='approved', application_id=$1,
                status='active', claimed=true, updated_at=now()
          WHERE id=$2`,
        [id, providerId]
      );
    } else {
      const ins = await db.query(
        `INSERT INTO provider_profiles
           (user_id, application_id, provider_type, business_name, description,
            address, city, country, latitude, longitude, phone, website, email,
            hours_of_operation, specialties, price_range,
            status, claimed, approval_status, hidden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'El Salvador'),$9,$10,$11,$12,$13,$14,$15,$16,
                 'active', true, 'approved', false)
         RETURNING id`,
        [
          app.user_id, id, app.provider_type, app.business_name, data.description || null,
          data.address || null, data.city || null, data.country || null,
          data.latitude != null ? parseFloat(data.latitude) : null,
          data.longitude != null ? parseFloat(data.longitude) : null,
          data.phone || null, data.website || null, data.email || null,
          data.hours_of_operation ? JSON.stringify(data.hours_of_operation) : null,
          data.specialties ? JSON.stringify(data.specialties) : null,
          data.price_range || null,
        ]
      );
      providerId = ins.rows[0].id;

      // Insert services if the application carried them.
      if (Array.isArray(data.services)) {
        for (const s of data.services) {
          if (!s || !s.service_name) continue;
          await db.query(
            `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [providerId, s.service_name, s.description || null, s.price || null, s.currency || 'USD', s.duration_minutes || null, s.category || null]
          );
        }
      }
    }

    // Flag the user as an approved provider.
    await db.query(
      `UPDATE users
          SET is_provider=true, provider_approved_at=now(), updated_at=now()
        WHERE id=$1`,
      [app.user_id]
    );

    // Notify applicant.
    const u = await db.query('SELECT email, first_name FROM users WHERE id=$1', [app.user_id]);
    if (u.rows.length) {
      await sendEmail({
        userId: app.user_id,
        toEmail: u.rows[0].email,
        template: 'application_approved',
        vars: { name: u.rows[0].first_name, businessName: app.business_name },
      });
    }

    await audit({
      actorId: adminId,
      action: 'provider.application.approve',
      resourceType: 'provider_application',
      resourceId: id,
      newValues: { providerId },
      result: 'success',
      ip: clientIp(req),
    });

    res.json({ ok: true, providerId });
  } catch (err) {
    console.error('admin providers approve', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* --------------------------------------------------------------------- */
/* POST /:id/reject                                                      */
/* --------------------------------------------------------------------- */
router.post('/:id/reject', async (req, res) => {
  try {
    const adminId = req.user.userId;
    const id = req.params.id;
    const reason = (req.body && req.body.rejection_reason || '').trim();
    const notes = (req.body && req.body.admin_notes) || null;

    if (!reason) return res.status(400).json({ error: 'A rejection_reason is required.' });

    const a = await db.query('SELECT * FROM provider_applications WHERE id=$1', [id]);
    if (!a.rows.length) return res.status(404).json({ error: 'Application not found' });
    const app = a.rows[0];

    await db.query(
      `UPDATE provider_applications
          SET status='rejected', rejection_reason=$1, reviewed_by=$2, reviewed_at=now(),
              admin_notes=COALESCE($3, admin_notes), updated_at=now()
        WHERE id=$4`,
      [reason, adminId, notes, id]
    );

    // Keep any profile hidden.
    await db.query(
      `UPDATE provider_profiles SET hidden=true, approval_status='rejected', updated_at=now()
        WHERE application_id=$1`,
      [id]
    );

    const u = await db.query('SELECT email, first_name FROM users WHERE id=$1', [app.user_id]);
    if (u.rows.length) {
      await sendEmail({
        userId: app.user_id,
        toEmail: u.rows[0].email,
        template: 'application_rejected',
        vars: { name: u.rows[0].first_name, reason },
      });
    }

    await audit({
      actorId: adminId,
      action: 'provider.application.reject',
      resourceType: 'provider_application',
      resourceId: id,
      newValues: { reason },
      result: 'success',
      ip: clientIp(req),
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('admin providers reject', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

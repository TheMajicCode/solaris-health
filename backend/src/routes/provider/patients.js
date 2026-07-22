'use strict';
/**
 * provider/patients.js — a practitioner's patient roster, derived from the
 * real demo data: booking_requests joined to the practitioner's own listings
 * (scoped by listings.owner_user_id — never a global listing_type filter).
 *
 * Each patient is grouped with their booking count, most recent booking, and
 * whether this practitioner currently has granted Passport consent for them.
 */
const express = require('express');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');

const router = express.Router();

// GET /api/provider/patients — grouped patient list for the current practitioner.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const practitionerId = req.user.userId;
    const { rows } = await db.query(
      `SELECT br.user_id AS patient_id,
              u.full_name, u.first_name, u.email,
              COUNT(br.id)::int AS booking_count,
              MAX(br.preferred_date) AS last_booking_date,
              MAX(br.created_at) AS last_activity,
              (ARRAY_AGG(br.status ORDER BY br.created_at DESC))[1] AS last_status,
              EXISTS (
                SELECT 1 FROM passport_consents pc
                 WHERE pc.member_id = br.user_id
                   AND pc.practitioner_id = $1
                   AND pc.status = 'granted'
              ) AS consent_granted
         FROM booking_requests br
         JOIN listings l ON l.id = br.listing_id AND l.owner_user_id = $1
         JOIN users u ON u.id = br.user_id
        GROUP BY br.user_id, u.full_name, u.first_name, u.email
        ORDER BY MAX(br.created_at) DESC`,
      [practitionerId]
    );
    const patients = rows.map((r) => ({
      patientId: r.patient_id,
      name: r.full_name || r.first_name || 'Member',
      email: r.email,
      bookingCount: r.booking_count,
      lastBookingDate: r.last_booking_date,
      lastActivity: r.last_activity,
      lastStatus: r.last_status,
      consentGranted: r.consent_granted,
    }));
    res.json({ patients });
  } catch (err) {
    console.error('[provider/patients] list error', err);
    res.status(500).json({ error: 'Failed to load patients' });
  }
});

// GET /api/provider/patients/:patientId/bookings — booking history for one patient
// (only bookings placed against this practitioner's listings).
router.get('/:patientId/bookings', authMiddleware, async (req, res) => {
  try {
    const practitionerId = req.user.userId;
    const { rows } = await db.query(
      `SELECT br.id, br.status, br.preferred_date, br.preferred_time, br.note,
              br.quoted_price, br.created_at, l.title AS service_title
         FROM booking_requests br
         JOIN listings l ON l.id = br.listing_id AND l.owner_user_id = $1
        WHERE br.user_id = $2
        ORDER BY br.created_at DESC`,
      [practitionerId, req.params.patientId]
    );
    res.json({ bookings: rows });
  } catch (err) {
    console.error('[provider/patients] bookings error', err);
    res.status(500).json({ error: 'Failed to load booking history' });
  }
});

module.exports = router;

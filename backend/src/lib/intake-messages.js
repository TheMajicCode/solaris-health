/**
 * intake-messages.js — side-effects that fire when a booking is confirmed:
 *   1. A warm booking-confirmation message to the patient's inbox.
 *   2. On the patient's FIRST booking with this practitioner (and if the
 *      practitioner has intake enabled), a pending intake submission plus an
 *      intake-request message with a "Complete Intake Form" call to action.
 *
 * All copy is Solaris — warm, grounded, non-clinical. Safe/non-fatal: any error
 * here is logged and swallowed so it never blocks the booking flow.
 */

const db = require('../db');

async function insertMessage(m) {
  await db.query(
    `INSERT INTO patient_messages
       (recipient_id, sender_id, sender_name, subject, body, message_type,
        related_booking_id, related_intake_id, action_url, action_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [m.recipientId, m.senderId || null, m.senderName || 'Solaris Health', m.subject,
     m.body, m.messageType || 'system', m.relatedBookingId || null,
     m.relatedIntakeId || null, m.actionUrl || null, m.actionLabel || null]
  );
}

/**
 * @param booking a row that includes: id, patient_id, provider_id (provider_profiles.id),
 *   provider_user_id (users.id of the practitioner), business_name, service_name.
 */
async function onBookingConfirmed(booking) {
  try {
    const providerUserId = booking.provider_user_id || null;
    const displayName = booking.business_name || 'your practitioner';

    // 1) Booking confirmation message.
    await insertMessage({
      recipientId: booking.patient_id,
      senderId: providerUserId,
      senderName: displayName,
      subject: 'Your session has been confirmed ✓',
      body: `Great news — ${displayName} has confirmed your booking request. We look forward to supporting your wellness journey. You'll receive further details shortly.`,
      messageType: 'booking_confirmation',
      relatedBookingId: booking.id,
    });

    if (!providerUserId) return;

    // 2) First-booking intake request.
    // "First" = the patient has no prior intake submission with this practitioner.
    const prior = await db.query(
      `SELECT 1 FROM patient_intake_submissions WHERE patient_id=$1 AND provider_id=$2 LIMIT 1`,
      [booking.patient_id, providerUserId]
    );
    if (prior.rows[0]) return; // already has an intake with this practitioner

    // Practitioner preferences (default: send, general template, no custom message).
    const setRes = await db.query(
      'SELECT * FROM provider_intake_settings WHERE provider_id=$1', [providerUserId]
    );
    const settings = setRes.rows[0];
    if (settings && settings.send_intake_on_first_booking === false) return;

    // Choose a template: practitioner's preferred, else the general system template.
    let templateId = settings && settings.preferred_template_id;
    if (!templateId) {
      const gen = await db.query(
        `SELECT id FROM intake_form_templates WHERE is_active=TRUE
           ORDER BY (clinic_type='general') DESC, is_system DESC, id ASC LIMIT 1`
      );
      templateId = gen.rows[0] && gen.rows[0].id;
    }
    if (!templateId) return; // no templates available

    // Create the pending submission.
    const sub = await db.query(
      `INSERT INTO patient_intake_submissions (patient_id, provider_id, template_id, booking_id, status)
       VALUES ($1,$2,$3,$4,'pending') RETURNING id`,
      [booking.patient_id, providerUserId, templateId, booking.id]
    );
    const submissionId = sub.rows[0].id;

    const defaultBody = 'To help us prepare for your first session, please take a few minutes to complete your new patient intake form. This information will help us understand your health background and ensure we make the most of your time together.';
    await insertMessage({
      recipientId: booking.patient_id,
      senderId: providerUserId,
      senderName: displayName,
      subject: 'Please complete your new patient intake form',
      body: (settings && settings.custom_message) || defaultBody,
      messageType: 'intake_request',
      relatedBookingId: booking.id,
      relatedIntakeId: submissionId,
      actionUrl: `/intake?id=${submissionId}`,
      actionLabel: 'Complete Intake Form',
    });
  } catch (err) {
    console.warn('[intake] onBookingConfirmed non-fatal:', err.message);
  }
}

module.exports = { onBookingConfirmed, insertMessage };

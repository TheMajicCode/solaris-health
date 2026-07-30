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
const { SPECIALTY_VARIANT } = require('../db/intake-templates');
const { sendNotificationEmail } = require('./mailer');

/** Global kill-switch (spec A5: auto_send_intake config, default ON). */
async function autoSendEnabled() {
  try {
    const r = await db.query(`SELECT value FROM system_config WHERE key='auto_send_intake'`);
    if (!r.rows[0]) return true; // default ON when unset
    const v = r.rows[0].value;
    return !(v === false || v === 'false' || v === 'off' || v === 0);
  } catch (_) {
    return true;
  }
}

/**
 * Choose the intake template for a practitioner. A5 combines Part A (foundational)
 * with a Part B variant chosen by the practitioner's provider_type. We send the
 * Part B variant template when a matching one exists (it carries the specialty
 * questions), else fall back to the general system template.
 */
async function chooseTemplateId(providerUserId, settings) {
  if (settings && settings.preferred_template_id) return settings.preferred_template_id;
  // Map provider_type -> clinic_type variant.
  let variantClinic = null;
  try {
    const p = await db.query(
      `SELECT provider_type FROM provider_profiles WHERE user_id=$1 LIMIT 1`,
      [providerUserId]
    );
    const ptype = p.rows[0] && (p.rows[0].provider_type || '').toString().toLowerCase().trim();
    if (ptype) variantClinic = SPECIALTY_VARIANT[ptype] || null;
  } catch (_) { /* ignore */ }
  if (variantClinic) {
    const v = await db.query(
      `SELECT id FROM intake_form_templates WHERE clinic_type=$1 AND is_active=TRUE
         ORDER BY is_system DESC, id ASC LIMIT 1`, [variantClinic]
    );
    if (v.rows[0]) return v.rows[0].id;
  }
  // Fallback: general template.
  const gen = await db.query(
    `SELECT id FROM intake_form_templates WHERE is_active=TRUE
       ORDER BY (clinic_type='general') DESC, is_system DESC, id ASC LIMIT 1`
  );
  return gen.rows[0] && gen.rows[0].id;
}

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

    // De-identified external email nudge (booking confirmation). A single nudge
    // also covers any first-booking intake request created below in the same
    // pass, so we never send two emails for one booking event.
    sendNotificationEmail({ userId: booking.patient_id, deepLinkPath: '/' })
      .catch(() => {});

    if (!providerUserId) return;

    // Global auto-send config (spec A5: default ON). Site admins can turn it off.
    if (!(await autoSendEnabled())) return;

    // 2) First-booking intake request.
    // "First" = the patient has no intake submission in the last 12 months.
    // A completed foundational snapshot <12mo old lets the form collapse to a
    // single confirm step, but we still surface the request so the member can
    // confirm; only a very recent submission with THIS practitioner is skipped.
    const prior = await db.query(
      `SELECT 1 FROM patient_intake_submissions
         WHERE patient_id=$1 AND provider_id=$2
           AND created_at > now() - INTERVAL '12 months' LIMIT 1`,
      [booking.patient_id, providerUserId]
    );
    if (prior.rows[0]) return; // already has a recent intake with this practitioner

    // Practitioner preferences (default: send, general template, no custom message).
    const setRes = await db.query(
      'SELECT * FROM provider_intake_settings WHERE provider_id=$1', [providerUserId]
    );
    const settings = setRes.rows[0];
    if (settings && settings.send_intake_on_first_booking === false) return;

    // Choose a template by practitioner provider_type (Part B variant), else general.
    const templateId = await chooseTemplateId(providerUserId, settings);
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

/**
 * sendIntakeReminders — idempotent 48h reminder pass (spec A5).
 * Finds pending intake submissions whose associated booking is within the next
 * 48 hours and which have NOT yet had a reminder sent, inserts a gentle reminder
 * message, and stamps reminder_sent_at so it never fires twice.
 * Returns the number of reminders sent. Safe to call repeatedly (idempotent).
 */
async function sendIntakeReminders(dbClient) {
  const q = dbClient || db;
  let sent = 0;
  try {
    const due = await q.query(
      `SELECT s.id AS submission_id, s.patient_id, s.provider_id, s.booking_id,
              pp.business_name, b.booking_date, b.start_time
         FROM patient_intake_submissions s
         JOIN bookings b ON b.id = s.booking_id
         LEFT JOIN provider_profiles pp ON pp.id = b.provider_id
        WHERE s.status = 'pending'
          AND s.reminder_sent_at IS NULL
          AND (b.booking_date + b.start_time) <= now() + INTERVAL '48 hours'
          AND (b.booking_date + b.start_time) >= now()`
    );
    for (const row of due.rows) {
      const displayName = row.business_name || 'your practitioner';
      await insertMessage({
        recipientId: row.patient_id,
        senderId: row.provider_id,
        senderName: displayName,
        subject: 'Reminder: your intake form is waiting',
        body: `Your session with ${displayName} is coming up soon. Completing your intake form beforehand helps you get the most out of your time together — it only takes a few minutes.`,
        messageType: 'intake_request',
        relatedBookingId: row.booking_id,
        relatedIntakeId: row.submission_id,
        actionUrl: `/intake?id=${row.submission_id}`,
        actionLabel: 'Complete Intake Form',
      });
      await q.query(
        `UPDATE patient_intake_submissions SET reminder_sent_at = now() WHERE id=$1`,
        [row.submission_id]
      );
      // De-identified 48h reminder email nudge (no PHI).
      sendNotificationEmail({ userId: row.patient_id, deepLinkPath: '/' }).catch(() => {});
      sent += 1;
    }
  } catch (err) {
    console.warn('[intake] sendIntakeReminders non-fatal:', err.message);
  }
  return sent;
}

module.exports = { onBookingConfirmed, insertMessage, sendIntakeReminders, autoSendEnabled };

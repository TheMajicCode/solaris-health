/**
 * booking-emails.js — best-effort booking lifecycle emails.
 *
 * Mirrors lib/email.js: no SMTP is configured, so these render a message,
 * log it to the console, and persist a row in `email_notifications` for audit.
 * Every function is wrapped so a failure can never break the booking flow.
 */

const { query } = require('../db');

// Booking-only gate (S1B-R2 §3.2.1): outbound email is fully neutralized. Every
// booking lifecycle event collapses to ONE PHI-free `secure_notification` — the
// subject and body are fixed constants with NO per-event variation, and the
// persisted template value is the neutral constant below. Detailed booking
// information stays available ONLY inside authenticated Solaris (in-app
// notifications), never in an outbound email or in application logs.
const NEUTRAL_TEMPLATE = 'secure_notification';
const NEUTRAL_SUBJECT = 'Secure notification';
const NEUTRAL_BODY = 'You have a new secure notification. Sign in to Solaris to view it.';

// The neutral payload — identical for every event. `vars` is intentionally
// ignored: no booking/appointment/patient context is ever rendered.
function neutralPayload() {
  return { subject: NEUTRAL_SUBJECT, body: NEUTRAL_BODY };
}

// All six historical templates now render the SAME neutral payload. Retained as
// keys so callers/tests referencing template names still resolve.
const TEMPLATES = {
  booking_request: neutralPayload,
  booking_confirmed: neutralPayload,
  booking_declined: neutralPayload,
  booking_cancelled: neutralPayload,
  booking_reminder: neutralPayload,
  booking_completed: neutralPayload,
};

/**
 * Render + log + persist a booking email (best-effort). The email is always the
 * neutral `secure_notification`; any `vars` supplied by a legacy caller is
 * ignored and never rendered, logged, or persisted.
 * @returns {Promise<{ok:boolean, subject?:string, template?:string}>}
 */
async function sendBookingEmail({ userId = null, toEmail } = {}) {
  try {
    const { subject, body } = neutralPayload();

    // Neutral status line only — no recipient, user id, event/template name,
    // subject, body, booking id, or any other booking detail may be logged.
    console.log('[booking-email] secure notification queued (logged, not delivered)');

    // Persist the neutral notification. The stored template is the fixed neutral
    // constant, NOT the requested booking_* event name; the body/subject carry
    // no PHI. `toEmail` is the delivery address, not booking content.
    await query(
      `INSERT INTO email_notifications (user_id, to_email, template, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, 'logged')`,
      [userId, toEmail || null, NEUTRAL_TEMPLATE, subject, body]
    );
    return { ok: true, subject, template: NEUTRAL_TEMPLATE };
  } catch {
    // Redacted: never print provider/database error detail that could carry
    // payload data. Fixed neutral text only.
    console.error('[booking-email] send failed (non-fatal)');
    return { ok: false };
  }
}

module.exports = { sendBookingEmail, TEMPLATES, NEUTRAL_TEMPLATE, NEUTRAL_SUBJECT, NEUTRAL_BODY };

/**
 * booking-emails.js — best-effort booking lifecycle emails.
 *
 * Mirrors lib/email.js: no SMTP is configured, so these render a message,
 * log it to the console, and persist a row in `email_notifications` for audit.
 * Every function is wrapped so a failure can never break the booking flow.
 */

const { query } = require('../db');

const FROM_ADDRESS = 'Solaris Health <no-reply@solaris-health.com>';

function fmtDate(d) {
  try {
    const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`);
    return dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return String(d); }
}
function fmtTime(t) {
  try {
    const [h, m] = String(t).split(':');
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${m} ${ampm}`;
  } catch { return String(t); }
}

const TEMPLATES = {
  // To provider: a patient requested a booking.
  booking_request: (v) => ({
    subject: `New booking request from ${v.patientName || 'a patient'}`,
    body: `You have a new booking request!

Patient:  ${v.patientName || 'A patient'}
Service:  ${v.serviceName || 'Consultation'}
Date:     ${fmtDate(v.date)}
Time:     ${fmtTime(v.startTime)}${v.endTime ? ' – ' + fmtTime(v.endTime) : ''}
${v.notes ? `Notes:    ${v.notes}\n` : ''}
Please review and confirm or decline this request from your Solaris Health
provider dashboard (My Practice → Bookings).

— The Solaris Health Team`,
  }),

  // To patient: provider confirmed.
  booking_confirmed: (v) => ({
    subject: `Appointment confirmed with ${v.businessName || v.providerName || 'your provider'}`,
    body: `Your appointment is confirmed!

Provider: ${v.providerName || v.businessName || 'Your provider'}${v.businessName && v.providerName ? ' — ' + v.businessName : ''}
Service:  ${v.serviceName || 'Consultation'}
Date:     ${fmtDate(v.date)}
Time:     ${fmtTime(v.startTime)}${v.endTime ? ' – ' + fmtTime(v.endTime) : ''}
${v.address ? `Location: ${v.address}\n` : ''}
You can add this appointment to your calendar and view full details from
"My Bookings" in your Solaris Health account.

Cancellation policy: please give at least 24 hours notice if you need to cancel.

See you soon!
— The Solaris Health Team`,
  }),

  // To patient: provider declined / cancelled.
  booking_declined: (v) => ({
    subject: `Update on your appointment request`,
    body: `Hi ${v.patientName || 'there'},

Unfortunately your booking request could not be confirmed.

Service:  ${v.serviceName || 'Consultation'}
Date:     ${fmtDate(v.date)}
Time:     ${fmtTime(v.startTime)}
${v.reason ? `Reason:   ${v.reason}\n` : ''}
You're welcome to browse other available times or providers from the Explore
marketplace in your Solaris Health account.

— The Solaris Health Team`,
  }),

  booking_cancelled: (v) => ({
    subject: `Appointment cancelled`,
    body: `Hi ${v.recipientName || 'there'},

The following appointment has been cancelled${v.byWhom ? ` by the ${v.byWhom}` : ''}:

Service:  ${v.serviceName || 'Consultation'}
Date:     ${fmtDate(v.date)}
Time:     ${fmtTime(v.startTime)}
${v.reason ? `Reason:   ${v.reason}\n` : ''}
— The Solaris Health Team`,
  }),

  // To patient: 24h reminder.
  booking_reminder: (v) => ({
    subject: `Reminder: appointment ${v.when || 'soon'}`,
    body: `Don't forget your upcoming appointment!

Provider: ${v.providerName || v.businessName || 'Your provider'}
Service:  ${v.serviceName || 'Consultation'}
Date:     ${fmtDate(v.date)}
Time:     ${fmtTime(v.startTime)}
${v.address ? `Location: ${v.address}\n` : ''}
See you soon!
— The Solaris Health Team`,
  }),

  // To patient: completed, prompt for review.
  booking_completed: (v) => ({
    subject: `How was your appointment with ${v.businessName || v.providerName || 'your provider'}?`,
    body: `Hi ${v.patientName || 'there'},

Thanks for visiting ${v.businessName || v.providerName || 'your provider'} through Solaris Health.

We'd love to hear about your experience. Leaving a review helps other members
find great care. You can add a review from the provider's profile in Explore.

— The Solaris Health Team`,
  }),
};

/**
 * Render + log + persist a booking email (best-effort).
 * @returns {Promise<{ok:boolean, subject?:string}>}
 */
async function sendBookingEmail({ userId = null, toEmail, template, vars = {} }) {
  let subject = '(no subject)';
  let body = '';
  try {
    const tpl = TEMPLATES[template];
    if (!tpl) {
      console.warn(`[booking-email] unknown template "${template}" — skipping`);
      return { ok: false };
    }
    const rendered = tpl(vars);
    subject = rendered.subject;
    body = rendered.body;

    console.log(
      `\n=== BOOKING EMAIL (logged, not delivered) ===\n` +
        `From: ${FROM_ADDRESS}\n` +
        `To:   ${toEmail || '(unknown)'}\n` +
        `Subj: ${subject}\n` +
        `----------------------------------------\n${body}\n` +
        `=====================================\n`
    );

    await query(
      `INSERT INTO email_notifications (user_id, to_email, template, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, 'logged')`,
      [userId, toEmail || null, template, subject, body]
    );
    return { ok: true, subject };
  } catch (err) {
    console.error('[booking-email] sendBookingEmail failed (non-fatal):', err.message);
    return { ok: false };
  }
}

module.exports = { sendBookingEmail, TEMPLATES };

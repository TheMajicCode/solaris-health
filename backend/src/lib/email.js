/**
 * email.js — best-effort email notification library.
 *
 * There is no SMTP / transactional-email provider configured in this
 * deployment, so this module does NOT actually deliver mail. Instead it:
 *   1. Renders a template with the supplied variables.
 *   2. Logs the rendered message to the server console.
 *   3. Persists a row in `email_notifications` for audit / later delivery.
 *
 * Every function is wrapped so it can never throw into the request flow —
 * notification failures must never block an application/approval action.
 */

const { query } = require('../db');

const FROM_ADDRESS = 'Solaris Health <no-reply@solaris-health.com>';

/* ----------------------------------------------------------------------- */
/* Templates                                                               */
/* ----------------------------------------------------------------------- */

const TEMPLATES = {
  application_received: (v) => ({
    subject: 'We received your provider application — Solaris Health',
    body: `Hi ${v.name || 'there'},

Thank you for applying to become a provider on Solaris Health.

We've received your application for "${v.businessName || 'your practice'}" (${v.providerType || 'provider'}).
Our team will review your submission${v.medical ? ', including your professional credentials,' : ''} and get back to you soon.

What happens next:
  • Our verification team reviews your application and documents.
  • You'll receive an email once a decision has been made.
  • Most reviews are completed within 2–3 business days.

You can check your application status any time from your Solaris Health account.

Warm regards,
The Solaris Health Team`,
  }),

  application_approved: (v) => ({
    subject: '🎉 Your provider application is approved — Solaris Health',
    body: `Hi ${v.name || 'there'},

Great news — your application to become a provider on Solaris Health has been APPROVED!

"${v.businessName || 'Your practice'}" is now part of the Solaris Health provider network.

What you can do now:
  • Switch to Provider mode any time using the mode toggle in your account.
  • Manage your listing, availability and services.
  • Receive and manage bookings from patients.
  • Track your performance from the provider analytics dashboard.

A reminder: Solaris Health applies a 10% platform commission on completed bookings, as outlined in the Platform Terms you agreed to.

Welcome aboard — we're thrilled to have you.

Warm regards,
The Solaris Health Team`,
  }),

  application_rejected: (v) => ({
    subject: 'Update on your provider application — Solaris Health',
    body: `Hi ${v.name || 'there'},

Thank you for your interest in becoming a provider on Solaris Health.

After careful review, we're unable to approve your application at this time.

Reason provided by our review team:
  ${v.reason || 'Your application did not meet our current verification requirements.'}

This is not necessarily final. You're welcome to update your application — for example, by providing clearer documents or additional information — and resubmit it for another review.

If you have questions, simply reply to this message and our team will be happy to help.

Warm regards,
The Solaris Health Team`,
  }),
};

/* ----------------------------------------------------------------------- */
/* Core                                                                    */
/* ----------------------------------------------------------------------- */

/**
 * sendEmail — render + log + persist a notification (best-effort).
 *
 * @param {Object}  opts
 * @param {string}  opts.userId    recipient user id (nullable)
 * @param {string}  opts.toEmail   recipient address
 * @param {string}  opts.template  one of TEMPLATES keys
 * @param {Object}  opts.vars      template variables
 * @returns {Promise<{ok:boolean, subject?:string}>}
 */
async function sendEmail({ userId = null, toEmail, template, vars = {} }) {
  let subject = '(no subject)';
  let body = '';
  try {
    const tpl = TEMPLATES[template];
    if (!tpl) {
      console.warn(`[email] unknown template "${template}" — skipping`);
    } else {
      const rendered = tpl(vars);
      subject = rendered.subject;
      body = rendered.body;
    }

    // 1. Console log (acts as our "outbox" in this environment).
    console.log(
      `\n=== EMAIL (logged, not delivered) ===\n` +
        `From: ${FROM_ADDRESS}\n` +
        `To:   ${toEmail || '(unknown)'}\n` +
        `Subj: ${subject}\n` +
        `----------------------------------------\n${body}\n` +
        `=====================================\n`
    );

    // 2. Persist for audit / later delivery.
    await query(
      `INSERT INTO email_notifications
         (user_id, to_email, template, subject, body, status)
       VALUES ($1, $2, $3, $4, $5, 'logged')`,
      [userId, toEmail || null, template, subject, body]
    );

    return { ok: true, subject };
  } catch (err) {
    // Never let notification failures bubble up into the request flow.
    console.error('[email] sendEmail failed (non-fatal):', err.message);
    return { ok: false };
  }
}

module.exports = { sendEmail, TEMPLATES };

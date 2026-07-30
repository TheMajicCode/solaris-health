/**
 * mailer.js — de-identified transactional email adapter.
 *
 * Solaris is a health platform, so no PHI may ever leave the system inside an
 * email that traverses third-party mail infrastructure. Every message this
 * adapter delivers is intentionally CONTENT-FREE: it says only "you have a new
 * message on Solaris" and links the member back to the app to read it behind
 * authentication. Subjects, preheaders and bodies carry NO name, provider,
 * service, date, diagnosis or any other identifying/health detail.
 *
 * Transport selection (first match wins):
 *   1. Resend        — if RESEND_API_KEY is set (HTTPS API, no SDK dependency).
 *   2. Nodemailer SMTP — if SMTP_HOST + SMTP_PORT + SMTP_USER + SMTP_PASS are set.
 *   3. console        — fallback: log the (de-identified) message; never throws.
 *
 * Bilingual (English / Spanish) copy is chosen from the recipient's profile
 * `language`. Every path is wrapped so a delivery failure can never break the
 * booking / intake flow that triggered it.
 */

const { query } = require('../db');

const FROM_ADDRESS =
  process.env.MAIL_FROM || 'Solaris Health <no-reply@solaris-health.com>';

const APP_BASE_URL = (
  process.env.APP_BASE_URL || 'https://solaris-health.abacusai.cloud'
).replace(/\/+$/, '');

/** Which transport will be used, given the current environment. */
function selectTransport() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  ) {
    return 'smtp';
  }
  return 'console';
}

/* ----------------------------------------------------------------------- */
/* De-identified bilingual copy                                            */
/* ----------------------------------------------------------------------- */

function isSpanish(language) {
  const l = String(language || '').trim().toLowerCase();
  return l.startsWith('es') || l === 'spanish' || l === 'español' || l === 'espanol';
}

/**
 * Build the de-identified message. NO PHI — generic "new message" nudge only.
 * @param {string} language  recipient profile language
 * @param {string} link      absolute deep link back into the app
 */
function buildNotification(language, link) {
  if (isSpanish(language)) {
    const subject = 'Tienes un mensaje nuevo en Solaris';
    const preheader = 'Inicia sesión para verlo de forma segura.';
    const text = `Tienes un mensaje nuevo en Solaris Health.\n\nInicia sesión para verlo de forma segura:\n${link}\n\nPor tu privacidad, no incluimos ningún detalle en este correo.\n\n— El equipo de Solaris Health`;
    return { subject, preheader, text, html: htmlWrap(subject, preheader, text, link, 'Abrir Solaris') };
  }
  const subject = 'You have a new message on Solaris';
  const preheader = 'Sign in to view it securely.';
  const text = `You have a new message on Solaris Health.\n\nSign in to view it securely:\n${link}\n\nFor your privacy, we never include any details in this email.\n\n— The Solaris Health Team`;
  return { subject, preheader, text, html: htmlWrap(subject, preheader, text, link, 'Open Solaris') };
}

function htmlWrap(subject, preheader, text, link, cta) {
  const safe = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const lines = safe(text).split('\n').map((l) => l || '&nbsp;').join('<br>');
  return `<!doctype html><html><body style="margin:0;background:#f4f6f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${safe(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
<tr><td style="color:#0A2B29;font-size:18px;font-weight:700;padding-bottom:12px;">${safe(subject)}</td></tr>
<tr><td style="color:#6b807a;font-size:14px;line-height:1.6;">${lines}</td></tr>
<tr><td style="padding-top:24px;"><a href="${safe(link)}" style="display:inline-block;background:#2DB584;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;">${safe(cta)}</a></td></tr>
</table></td></tr></table></body></html>`;
}

/* ----------------------------------------------------------------------- */
/* Transports                                                              */
/* ----------------------------------------------------------------------- */

async function deliverResend({ to, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, text, html }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`resend ${res.status}: ${detail.slice(0, 200)}`);
  }
  return true;
}

let _smtpTransport = null;
async function deliverSmtp({ to, subject, text, html }) {
  if (!_smtpTransport) {
    // Lazy require so the dependency is only loaded when SMTP is actually used.
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    _smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
        parseInt(process.env.SMTP_PORT, 10) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  await _smtpTransport.sendMail({ from: FROM_ADDRESS, to, subject, text, html });
  return true;
}

function deliverConsole({ to, subject, text }) {
  console.log(
    `\n=== NOTIFICATION EMAIL (console transport, de-identified) ===\n` +
      `From: ${FROM_ADDRESS}\nTo:   ${to || '(unknown)'}\nSubj: ${subject}\n` +
      `----------------------------------------\n${text}\n` +
      `=====================================\n`
  );
  return true;
}

/**
 * Low-level delivery via the currently selected transport.
 * @returns {Promise<{ok:boolean, transport:string}>}
 */
async function deliver(msg) {
  const transport = selectTransport();
  try {
    if (transport === 'resend') await deliverResend(msg);
    else if (transport === 'smtp') await deliverSmtp(msg);
    else deliverConsole(msg);
    return { ok: true, transport };
  } catch (err) {
    console.error(`[mailer] ${transport} delivery failed (non-fatal):`, err.message);
    // Fall back to console so there is always an audit trail.
    if (transport !== 'console') deliverConsole(msg);
    return { ok: false, transport };
  }
}

/* ----------------------------------------------------------------------- */
/* Public API                                                              */
/* ----------------------------------------------------------------------- */

/**
 * Send a de-identified "you have a new message" nudge to a member.
 *
 * @param {Object}  opts
 * @param {string}  opts.userId       recipient user id (used to look up email+language)
 * @param {string} [opts.toEmail]     override recipient address (skips lookup)
 * @param {string} [opts.language]    override recipient language (skips lookup)
 * @param {string} [opts.deepLinkPath] app path to link to (default '/')
 * @returns {Promise<{ok:boolean, transport?:string, skipped?:boolean}>}
 */
async function sendNotificationEmail({ userId = null, toEmail = null, language = null, deepLinkPath = '/' } = {}) {
  try {
    let email = toEmail;
    let lang = language;
    if ((!email || !lang) && userId) {
      const { rows } = await query(
        'SELECT email, language FROM users WHERE id = $1',
        [userId]
      );
      if (rows[0]) {
        email = email || rows[0].email;
        lang = lang || rows[0].language;
      }
    }
    if (!email) return { ok: false, skipped: true };

    const path = deepLinkPath && deepLinkPath.startsWith('/') ? deepLinkPath : `/${deepLinkPath || ''}`;
    const link = `${APP_BASE_URL}${path}`;
    const { subject, preheader, text, html } = buildNotification(lang, link);

    const result = await deliver({ to: email, subject, text, html });

    // Persist a de-identified audit row (NO PHI in subject/body).
    try {
      await query(
        `INSERT INTO email_notifications (user_id, to_email, template, subject, body, status)
         VALUES ($1, $2, 'new_message_notification', $3, $4, $5)`,
        [userId, email, subject, `${preheader} ${link}`, result.ok ? `sent:${result.transport}` : `failed:${result.transport}`]
      );
    } catch (_) { /* audit persistence is best-effort */ }

    return result;
  } catch (err) {
    console.error('[mailer] sendNotificationEmail failed (non-fatal):', err.message);
    return { ok: false };
  }
}

module.exports = {
  selectTransport,
  buildNotification,
  isSpanish,
  deliver,
  sendNotificationEmail,
};

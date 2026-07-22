/**
 * notification-provider.js — a tiny ports-and-adapters seam for outbound
 * notifications. One `send()` port fans out to pluggable adapters:
 *
 *   • in-app  — always writes a row via createNotification() (the DB adapter)
 *   • email   — console/log placeholder now; a real SMTP adapter can slot in
 *               later behind the same interface, configured purely by env.
 *
 * Keeps the app deployable-anywhere: no vendor SDK in the core, email is an
 * adapter with a portable no-op fallback. All calls are best-effort — a
 * notification failure must never break the surrounding request.
 */

const { createNotification } = require('./notifications');

/**
 * Send a notification to a user across all configured adapters.
 *
 * @param {string} type    notification type (welcome | practitioner_interest | invite | ...)
 * @param {string} userId  recipient user id
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.message
 * @param {Object} [payload.data]        extra JSON context (e.g. { tab: 'media' })
 * @param {string} [payload.emailSubject]
 * @param {string} [payload.emailBody]   when present, the email adapter fires
 */
async function send(type, userId, { title, message, data = {}, emailSubject, emailBody } = {}) {
  // In-app adapter (always on)
  try {
    await createNotification(userId, type, title, message, data);
  } catch (err) {
    console.error('[NotificationProvider:in-app] failed (non-fatal):', err.message);
  }

  // Email adapter — console/log placeholder. Swap for real SMTP via env later.
  if (emailBody) {
    try {
      console.log(
        `[NotificationProvider:email] TO: ${userId} | SUBJECT: ${emailSubject || title} | BODY: ${String(emailBody).slice(0, 100)}`
      );
    } catch { /* ignore */ }
  }
}

module.exports = { send };

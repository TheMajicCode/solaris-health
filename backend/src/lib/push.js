/**
 * push.js — Web Push (VAPID) delivery, best-effort and PHI-safe.
 *
 * Privacy rule (hard requirement): push payloads NEVER contain message text,
 * health data, or any other user content. The body is always a generic,
 * per-type template ("You have a new message"). Real content stays behind
 * login in the in-app notification center.
 *
 * VAPID keys live in the environment only (backend/.env, never committed).
 * Rotation: `npx web-push generate-vapid-keys`, update env, restart backend.
 * Stale subscriptions are pruned automatically when the push service returns
 * 404/410, and clients re-subscribe with the new public key on next visit.
 *
 * If keys are missing (e.g. in tests), everything degrades to a no-op —
 * in-app notifications keep working.
 */

const webpush = require('web-push');
const { query } = require('../db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@solaris.health';

let configured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  } catch (err) {
    console.error('[push] invalid VAPID keys, push disabled:', err.message);
  }
}

/** Generic, PHI-free copy per notification type. Never interpolate user content. */
const PUSH_TEMPLATES = {
  message: { title: 'Solaris Health', body: 'You have a new secure message.', url: '/messages' },
  booking: { title: 'Solaris Health', body: 'You have a booking update.', url: '/bookings' },
  application_approved: { title: 'Solaris Health', body: 'There is an update on your practitioner application.', url: '/' },
  application_rejected: { title: 'Solaris Health', body: 'There is an update on your practitioner application.', url: '/' },
  review: { title: 'Solaris Health', body: 'You have a new review.', url: '/' },
  system: { title: 'Solaris Health', body: 'You have a new notification.', url: '/' },
};

/**
 * Build the (PHI-free) push payload for a notification type.
 * Exported separately so tests can assert no user content leaks.
 */
function buildPushPayload(type) {
  const t = PUSH_TEMPLATES[type] || PUSH_TEMPLATES.system;
  return { title: t.title, body: t.body, url: t.url };
}

function isPushConfigured() {
  return configured;
}

function getVapidPublicKey() {
  return configured ? VAPID_PUBLIC_KEY : null;
}

/**
 * Send a generic push to all of a user's active subscriptions. Best-effort:
 * never throws, prunes dead endpoints (404/410).
 *
 * @param {string} userId
 * @param {string} type notification type (chooses the generic template)
 */
async function sendPushToUser(userId, type) {
  if (!configured || !userId) return;
  try {
    const subs = await query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1 AND revoked_at IS NULL',
      [userId]
    );
    if (!subs.rows.length) return;

    const payload = JSON.stringify(buildPushPayload(type));
    await Promise.all(
      subs.rows.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
        } catch (err) {
          const code = err && err.statusCode;
          if (code === 404 || code === 410) {
            // Endpoint gone — revoke so we stop retrying.
            await query('UPDATE push_subscriptions SET revoked_at=NOW() WHERE id=$1', [s.id]).catch(() => {});
          } else {
            console.error('[push] send failed (non-fatal):', code || err.message);
          }
        }
      })
    );
  } catch (err) {
    console.error('[push] sendPushToUser failed (non-fatal):', err.message);
  }
}

module.exports = { sendPushToUser, buildPushPayload, isPushConfigured, getVapidPublicKey, PUSH_TEMPLATES };

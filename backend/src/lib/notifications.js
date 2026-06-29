/**
 * notifications.js — in-app notification helper.
 *
 * createNotification() inserts a row in `notifications`. It is best-effort:
 * a notification failure must never break the surrounding request (e.g. an
 * approval should still succeed even if the notification insert fails).
 */

const { query } = require('../db');

/**
 * Create an in-app notification for a user.
 *
 * @param {string} userId   recipient user id
 * @param {string} type     application_approved | application_rejected | booking | message | review | system
 * @param {string} title    short headline
 * @param {string} message  body text
 * @param {Object} [data]   extra JSON context (applicationId, reason, etc.)
 * @returns {Promise<Object|null>} the created row, or null on failure
 */
async function createNotification(userId, type, title, message, data = {}) {
  if (!userId) return null;
  try {
    const r = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, type, title, message, read, data, created_at`,
      [userId, type || 'system', title || null, message || null, data ? JSON.stringify(data) : null]
    );
    return r.rows[0] || null;
  } catch (err) {
    console.error('[notifications] createNotification failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { createNotification };

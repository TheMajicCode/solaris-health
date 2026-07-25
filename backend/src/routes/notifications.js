/**
 * notifications.js — in-app notification API.
 *
 * Mounted at /api/notifications  (all routes require auth)
 *
 *   GET  /                  list current user's notifications (filter, pagination)
 *   GET  /unread-count       unread badge count
 *   PUT  /:id/read           mark one as read
 *   PUT  /read-all           mark all as read
 *   POST /test               create a test notification for the current user (dev)
 *   GET  /vapid-public-key   web push public key (null when push not configured)
 *   POST /subscribe          register a browser push subscription
 *   POST /unsubscribe        revoke a browser push subscription
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { getVapidPublicKey, isPushConfigured } = require('../lib/push');

const router = express.Router();

router.use(authMiddleware);

const PROVIDER_TYPES = ['application_approved', 'application_rejected', 'booking', 'review'];
const SYSTEM_TYPES = ['system', 'message'];

/* GET / — list notifications (filter: all|unread|provider|system) */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { filter = 'all' } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const where = ['user_id = $1'];
    const vals = [userId];
    let i = 2;

    if (filter === 'unread') {
      where.push('read = false');
    } else if (filter === 'provider') {
      where.push(`type = ANY($${i++})`);
      vals.push(PROVIDER_TYPES);
    } else if (filter === 'system') {
      where.push(`type = ANY($${i++})`);
      vals.push(SYSTEM_TYPES);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    vals.push(limit, offset);
    const r = await db.query(
      `SELECT id, type, title, message, read, data, created_at
         FROM notifications
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${i++} OFFSET $${i}`,
      vals
    );

    const count = await db.query(
      'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND read=false',
      [userId]
    );

    res.json({ notifications: r.rows, unread: count.rows[0]?.unread || 0 });
  } catch (err) {
    console.error('notifications list', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /unread-count — badge */
router.get('/unread-count', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id=$1 AND read=false',
      [req.user.userId]
    );
    res.json({ unread: r.rows[0]?.unread || 0 });
  } catch (err) {
    console.error('notifications unread-count', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* PUT /read-all — mark all read (declared before /:id/read) */
router.put('/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read=true WHERE user_id=$1 AND read=false',
      [req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications read-all', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* PUT /:id/read — mark one read */
router.put('/:id/read', async (req, res) => {
  try {
    const r = await db.query(
      'UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('notifications mark read', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /test — create a test notification for the current user (dev helper) */
router.post('/test', async (req, res) => {
  try {
    const { type = 'system', title = 'Test notification', message = 'This is a test notification from LUCA Passport.', data = {} } = req.body || {};
    const n = await createNotification(req.user.userId, type, title, message, data);
    res.json({ ok: true, notification: n });
  } catch (err) {
    console.error('notifications test', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* GET /vapid-public-key — public key for browser push subscription */
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: getVapidPublicKey(), enabled: isPushConfigured() });
});

/* POST /subscribe — register a browser push subscription for this user */
router.post('/subscribe', async (req, res) => {
  try {
    if (!isPushConfigured()) return res.status(503).json({ error: 'Push notifications are not configured on this server' });
    const { endpoint, keys, userAgent } = req.body || {};
    if (!endpoint || typeof endpoint !== 'string' || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'A push subscription with endpoint and keys (p256dh, auth) is required' });
    }
    // Upsert on endpoint: a browser re-subscribing (or a different user on the
    // same browser) takes over the endpoint and un-revokes it.
    await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent,
             revoked_at = NULL`,
      [req.user.userId, endpoint, keys.p256dh, keys.auth, (userAgent || '').slice(0, 500) || null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('push subscribe', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* POST /unsubscribe — revoke a browser push subscription */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await db.query(
      'UPDATE push_subscriptions SET revoked_at=NOW() WHERE endpoint=$1 AND user_id=$2 AND revoked_at IS NULL',
      [endpoint, req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('push unsubscribe', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

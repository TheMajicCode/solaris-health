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
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');

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

module.exports = router;

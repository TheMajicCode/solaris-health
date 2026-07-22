/**
 * admin/invite.js — admin beta-invite endpoint.
 *
 * Mounted at /api/admin/invite (admin only).
 *
 *   POST /   { email, firstName, tempPassword?, personalNote? }
 *     Creates a member account (role=patient, onboarding_status='profile') with a
 *     temporary password, sends an invite via the NotificationProvider (in-app +
 *     email log), and returns the plain temp password ONCE for the admin to relay.
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const { authMiddleware } = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/admin-only');
const notificationProvider = require('../../lib/notification-provider');

const router = express.Router();

router.use(authMiddleware, adminOnly);

function randomPassword(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

router.post('/', async (req, res) => {
  try {
    const { email, firstName, tempPassword, personalNote } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const plainPassword = tempPassword && String(tempPassword).length >= 6 ? String(tempPassword) : randomPassword(8);
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const fullName = firstName || email.split('@')[0];

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, first_name, role, onboarding_status)
       VALUES ($1,$2,$3,$4,'patient','profile') RETURNING id, email`,
      [email, passwordHash, fullName, firstName || null]
    );
    const user = result.rows[0];

    // Send the invite (best-effort).
    try {
      await notificationProvider.send('invite', user.id, {
        title: 'You have been invited to Solaris',
        message: `Welcome${firstName ? ', ' + firstName : ''}! Your Sovereign Passport is ready.${personalNote ? ' ' + personalNote : ''}`,
        data: { tab: 'dashboard' },
        emailSubject: 'Your Solaris invitation',
        emailBody: `Sign in at ${email} with your temporary password: ${plainPassword}.${personalNote ? ' Note: ' + personalNote : ''}`,
      });
    } catch (e) { console.warn('[invite] notification failed:', e.message); }

    res.status(201).json({ userId: user.id, email: user.email, tempPassword: plainPassword });
  } catch (err) {
    console.error('admin invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

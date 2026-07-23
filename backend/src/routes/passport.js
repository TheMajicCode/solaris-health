/**
 * passport.js — Sovereign Passport completeness.
 * Mounted at /api/passport.
 *
 * Returns a 0–100 completeness score built from the member's real activity across
 * the passport: intake assessment, daily check-ins, habits, journal, journey,
 * bookings and health documents. Each area contributes a fixed weight; the
 * response also returns the per-area `checks` and a warm `nextStep` suggestion.
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Weighted areas (sum = 100). Order also defines next-step priority.
const AREAS = [
  {
    key: 'intake', weight: 20, tab: 'health',
    label: 'Complete your intake assessment',
    hint: 'Take the Solaris Method assessment to map your Mind, Body, Heart & Spirit.',
    sql: `SELECT 1 FROM assessment_responses WHERE user_id=$1 LIMIT 1`,
  },
  {
    key: 'journey', weight: 15, tab: 'explore',
    label: 'Begin a journey',
    hint: 'Choose a journey — Heal, Learn, Earn or Contribute — to give your path direction.',
    sql: `SELECT 1 FROM member_journeys WHERE user_id=$1 LIMIT 1`,
  },
  {
    key: 'checkin', weight: 15, tab: 'dashboard',
    label: 'Log your first check-in',
    hint: 'A daily check-in helps LUCA notice what moves your vitality.',
    sql: `SELECT 1 FROM daily_checkins WHERE user_id=$1 LIMIT 1`,
  },
  {
    key: 'booking', weight: 15, tab: 'explore',
    label: 'Book a session with a practitioner',
    hint: 'Connect with a Solaris practitioner when you feel ready.',
    sql: `SELECT 1 FROM bookings WHERE patient_id=$1 LIMIT 1`,
  },
  {
    key: 'habit', weight: 15, tab: 'dashboard',
    label: 'Start a daily habit',
    hint: 'Tend a small daily habit — tiny, repeatable steps compound.',
    sql: `SELECT 1 FROM member_habits WHERE user_id=$1 LIMIT 1`,
  },
  {
    key: 'journal', weight: 10, tab: 'journal',
    label: 'Write a journal entry',
    hint: 'Reflect in your journal — a few honest lines are enough.',
    sql: `SELECT 1 FROM journal_entries WHERE user_id=$1 LIMIT 1`,
  },
  {
    key: 'health_doc', weight: 10, tab: 'health',
    label: 'Add a health document',
    hint: 'Bring a lab result or record into your sovereign vault when you like.',
    sql: `SELECT 1 FROM health_documents WHERE user_id=$1 LIMIT 1`,
  },
];

// GET /api/passport/completeness
router.get('/completeness', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const results = await Promise.all(
      AREAS.map((a) =>
        db.query(a.sql, [userId])
          .then((r) => r.rowCount > 0)
          .catch(() => false) // a missing table never breaks the score
      )
    );

    const checks = {};
    let score = 0;
    AREAS.forEach((a, i) => {
      const done = results[i];
      checks[a.key] = done;
      if (done) score += a.weight;
    });
    score = Math.max(0, Math.min(100, score));

    // Next step = highest-priority incomplete area (null when fully complete).
    const nextArea = AREAS.find((a) => !checks[a.key]) || null;
    const nextStep = nextArea
      ? { key: nextArea.key, label: nextArea.label, hint: nextArea.hint, tab: nextArea.tab }
      : null;

    const tier = score >= 80 ? 'sovereign' : score >= 50 ? 'growing' : 'starting';

    res.json({ score, checks, nextStep, tier });
  } catch (err) {
    console.error('passport completeness', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/passport/sovereignty-status — one truthful answer to:
// who am I here, which identity methods are connected, who has access,
// where my data lives, which AI handled my last LUCA interaction, and
// how I export or revoke. Plain language first; identifiers live under
// `advanced` for the details disclosure — never as the main UX.
router.get('/sovereignty-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const safe = (q, params) => db.query(q, params).then((r) => r.rows).catch(() => []);

    const [userRows, wallets, consents, lastReceipt] = await Promise.all([
      safe(
        `SELECT id, email, full_name, role, country, city, created_at, did, nostr_npub
           FROM users WHERE id=$1 AND deleted_at IS NULL`,
        [userId]
      ),
      safe(
        `SELECT chain, label, verified, is_primary FROM wallet_addresses WHERE user_id=$1`,
        [userId]
      ),
      safe(
        `SELECT pc.id, pc.granted_sections, pc.status, pc.responded_at, pc.expires_at,
                u.full_name AS practitioner_name
           FROM passport_consents pc
           JOIN users u ON u.id = pc.practitioner_id
          WHERE pc.member_id=$1 AND pc.status='granted'
          ORDER BY pc.responded_at DESC NULLS LAST`,
        [userId]
      ),
      safe(
        `SELECT provider, compute_target, event_type, degraded, created_at
           FROM ai_execution_receipts
          WHERE user_id=$1
          ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ),
    ]);

    if (!userRows.length) return res.status(404).json({ error: 'User not found' });
    const u = userRows[0];

    const identityMethods = [
      { method: 'email', label: 'Email & password', connected: true, detail: u.email },
      { method: 'did', label: 'Decentralized ID (DID)', connected: Boolean(u.did) },
      { method: 'nostr', label: 'Nostr key', connected: Boolean(u.nostr_npub) },
      {
        method: 'wallet',
        label: 'Crypto wallet',
        connected: wallets.length > 0,
        detail: wallets.length
          ? `${wallets.length} linked (${[...new Set(wallets.map((w) => w.chain))].join(', ')})`
          : undefined,
      },
    ];

    const ai = lastReceipt.length
      ? {
          provider: lastReceipt[0].provider,
          computeTarget: lastReceipt[0].compute_target,
          interaction: lastReceipt[0].event_type,
          degraded: lastReceipt[0].degraded,
          at: lastReceipt[0].created_at,
          plain:
            lastReceipt[0].compute_target === 'in_process'
              ? 'Your last LUCA reply was generated inside Solaris itself — nothing left the server.'
              : lastReceipt[0].compute_target === 'local'
                ? 'Your last LUCA reply was generated on Solaris-controlled hardware.'
                : 'Your last LUCA reply used a managed cloud AI provider; identifying numbers are stripped before anything is sent, and only content hashes are kept in the receipt.',
        }
      : { provider: null, plain: 'You have not talked with LUCA yet, so no AI has handled your data.' };

    res.json({
      identity: {
        name: u.full_name,
        role: u.role,
        memberSince: u.created_at,
        location: [u.city, u.country].filter(Boolean).join(', ') || null,
        plain: `You are ${u.full_name || 'a Solaris member'} — a sovereign ${u.role === 'patient' ? 'member' : u.role} of Solaris. Your Passport belongs to you.`,
      },
      identityMethods,
      access: {
        practitioners: consents.map((c) => ({
          id: c.id, // needed for PUT /api/consent/:id/revoke
          name: c.practitioner_name,
          sections: c.granted_sections,
          since: c.responded_at,
          expires: c.expires_at,
        })),
        plain: consents.length
          ? `${consents.length} practitioner${consents.length > 1 ? 's' : ''} can currently view parts of your Passport — only the sections you granted, and you can revoke at any time.`
          : 'No one else can view your Passport right now. Practitioners only ever see it with your explicit consent.',
      },
      storage: {
        plain:
          'Your data lives in Solaris\u2019s own PostgreSQL database on a server we operate — not inside a third-party health platform. Daily backups are kept under Solaris\u2019s own cloud storage account.',
        exportFormats: ['JSON vault export', 'ZIP archive'],
      },
      ai,
      rights: {
        export: { api: '/api/export/me', zip: '/api/export/me.zip' },
        revokeConsent: '/api/consent/:id/revoke',
        plain: 'You can export everything Solaris holds about you at any time, and revoke any practitioner\u2019s access with one tap.',
      },
      advanced: {
        subjectId: u.id,
        did: u.did || null,
        nostrNpub: u.nostr_npub || null,
      },
    });
  } catch (err) {
    console.error('passport sovereignty-status', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

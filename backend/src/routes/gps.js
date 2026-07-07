/**
 * gps.js — Generative Prosperity System API (mounted at /api/gps).
 *
 * Surfaces the economic coordination layer to the frontend: a patient's
 * value trail, provider/contributor earnings, the regenerative treasury,
 * the referral economy, and admin-wide GPS statistics.
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin-only');
const { processGPSSplit, ensureReferralCode, FUND_LABELS, GPS_SPLIT } = require('../lib/gps-engine');

const router = express.Router();

const FUND_META = {
  health:         { label: 'Local Health Fund',          icon: '🏥' },
  food:           { label: 'Regenerative Food Fund',      icon: '🌱' },
  education:      { label: 'Education Fund',               icon: '📚' },
  infrastructure: { label: 'Infrastructure Fund',         icon: '🖥️' },
  emergency:      { label: 'Emergency Resilience Fund',   icon: '🆘' },
  opensource:     { label: 'Open-Source Fund',            icon: '💻' },
};

/* ----------------------- lightweight treasury cache ----------------------- */
let treasuryCache = { at: 0, data: null };
const TREASURY_TTL = 5 * 60 * 1000;

/* ============================ PATIENT LEDGER ============================ */
// GET /api/gps/my-ledger?limit=&offset=
router.get('/my-ledger', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const r = await db.query(
      `SELECT t.*, s.service_name, p.business_name
         FROM gps_transactions t
         LEFT JOIN bookings b ON b.id = t.booking_id
         LEFT JOIN provider_services s ON s.id = b.service_id
         LEFT JOIN provider_profiles p ON p.id = t.provider_id
        WHERE t.patient_id = $1
        ORDER BY t.created_at DESC
        LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );
    const totals = await db.query(
      `SELECT
         COALESCE(SUM(total_amount),0)::numeric AS total_spent,
         COALESCE(SUM(user_reward_share),0)::numeric AS total_rewards,
         COALESCE(SUM(treasury_share),0)::numeric AS treasury_contributed,
         COUNT(*)::int AS tx_count
       FROM gps_transactions WHERE patient_id=$1`,
      [req.user.userId]
    );
    const s = totals.rows[0];
    // Ecosystem impact score: a friendly composite of spend + commons built.
    const impact = Math.round(Number(s.total_spent) * 0.5 + Number(s.treasury_contributed) * 20 + Number(s.tx_count) * 5);
    res.json({ transactions: r.rows, summary: { ...s, impact_score: impact } });
  } catch (err) {
    console.error('gps my-ledger', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* =========================== EARNINGS DASHBOARD =========================== */
// GET /api/gps/my-earnings — provider payout + contributor earnings for the caller
router.get('/my-earnings', authMiddleware, async (req, res) => {
  try {
    // Provider side: sum provider_share across the caller's provider profiles.
    const provider = await db.query(
      `SELECT
         COALESCE(SUM(t.provider_share),0)::numeric AS total_earned,
         COALESCE(SUM(t.provider_share) FILTER (WHERE t.status='settled'),0)::numeric AS settled,
         COALESCE(SUM(t.provider_share) FILTER (WHERE t.status<>'settled'),0)::numeric AS pending,
         COUNT(*)::int AS bookings
       FROM gps_transactions t
       JOIN provider_profiles p ON p.id = t.provider_id
      WHERE p.user_id = $1`,
      [req.user.userId]
    );
    const perBooking = await db.query(
      `SELECT t.id, t.total_amount, t.provider_share, t.status, t.created_at,
              s.service_name, u.full_name AS patient_name
         FROM gps_transactions t
         JOIN provider_profiles p ON p.id = t.provider_id
         LEFT JOIN bookings b ON b.id = t.booking_id
         LEFT JOIN provider_services s ON s.id = b.service_id
         LEFT JOIN users u ON u.id = t.patient_id
        WHERE p.user_id = $1
        ORDER BY t.created_at DESC
        LIMIT 50`,
      [req.user.userId]
    );
    // Contributor / referral side.
    const contributor = await db.query(
      `SELECT contribution_type, total_earned, pending_earnings, settled_earnings, referral_count
         FROM gps_contributors WHERE user_id=$1`,
      [req.user.userId]
    );
    res.json({
      provider: provider.rows[0],
      perBooking: perBooking.rows,
      contributor: contributor.rows,
      splitTemplate: GPS_SPLIT,
    });
  } catch (err) {
    console.error('gps my-earnings', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ============================== TREASURY ============================== */
// GET /api/gps/treasury — public overview (cached 5 min)
router.get('/treasury', async (req, res) => {
  try {
    if (treasuryCache.data && Date.now() - treasuryCache.at < TREASURY_TTL) {
      return res.json(treasuryCache.data);
    }
    const total = await db.query('SELECT COALESCE(SUM(amount),0)::numeric AS balance, COUNT(*)::int AS deposits FROM gps_treasury');
    const byFund = await db.query(
      `SELECT fund_type, COALESCE(SUM(amount),0)::numeric AS amount, COUNT(*)::int AS deposits
         FROM gps_treasury GROUP BY fund_type`
    );
    // Monthly growth for a chart.
    const growth = await db.query(
      `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS month,
              COALESCE(SUM(amount),0)::numeric AS amount
         FROM gps_treasury
        GROUP BY 1 ORDER BY 1`
    );
    const funds = Object.keys(FUND_META).map((k) => {
      const row = byFund.rows.find((f) => f.fund_type === k);
      return { fund_type: k, ...FUND_META[k], amount: row ? Number(row.amount) : 0, deposits: row ? row.deposits : 0 };
    });
    const data = {
      balance: Number(total.rows[0].balance),
      deposits: total.rows[0].deposits,
      funds,
      growth: growth.rows.map((g) => ({ month: g.month, amount: Number(g.amount) })),
    };
    treasuryCache = { at: Date.now(), data };
    res.json(data);
  } catch (err) {
    console.error('gps treasury', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/gps/treasury/breakdown — fund breakdown + recent contributions
router.get('/treasury/breakdown', async (req, res) => {
  try {
    const byFund = await db.query(
      `SELECT fund_type, COALESCE(SUM(amount),0)::numeric AS amount, COUNT(*)::int AS deposits
         FROM gps_treasury GROUP BY fund_type`
    );
    const recent = await db.query(
      `SELECT amount, fund_type, description, created_at
         FROM gps_treasury ORDER BY created_at DESC LIMIT 15`
    );
    const funds = Object.keys(FUND_META).map((k) => {
      const row = byFund.rows.find((f) => f.fund_type === k);
      return { fund_type: k, ...FUND_META[k], amount: row ? Number(row.amount) : 0, deposits: row ? row.deposits : 0 };
    });
    res.json({ funds, recent: recent.rows });
  } catch (err) {
    console.error('gps treasury breakdown', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ============================== REFERRALS ============================== */
// GET /api/gps/referrals/my-code
router.get('/referrals/my-code', authMiddleware, async (req, res) => {
  try {
    const u = await db.query('SELECT full_name, referral_code FROM users WHERE id=$1', [req.user.userId]);
    let code = u.rows[0]?.referral_code;
    if (!code) code = await ensureReferralCode(req.user.userId, u.rows[0]?.full_name || req.user.email);
    res.json({ code, link: `https://solaris-health.abacusai.cloud?ref=${code}` });
  } catch (err) {
    console.error('gps my-code', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/gps/referrals/my-earnings
router.get('/referrals/my-earnings', authMiddleware, async (req, res) => {
  try {
    const summary = await db.query(
      `SELECT COALESCE(SUM(reward_amount),0)::numeric AS total_earned,
              COALESCE(SUM(reward_amount) FILTER (WHERE status='paid'),0)::numeric AS paid,
              COALESCE(SUM(reward_amount) FILTER (WHERE status='pending'),0)::numeric AS pending,
              COUNT(*)::int AS reward_count
         FROM gps_referrals WHERE referrer_id=$1`,
      [req.user.userId]
    );
    const joined = await db.query(
      `SELECT ru.full_name, ru.created_at,
              COUNT(gr.id) FILTER (WHERE gr.booking_id IS NOT NULL)::int AS bookings,
              COALESCE(SUM(gr.reward_amount),0)::numeric AS earned
         FROM users ru
         LEFT JOIN gps_referrals gr ON gr.referred_user_id = ru.id AND gr.referrer_id = $1
        WHERE ru.referred_by = $1
        GROUP BY ru.id, ru.full_name, ru.created_at
        ORDER BY ru.created_at DESC`,
      [req.user.userId]
    );
    res.json({ summary: summary.rows[0], referrals: joined.rows });
  } catch (err) {
    console.error('gps referral earnings', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/gps/referrals/apply  body: { code }
router.post('/referrals/apply', authMiddleware, async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'Referral code required' });

    const me = await db.query('SELECT id, referred_by FROM users WHERE id=$1', [req.user.userId]);
    if (me.rows[0]?.referred_by) return res.status(400).json({ error: 'A referral is already applied to your account.' });

    const ref = await db.query('SELECT id FROM users WHERE referral_code=$1', [code]);
    if (!ref.rows.length) return res.status(404).json({ error: 'That referral code was not found.' });
    const referrerId = ref.rows[0].id;
    if (referrerId === req.user.userId) return res.status(400).json({ error: 'You cannot refer yourself.' });

    await db.query('UPDATE users SET referred_by=$1 WHERE id=$2', [referrerId, req.user.userId]);
    await db.query(
      `INSERT INTO gps_referrals (referrer_id, referred_user_id, reward_amount, status)
       VALUES ($1,$2,0,'pending')`,
      [referrerId, req.user.userId]
    );
    res.json({ ok: true, referrerId });
  } catch (err) {
    console.error('gps apply referral', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ========================= PROCESS (admin/system) ========================= */
// POST /api/gps/process/:bookingId — process a completed booking's split
router.post('/process/:bookingId', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT b.*, p.user_id AS provider_user_id
         FROM bookings b LEFT JOIN provider_profiles p ON p.id=b.provider_id
        WHERE b.id=$1`,
      [req.params.bookingId]
    );
    const booking = r.rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    // Only admin or the owning provider may trigger a manual split.
    if (req.user.role !== 'admin' && booking.provider_user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ error: 'GPS splits are processed on completed bookings only.' });
    }
    const result = await processGPSSplit(booking);
    treasuryCache = { at: 0, data: null }; // invalidate
    res.json(result);
  } catch (err) {
    console.error('gps process', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ============================ ADMIN STATS ============================ */
// GET /api/gps/stats
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tx = await db.query(
      `SELECT COUNT(*)::int AS transactions,
              COALESCE(SUM(total_amount),0)::numeric AS gross_volume,
              COALESCE(SUM(provider_share),0)::numeric AS provider_total,
              COALESCE(SUM(contributor_share),0)::numeric AS contributor_total,
              COALESCE(SUM(infrastructure_share),0)::numeric AS infrastructure_total,
              COALESCE(SUM(treasury_share),0)::numeric AS treasury_total,
              COALESCE(SUM(software_share),0)::numeric AS software_total,
              COALESCE(SUM(user_reward_share),0)::numeric AS reward_total
         FROM gps_transactions`
    );
    const treasury = await db.query('SELECT COALESCE(SUM(amount),0)::numeric AS balance FROM gps_treasury');
    const recent = await db.query(
      `SELECT t.id, t.total_amount, t.provider_share, t.treasury_share, t.user_reward_share, t.created_at,
              p.business_name, u.full_name AS patient_name
         FROM gps_transactions t
         LEFT JOIN provider_profiles p ON p.id=t.provider_id
         LEFT JOIN users u ON u.id=t.patient_id
        ORDER BY t.created_at DESC LIMIT 12`
    );
    res.json({ stats: tx.rows[0], treasuryBalance: Number(treasury.rows[0].balance), recent: recent.rows });
  } catch (err) {
    console.error('gps stats', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ============================ LEADERBOARD ============================ */
// GET /api/gps/leaderboard — top contributors (anonymized initials)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT c.total_earned, c.referral_count, u.full_name
         FROM gps_contributors c JOIN users u ON u.id=c.user_id
        WHERE c.total_earned > 0
        ORDER BY c.total_earned DESC LIMIT 10`
    );
    const anon = (name) => {
      const parts = String(name || 'Anonymous').trim().split(/\s+/);
      return parts.map((p) => (p[0] || '').toUpperCase()).join('') || 'A';
    };
    res.json({
      leaderboard: r.rows.map((row, i) => ({
        rank: i + 1,
        initials: anon(row.full_name),
        total_earned: Number(row.total_earned),
        referral_count: row.referral_count,
      })),
    });
  } catch (err) {
    console.error('gps leaderboard', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

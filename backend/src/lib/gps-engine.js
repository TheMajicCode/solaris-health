/**
 * gps-engine.js — the Generative Prosperity System value-split engine.
 *
 * Every completed booking is routed through processGPSSplit(), which divides
 * the transaction value across the whole ecosystem and records an immutable
 * ledger row plus treasury deposits, contributor credits, referral rewards
 * and LOVE (reciprocity) points for the patient.
 *
 * "Value flows to where value was created."
 *
 * All work is best-effort and idempotent: a GPS failure must never break the
 * underlying booking, and re-processing the same booking is a no-op.
 */

const db = require('../db');
const { createNotification } = require('./notifications');

/** The default GPS split template. Fractions must sum to 1. */
const GPS_SPLIT = {
  provider: 0.85,       // Sovereign income
  contributor: 0.05,    // Ecosystem builder (referrer) — or platform if none
  infrastructure: 0.03, // Local node operators
  treasury: 0.03,       // Regenerative commons
  software: 0.02,       // Platform maintenance / open-source
  userReward: 0.02,     // Patient LOVE / education credits
};

/**
 * How the 3% treasury share is distributed across the six community funds.
 * Weights are normalized, tuned to build a believable regenerative commons.
 */
const TREASURY_FUND_WEIGHTS = {
  health: 0.37,
  food: 0.223,
  education: 0.185,
  infrastructure: 0.111,
  emergency: 0.074,
  opensource: 0.037,
};

const FUND_LABELS = {
  health: 'Local Health Fund',
  food: 'Regenerative Food Fund',
  education: 'Education Fund',
  infrastructure: 'Infrastructure Fund',
  emergency: 'Emergency Resilience Fund',
  opensource: 'Open-Source Fund',
};

/** LOVE points awarded per $1 of user reward share (2% of total → ×100). */
const LOVE_POINTS_PER_DOLLAR = 100;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Compute the six-way split for a total amount. The provider share absorbs
 * any rounding remainder so the parts always sum exactly to the total.
 */
function computeSplit(total) {
  const t = round2(total);
  const contributor = round2(t * GPS_SPLIT.contributor);
  const infrastructure = round2(t * GPS_SPLIT.infrastructure);
  const treasury = round2(t * GPS_SPLIT.treasury);
  const software = round2(t * GPS_SPLIT.software);
  const userReward = round2(t * GPS_SPLIT.userReward);
  const provider = round2(t - contributor - infrastructure - treasury - software - userReward);
  return { total: t, provider, contributor, infrastructure, treasury, software, userReward };
}

/** Award LOVE (reciprocity) points to a user + log a reward event. */
async function awardLovePoints(userId, points, note) {
  if (!userId || !points) return;
  const pts = Math.round(points);
  try {
    await db.query(
      `INSERT INTO reward_events (user_id, event_type, points, category, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, 'gps_reward', pts, 'gps', note || 'GPS reciprocity credit']
    );
    await db.query('UPDATE users SET love_points = COALESCE(love_points,0) + $1 WHERE id = $2', [pts, userId]);
  } catch (err) {
    console.warn('[gps] awardLovePoints failed (non-fatal):', err.message);
  }
}

/** Credit a contributor's running tally (upsert on user + type). */
async function creditContributor(userId, type, amount) {
  if (!userId || !amount) return;
  const amt = round2(amount);
  await db.query(
    `INSERT INTO gps_contributors (user_id, contribution_type, total_earned, pending_earnings, referral_count)
       VALUES ($1,$2,$3,$3,1)
     ON CONFLICT (user_id, contribution_type) DO UPDATE
       SET total_earned = gps_contributors.total_earned + EXCLUDED.total_earned,
           pending_earnings = gps_contributors.pending_earnings + EXCLUDED.pending_earnings,
           referral_count = gps_contributors.referral_count + 1,
           updated_at = now()`,
    [userId, type, amt]
  );
}

/** Deposit the treasury share across the six community funds by weight. */
async function depositTreasury(transactionId, treasuryTotal) {
  const amt = round2(treasuryTotal);
  if (amt <= 0) return;
  const funds = Object.keys(TREASURY_FUND_WEIGHTS);
  let allocated = 0;
  for (let i = 0; i < funds.length; i += 1) {
    const fund = funds[i];
    let portion = round2(amt * TREASURY_FUND_WEIGHTS[fund]);
    if (i === funds.length - 1) portion = round2(amt - allocated); // remainder to last fund
    allocated = round2(allocated + portion);
    if (portion <= 0) continue;
    await db.query(
      `INSERT INTO gps_treasury (transaction_id, amount, fund_type, description)
       VALUES ($1,$2,$3,$4)`,
      [transactionId, portion, fund, `A patient booking added $${portion.toFixed(2)} to the ${FUND_LABELS[fund]}`]
    );
  }
}

/**
 * Process the GPS split for a booking. Idempotent: if a gps_transaction
 * already exists for the booking it returns the existing split.
 *
 * @param {Object} booking  a bookings row (needs id, total_price, provider_id, patient_id, currency)
 * @returns {Promise<Object>} the computed split + transaction id
 */
async function processGPSSplit(booking) {
  if (!booking || !booking.id) throw new Error('processGPSSplit: booking required');

  // Idempotency guard.
  const existing = await db.query('SELECT * FROM gps_transactions WHERE booking_id=$1', [booking.id]);
  if (existing.rows.length) {
    const t = existing.rows[0];
    return {
      alreadyProcessed: true,
      transactionId: t.id,
      split: {
        total: Number(t.total_amount), provider: Number(t.provider_share),
        contributor: Number(t.contributor_share), infrastructure: Number(t.infrastructure_share),
        treasury: Number(t.treasury_share), software: Number(t.software_share),
        userReward: Number(t.user_reward_share),
      },
    };
  }

  const total = round2(booking.total_price);
  const split = computeSplit(total);
  const currency = booking.currency || 'USD';
  const patientId = booking.patient_id;
  const providerId = booking.provider_id;

  // Determine the contributor: whoever referred this patient (if anyone).
  let contributorId = null;
  if (patientId) {
    const u = await db.query('SELECT referred_by FROM users WHERE id=$1', [patientId]);
    contributorId = u.rows[0]?.referred_by || null;
  }

  // Record the canonical ledger row.
  const ins = await db.query(
    `INSERT INTO gps_transactions
       (booking_id, total_amount, currency, provider_share, contributor_share,
        infrastructure_share, treasury_share, software_share, user_reward_share,
        provider_id, contributor_id, patient_id, status, split_template)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending','default')
     RETURNING *`,
    [
      booking.id, split.total, currency, split.provider, split.contributor,
      split.infrastructure, split.treasury, split.software, split.userReward,
      providerId || null, contributorId, patientId || null,
    ]
  );
  const tx = ins.rows[0];

  // Treasury deposits across the six funds.
  await depositTreasury(tx.id, split.treasury);

  // LOVE points to the patient (2% share → reciprocity credits).
  if (patientId && split.userReward > 0) {
    const lovePoints = split.userReward * LOVE_POINTS_PER_DOLLAR;
    await awardLovePoints(patientId, lovePoints, 'GPS reward — your booking fed the ecosystem');
  }

  // Credit + reward the referral contributor (5% share).
  if (contributorId && split.contributor > 0) {
    await creditContributor(contributorId, 'referral', split.contributor);
    await db.query(
      `INSERT INTO gps_referrals (referrer_id, referred_user_id, booking_id, reward_amount, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [contributorId, patientId || null, booking.id, split.contributor]
    );
  }

  // Notify everyone whose value was recognized.
  await notifyAllParties(booking, split, contributorId);

  return { alreadyProcessed: false, transactionId: tx.id, split, contributorId };
}

/** Fire in-app notifications to patient, provider owner, and contributor. */
async function notifyAllParties(booking, split, contributorId) {
  try {
    const providerRow = await db.query('SELECT user_id, business_name FROM provider_profiles WHERE id=$1', [booking.provider_id]);
    const provider = providerRow.rows[0] || {};

    if (booking.patient_id) {
      await createNotification(
        booking.patient_id, 'gps', '🌱 Your value trail grew',
        `Your booking distributed $${split.total.toFixed(2)} across the ecosystem — and earned you ${Math.round(split.userReward * LOVE_POINTS_PER_DOLLAR)} LOVE points. Value flows to where value was created.`,
        { bookingId: booking.id, kind: 'gps_split' }
      );
    }
    if (provider.user_id) {
      await createNotification(
        provider.user_id, 'gps', '💰 Sovereign income recorded',
        `Your ${split.provider.toFixed(2)} provider share from a completed booking has been recorded in GPS (pending settlement).`,
        { bookingId: booking.id, kind: 'gps_earning' }
      );
    }
    if (contributorId) {
      await createNotification(
        contributorId, 'gps', '🤝 Ecosystem builder reward',
        `You earned $${split.contributor.toFixed(2)} because someone you referred booked care. Thank you for growing the regenerative economy.`,
        { bookingId: booking.id, kind: 'gps_referral' }
      );
    }
  } catch (err) {
    console.warn('[gps] notifyAllParties failed (non-fatal):', err.message);
  }
}

/**
 * Generate a unique 6-character referral code.
 * Base from the username, suffix from the user id, padded with X.
 */
function generateReferralCode(userId, username) {
  const base = String(username || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = String(userId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return (base.slice(0, 3) + suffix).padEnd(6, 'X').slice(0, 6);
}

/** Ensure a user has a referral code; generates + persists a unique one. */
async function ensureReferralCode(userId, username) {
  const cur = await db.query('SELECT referral_code FROM users WHERE id=$1', [userId]);
  if (cur.rows[0]?.referral_code) return cur.rows[0].referral_code;

  let code = generateReferralCode(userId, username);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const r = await db.query(
        'UPDATE users SET referral_code=$1 WHERE id=$2 AND referral_code IS NULL RETURNING referral_code',
        [code, userId]
      );
      if (r.rows.length) return r.rows[0].referral_code;
      // Was set concurrently — read it back.
      const again = await db.query('SELECT referral_code FROM users WHERE id=$1', [userId]);
      if (again.rows[0]?.referral_code) return again.rows[0].referral_code;
    } catch (err) {
      // Unique collision — perturb and retry.
      const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
      code = (code.slice(0, 4) + rand).slice(0, 6);
    }
  }
  return code;
}

module.exports = {
  GPS_SPLIT,
  TREASURY_FUND_WEIGHTS,
  FUND_LABELS,
  LOVE_POINTS_PER_DOLLAR,
  computeSplit,
  processGPSSplit,
  awardLovePoints,
  generateReferralCode,
  ensureReferralCode,
};

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { ensureSubjectForUser } = require('../lib/identity');

// Resolve the permanent Solaris subject id for the JWT `sub` claim.
// Best-effort: token issuance must never fail on identity-spine hiccups.
async function subjectRef(userId) {
  try { const s = await ensureSubjectForUser(userId); return s ? s.subject_id : null; }
  catch (_) { return null; }
}
const { ensureReferralCode } = require('../lib/gps-engine');
const notificationProvider = require('../lib/notification-provider');

const router = express.Router();

async function award(userId, eventType, points, category, note) {
  await db.query(
    'INSERT INTO reward_events (user_id, event_type, points, category, note) VALUES ($1,$2,$3,$4,$5)',
    [userId, eventType, points, category, note]
  );
  await db.query('UPDATE users SET love_points = COALESCE(love_points,0) + $1 WHERE id = $2', [points, userId]);
}

function shapeUser(u) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    firstName: u.first_name,
    lastName: u.last_name,
    role: u.role,
    avatarUrl: u.avatar_url,
    onboardingStatus: u.onboarding_status,
    currentPhase: u.current_phase,
    lovePoints: u.love_points,
    country: u.country,
    city: u.city,
    language: u.language,
    isProvider: u.is_provider === true,
    providerMode: u.provider_mode === true,
    providerApprovedAt: u.provider_approved_at,
    displayName: u.display_name,
    nostrNpub: u.nostr_npub,
    did: u.did,
    keyCustody: u.key_custody,
    createdVia: u.created_via,
    levelPoints: u.level_points,
    homeCommunityId: u.home_community_id,
  };
}

// Register (patient or practitioner)
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, country, language, referralCode } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Password strength: min 8 chars, at least one letter and one number.
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include a letter and a number.',
      });
    }

    // Decision D-B: every public signup begins as a member. Role is never chosen at
    // signup; `role` from the request body is intentionally ignored. Practitioner is an
    // upgrade after onboarding. (Seed/demo accounts are created directly, not via this path.)
    const role = 'patient';

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, country, language, onboarding_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'profile') RETURNING *`,
      [email, passwordHash, fullName, firstName, lastName, role, country, language || 'English']
    );
    const user = result.rows[0];

    // Award account-created points & create practitioner profile shell
    await award(user.id, 'account_created', 10, 'onboarding', 'Welcome to Solaris');
    if (role === 'practitioner') {
      await db.query('INSERT INTO practitioner_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id]);
    }

    // GPS — mint a unique referral code so every member can become an ecosystem builder.
    try { await ensureReferralCode(user.id, fullName); } catch (e) { console.warn('[gps] referral code failed:', e.message); }

    // GPS — link this member to their referrer if a valid code was supplied.
    if (referralCode) {
      try {
        const code = String(referralCode).trim().toUpperCase();
        const ref = await db.query('SELECT id FROM users WHERE referral_code=$1', [code]);
        if (ref.rows.length && ref.rows[0].id !== user.id) {
          await db.query('UPDATE users SET referred_by=$1 WHERE id=$2', [ref.rows[0].id, user.id]);
          await db.query(
            `INSERT INTO gps_referrals (referrer_id, referred_user_id, reward_amount, status) VALUES ($1,$2,0,'pending')`,
            [ref.rows[0].id, user.id]
          );
        }
      } catch (e) { console.warn('[gps] apply referral on signup failed:', e.message); }
    }

    // Welcome notification (best-effort, non-blocking — never fail the signup)
    try {
      await notificationProvider.send('welcome', user.id, {
        title: 'Welcome to Solaris!',
        message: 'Your Sovereign Passport is ready.',
        data: { tab: 'dashboard' },
        emailSubject: 'Welcome to Solaris',
        emailBody: 'Your passport has been created.',
      });
    } catch (e) { console.warn('[notifications] welcome failed:', e.message); }

    const token = generateToken(user.id, user.email, user.role, await subjectRef(user.id));
    res.status(201).json({ user: shapeUser({ ...user, love_points: 10 }), token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await db.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    // Generic message — never reveal whether the email exists.
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password.' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = generateToken(user.id, user.email, user.role, await subjectRef(user.id));
    res.json({ user: shapeUser(user), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Identity Key (Nostr) LOGIN — real BIP-340 challenge/response (M8; A2 §3).
//
// The member's device holds the secret key (derived client-side from the
// BIP-39 seed, kept in sessionStorage only — never sent to Solaris). Login is
// a proof of control: the server issues a random nonce, the device signs it
// with a Schnorr signature, and the server verifies it against the npub. No
// password, no secret key on the server.
// ---------------------------------------------------------------------------
const crypto = require('crypto');
const { isValidNpub, npubToHex, verifyChallengeSignature } = require('../lib/nostr');
const { bindNostrKey } = require('../lib/identity');

// Short-lived single-use challenge store (nonce -> { npub, pubkeyHex, expiresAt }).
const challenges = new Map();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
function sweepChallenges() {
  const now = Date.now();
  for (const [k, v] of challenges) if (v.expiresAt < now) challenges.delete(k);
}

// POST /api/auth/nostr/challenge  { npub }
router.post('/nostr/challenge', (req, res) => {
  try {
    const npub = String(req.body?.npub || '').trim();
    if (!isValidNpub(npub)) return res.status(400).json({ error: 'A valid Identity Key (npub1…) is required.' });
    sweepChallenges();
    const pubkeyHex = npubToHex(npub);
    const nonce = crypto.randomBytes(24).toString('hex');
    const message = `solaris-login:${nonce}`;
    challenges.set(nonce, { npub, pubkeyHex, expiresAt: Date.now() + CHALLENGE_TTL_MS });
    res.json({ nonce, message, expiresInMs: CHALLENGE_TTL_MS });
  } catch (err) {
    console.error('nostr challenge error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/nostr/login  { npub, nonce, sig }  (sig = hex Schnorr signature of the message)
router.post('/nostr/login', async (req, res) => {
  try {
    const npub = String(req.body?.npub || '').trim();
    const nonce = String(req.body?.nonce || '').trim();
    const sig = String(req.body?.sig || '').trim();
    if (!isValidNpub(npub) || !nonce || !sig) {
      return res.status(400).json({ error: 'npub, nonce and signature are required.' });
    }
    const ch = challenges.get(nonce);
    if (!ch || ch.expiresAt < Date.now() || ch.npub !== npub) {
      return res.status(401).json({ error: 'Challenge expired or invalid. Please try again.' });
    }
    challenges.delete(nonce); // single-use, regardless of outcome

    const message = `solaris-login:${nonce}`;
    if (!verifyChallengeSignature({ pubkey: npub, message, sigHex: sig })) {
      return res.status(401).json({ error: 'Signature did not verify for this Identity Key.' });
    }

    // Proven control of the key. Find or create the account.
    let result = await db.query('SELECT * FROM users WHERE nostr_npub = $1 AND deleted_at IS NULL', [npub]);
    let user;
    let isNew = false;
    if (result.rows.length) {
      user = result.rows[0];
    } else {
      isNew = true;
      const syntheticEmail = `${npub.slice(0, 24)}@nostr.solaris`;
      const passwordHash = await bcrypt.hash('identity-key-' + crypto.randomBytes(8).toString('hex'), 10);
      const displayName = 'Sovereign ' + npub.slice(5, 11);
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, full_name, display_name, role,
            onboarding_status, nostr_npub, key_custody, created_via, level_points)
         VALUES ($1,$2,$3,$4,'patient','profile',$5,'self','nostr',0) RETURNING *`,
        [syntheticEmail, passwordHash, displayName, displayName, npub]
      );
      user = ins.rows[0];
      try { await award(user.id, 'account_created', 10, 'onboarding', 'Welcome to Solaris (Identity Key)'); } catch (e) {}
      try { await ensureReferralCode(user.id, displayName); } catch (e) {}
    }

    // Bind (or refresh) the Identity Key on the permanent subject — public key only.
    try { await bindNostrKey(user.id, npub, npubToHex(npub), null); } catch (e) { /* non-fatal */ }

    const token = generateToken(user.id, user.email, user.role, await subjectRef(user.id));
    res.json({ user: shapeUser(user), token, isNew });
  } catch (err) {
    console.error('nostr login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/nostr-mock — removed (S1A-P0-FAIL-CLOSED)
router.post('/nostr-mock', (req, res) => {
  return res.status(410).json({ error: 'ENDPOINT_REMOVED', endpoint: 'mock_auth', removed: true });
});

// POST /api/auth/google-mock — removed (S1A-P0-FAIL-CLOSED)
router.post('/google-mock', (req, res) => {
  return res.status(410).json({ error: 'ENDPOINT_REMOVED', endpoint: 'mock_auth', removed: true });
});

// Skip onboarding: mark the current user's onboarding as complete so they can
// enter the dashboard without finishing the Solaris Method assessment.
router.patch('/skip-onboarding', authMiddleware, async (req, res) => {
  try {
    await db.query(
      "UPDATE users SET onboarding_status = 'complete', updated_at = NOW() WHERE id = $1",
      [req.user.userId]
    );
    res.json({ ok: true, onboardingStatus: 'complete' });
  } catch (err) {
    console.error('skip-onboarding error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout — revoke the current token by recording its jti in the blocklist.
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (req.user.jti) {
      const expiresAt = req.user.exp ? new Date(req.user.exp * 1000) : null;
      await db.query(
        'INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [req.user.jti, req.user.userId, expiresAt]
      );
    }
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ error: 'Logout failed — please clear your session manually.' });
  }
});

module.exports = router;

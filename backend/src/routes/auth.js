const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const { ensureReferralCode } = require('../lib/gps-engine');

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

    const token = generateToken(user.id, user.email, user.role);
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
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(user.id, user.email, user.role);
    res.json({ user: shapeUser(user), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Identity-first mock sign-in flows (Solaris sprint).
// All keys/values are clearly fake (npub1mock..., nsec1mock...). No real Nostr.
// ---------------------------------------------------------------------------

function mockNsec(seed) {
  return 'nsec1mock' + Buffer.from(String(seed)).toString('hex').slice(0, 40);
}
function mockNpubFromSeed(seed) {
  return 'npub1mock' + Buffer.from('np' + String(seed)).toString('hex').slice(0, 40);
}
function mockDid(npub) {
  return 'did:nostr:mock:' + npub.slice(0, 24);
}

// POST /api/auth/nostr-mock  { npub }
// Continue with a Nostr identity: paste any npub -> mock-validates, find or
// create the user (created_via 'nostr', self key custody), return a JWT.
router.post('/nostr-mock', async (req, res) => {
  try {
    const { npub } = req.body || {};
    if (!npub || typeof npub !== 'string' || !npub.startsWith('npub1')) {
      return res.status(400).json({ error: 'A valid npub (starting with "npub1") is required' });
    }
    const cleanNpub = npub.trim();

    let result = await db.query('SELECT * FROM users WHERE nostr_npub = $1 AND deleted_at IS NULL', [cleanNpub]);
    let user;
    let isNew = false;

    if (result.rows.length) {
      user = result.rows[0];
    } else {
      isNew = true;
      const syntheticEmail = `${cleanNpub.slice(0, 24)}@nostr.mock`;
      const passwordHash = await bcrypt.hash('nostr-mock-' + Date.now(), 10);
      const did = mockDid(cleanNpub);
      const displayName = 'Sovereign ' + cleanNpub.slice(5, 11);
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, full_name, display_name, role,
            onboarding_status, nostr_npub, did, key_custody, created_via, level_points)
         VALUES ($1,$2,$3,$4,'patient','profile',$5,$6,'self','nostr',0) RETURNING *`,
        [syntheticEmail, passwordHash, displayName, displayName, cleanNpub, did]
      );
      user = ins.rows[0];
      try { await award(user.id, 'account_created', 10, 'onboarding', 'Welcome to Solaris (Nostr)'); } catch (e) {}
      try { await ensureReferralCode(user.id, displayName); } catch (e) {}
    }

    const token = generateToken(user.id, user.email, user.role);
    res.json({ user: shapeUser(user), token, isNew });
  } catch (err) {
    console.error('nostr-mock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/google-mock  { email?, name? }
// Continue with Google (mock): creates an account AND auto-generates a mock
// Nostr keypair (app-managed custody). Returns JWT + { isNew, npub_mock }.
router.post('/google-mock', async (req, res) => {
  try {
    const email = (req.body && req.body.email) || `demo.user.${Date.now()}@gmail.mock`;
    const name = (req.body && req.body.name) || email.split('@')[0];

    let result = await db.query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
    let user;
    let isNew = false;

    if (result.rows.length) {
      user = result.rows[0];
      // Ensure a mock key exists for existing accounts too.
      if (!user.nostr_npub) {
        const npub = mockNpubFromSeed(user.id);
        const nsec = mockNsec(user.id);
        const upd = await db.query(
          `UPDATE users SET nostr_npub=$1, nostr_nsec_encrypted_mock=$2, did=$3,
             key_custody='app_managed', created_via=COALESCE(created_via,'google'), updated_at=NOW()
           WHERE id=$4 RETURNING *`,
          [npub, nsec, mockDid(npub), user.id]
        );
        user = upd.rows[0];
      }
    } else {
      isNew = true;
      const passwordHash = await bcrypt.hash('google-mock-' + Date.now(), 10);
      const seed = email + Date.now();
      const npub = mockNpubFromSeed(seed);
      const nsec = mockNsec(seed);
      const did = mockDid(npub);
      const ins = await db.query(
        `INSERT INTO users (email, password_hash, full_name, display_name, role,
            onboarding_status, nostr_npub, nostr_nsec_encrypted_mock, did,
            key_custody, created_via, level_points)
         VALUES ($1,$2,$3,$4,'patient','profile',$5,$6,$7,'app_managed','google',0) RETURNING *`,
        [email, passwordHash, name, name, npub, nsec, did]
      );
      user = ins.rows[0];
      try { await award(user.id, 'account_created', 10, 'onboarding', 'Welcome to Solaris (Google)'); } catch (e) {}
      try { await ensureReferralCode(user.id, name); } catch (e) {}
    }

    const token = generateToken(user.id, user.email, user.role);
    res.json({
      user: shapeUser(user),
      token,
      isNew,
      npub_mock: user.nostr_npub,
      keyBanner: 'Your sovereign key was created. You can export or uncouple it anytime.',
    });
  } catch (err) {
    console.error('google-mock error:', err);
    res.status(500).json({ error: 'Server error' });
  }
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

module.exports = router;

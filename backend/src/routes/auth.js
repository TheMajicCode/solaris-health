const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken } = require('../middleware/auth');

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
  };
}

// Register (patient or practitioner)
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'patient', country, language } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

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

module.exports = router;

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { shapeUser } = require('../lib/helpers');

const router = express.Router();

// GET /api/users/me — full user + profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const u = await db.query('SELECT * FROM users WHERE id=$1', [req.user.userId]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const profile = await db.query('SELECT * FROM user_profiles WHERE user_id=$1', [req.user.userId]);
    res.json({ user: shapeUser(u.rows[0]), profile: profile.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me — update user core fields + onboarding status
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const allowed = ['first_name', 'last_name', 'full_name', 'country', 'city', 'language', 'phone',
                     'avatar_url', 'bio', 'onboarding_status', 'current_phase'];
    const updates = [];
    const values = [];
    let i = 1;
    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body[key] !== undefined || req.body[camel] !== undefined) {
        updates.push(`${key} = $${i}`);
        values.push(req.body[key] !== undefined ? req.body[key] : req.body[camel]);
        i++;
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No valid fields' });
    values.push(req.user.userId);
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      values
    );
    res.json({ user: shapeUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/profile
router.get('/profile', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM user_profiles WHERE user_id=$1', [req.user.userId]);
  res.json({ profile: r.rows[0] || null });
});

// PUT /api/users/profile — upsert health profile (onboarding step)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const fields = {
      date_of_birth: b.dateOfBirth || null,
      sex_at_birth: b.sexAtBirth || null,
      gender_identity: b.genderIdentity || null,
      height_cm: b.heightCm || null,
      weight_kg: b.weightKg || null,
      timezone: b.timezone || null,
      goals_text: b.goalsText || null,
      goals_json: JSON.stringify(b.goals || []),
      main_concerns_text: b.mainConcernsText || null,
      budget_range: b.budgetRange || null,
      care_preference: b.carePreference || null,
      travel_willingness: b.travelWillingness || null,
      wants_practitioner_guidance: b.wantsPractitionerGuidance ?? true,
      wants_workshops: b.wantsWorkshops ?? true,
      wants_routines: b.wantsRoutines ?? true,
      consent_privacy: b.consentPrivacy ?? false,
      consent_ai_guidance: b.consentAiGuidance ?? false,
      consent_marketing: b.consentMarketing ?? false,
    };
    const keys = Object.keys(fields);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, idx) => `$${idx + 2}`).join(', ');
    const updates = keys.map((k) => `${k} = EXCLUDED.${k}`).join(', ');
    const values = [req.user.userId, ...keys.map((k) => fields[k])];
    const result = await db.query(
      `INSERT INTO user_profiles (user_id, ${cols}) VALUES ($1, ${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updates}, updated_at = now() RETURNING *`,
      values
    );
    res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

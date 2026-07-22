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

module.exports = router;

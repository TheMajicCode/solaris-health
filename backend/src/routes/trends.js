/**
 * Trends routes — Phase 3
 * Time-series data for multi-metric charts.
 *
 *   GET /api/trends/vitals?range=30d            — authenticated user's vitals trends
 *   GET /api/trends/vitals?userId=..&range=90d  — patient vitals (practitioner/admin)
 *
 * range: 7d | 30d | 90d | 1y | all  (default 30d)
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function rangeToDate(range) {
  const now = new Date();
  const map = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
  if (range === 'all') return null;
  const days = map[range] || 30;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

function statsFor(values) {
  const nums = values.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number);
  if (!nums.length) return { count: 0, avg: null, min: null, max: null, first: null, last: null, change: null };
  const sum = nums.reduce((a, b) => a + b, 0);
  const first = nums[0], last = nums[nums.length - 1];
  return {
    count: nums.length,
    avg: Math.round((sum / nums.length) * 10) / 10,
    min: Math.min(...nums),
    max: Math.max(...nums),
    first, last,
    change: Math.round((last - first) * 10) / 10,
  };
}

async function gatherVitals(userId, range) {
  const since = rangeToDate(range);
  const params = [userId];
  let where = 'user_id = $1';
  if (since) { params.push(since.toISOString().slice(0, 10)); where += ` AND checkin_date >= $2`; }

  const r = await db.query(
    `SELECT checkin_date, energy_score, mood_score, sleep_hours,
            hydration_glasses, movement_minutes
       FROM daily_checkins
      WHERE ${where}
      ORDER BY checkin_date ASC`,
    params
  );

  const points = r.rows.map((row) => ({
    date: row.checkin_date ? new Date(row.checkin_date).toISOString().slice(0, 10) : null,
    energy: row.energy_score,
    mood: row.mood_score,
    sleep: row.sleep_hours != null ? Number(row.sleep_hours) : null,
    hydration: row.hydration_glasses,
    movement: row.movement_minutes,
  }));

  // Vitality score series from assessments
  const aParams = [userId];
  let aWhere = 'user_id = $1';
  if (since) { aParams.push(since.toISOString().slice(0, 10)); aWhere += ` AND COALESCE(completed_at, created_at) >= $2`; }
  const a = await db.query(
    `SELECT COALESCE(completed_at, created_at) AS d, vitality_score, mental_score,
            emotional_score, physical_score, spiritual_score
       FROM assessment_responses
      WHERE ${aWhere}
      ORDER BY COALESCE(completed_at, created_at) ASC`,
    aParams
  );
  const vitality = a.rows.map((row) => ({
    date: row.d ? new Date(row.d).toISOString().slice(0, 10) : null,
    vitality: row.vitality_score,
    mental: row.mental_score,
    emotional: row.emotional_score,
    physical: row.physical_score,
    spiritual: row.spiritual_score,
  }));

  const metrics = {
    energy: statsFor(points.map((p) => p.energy)),
    mood: statsFor(points.map((p) => p.mood)),
    sleep: statsFor(points.map((p) => p.sleep)),
    hydration: statsFor(points.map((p) => p.hydration)),
    movement: statsFor(points.map((p) => p.movement)),
    vitality: statsFor(vitality.map((p) => p.vitality)),
  };

  return { range, points, vitality, metrics };
}

// Own vitals trends
router.get('/vitals', authMiddleware, async (req, res) => {
  try {
    let userId = req.user.userId;
    if (req.query.userId && req.query.userId !== req.user.userId) {
      if (req.user.role !== 'practitioner' && req.user.role !== 'admin')
        return res.status(403).json({ error: 'Not allowed' });
      userId = req.query.userId;
    }
    const data = await gatherVitals(userId, req.query.range || '30d');
    res.json(data);
  } catch (err) { console.error('trends/vitals', err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

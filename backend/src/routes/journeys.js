const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ------------------------------------------------------------------
   Milestone definitions — static per journey type. User progress is
   stored in member_journeys.milestones_json; these are the labels.
------------------------------------------------------------------- */
const MILESTONE_DEFS = {
  optimal_health: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'streak7', label: '7-day check-in streak', week: 2 },
    { key: 'booking', label: 'First practitioner session', week: 4 },
    { key: 'reassessment', label: 'Reassessment at week 8', week: 8 },
  ],
  detox: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'habits3', label: 'Activate 3 daily habits', week: 2 },
    { key: 'checkin14', label: '14-day check-in streak', week: 3 },
    { key: 'report', label: 'Add detox health markers', week: 6 },
  ],
  menopause: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'streak7', label: '7-day check-in streak', week: 2 },
    { key: 'booking', label: 'First practitioner session', week: 4 },
    { key: 'protocol', label: 'Receive personalised protocol', week: 6 },
  ],
  heavy_metal: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'report', label: 'Add heavy metal test results', week: 2 },
    { key: 'streak7', label: '7-day check-in streak', week: 3 },
    { key: 'booking', label: 'First practitioner session', week: 5 },
  ],
  smile: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'streak5', label: '5-day check-in streak', week: 2 },
    { key: 'booking', label: 'First wellness session', week: 3 },
  ],
  thyroid: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'report', label: 'Add thyroid panel results', week: 2 },
    { key: 'streak7', label: '7-day check-in streak', week: 3 },
    { key: 'booking', label: 'First practitioner session', week: 5 },
  ],
  sugar: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'habits3', label: 'Activate 3 daily habits', week: 2 },
    { key: 'streak7', label: '7-day check-in streak', week: 3 },
    { key: 'booking', label: 'First practitioner session', week: 5 },
  ],
  nurture_mama: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'streak7', label: '7-day check-in streak', week: 2 },
    { key: 'booking', label: 'First wellness session', week: 3 },
    { key: 'protocol', label: 'Receive personalised protocol', week: 5 },
  ],
  your_path: [
    { key: 'intake', label: 'Complete intake assessment', week: 1 },
    { key: 'streak7', label: '7-day check-in streak', week: 2 },
    { key: 'explore', label: 'Explore wellness resources', week: 3 },
    { key: 'booking', label: 'First session', week: 4 },
  ],
};

const VALID_TYPES = Object.keys(MILESTONE_DEFS);

/* Count map — used by LUCA context for a quick total without loading defs. */
const MILESTONE_DEFS_COUNT = Object.fromEntries(
  Object.entries(MILESTONE_DEFS).map(([k, v]) => [k, v.length])
);

/* ------------------------------------------------------------------
   Streak helper (mirrors journey.js). Current streak = consecutive
   days ending today or yesterday.
------------------------------------------------------------------- */
async function currentStreak(userId) {
  const r = await db
    .query(
      `SELECT DISTINCT to_char(checkin_date,'YYYY-MM-DD') AS d
       FROM daily_checkins WHERE user_id=$1 ORDER BY d DESC`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  const dates = r.rows.map((x) => x.d);
  if (!dates.length) return 0;
  const set = new Set(dates);
  const dayMs = 86400000;
  const toKey = (dt) => dt.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let cursor = new Date(today);
  if (!set.has(toKey(cursor))) {
    cursor = new Date(today.getTime() - dayMs);
    if (!set.has(toKey(cursor))) return 0;
  }
  let n = 0;
  while (set.has(toKey(cursor))) {
    n += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return n;
}

/* Gather the user signals needed to auto-complete milestones. */
async function gatherSignals(userId) {
  const [streak, habits, bookings, docs, intake] = await Promise.all([
    currentStreak(userId),
    db
      .query('SELECT COUNT(*)::int AS n FROM member_habits WHERE user_id=$1 AND active=true', [userId])
      .catch(() => ({ rows: [{ n: 0 }] })),
    db
      .query('SELECT COUNT(*)::int AS n FROM booking_requests WHERE user_id=$1', [userId])
      .catch(() => ({ rows: [{ n: 0 }] })),
    db
      .query('SELECT COUNT(*)::int AS n FROM health_documents WHERE user_id=$1', [userId])
      .catch(() => ({ rows: [{ n: 0 }] })),
    db
      .query(
        `SELECT COUNT(*)::int AS n FROM assessment_responses WHERE user_id=$1`,
        [userId]
      )
      .catch(() => ({ rows: [{ n: 0 }] })),
  ]);
  return {
    streak,
    habitCount: habits.rows[0]?.n || 0,
    bookingCount: bookings.rows[0]?.n || 0,
    docCount: docs.rows[0]?.n || 0,
    intakeComplete: (intake.rows[0]?.n || 0) > 0,
  };
}

/* Decide whether a milestone key is complete given user signals + age. */
function isMilestoneComplete(key, sig, weeksOld) {
  switch (key) {
    case 'intake':
      return sig.intakeComplete;
    case 'streak5':
      return sig.streak >= 5;
    case 'streak7':
      return sig.streak >= 7;
    case 'streak14':
    case 'checkin14':
      return sig.streak >= 14;
    case 'habits3':
      return sig.habitCount >= 3;
    case 'booking':
      return sig.bookingCount >= 1;
    case 'report':
      return sig.docCount >= 1;
    case 'explore':
      return true; // resources are always available to explore
    case 'reassessment':
    case 'protocol':
      return weeksOld >= 8;
    default:
      return false;
  }
}

/* Build the merged milestone list (definition + completed flag) and the
   persisted milestones_json (only completed keys with timestamps). */
function computeMilestones(journeyType, existingJson, sig, startedAt) {
  const defs = MILESTONE_DEFS[journeyType] || [];
  const weeksOld = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / (7 * 86400000))
    : 0;
  const prior = Array.isArray(existingJson) ? existingJson : [];
  const priorMap = Object.fromEntries(prior.map((m) => [m.key, m]));

  const merged = defs.map((d) => {
    const already = priorMap[d.key];
    const completed = (already && already.completed) || isMilestoneComplete(d.key, sig, weeksOld);
    return {
      key: d.key,
      label: d.label,
      week: d.week,
      completed: !!completed,
      completed_at: completed ? already?.completed_at || new Date().toISOString() : null,
    };
  });

  // Persisted form: only the completed markers.
  const persist = merged
    .filter((m) => m.completed)
    .map((m) => ({ key: m.key, completed: true, completed_at: m.completed_at }));

  return { merged, persist };
}

/* GET /api/journeys/mine — user's journeys with live milestone progress. */
router.get('/mine', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    const r = await db.query(
      `SELECT id, journey_type, status, started_at, milestones_json, notes
       FROM member_journeys WHERE user_id=$1 ORDER BY started_at DESC`,
      [userId]
    );
    const sig = await gatherSignals(userId);
    const journeys = [];
    for (const row of r.rows) {
      const { merged, persist } = computeMilestones(
        row.journey_type,
        row.milestones_json,
        sig,
        row.started_at
      );
      // Persist any newly auto-completed milestones (active journeys only).
      if (row.status === 'active') {
        await db
          .query('UPDATE member_journeys SET milestones_json=$1 WHERE id=$2', [
            JSON.stringify(persist),
            row.id,
          ])
          .catch(() => {});
      }
      const completed = merged.filter((m) => m.completed).length;
      const next = merged.find((m) => !m.completed) || null;
      journeys.push({
        id: row.id,
        journeyType: row.journey_type,
        status: row.status,
        startedAt: row.started_at,
        notes: row.notes,
        milestones: merged,
        completedCount: completed,
        totalCount: merged.length,
        nextMilestone: next ? { key: next.key, label: next.label, week: next.week } : null,
      });
    }
    res.json({ journeys });
  } catch (err) {
    console.error('GET /journeys/mine failed:', err.message);
    res.status(500).json({ error: 'Could not load journeys' });
  }
});

/* POST /api/journeys/start — start (or re-activate) a journey. */
router.post('/start', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { journeyType } = req.body || {};
  if (!VALID_TYPES.includes(journeyType)) {
    return res.status(400).json({ error: 'Unknown journey type' });
  }
  try {
    const r = await db.query(
      `INSERT INTO member_journeys (user_id, journey_type, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (user_id, journey_type)
       DO UPDATE SET status='active'
       RETURNING id, journey_type, status, started_at, milestones_json`,
      [userId, journeyType]
    );
    const row = r.rows[0];
    res.json({
      journey: {
        id: row.id,
        journeyType: row.journey_type,
        status: row.status,
        startedAt: row.started_at,
      },
    });
  } catch (err) {
    console.error('POST /journeys/start failed:', err.message);
    res.status(500).json({ error: 'Could not start journey' });
  }
});

/* Shared status setter for pause/complete. */
function setStatus(status) {
  return async (req, res) => {
    const userId = req.user.userId;
    const { id } = req.params;
    try {
      const r = await db.query(
        `UPDATE member_journeys SET status=$1 WHERE id=$2 AND user_id=$3
         RETURNING id, journey_type, status, started_at`,
        [status, id, userId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Journey not found' });
      const row = r.rows[0];
      res.json({
        journey: {
          id: row.id,
          journeyType: row.journey_type,
          status: row.status,
          startedAt: row.started_at,
        },
      });
    } catch (err) {
      console.error(`POST /journeys/:id/${status} failed:`, err.message);
      res.status(500).json({ error: 'Could not update journey' });
    }
  };
}

router.post('/:id/pause', authMiddleware, setStatus('paused'));
router.post('/:id/complete', authMiddleware, setStatus('complete'));

/* GET /api/journeys/milestones/:journeyType — static milestone definitions. */
router.get('/milestones/:journeyType', authMiddleware, (req, res) => {
  const defs = MILESTONE_DEFS[req.params.journeyType];
  if (!defs) return res.status(404).json({ error: 'Unknown journey type' });
  res.json({ journeyType: req.params.journeyType, milestones: defs });
});

module.exports = router;
module.exports.MILESTONE_DEFS = MILESTONE_DEFS;
module.exports.MILESTONE_DEFS_COUNT = MILESTONE_DEFS_COUNT;

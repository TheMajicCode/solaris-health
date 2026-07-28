const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { award } = require('../lib/helpers');

const router = express.Router();

// ---------- BOOKINGS ----------
router.get('/bookings', authMiddleware, async (req, res) => {
  const r = await db.query(
    `SELECT b.*, l.title AS listing_title, l.listing_type, l.specialty, l.cover_image_url, l.city
     FROM booking_requests b LEFT JOIN listings l ON l.id = b.listing_id
     WHERE b.user_id=$1 ORDER BY b.created_at DESC`, [req.user.userId]);
  res.json({ bookings: r.rows });
});

router.post('/bookings', authMiddleware, async (req, res) => {
  try {
    const { listingId, preferredDate, preferredTime, note } = req.body;
    const r = await db.query(
      `INSERT INTO booking_requests (user_id,listing_id,preferred_date,preferred_time,note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.userId, listingId, preferredDate || null, preferredTime || null, note || null]
    );
    await award(req.user.userId, 'booking_request', 30, 'engagement', 'Requested a booking');
    res.status(201).json({ booking: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- DAILY CHECK-INS ----------
// Helpers ----------------------------------------------------------
const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

// YYYY-MM-DD list of distinct check-in dates for a user, newest first
async function checkinDates(userId) {
  const r = await db.query(
    `SELECT DISTINCT to_char(checkin_date,'YYYY-MM-DD') AS d
     FROM daily_checkins WHERE user_id=$1 ORDER BY d DESC`, [userId]);
  return r.rows.map((x) => x.d);
}

// Current streak = consecutive days ending today (or yesterday if not yet checked in today).
// Longest streak = longest run of consecutive days anywhere in history.
function computeStreaks(dates) {
  if (!dates.length) return { currentStreak: 0, longestStreak: 0 };
  const set = new Set(dates);
  const dayMs = 86400000;
  const toKey = (dt) => dt.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // current: start from today, else yesterday, else 0
  let cursor = new Date(today);
  if (!set.has(toKey(cursor))) {
    cursor = new Date(today.getTime() - dayMs);
    if (!set.has(toKey(cursor))) return { currentStreak: 0, longestStreak: longest(dates) };
  }
  let current = 0;
  while (set.has(toKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  return { currentStreak: current, longestStreak: Math.max(current, longest(dates)) };
}

function longest(dates) {
  // dates newest-first; walk ascending runs
  const asc = [...dates].sort();
  const dayMs = 86400000;
  let best = 0, run = 0, prev = null;
  for (const d of asc) {
    const t = new Date(d + 'T00:00:00Z').getTime();
    if (prev !== null && t - prev === dayMs) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

router.get('/checkins', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 30', [req.user.userId]);
  res.json({ checkins: r.rows });
});

router.post('/checkins', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const userId = req.user.userId;
    const notes = b.notes || (b.lucaQuestionAnswer ? String(b.lucaQuestionAnswer).slice(0, 300) : null);

    // Was there already a check-in today? (to gate streak bonuses to one award/day)
    const existing = await db.query(
      `SELECT id FROM daily_checkins WHERE user_id=$1 AND checkin_date=CURRENT_DATE`, [userId]);
    const wasNew = existing.rows.length === 0;

    // Upsert today's check-in (one per member per day)
    const r = await db.query(
      `INSERT INTO daily_checkins
         (user_id,energy_score,mood_score,sleep_hours,hydration_glasses,movement_minutes,
          mind_score,body_score,heart_score,spirit_score,notes,nutrition_score,meal_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (user_id, checkin_date) DO UPDATE SET
         energy_score=COALESCE(EXCLUDED.energy_score, daily_checkins.energy_score),
         mood_score=COALESCE(EXCLUDED.mood_score, daily_checkins.mood_score),
         sleep_hours=COALESCE(EXCLUDED.sleep_hours, daily_checkins.sleep_hours),
         hydration_glasses=COALESCE(EXCLUDED.hydration_glasses, daily_checkins.hydration_glasses),
         movement_minutes=COALESCE(EXCLUDED.movement_minutes, daily_checkins.movement_minutes),
         mind_score=COALESCE(EXCLUDED.mind_score, daily_checkins.mind_score),
         body_score=COALESCE(EXCLUDED.body_score, daily_checkins.body_score),
         heart_score=COALESCE(EXCLUDED.heart_score, daily_checkins.heart_score),
         spirit_score=COALESCE(EXCLUDED.spirit_score, daily_checkins.spirit_score),
         notes=COALESCE(EXCLUDED.notes, daily_checkins.notes),
         nutrition_score=COALESCE(EXCLUDED.nutrition_score, daily_checkins.nutrition_score),
         meal_notes=COALESCE(EXCLUDED.meal_notes, daily_checkins.meal_notes)
       RETURNING *`,
      [userId, num(b.energyScore), num(b.moodScore), num(b.sleepHours), num(b.hydrationGlasses),
       num(b.movementMinutes), num(b.mindScore), num(b.bodyScore), num(b.heartScore), num(b.spiritScore), notes,
       num(b.nutritionScore), b.mealNotes ? String(b.mealNotes).slice(0, 300) : null]
    );

    // Tick any habits the member marked done today
    const habitIds = Array.isArray(b.habitIds) ? b.habitIds : [];
    for (const hid of habitIds) {
      try {
        await db.query(
          `INSERT INTO habit_ticks (user_id, habit_id, tick_date)
           VALUES ($1,$2,CURRENT_DATE) ON CONFLICT (user_id, habit_id, tick_date) DO NOTHING`,
          [userId, hid]);
      } catch (e) { /* ignore invalid habit id */ }
    }

    // Base LOVE points + streak bonuses (only on a genuinely new day)
    const awards = [];
    if (wasNew) {
      await award(userId, 'daily_checkin', 5, 'habit', 'Daily check-in');
      awards.push({ points: 5, label: 'Daily check-in' });
    }

    const dates = await checkinDates(userId);
    const { currentStreak, longestStreak } = computeStreaks(dates);

    if (wasNew && currentStreak > 0) {
      if (currentStreak % 7 === 0) {
        await award(userId, 'checkin_streak_7', 25, 'habit', `${currentStreak}-day streak`);
        awards.push({ points: 25, label: `${currentStreak}-day streak! 🌟` });
      } else if (currentStreak % 3 === 0) {
        await award(userId, 'checkin_streak_3', 10, 'habit', `${currentStreak}-day streak`);
        awards.push({ points: 10, label: `${currentStreak}-day streak! 🔥` });
      }
    }

    const bonusPoints = awards.reduce((s, a) => s + a.points, 0);
    res.status(201).json({ checkin: r.rows[0], currentStreak, longestStreak, awards, pointsAwarded: bonusPoints, wasNew });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- GUIDED JOURNEY TASKS ----------
// Curates today's task list from the member's real health data: daily check-in,
// hydration/sleep/movement/nutrition signals, active journeys, assessment focus
// areas, the audio library and bookable practitioners. First task is always the
// daily check-in; the rest are next-step actions the frontend can execute.
const JOURNEY_FOCUS = {
  detox: { type: 'nutritionist', label: 'a nutrition specialist' },
  heavy_metal: { type: 'doctor', label: 'a functional medicine doctor' },
  menopause: { type: 'doctor', label: 'a doctor who supports hormonal health' },
  optimal_health: { type: 'wellness', label: 'a wellness practitioner' },
  smile: { type: 'doctor', label: 'a holistic dentist or doctor' },
  thyroid: { type: 'doctor', label: 'a functional medicine doctor' },
  sugar: { type: 'nutritionist', label: 'a nutrition specialist' },
  nurture_mama: { type: 'doctor', label: 'a supportive doctor' },
  your_path: { type: 'wellness', label: 'a wellness practitioner' },
};

router.get('/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [today, journeys, assessment, audio, bookings] = await Promise.all([
      db.query(`SELECT * FROM daily_checkins WHERE user_id=$1 AND checkin_date=CURRENT_DATE`, [userId]),
      db.query(`SELECT journey_type FROM member_journeys WHERE user_id=$1 AND status='active' ORDER BY started_at DESC`, [userId]),
      db.query(`SELECT top_focus_areas_json FROM assessment_responses WHERE user_id=$1 AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1`, [userId]),
      db.query(`SELECT id, title, duration_seconds FROM audio_library ORDER BY duration_seconds ASC`),
      db.query(`SELECT COUNT(*)::int AS n FROM bookings WHERE patient_id=$1 AND status IN ('pending','confirmed') AND booking_date >= CURRENT_DATE`, [userId]).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const c = today.rows[0] || null;
    const tasks = [];

    // 1. Daily check-in — always first
    tasks.push({
      id: 'daily-checkin',
      label: 'Complete your daily check-in',
      detail: c ? 'Logged today — update it any time.' : 'Log how your Mind, Body, Heart and Spirit feel today.',
      done: !!c,
      action: { type: 'start_checkin', target: null },
    });

    // 2. Hydration goal (8 glasses)
    const glasses = c && c.hydration_glasses != null ? Number(c.hydration_glasses) : null;
    tasks.push({
      id: 'water-goal',
      label: 'Drink water to satisfy your daily water goal',
      detail: glasses != null ? `${glasses} of 8 glasses logged so far.` : 'Aim for 8 glasses — log them in your check-in.',
      done: glasses != null && glasses >= 8,
      action: { type: 'start_checkin', target: null },
    });

    // 3. Breathwork / audio session (shortest track = the breath reset)
    const breath = audio.rows.find((a) => /breath/i.test(a.title)) || audio.rows[0];
    if (breath) {
      tasks.push({
        id: 'breathwork',
        label: 'Take a guided breathwork session',
        detail: `${breath.title} · ${Math.round(breath.duration_seconds / 60)} min`,
        done: false,
        action: { type: 'play_audio', target: breath.id },
      });
    }

    // 4. Movement — a walk or gentle run
    const moved = c && c.movement_minutes != null ? Number(c.movement_minutes) : null;
    tasks.push({
      id: 'movement',
      label: 'Move for 20 minutes — a walk or gentle run',
      detail: moved != null ? `${moved} minutes logged today.` : 'Log your movement minutes in your check-in.',
      done: moved != null && moved >= 20,
      action: { type: 'start_checkin', target: null },
    });

    // 5. Sleep wind-down when last night was short
    const slept = c && c.sleep_hours != null ? Number(c.sleep_hours) : null;
    if (slept != null && slept < 7) {
      const wind = audio.rows.find((a) => /wind-down|evening/i.test(a.title));
      tasks.push({
        id: 'wind-down',
        label: 'Wind down earlier tonight',
        detail: `You logged ${slept}h of sleep — an evening session can help.`,
        done: false,
        action: wind ? { type: 'play_audio', target: wind.id } : { type: 'navigate', target: 'media' },
      });
    }

    // 6. Connect with a practitioner matched to journey / assessment focus
    const journeyType = journeys.rows[0] ? journeys.rows[0].journey_type : null;
    const focus = JOURNEY_FOCUS[journeyType] || { type: 'wellness', label: 'a wellness practitioner' };
    const provider = await db.query(
      `SELECT id, business_name FROM provider_profiles
       WHERE status='active' AND approval_status='approved' AND hidden=false AND provider_type=$1
       ORDER BY rating DESC NULLS LAST LIMIT 1`, [focus.type]);
    const hasBooking = Number(bookings.rows[0] && bookings.rows[0].n) > 0;
    if (provider.rows[0]) {
      tasks.push({
        id: 'book-specialist',
        label: `Connect with ${focus.label}`,
        detail: hasBooking ? 'You have an upcoming booking — see you there.' : `${provider.rows[0].business_name} is a great match for your journey.`,
        done: hasBooking,
        action: { type: 'open_listing', target: provider.rows[0].id },
      });
    }

    let focusAreas = [];
    try { focusAreas = assessment.rows[0] ? assessment.rows[0].top_focus_areas_json || [] : []; } catch (e) { /* noop */ }
    res.json({ tasks, journeyType, focusAreas, checkedInToday: !!c });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- STREAK ----------
router.get('/streak', authMiddleware, async (req, res) => {
  try {
    const dates = await checkinDates(req.user.userId);
    res.json(computeStreaks(dates));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- WEEKLY STRIP (Mon–Sun of current week) ----------
router.get('/week-strip', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Monday as first day
    const dow = (today.getDay() + 6) % 7; // 0=Mon ... 6=Sun
    const monday = new Date(today.getTime() - dow * 86400000);
    const dayKeys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 86400000);
      dayKeys.push(d.toISOString().slice(0, 10));
    }
    const r = await db.query(
      `SELECT to_char(checkin_date,'YYYY-MM-DD') AS d, mind_score, body_score, heart_score, spirit_score
       FROM daily_checkins
       WHERE user_id=$1 AND checkin_date >= $2::date AND checkin_date <= $3::date`,
      [userId, dayKeys[0], dayKeys[6]]);
    const byDate = {};
    for (const row of r.rows) byDate[row.d] = row;
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const days = dayKeys.map((d, i) => {
      const c = byDate[d];
      return {
        date: d,
        letter: letters[i],
        hasCheckin: !!c,
        mind: c ? c.mind_score : null,
        body: c ? c.body_score : null,
        heart: c ? c.heart_score : null,
        spirit: c ? c.spirit_score : null,
      };
    });
    res.json({ days });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- HABITS ----------
router.get('/habits', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, name, icon, active, created_at FROM member_habits
       WHERE user_id=$1 AND active=true ORDER BY created_at ASC`, [req.user.userId]);
    res.json({ habits: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/habits', authMiddleware, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name required' });
    const count = await db.query(
      `SELECT COUNT(*)::int AS n FROM member_habits WHERE user_id=$1 AND active=true`, [req.user.userId]);
    if (count.rows[0].n >= 5) return res.status(400).json({ error: 'You can track up to 5 habits' });
    const r = await db.query(
      `INSERT INTO member_habits (user_id, name, icon) VALUES ($1,$2,$3)
       RETURNING id, name, icon, active, created_at`,
      [req.user.userId, String(name).trim().slice(0, 100), (icon || '🌱').slice(0, 20)]);
    res.status(201).json({ habit: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/habits/:id', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `DELETE FROM member_habits WHERE id=$1 AND user_id=$2 RETURNING id`,
      [req.params.id, req.user.userId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/habits/ticks', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [req.user.userId];
    let where = 'user_id=$1';
    if (from) { params.push(from); where += ` AND tick_date >= $${params.length}::date`; }
    if (to) { params.push(to); where += ` AND tick_date <= $${params.length}::date`; }
    const r = await db.query(
      `SELECT habit_id, to_char(tick_date,'YYYY-MM-DD') AS tick_date FROM habit_ticks WHERE ${where}`, params);
    res.json({ ticks: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.post('/habits/tick', authMiddleware, async (req, res) => {
  try {
    const { habitId, date } = req.body;
    if (!habitId) return res.status(400).json({ error: 'habitId required' });
    // Verify the habit belongs to this member
    const owns = await db.query(
      `SELECT id FROM member_habits WHERE id=$1 AND user_id=$2`, [habitId, req.user.userId]);
    if (owns.rows.length === 0) return res.status(404).json({ error: 'Habit not found' });
    const tickDate = date || null;
    const del = await db.query(
      `DELETE FROM habit_ticks WHERE user_id=$1 AND habit_id=$2
        AND tick_date = COALESCE($3::date, CURRENT_DATE) RETURNING id`,
      [req.user.userId, habitId, tickDate]);
    if (del.rows.length > 0) return res.json({ ticked: false });
    await db.query(
      `INSERT INTO habit_ticks (user_id, habit_id, tick_date)
       VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE))
       ON CONFLICT (user_id, habit_id, tick_date) DO NOTHING`,
      [req.user.userId, habitId, tickDate]);
    res.json({ ticked: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ---------- REWARDS ----------
router.get('/rewards', authMiddleware, async (req, res) => {
  const events = await db.query('SELECT * FROM reward_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.userId]);
  const total = await db.query('SELECT COALESCE(SUM(points),0) AS total FROM reward_events WHERE user_id=$1', [req.user.userId]);
  res.json({ events: events.rows, total: Number(total.rows[0].total) });
});

// ---------- DOCUMENTS (labs / photos) ----------
router.get('/documents', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT id,document_type,file_name,mime_type,description,visibility,created_at FROM documents WHERE user_id=$1 ORDER BY created_at DESC', [req.user.userId]);
  res.json({ documents: r.rows });
});

router.get('/documents/:id', authMiddleware, async (req, res) => {
  const r = await db.query('SELECT * FROM documents WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
  if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ document: r.rows[0] });
});

router.post('/documents', authMiddleware, async (req, res) => {
  try {
    const b = req.body;
    const r = await db.query(
      `INSERT INTO documents (user_id,document_type,file_name,file_data,mime_type,description,visibility)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,document_type,file_name,mime_type,description,created_at`,
      [req.user.userId, b.documentType || 'lab', b.fileName, b.fileData || null, b.mimeType, b.description, b.visibility || 'private']
    );
    res.status(201).json({ document: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;

/*
 * seed-demo-data.js — Populate the two showcase accounts with realistic activity.
 *
 * Idempotent: safe to run multiple times. For the two showcase accounts it clears
 * their check-ins, journal entries, and audio unlocks, then reseeds a fresh,
 * coherent picture (30 days of check-ins, journal reflections, unlocked audio).
 *
 * Run:  docker exec luca-passport-backend-1 node src/db/seed-demo-data.js
 */
const db = require('../db');

const SARAH_EMAIL = 'sarah@solaris.health';
const CARO_EMAIL = 'caroumanzorsv@gmail.com';

// ---- helpers ----
const rand = (min, max) => Math.round(min + Math.random() * (max - min));
const randf = (min, max, d = 1) => +(min + Math.random() * (max - min)).toFixed(d);

function daysAgo(n) {
  const dt = new Date();
  dt.setHours(9, 0, 0, 0);
  dt.setDate(dt.getDate() - n);
  return dt;
}

async function getUser(email) {
  const { rows } = await db.query('SELECT id, first_name FROM users WHERE email=$1', [email]);
  return rows[0] || null;
}

async function clearFor(userId) {
  await db.query('DELETE FROM daily_checkins WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM journal_entries WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM user_audio WHERE user_id=$1', [userId]);
}

async function seedCheckins(userId, days) {
  // Build a gently improving trend over the window.
  for (let i = days - 1; i >= 0; i--) {
    const progress = (days - 1 - i) / (days - 1); // 0 -> 1 as we approach today
    const energy = Math.min(100, rand(52, 66) + Math.round(progress * 22) + rand(-4, 4));
    const mood = Math.min(100, rand(55, 68) + Math.round(progress * 20) + rand(-4, 4));
    const sleep = randf(6.2 + progress * 1.0, 7.4 + progress * 0.8, 1);
    const hydration = rand(4, 8);
    const movement = rand(10, 45) + Math.round(progress * 15);
    const dt = daysAgo(i);
    await db.query(
      `INSERT INTO daily_checkins
         (user_id, checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, dt.toISOString().slice(0, 10), energy, mood, sleep, hydration, movement, null, dt]
    );
  }
}

async function ensureAssessment(userId, focus) {
  const { rows } = await db.query('SELECT id FROM assessment_responses WHERE user_id=$1 LIMIT 1', [userId]);
  if (rows.length) return;
  const dt = daysAgo(29);
  await db.query(
    `INSERT INTO assessment_responses
       (user_id, started_at, completed_at, raw_score, vitality_score, mental_score, emotional_score, physical_score, spiritual_score, summary_json, top_focus_areas_json, created_at)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$2)`,
    [
      userId, dt, 68, 71, 66, 62, 70, 64,
      JSON.stringify({ headline: 'A strong foundation with room to restore energy and calm.' }),
      JSON.stringify(focus),
    ]
  );
}

async function seedJournal(userId, entries) {
  // entries: [{ mood, content, daysBack }]
  for (const e of entries) {
    const dt = daysAgo(e.daysBack);
    await db.query(
      `INSERT INTO journal_entries (user_id, mood, content, created_at) VALUES ($1,$2,$3,$4)`,
      [userId, e.mood, e.content, dt]
    );
  }
}

async function unlockTracks(userId, count) {
  const { rows } = await db.query(
    `SELECT id FROM audio_library ORDER BY sort_order ASC LIMIT $1`,
    [count]
  );
  for (const t of rows) {
    await db.query(
      `INSERT INTO user_audio (user_id, audio_id) VALUES ($1,$2)
       ON CONFLICT (user_id, audio_id) DO NOTHING`,
      [userId, t.id]
    );
  }
  return rows.length;
}

const SARAH_JOURNAL = [
  { daysBack: 1, mood: 'good', content: "Slept almost 8 hours last night and woke up before my alarm. The morning walk is becoming a habit — LUCA was right that starting small would stick." },
  { daysBack: 4, mood: 'great', content: "Best week in a while. Energy held steady through the afternoon instead of crashing at 3pm. I think cutting the second coffee helped more than I expected." },
  { daysBack: 8, mood: 'okay', content: "Busy day, felt a bit scattered. Did the grounding breath practice between meetings and it genuinely reset me. Grateful I had it saved." },
  { daysBack: 15, mood: 'low', content: "Rough sleep, mind wouldn't switch off. Noting it so I can see if it's a pattern around work deadlines. Going to try the evening wind-down tonight." },
  { daysBack: 24, mood: 'good', content: "Started tracking my check-ins seriously today. Feels good to actually see my vitality instead of guessing. Small steps." },
];

const CARO_JOURNAL = [
  { daysBack: 2, mood: 'good', content: "Settling into the platform. Excited to see how the passport view brings my own health data together in one place." },
  { daysBack: 6, mood: 'okay', content: "Long clinic day. Reminding myself to take my own advice — hydration and a short walk between patients makes a real difference." },
  { daysBack: 12, mood: 'great', content: "Felt genuinely rested this morning. The evening audio practice is a keeper. Recommending the free tracks to a few of my own clients." },
];

async function main() {
  console.log('Seeding showcase data…');

  // ---- Sarah ----
  const sarah = await getUser(SARAH_EMAIL);
  if (!sarah) {
    console.warn(`! ${SARAH_EMAIL} not found — skipping`);
  } else {
    await db.query(`UPDATE users SET onboarding_status='complete', updated_at=NOW() WHERE id=$1`, [sarah.id]);
    await clearFor(sarah.id);
    await ensureAssessment(sarah.id, [
      { name: 'Energy & Vitality' }, { name: 'Sleep' }, { name: 'Stress & Nervous System' },
    ]);
    await seedCheckins(sarah.id, 30);
    await seedJournal(sarah.id, SARAH_JOURNAL);
    const n = await unlockTracks(sarah.id, 3);
    console.log(`✓ Sarah: onboarding complete, 30 check-ins, ${SARAH_JOURNAL.length} journal entries, ${n} audio tracks unlocked`);
  }

  // ---- Carolina ----
  const caro = await getUser(CARO_EMAIL);
  if (!caro) {
    console.warn(`! ${CARO_EMAIL} not found — skipping`);
  } else {
    await db.query(`UPDATE users SET onboarding_status='complete', updated_at=NOW() WHERE id=$1`, [caro.id]);
    await clearFor(caro.id);
    await seedJournal(caro.id, CARO_JOURNAL);
    const n = await unlockTracks(caro.id, 2);
    console.log(`✓ Carolina: onboarding complete, ${CARO_JOURNAL.length} journal entries, ${n} audio tracks unlocked`);
  }

  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); });

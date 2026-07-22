/*
 * seed-demo-data.js — Populate the showcase accounts with realistic activity.
 *
 * Idempotent: safe to run multiple times. For each showcase account it clears the
 * member's activity (check-ins, journal, audio unlocks) and reseeds a fresh, coherent
 * picture (30 days of check-ins, journal reflections, unlocked audio).
 *
 * USAGE
 *   Seed both showcase accounts (default, idempotent):
 *     node src/db/seed-demo-data.js
 *     npm run seed
 *
 *   Hard reset a single member and reseed them (wipes ALL of their generated data —
 *   check-ins, journal, audio, rewards, LUCA messages, assessment, bookings — but
 *   never the users row):
 *     node src/db/seed-demo-data.js --reset --email=sarah@solaris.health
 *     npm run seed:reset -- --email=sarah@solaris.health
 *
 *   Hard reset ALL showcase accounts:
 *     node src/db/seed-demo-data.js --reset
 *     npm run seed:reset
 *
 * Run inside Docker:
 *   docker exec luca-passport-backend-1 node src/db/seed-demo-data.js
 */
const db = require('../db');
const bcrypt = require('bcryptjs');

const SARAH_EMAIL = 'sarah@solaris.health';
const CARO_EMAIL = 'caroumanzorsv@gmail.com';
const SOFIA_EMAIL = 'sofia@solaris.health';
const ALEJANDRO_EMAIL = 'alejandro@solaris.health';
const DEMO_PASSWORD = 'demo123';

// ---- CLI args ----
const ARGV = process.argv.slice(2);
const RESET = ARGV.includes('--reset');
const EMAIL_ARG = (ARGV.find((a) => a.startsWith('--email=')) || '').split('=')[1] || null;

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

// Create a demo user if they don't exist yet; always refresh their profile fields.
// Returns the users row ({ id, first_name, ... }).
async function ensureUser(email, opts = {}) {
  const {
    firstName = 'Member',
    lastName = '',
    role = 'patient',
    country = 'El Salvador',
    language = 'English',
    lovePoints = 0,
    onboardingStatus = 'complete',
    isProvider = false,
  } = opts;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
  const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length) {
    const id = existing.rows[0].id;
    await db.query(
      `UPDATE users SET first_name=$1, last_name=$2, full_name=$3, role=$4, country=$5,
         language=$6, love_points=$7, onboarding_status=$8, is_provider=$9,
         provider_approved_at = CASE WHEN $9 THEN COALESCE(provider_approved_at, NOW()) ELSE provider_approved_at END,
         updated_at=NOW()
       WHERE id=$10`,
      [firstName, lastName, fullName, role, country, language, lovePoints, onboardingStatus, isProvider, id]
    );
    return { id, first_name: firstName };
  }
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows } = await db.query(
    `INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, country, language,
       onboarding_status, love_points, is_provider, provider_approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $11 THEN NOW() ELSE NULL END)
     RETURNING id, first_name`,
    [email, passwordHash, fullName, firstName, lastName, role, country, language, onboardingStatus, lovePoints, isProvider]
  );
  return rows[0];
}

// Seed active habits + a realistic trail of daily ticks over the window.
async function seedHabits(userId, habits) {
  // habits: [{ name, icon, completionRate (0..1), days }]
  await db.query('DELETE FROM habit_ticks WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM member_habits WHERE user_id=$1', [userId]);
  for (const h of habits) {
    const created = daysAgo(h.days || 14);
    const { rows } = await db.query(
      `INSERT INTO member_habits (user_id, name, icon, active, created_at)
       VALUES ($1,$2,$3,true,$4) RETURNING id`,
      [userId, h.name, h.icon, created]
    );
    const habitId = rows[0].id;
    const days = h.days || 14;
    const rate = typeof h.completionRate === 'number' ? h.completionRate : 0.7;
    for (let i = days - 1; i >= 0; i--) {
      if (Math.random() <= rate) {
        const dt = daysAgo(i);
        await db.query(
          `INSERT INTO habit_ticks (user_id, habit_id, tick_date, created_at)
           VALUES ($1,$2,$3,$4)`,
          [userId, habitId, dt.toISOString().slice(0, 10), dt]
        );
      }
    }
  }
}

async function seedRewards(userId, events) {
  // events: [{ event_type, points, category, note, daysBack }]
  for (const e of events) {
    const dt = daysAgo(e.daysBack || 0);
    await db.query(
      `INSERT INTO reward_events (user_id, event_type, points, category, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, e.event_type, e.points, e.category || null, e.note || null, dt]
    );
  }
}

// Light clear used on every seed run so re-seeding produces a fresh, coherent picture
// (does NOT touch assessment/bookings/rewards/messages that a member may have built up).
async function clearFor(userId) {
  await db.query('DELETE FROM daily_checkins WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM journal_entries WHERE user_id=$1', [userId]);
  await db.query('DELETE FROM user_audio WHERE user_id=$1', [userId]);
}

// Hard reset (--reset): wipe ALL of a member's generated data — never the users row.
async function resetFull(userId) {
  const tables = [
    'daily_checkins',
    'journal_entries',
    'user_audio',
    'habit_ticks',
    'member_habits',
    'reward_events',
    'luca_messages',
    'recommendations',       // FK → assessment_responses; must be cleared first
    'assessment_responses',
    'booking_requests',
    'member_journeys',
    'notifications',
  ];
  for (const t of tables) {
    await db.query(`DELETE FROM ${t} WHERE user_id=$1`, [userId]).catch((e) => {
      console.warn(`  ! could not clear ${t}: ${e.message}`);
    });
  }
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
    // Mind / Body / Heart / Spirit pillar scores (Solaris framing), gently improving.
    const mind = Math.min(100, rand(54, 66) + Math.round(progress * 20) + rand(-4, 4));
    const body = Math.min(100, rand(52, 64) + Math.round(progress * 22) + rand(-4, 4));
    const heart = Math.min(100, rand(56, 68) + Math.round(progress * 18) + rand(-4, 4));
    const spirit = Math.min(100, rand(50, 62) + Math.round(progress * 24) + rand(-4, 4));
    const dt = daysAgo(i);
    await db.query(
      `INSERT INTO daily_checkins
         (user_id, checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes,
          mind_score, body_score, heart_score, spirit_score, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [userId, dt.toISOString().slice(0, 10), energy, mood, sleep, hydration, movement,
       mind, body, heart, spirit, null, dt]
    );
  }
}

async function ensureAssessment(userId, focus, opts = {}) {
  const { rows } = await db.query('SELECT id FROM assessment_responses WHERE user_id=$1 LIMIT 1', [userId]);
  if (rows.length) return;
  const {
    vitality = 68,
    mental = 71,
    emotional = 66,
    physical = 62,
    spiritual = 70,
    raw = 64,
    headline = 'A strong foundation with room to restore energy and calm.',
  } = opts;
  const dt = daysAgo(29);
  await db.query(
    `INSERT INTO assessment_responses
       (user_id, started_at, completed_at, raw_score, vitality_score, mental_score, emotional_score, physical_score, spiritual_score, summary_json, top_focus_areas_json, created_at)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$2)`,
    [
      userId, dt, raw, vitality, mental, emotional, physical, spiritual,
      JSON.stringify({ headline }),
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

async function seedJourney(userId, journeyType, { daysAgo = 0, milestones = [] } = {}) {
  const started = new Date();
  started.setDate(started.getDate() - daysAgo);
  const json = milestones.map((key) => ({
    key,
    completed: true,
    completed_at: started.toISOString(),
  }));
  await db.query(
    `INSERT INTO member_journeys (user_id, journey_type, status, started_at, milestones_json)
     VALUES ($1,$2,'active',$3,$4)
     ON CONFLICT (user_id, journey_type)
     DO UPDATE SET status='active', started_at=EXCLUDED.started_at, milestones_json=EXCLUDED.milestones_json`,
    [userId, journeyType, started, JSON.stringify(json)]
  );
}

async function seedNotification(userId, { type, title, message, data = null, daysAgo = 0, read = false }) {
  const created = new Date();
  created.setDate(created.getDate() - daysAgo);
  await db.query(
    `INSERT INTO notifications (user_id, type, title, message, data, read, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, type, title, message, data ? JSON.stringify(data) : null, read, created]
  );
}

async function seedSarah(user) {
  await db.query(`UPDATE users SET onboarding_status='complete', updated_at=NOW() WHERE id=$1`, [user.id]);
  if (RESET) await resetFull(user.id);
  await clearFor(user.id);
  await ensureAssessment(user.id, [
    { name: 'Energy & Vitality' }, { name: 'Sleep' }, { name: 'Stress & Nervous System' },
  ]);
  await seedCheckins(user.id, 30);
  await seedJournal(user.id, SARAH_JOURNAL);
  const n = await unlockTracks(user.id, 3);
  console.log(`✓ Sarah: onboarding complete, 30 check-ins, ${SARAH_JOURNAL.length} journal entries, ${n} audio tracks unlocked`);
}

async function seedCaro(user) {
  await db.query(`UPDATE users SET onboarding_status='complete', updated_at=NOW() WHERE id=$1`, [user.id]);
  if (RESET) await resetFull(user.id);
  await clearFor(user.id);
  await seedJournal(user.id, CARO_JOURNAL);
  const n = await unlockTracks(user.id, 2);
  console.log(`✓ Carolina: onboarding complete, ${CARO_JOURNAL.length} journal entries, ${n} audio tracks unlocked`);
}

// Fallback for resetting/seeding any other member by email.
async function seedGenericMember(user, email) {
  await db.query(`UPDATE users SET onboarding_status='complete', updated_at=NOW() WHERE id=$1`, [user.id]);
  if (RESET) await resetFull(user.id);
  await clearFor(user.id);
  await ensureAssessment(user.id, [{ name: 'Optimal Health' }, { name: 'Energy & Vitality' }]);
  await seedCheckins(user.id, 14);
  const n = await unlockTracks(user.id, 2);
  console.log(`✓ ${email}: onboarding complete, 14 check-ins, ${n} audio tracks unlocked`);
}

// ---------------------------------------------------------------------------
// Demo pair: Sofia Herrera (patient) + Dr. Alejandro Reyes (practitioner).
// These accounts are CREATED if they don't exist (password: demo123).
// ---------------------------------------------------------------------------
const SOFIA_JOURNAL = [
  { daysBack: 1, mood: 'Good', content: "Woke up genuinely rested for the first time in a while. The morning meditation is starting to feel less like a chore and more like something I look forward to. Small win, but it counts." },
  { daysBack: 5, mood: 'Thriving', content: "Great session with the breathwork practice before a stressful meeting — walked in calm instead of wired. I can feel my body learning a different response to pressure." },
  { daysBack: 11, mood: 'Neutral', content: "Bit of a flat day. Anxiety crept back in the afternoon. Made the herbal tea and journaled instead of doom-scrolling, which is progress even if the day felt heavy." },
];

async function seedSofia() {
  const sofia = await ensureUser(SOFIA_EMAIL, {
    firstName: 'Sofia',
    lastName: 'Herrera',
    role: 'patient',
    country: 'El Salvador',
    lovePoints: 120,
    onboardingStatus: 'complete',
  });
  if (RESET) await resetFull(sofia.id);
  await clearFor(sofia.id);
  await ensureAssessment(
    sofia.id,
    ['Stress & Anxiety', 'Optimal Health', 'Sleep'],
    { vitality: 72, mental: 68, emotional: 66, physical: 74, spiritual: 70, raw: 70,
      headline: 'Vibrant and capable, with a clear invitation to soften stress and protect sleep.' }
  );
  await seedCheckins(sofia.id, 14);
  await seedJournal(sofia.id, SOFIA_JOURNAL);
  await seedHabits(sofia.id, [
    { name: 'Morning meditation', icon: '🧘', completionRate: 0.8, days: 14 },
    { name: 'Herbal tea ritual', icon: '🍵', completionRate: 0.65, days: 14 },
  ]);
  await seedRewards(sofia.id, [
    { event_type: 'assessment_completed', points: 50, category: 'onboarding', note: 'Completed the Solaris Method assessment', daysBack: 29 },
    { event_type: 'checkin_streak', points: 30, category: 'consistency', note: '7-day check-in streak', daysBack: 3 },
  ]);
  const n = await unlockTracks(sofia.id, 3);
  // Active Optimal Health journey, started 14 days ago; intake + 7-day streak done.
  await seedJourney(sofia.id, 'optimal_health', { daysAgo: 14, milestones: ['intake', 'streak7'] });
  // A warm welcome notification so the bell is never empty.
  await seedNotification(sofia.id, {
    type: 'welcome',
    title: 'Your Optimal Health journey is underway',
    message: "Beautiful start, Sofia — you've completed your intake and a 7-day check-in streak. Your next milestone is your first practitioner session.",
    data: { tab: 'dashboard' },
    daysAgo: 1,
    read: false,
  });
  console.log(`✓ Sofia Herrera (${SOFIA_EMAIL} / ${DEMO_PASSWORD}): patient, assessment, 14 check-ins, ${SOFIA_JOURNAL.length} journal entries, 2 habits, ${n} audio tracks, Optimal Health journey, 1 notification`);
  return sofia;
}

async function seedAlejandro(sofia) {
  const alejandro = await ensureUser(ALEJANDRO_EMAIL, {
    firstName: 'Alejandro',
    lastName: 'Reyes',
    role: 'practitioner',
    country: 'El Salvador',
    lovePoints: 60,
    onboardingStatus: 'complete',
    isProvider: true,
  });

  // Idempotent: clear this practitioner's prior listing/profile/application/bookings.
  await db.query(
    `DELETE FROM booking_requests WHERE listing_id IN (SELECT id FROM listings WHERE owner_user_id=$1)`,
    [alejandro.id]
  );
  await db.query('DELETE FROM practitioner_profiles WHERE user_id=$1', [alejandro.id]);
  await db.query('DELETE FROM provider_applications WHERE user_id=$1', [alejandro.id]).catch(() => {});
  await db.query('DELETE FROM listings WHERE owner_user_id=$1', [alejandro.id]);

  // Published practitioner listing owned by Alejandro.
  const listing = await db.query(
    `INSERT INTO listings
       (listing_type, node_type, status, visibility, title, slug, tagline, short_description, full_description,
        specialty, city, region, country, focus_areas_json, price, currency, duration_minutes,
        booking_enabled, payment_enabled, featured, owner_user_id, created_by_admin, trust_score, rating)
     VALUES ('practitioner','practitioner_node','published','public',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'USD',$12,
             true,false,true,$13,false,88,4.9)
     RETURNING id`,
    [
      'Dr. Alejandro Reyes — Integrative Wellness',
      'dr-alejandro-reyes',
      'Root-cause, whole-person care blending functional medicine and nervous-system regulation.',
      'Integrative physician helping members calm stress, restore sleep, and rebuild lasting vitality.',
      "Dr. Alejandro Reyes is an integrative physician who blends evidence-based functional medicine with nervous-system and lifestyle work. He partners with members to address the roots of stress, fatigue, and disrupted sleep — honouring mind, body, heart, and spirit rather than chasing symptoms in isolation.",
      'Integrative & Functional Medicine',
      'San Salvador',
      'San Salvador',
      'El Salvador',
      JSON.stringify(['Stress & Anxiety', 'Sleep', 'Optimal Health', 'Energy & Vitality']),
      120,
      60,
      alejandro.id,
    ]
  );
  const listingId = listing.rows[0].id;

  // Approved practitioner profile linked to the listing.
  await db.query(
    `INSERT INTO practitioner_profiles
       (user_id, listing_id, specialty, credentials_text, years_experience, bio, treatment_philosophy,
        onboarding_status, verification_status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'approved','verified',NOW(),NOW())`,
    [
      alejandro.id,
      listingId,
      'Integrative & Functional Medicine',
      'MD, Universidad de El Salvador · Institute for Functional Medicine (IFM) Certified Practitioner',
      12,
      "Twelve years guiding members from burnout back to balance through integrative, root-cause care.",
      'Meet the whole person first: steady the nervous system, restore sleep and energy, then build habits that last.',
    ]
  );

  // Approved provider application (audit trail of approval).
  await db.query(
    `INSERT INTO provider_applications
       (user_id, provider_type, business_name, status, application_data, reviewed_at, submitted_at, created_at, updated_at)
     VALUES ($1,'practitioner',$2,'approved',$3,NOW(),NOW(),NOW(),NOW())`,
    [
      alejandro.id,
      'Dr. Alejandro Reyes — Integrative Wellness',
      JSON.stringify({ specialty: 'Integrative & Functional Medicine', city: 'San Salvador', country: 'El Salvador' }),
    ]
  ).catch((e) => console.warn(`  ! provider_applications insert skipped: ${e.message}`));

  // Pending booking request from Sofia → Alejandro's listing (3 days out).
  const preferred = new Date();
  preferred.setDate(preferred.getDate() + 3);
  if (sofia) {
    await db.query(
      `INSERT INTO booking_requests
         (user_id, listing_id, status, preferred_date, preferred_time, note, created_at, updated_at)
       VALUES ($1,$2,'pending',$3,$4,$5,NOW(),NOW())`,
      [
        sofia.id,
        listingId,
        preferred.toISOString().slice(0, 10),
        '10:00 AM',
        "I've been working on my stress and sleep through Solaris and would love your guidance on the next step. Looking forward to connecting.",
      ]
    );
  }

  console.log(`✓ Dr. Alejandro Reyes (${ALEJANDRO_EMAIL} / ${DEMO_PASSWORD}): practitioner, approved provider, published listing, ${sofia ? '1 pending booking from Sofia' : 'no booking (Sofia missing)'}`);
  return alejandro;
}

async function seedDemoPair() {
  const sofia = await seedSofia();
  await seedAlejandro(sofia);
}

const SEEDERS = { [SARAH_EMAIL]: seedSarah, [CARO_EMAIL]: seedCaro };
const PAIR_EMAILS = new Set([SOFIA_EMAIL, ALEJANDRO_EMAIL]);

async function seedOne(email) {
  const user = await getUser(email);
  if (!user) { console.warn(`! ${email} not found — skipping`); return; }
  const fn = SEEDERS[email] || ((u) => seedGenericMember(u, email));
  await fn(user);
}

async function main() {
  if (EMAIL_ARG) {
    console.log(`${RESET ? 'Resetting + reseeding' : 'Seeding'} ${EMAIL_ARG}…`);
    if (PAIR_EMAILS.has(EMAIL_ARG)) {
      await seedDemoPair();
    } else {
      await seedOne(EMAIL_ARG);
    }
  } else {
    console.log(`${RESET ? 'Resetting + reseeding' : 'Seeding'} showcase data…`);
    await seedOne(SARAH_EMAIL);
    await seedOne(CARO_EMAIL);
    await seedDemoPair();
  }
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); });

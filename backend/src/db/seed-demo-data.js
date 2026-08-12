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
const crypto = require('crypto');
const fs = require('fs');
const { seedIntakeTemplates } = require('./intake-templates');
const { insertMessage } = require('../lib/intake-messages');

const SARAH_EMAIL = 'sarah@solaris.health';
const CARO_EMAIL = 'caroumanzorsv@gmail.com';
const SOFIA_EMAIL = 'sofia@solaris.health';
const ALEJANDRO_EMAIL = 'alejandro@solaris.health';
const DEMO_PASSWORD = 'demo123';

// ---- CLI args ----
const ARGV = process.argv.slice(2);
const RESET = ARGV.includes('--reset');
const BETA = ARGV.includes('--beta');
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

  // Simulated GPS payment splits (Sofia → Alejandro) — a preview of sovereign income.
  if (sofia) await seedPaymentSplits(alejandro, sofia);

  console.log(`✓ Dr. Alejandro Reyes (${ALEJANDRO_EMAIL} / ${DEMO_PASSWORD}): practitioner, approved provider, published listing, ${sofia ? '1 pending booking from Sofia' : 'no booking (Sofia missing)'}`);
  return alejandro;
}

// Seed 3 simulated payment splits from Sofia to Alejandro. Idempotent: clears
// this provider's prior simulated splits first. The payment_splits table is
// created by migration 014; if it's absent we skip quietly.
async function seedPaymentSplits(alejandro, sofia) {
  try {
    await db.query('DELETE FROM payment_splits WHERE provider_id=$1', [alejandro.id]);
    const rows = [
      { sats: 42000, usd: 2800, type: 'session_fee', days: 21, note: 'Initial vitality consultation — sovereign session fee.' },
      { sats: 42000, usd: 2800, type: 'session_fee', days: 12, note: 'Follow-up session — stress & sleep protocol.' },
      { sats: 18000, usd: 1200, type: 'contribution_bonus', days: 4, note: 'Community contribution bonus — regenerative commons share.' },
    ];
    for (const r of rows) {
      const created = new Date();
      created.setDate(created.getDate() - r.days);
      await db.query(
        `INSERT INTO payment_splits
           (provider_id, patient_id, amount_sats, amount_usd_cents, split_type, status, note, created_at)
         VALUES ($1,$2,$3,$4,$5,'simulated',$6,$7)`,
        [alejandro.id, sofia.id, r.sats, r.usd, r.type, r.note, created.toISOString()]
      );
    }
    console.log(`  ↳ seeded ${rows.length} simulated payment splits (Sofia → Alejandro)`);
  } catch (e) {
    console.warn(`  ! payment_splits seed skipped: ${e.message}`);
  }
}

// Seed a coherent intake picture for the Sofia → Alejandro pair:
//   - Alejandro has intake-on-first-booking enabled (general template preferred).
//   - Sofia has a pending intake submission + a booking-confirmation and an
//     intake-request message waiting in her inbox.
// Idempotent: clears this pair's prior intake rows first. Requires the intake
// templates to already be seeded (call seedIntakeTemplates first).
async function seedIntakeDemo(sofia, alejandro) {
  if (!sofia || !alejandro) return;
  try {
    // Idempotent cleanup for this pair.
    await db.query('DELETE FROM patient_messages WHERE recipient_id=$1 AND message_type IN ($2,$3)',
      [sofia.id, 'booking_confirmation', 'intake_request']);
    await db.query('DELETE FROM patient_intake_submissions WHERE patient_id=$1 AND provider_id=$2',
      [sofia.id, alejandro.id]);
    await db.query('DELETE FROM provider_intake_settings WHERE provider_id=$1', [alejandro.id]);

    // Pick the general system template.
    const tpl = await db.query(
      `SELECT id FROM intake_form_templates WHERE is_active=TRUE
         ORDER BY (clinic_type='general') DESC, is_system DESC, id ASC LIMIT 1`
    );
    const templateId = tpl.rows[0] && tpl.rows[0].id;
    if (!templateId) { console.warn('  ! intake demo skipped: no templates seeded'); return; }

    // Alejandro's intake settings.
    await db.query(
      `INSERT INTO provider_intake_settings
         (provider_id, send_intake_on_first_booking, preferred_template_id, custom_message, updated_at)
       VALUES ($1, TRUE, $2, NULL, NOW())
       ON CONFLICT (provider_id) DO UPDATE
         SET send_intake_on_first_booking=EXCLUDED.send_intake_on_first_booking,
             preferred_template_id=EXCLUDED.preferred_template_id, updated_at=NOW()`,
      [alejandro.id, templateId]
    );

    // Pending intake submission Sofia → Alejandro.
    const sub = await db.query(
      `INSERT INTO patient_intake_submissions (patient_id, provider_id, template_id, status)
       VALUES ($1,$2,$3,'pending') RETURNING id`,
      [sofia.id, alejandro.id, templateId]
    );
    const submissionId = sub.rows[0].id;

    // Two inbox messages for Sofia.
    await insertMessage({
      recipientId: sofia.id,
      senderId: alejandro.id,
      senderName: 'Dr. Alejandro Reyes',
      subject: 'Your session has been confirmed ✓',
      body: 'Great news — Dr. Alejandro Reyes has confirmed your booking request. We look forward to supporting your wellness journey. You\'ll receive further details shortly.',
      messageType: 'booking_confirmation',
    });
    await insertMessage({
      recipientId: sofia.id,
      senderId: alejandro.id,
      senderName: 'Dr. Alejandro Reyes',
      subject: 'Please complete your new patient intake form',
      body: 'To help us prepare for your first session, please take a few minutes to complete your new patient intake form. This information will help us understand your health background and ensure we make the most of your time together.',
      messageType: 'intake_request',
      relatedIntakeId: submissionId,
      actionUrl: `/intake?id=${submissionId}`,
      actionLabel: 'Complete Intake Form',
    });

    console.log(`  ↳ seeded intake demo: Alejandro settings + Sofia pending submission (#${submissionId}) + 2 inbox messages`);
  } catch (e) {
    console.warn(`  ! intake demo seed skipped: ${e.message}`);
  }
}

async function seedDemoPair() {
  const sofia = await seedSofia();
  const alejandro = await seedAlejandro(sofia);
  await seedIntakeDemo(sofia, alejandro);
}

// ===========================================================================
// SOLARIS BETA V1 — Investor demo scenario (marketplace booking loop).
// ---------------------------------------------------------------------------
// Entirely synthetic, namespaced to the @example.test fixture set. Uses the
// LIVE marketplace booking system (provider_profiles + provider_services +
// provider_availability + bookings) — the same one the app UI drives — so the
// closed booking loop can be exercised end-to-end through the rendered UI.
//
// Guarded, transactional, idempotent and namespaced:
//   • GUARD   — refuses unless current_database() is NOT 'luca_passport' AND
//               ALLOW_BETA_DEMO_SEED is set. Never runs against production.
//   • TXN     — everything runs in one BEGIN/COMMIT; any error rolls back.
//   • NAMESPACE — only ever touches the @example.test fixture rows (and the
//               practitioner's own provider_profiles cascade). Never deletes
//               unrelated users or their data.
//   • IDEMPOTENT — re-running yields identical fixture counts and no dupes:
//               fixture users are upserted by stable email, the practitioner's
//               provider_profiles row is deleted+recreated (cascading its
//               services/availability/bookings), and each member's generated
//               activity is cleared before reseeding.
//
// Run:
//   ALLOW_BETA_DEMO_SEED=1 node src/db/seed-demo-data.js --beta
// Reset (same command — it is idempotent and wipes any walkthrough additions):
//   cd backend && sudo bash -c 'set -a; . /etc/solaris-beta-demo/backend.env; \
//     set +a; ALLOW_BETA_DEMO_SEED=1 node src/db/seed-demo-data.js --beta'
// ===========================================================================

const BETA_MEMBER_EMAIL = 'maria.member@example.test';
const BETA_PRACTITIONER_EMAIL = 'dr.reyes@example.test';
const BETA_SUPPORTING = [
  { email: 'carlos.demo@example.test', firstName: 'Carlos', lastName: 'Nunez' },
  { email: 'lucia.demo@example.test', firstName: 'Lucia', lastName: 'Flores' },
  { email: 'diego.demo@example.test', firstName: 'Diego', lastName: 'Ramirez' },
  { email: 'ana.demo@example.test', firstName: 'Ana', lastName: 'Villalta' },
  { email: 'pablo.demo@example.test', firstName: 'Pablo', lastName: 'Menendez' },
];
const BETA_CREDS_PATH = '/home/ubuntu/SOLARIS-INVESTOR-DEMO-CREDENTIALS.txt';

// ---------------------------------------------------------------------------
// InvestorDemoV1 marketplace catalog — a synthetic directory of fictional
// practitioners so the marketplace + map show real breadth. Every row is
// entirely made up: business names, PUBLIC street addresses, phone numbers and
// coordinates are invented and never reference a real person or clinic. Owner
// logins are namespaced @example.test and are NOT principal accounts (they use
// the shared demo password and are never signed into for the demo).
//
// Non-schema attributes the marketplace filters on — languages, modality
// (virtual / in_person / hybrid) and the licensed-clinical vs wellness
// distinction — are stored in the existing provider_profiles.hours_of_operation
// jsonb column under a { meta: { … } } key. No migration is introduced; the
// frontend reads provider.hours_of_operation.meta for these filters, and the
// weekly availability template remains the source of truth for hours.
const INVESTOR_PROVIDERS = [
  // ---- Licensed / clinical ----
  { key: 'p01', type: 'doctor', licensed: true, firstName: 'Sofía', lastName: 'Herrera',
    business: 'Clínica Vida Integral', city: 'Santa Ana', country: 'El Salvador',
    lat: 13.9942, lng: -89.5597, address: 'Avenida Independencia 210, Centro', phone: '+503 2447 3300',
    specialties: ['Optimal Health', 'Preventive Care', 'Energy & Vitality'],
    languages: ['Spanish', 'English'], modality: 'hybrid', priceRange: '$$', rating: 4.8, reviewCount: 34,
    verified: true, vtv: true, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Functional-medicine family practice focused on preventive, root-cause care for the whole household.',
    services: [{ name: 'New Patient Consultation', description: '60-minute functional-medicine intake and plan.', price: 95, duration: 60, category: 'Consultation' },
               { name: 'Preventive Check-up', description: '30-minute preventive review and labs guidance.', price: 55, duration: 30, category: 'Follow-up' }] },
  { key: 'p02', type: 'doctor', licensed: true, firstName: 'Javier', lastName: 'Morales',
    business: 'Centro Médico Aurora', city: 'San Miguel', country: 'El Salvador',
    lat: 13.4833, lng: -88.1833, address: 'Calle Chaparrastique 45, Barrio El Centro', phone: '+503 2661 8890',
    specialties: ['Stress & Anxiety', 'Sleep', 'Optimal Health'],
    languages: ['Spanish'], modality: 'in_person', priceRange: '$$', rating: 4.6, reviewCount: 21,
    verified: true, vtv: false, featured: false, days: [1, 2, 3, 4, 5, 6],
    description: 'Integrative internal medicine helping patients restore sleep and steady energy after burnout.',
    services: [{ name: 'Integrative Consultation', description: '50-minute whole-person medical consultation.', price: 80, duration: 50, category: 'Consultation' }] },
  { key: 'p03', type: 'dentist', licensed: true, firstName: 'Camila', lastName: 'Ortiz',
    business: 'Sonrisa Dental Studio', city: 'San Salvador', country: 'El Salvador',
    lat: 13.7010, lng: -89.2240, address: 'Boulevard del Hipódromo 320, Colonia San Benito', phone: '+503 2223 5567',
    specialties: ['Dental Health', 'Preventive Care'],
    languages: ['Spanish', 'English'], modality: 'in_person', priceRange: '$$$', rating: 4.9, reviewCount: 58,
    verified: true, vtv: true, featured: true, days: [1, 2, 3, 4, 5],
    description: 'Modern preventive and cosmetic dentistry with a calm, low-anxiety patient experience.',
    services: [{ name: 'Dental Cleaning & Check-up', description: '45-minute cleaning and oral-health review.', price: 60, duration: 45, category: 'Preventive' },
               { name: 'Cosmetic Consultation', description: '30-minute smile-design consultation.', price: 40, duration: 30, category: 'Consultation' }] },
  { key: 'p04', type: 'dentist', licensed: true, firstName: 'Luis', lastName: 'Paredes',
    business: 'DentalCare Antigua', city: 'Antigua Guatemala', country: 'Guatemala',
    lat: 14.5586, lng: -90.7295, address: '5a Avenida Norte 12, Antigua', phone: '+502 7832 4410',
    specialties: ['Dental Health'],
    languages: ['Spanish', 'English'], modality: 'in_person', priceRange: '$$', rating: 4.7, reviewCount: 29,
    verified: true, vtv: false, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Family and restorative dentistry serving Antigua and surrounding towns.',
    services: [{ name: 'Comprehensive Exam', description: '40-minute full dental exam.', price: 50, duration: 40, category: 'Preventive' }] },
  { key: 'p05', type: 'nutritionist', licensed: true, firstName: 'Andrea', lastName: 'Gómez',
    business: 'Nutrir Vida', city: 'Guatemala City', country: 'Guatemala',
    lat: 14.6349, lng: -90.5069, address: 'Zona 10, 4a Calle 2-15', phone: '+502 2360 7788',
    specialties: ['Nutrition', 'Energy & Vitality', 'Women\u2019s Health'],
    languages: ['Spanish', 'English'], modality: 'virtual', priceRange: '$$', rating: 4.8, reviewCount: 41,
    verified: true, vtv: true, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Registered dietitian offering evidence-based nutrition plans, fully online.',
    services: [{ name: 'Nutrition Assessment', description: '60-minute nutrition intake and plan.', price: 70, duration: 60, category: 'Consultation' },
               { name: 'Nutrition Follow-up', description: '30-minute progress review.', price: 40, duration: 30, category: 'Follow-up' }] },
  { key: 'p06', type: 'nutritionist', licensed: true, firstName: 'Ricardo', lastName: 'Fuentes',
    business: 'Balance Nutrición', city: 'San José', country: 'Costa Rica',
    lat: 9.9281, lng: -84.0907, address: 'Barrio Escalante, Calle 33', phone: '+506 2253 9010',
    specialties: ['Nutrition', 'Optimal Health'],
    languages: ['Spanish'], modality: 'hybrid', priceRange: '$$', rating: 4.5, reviewCount: 18,
    verified: false, vtv: false, featured: false, days: [2, 3, 4, 5, 6],
    description: 'Sports and metabolic nutrition for sustainable energy and body composition.',
    services: [{ name: 'Metabolic Consultation', description: '55-minute metabolic nutrition consultation.', price: 65, duration: 55, category: 'Consultation' }] },
  { key: 'p07', type: 'therapist', licensed: true, firstName: 'Valentina', lastName: 'Cruz',
    business: 'Espacio Calma Psicología', city: 'San Salvador', country: 'El Salvador',
    lat: 13.6960, lng: -89.2400, address: 'Colonia Escalón, Paseo General Escalón 4820', phone: '+503 2263 1120',
    specialties: ['Stress & Anxiety', 'Emotional Wellbeing', 'Mindfulness'],
    languages: ['Spanish', 'English'], modality: 'hybrid', priceRange: '$$', rating: 4.9, reviewCount: 47,
    verified: true, vtv: true, featured: true, days: [1, 2, 3, 4, 5],
    description: 'Licensed clinical psychology for anxiety, stress and life transitions, in person or online.',
    services: [{ name: 'Therapy Session', description: '50-minute individual psychotherapy session.', price: 60, duration: 50, category: 'Therapy' }] },
  { key: 'p08', type: 'therapist', licensed: true, firstName: 'Daniel', lastName: 'Rivas',
    business: 'Mindful Therapy Collective', city: 'Panama City', country: 'Panama',
    lat: 8.9824, lng: -79.5199, address: 'Bella Vista, Calle 50', phone: '+507 396 4501',
    specialties: ['Emotional Wellbeing', 'Stress & Anxiety'],
    languages: ['English', 'Spanish'], modality: 'virtual', priceRange: '$$$', rating: 4.7, reviewCount: 33,
    verified: true, vtv: false, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Bilingual psychotherapy practice specialising in stress, relationships and burnout — online.',
    services: [{ name: 'Individual Therapy', description: '50-minute online therapy session.', price: 85, duration: 50, category: 'Therapy' }] },
  { key: 'p09', type: 'clinic', licensed: true, firstName: 'Holística', lastName: 'Amanecer',
    business: 'Clínica Holística Amanecer', city: 'San Salvador', country: 'El Salvador',
    lat: 13.6890, lng: -89.2050, address: 'Colonia Médica, Avenida Dr. Max Bloch 15', phone: '+503 2225 7700',
    specialties: ['Optimal Health', 'Preventive Care', 'Detox & Cleanse'],
    languages: ['Spanish', 'English'], modality: 'in_person', priceRange: '$$$', rating: 4.6, reviewCount: 52,
    verified: true, vtv: true, featured: false, days: [1, 2, 3, 4, 5, 6],
    description: 'Multi-disciplinary integrative clinic combining medical, nutrition and mind-body services.',
    services: [{ name: 'Integrative Intake', description: '60-minute multi-disciplinary intake.', price: 90, duration: 60, category: 'Consultation' }] },
  { key: 'p10', type: 'clinic', licensed: true, firstName: 'Ceiba', lastName: 'Salud',
    business: 'Centro de Salud Integral Ceiba', city: 'Tegucigalpa', country: 'Honduras',
    lat: 14.0723, lng: -87.1921, address: 'Colonia Palmira, Avenida República de Chile', phone: '+504 2232 5566',
    specialties: ['Preventive Care', 'Women\u2019s Health', 'Optimal Health'],
    languages: ['Spanish'], modality: 'in_person', priceRange: '$$', rating: 4.4, reviewCount: 19,
    verified: false, vtv: false, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Community integrative health centre with preventive and women\u2019s-health programmes.',
    services: [{ name: 'Wellness Check-up', description: '45-minute preventive health visit.', price: 45, duration: 45, category: 'Preventive' }] },
  // ---- Wellness (non-clinical) ----
  { key: 'p11', type: 'wellness', licensed: false, firstName: 'Raíces', lastName: 'Studio',
    business: 'Raíces Wellness Studio', city: 'Antigua Guatemala', country: 'Guatemala',
    lat: 14.5620, lng: -90.7340, address: '6a Calle Poniente 30, Antigua', phone: '+502 7955 2210',
    specialties: ['Mindfulness', 'Stress & Anxiety', 'Movement & Fitness'],
    languages: ['Spanish', 'English'], modality: 'hybrid', priceRange: '$$', rating: 4.8, reviewCount: 62,
    verified: true, vtv: false, featured: true, days: [1, 2, 3, 4, 5, 6],
    description: 'Yoga, meditation and breathwork studio for stress relief and gentle movement.',
    services: [{ name: 'Private Yoga Session', description: '60-minute private guided yoga session.', price: 35, duration: 60, category: 'Movement' },
               { name: 'Guided Meditation', description: '30-minute guided meditation session.', price: 20, duration: 30, category: 'Mindfulness' }] },
  { key: 'p12', type: 'wellness', licensed: false, firstName: 'Pura', lastName: 'Vida',
    business: 'Pura Vida Wellness', city: 'San José', country: 'Costa Rica',
    lat: 9.9350, lng: -84.0800, address: 'Santa Ana, Centro Comercial Vistas', phone: '+506 2282 4400',
    specialties: ['Mindfulness', 'Emotional Wellbeing'],
    languages: ['English', 'Spanish'], modality: 'virtual', priceRange: '$', rating: 4.6, reviewCount: 27,
    verified: false, vtv: false, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Online mindfulness coaching and stress-resilience programmes.',
    services: [{ name: 'Mindfulness Coaching', description: '45-minute online mindfulness coaching call.', price: 30, duration: 45, category: 'Coaching' }] },
  { key: 'p13', type: 'gym', licensed: false, firstName: 'Fuerza', lastName: 'Funcional',
    business: 'Fuerza Funcional Gym', city: 'San Salvador', country: 'El Salvador',
    lat: 13.7050, lng: -89.2300, address: 'Colonia San Benito, Calle La Mascota 540', phone: '+503 2245 9900',
    specialties: ['Movement & Fitness', 'Energy & Vitality'],
    languages: ['Spanish'], modality: 'in_person', priceRange: '$$', rating: 4.7, reviewCount: 44,
    verified: true, vtv: false, featured: false, days: [1, 2, 3, 4, 5, 6],
    description: 'Functional-training gym with small-group coaching for strength and mobility.',
    services: [{ name: 'Personal Training', description: '60-minute one-on-one functional training.', price: 40, duration: 60, category: 'Fitness' }] },
  { key: 'p14', type: 'gym', licensed: false, firstName: 'Movimiento', lastName: 'Studio',
    business: 'Movimiento Studio', city: 'Guatemala City', country: 'Guatemala',
    lat: 14.6000, lng: -90.5140, address: 'Zona 14, Avenida Las Américas 18-40', phone: '+502 2385 1120',
    specialties: ['Movement & Fitness', 'Optimal Health'],
    languages: ['Spanish', 'English'], modality: 'hybrid', priceRange: '$$', rating: 4.5, reviewCount: 22,
    verified: false, vtv: false, featured: false, days: [1, 2, 3, 4, 5],
    description: 'Movement and mobility studio blending Pilates, strength and recovery.',
    services: [{ name: 'Reformer Pilates', description: '50-minute reformer Pilates class.', price: 28, duration: 50, category: 'Fitness' }] },
  { key: 'p15', type: 'spa', licensed: false, firstName: 'Serenidad', lastName: 'Spa',
    business: 'Serenidad Spa & Baños', city: 'Santa Ana', country: 'El Salvador',
    lat: 13.9900, lng: -89.5560, address: 'Calle Libertad Poniente 88', phone: '+503 2440 6677',
    specialties: ['Detox & Cleanse', 'Stress & Anxiety'],
    languages: ['Spanish'], modality: 'in_person', priceRange: '$$$', rating: 4.8, reviewCount: 39,
    verified: true, vtv: false, featured: false, days: [3, 4, 5, 6, 0],
    description: 'Thermal-bath spa offering massage, hydrotherapy and deep-relaxation rituals.',
    services: [{ name: 'Relaxation Massage', description: '60-minute full-body relaxation massage.', price: 45, duration: 60, category: 'Spa' }] },
  { key: 'p16', type: 'spa', licensed: false, firstName: 'Aguas', lastName: 'Termales',
    business: 'Aguas Termales Spa', city: 'Panama City', country: 'Panama',
    lat: 8.9900, lng: -79.5100, address: 'Punta Pacífica, Boulevard Pacífica', phone: '+507 302 7788',
    specialties: ['Detox & Cleanse', 'Emotional Wellbeing'],
    languages: ['English', 'Spanish'], modality: 'in_person', priceRange: '$$$$', rating: 4.9, reviewCount: 71,
    verified: true, vtv: true, featured: true, days: [1, 2, 3, 4, 5, 6, 0],
    description: 'Luxury hydrotherapy spa with detox and restorative wellness packages.',
    services: [{ name: 'Detox Ritual', description: '90-minute hydrotherapy and detox ritual.', price: 120, duration: 90, category: 'Spa' }] },
  { key: 'p17', type: 'farm', licensed: false, firstName: 'Finca', lastName: 'Roble',
    business: 'Finca Orgánica El Roble', city: 'Antigua Guatemala', country: 'Guatemala',
    lat: 14.5500, lng: -90.7200, address: 'Aldea San Juan del Obispo, km 3', phone: '+502 7830 9911',
    specialties: ['Nutrition', 'Detox & Cleanse', 'Optimal Health'],
    languages: ['Spanish', 'English'], modality: 'in_person', priceRange: '$', rating: 4.7, reviewCount: 25,
    verified: false, vtv: false, featured: false, days: [4, 5, 6, 0],
    description: 'Regenerative organic farm offering farm-to-table nutrition and wellness day visits.',
    services: [{ name: 'Farm Wellness Day', description: 'Half-day farm-to-table nutrition experience.', price: 35, duration: 240, category: 'Experience' }] },
  { key: 'p18', type: 'farm', licensed: false, firstName: 'Granja', lastName: 'Cosecha',
    business: 'Granja Regenerativa La Cosecha', city: 'San Miguel', country: 'El Salvador',
    lat: 13.4900, lng: -88.1900, address: 'Cantón El Jocotal, carretera Litoral', phone: '+503 2669 3300',
    specialties: ['Nutrition', 'Preventive Care'],
    languages: ['Spanish'], modality: 'in_person', priceRange: '$', rating: 4.4, reviewCount: 12,
    verified: false, vtv: false, featured: false, days: [5, 6, 0],
    description: 'Regenerative farm running seasonal nutrition and healthy-cooking visits.',
    services: [{ name: 'Seasonal Harvest Visit', description: '3-hour harvest and cooking session.', price: 25, duration: 180, category: 'Experience' }] },
  { key: 'p19', type: 'workshop', licensed: false, firstName: 'Taller', lastName: 'Respira',
    business: 'Taller Respira — Breathwork', city: 'San Salvador', country: 'El Salvador',
    lat: 13.6940, lng: -89.2150, address: 'Colonia Escalón, 87 Avenida Norte 220', phone: '+503 2264 5588',
    specialties: ['Mindfulness', 'Stress & Anxiety', 'Emotional Wellbeing'],
    languages: ['Spanish', 'English'], modality: 'virtual', priceRange: '$', rating: 4.8, reviewCount: 36,
    verified: false, vtv: false, featured: false, days: [1, 3, 5],
    description: 'Live online breathwork and nervous-system regulation workshops.',
    services: [{ name: 'Breathwork Workshop', description: '75-minute live online breathwork workshop.', price: 18, duration: 75, category: 'Workshop' }] },
  { key: 'p20', type: 'workshop', licensed: false, firstName: 'Cocina', lastName: 'Consciente',
    business: 'Cocina Consciente Workshop', city: 'Guatemala City', country: 'Guatemala',
    lat: 14.6100, lng: -90.5200, address: 'Zona 4, 4 Grados Norte', phone: '+502 2334 7799',
    specialties: ['Nutrition', 'Movement & Fitness'],
    languages: ['Spanish', 'English'], modality: 'hybrid', priceRange: '$$', rating: 4.6, reviewCount: 20,
    verified: false, vtv: false, featured: false, days: [2, 4, 6],
    description: 'Hands-on healthy-cooking and mindful-eating workshops, in studio or online.',
    services: [{ name: 'Healthy Cooking Class', description: '2-hour hands-on healthy cooking class.', price: 30, duration: 120, category: 'Workshop' }] },
];

// Owner logins for the catalog providers (namespaced, non-principal).
const INVESTOR_PROVIDER_EMAILS = INVESTOR_PROVIDERS.map((p) => `${p.key}.provider@example.test`);

// All fixture emails this scenario owns — used only for namespaced cleanup.
const BETA_ALL_EMAILS = [
  BETA_MEMBER_EMAIL,
  BETA_PRACTITIONER_EMAIL,
  ...BETA_SUPPORTING.map((s) => s.email),
  ...INVESTOR_PROVIDER_EMAILS,
];

// Generate (or reuse) strong random passwords for the two PRINCIPAL logins.
// Reused from the local credentials file when present so logins stay stable
// and re-running the seed produces the same accounts. The file lives OUTSIDE
// the repo, is written 0600, and passwords are NEVER printed to stdout.
function ensurePrincipalPasswords() {
  const creds = {};
  try {
    if (fs.existsSync(BETA_CREDS_PATH)) {
      const txt = fs.readFileSync(BETA_CREDS_PATH, 'utf8');
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([\w.+-]+@example\.test)\s*[:=]\s*(\S+)\s*$/);
        if (m) creds[m[1]] = m[2];
      }
    }
  } catch (e) {
    console.warn(`  ! could not read existing credentials file: ${e.message}`);
  }
  const genPw = () => crypto.randomBytes(18).toString('base64url'); // ~24 chars
  if (!creds[BETA_MEMBER_EMAIL]) creds[BETA_MEMBER_EMAIL] = genPw();
  if (!creds[BETA_PRACTITIONER_EMAIL]) creds[BETA_PRACTITIONER_EMAIL] = genPw();

  const body =
    'Solaris Beta V1 — investor demo principal credentials (SYNTHETIC, rotate after recording)\n' +
    'Environment: https://solaris-beta-demo.abacusai.cloud\n' +
    `Generated / last confirmed: ${new Date().toISOString()}\n` +
    '\n' +
    `MEMBER        ${BETA_MEMBER_EMAIL} : ${creds[BETA_MEMBER_EMAIL]}\n` +
    `PRACTITIONER  ${BETA_PRACTITIONER_EMAIL} : ${creds[BETA_PRACTITIONER_EMAIL]}\n` +
    '\n' +
    'Supporting members use the shared demo password: demo123\n';
  try {
    fs.writeFileSync(BETA_CREDS_PATH, body, { mode: 0o600 });
    fs.chmodSync(BETA_CREDS_PATH, 0o600);
  } catch (e) {
    console.warn(`  ! could not write credentials file: ${e.message}`);
  }
  return creds;
}

// Upsert a fixture user on the transaction client. Keeps the id stable across
// runs (upsert by email). password_hash is only overwritten when provided
// (principals); supporting members keep the shared demo password.
async function betaUpsertUser(client, email, opts, passwordHash) {
  const {
    firstName = 'Member', lastName = '', role = 'patient', country = 'El Salvador',
    language = 'English', lovePoints = 0, onboardingStatus = 'complete', isProvider = false,
  } = opts;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
  const existing = await client.query('SELECT id FROM users WHERE email=$1', [email]);
  if (existing.rows.length) {
    const id = existing.rows[0].id;
    await client.query(
      `UPDATE users SET first_name=$1, last_name=$2, full_name=$3, role=$4, country=$5, language=$6,
         love_points=$7, onboarding_status=$8, is_provider=$9,
         provider_approved_at = CASE WHEN $9 THEN COALESCE(provider_approved_at, NOW()) ELSE provider_approved_at END,
         password_hash = COALESCE($10, password_hash), updated_at=NOW()
       WHERE id=$11`,
      [firstName, lastName, fullName, role, country, language, lovePoints, onboardingStatus, isProvider, passwordHash, id]
    );
    return id;
  }
  const ph = passwordHash || (await bcrypt.hash(DEMO_PASSWORD, 10));
  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, first_name, last_name, role, country, language,
       onboarding_status, love_points, is_provider, provider_approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CASE WHEN $11 THEN NOW() ELSE NULL END)
     RETURNING id`,
    [email, ph, fullName, firstName, lastName, role, country, language, onboardingStatus, lovePoints, isProvider]
  );
  return rows[0].id;
}

// Clear a fixture member's generated activity (namespaced to this user id only).
async function betaClearMember(client, userId) {
  const tables = [
    'daily_checkins', 'journal_entries', 'user_audio', 'habit_ticks', 'member_habits',
    'reward_events', 'member_journeys', 'assessment_responses', 'notifications',
  ];
  for (const t of tables) {
    await client.query(`DELETE FROM ${t} WHERE user_id=$1`, [userId]).catch((e) => {
      console.warn(`  ! could not clear ${t} for fixture user: ${e.message}`);
    });
  }
}

async function betaSeedCheckins(client, userId, days) {
  for (let i = days - 1; i >= 0; i--) {
    const progress = (days - 1 - i) / (days - 1);
    const energy = Math.min(100, rand(52, 66) + Math.round(progress * 22) + rand(-4, 4));
    const mood = Math.min(100, rand(55, 68) + Math.round(progress * 20) + rand(-4, 4));
    const sleep = randf(6.2 + progress * 1.0, 7.4 + progress * 0.8, 1);
    const hydration = rand(4, 8);
    const movement = rand(10, 45) + Math.round(progress * 15);
    const mind = Math.min(100, rand(54, 66) + Math.round(progress * 20) + rand(-4, 4));
    const body = Math.min(100, rand(52, 64) + Math.round(progress * 22) + rand(-4, 4));
    const heart = Math.min(100, rand(56, 68) + Math.round(progress * 18) + rand(-4, 4));
    const spirit = Math.min(100, rand(50, 62) + Math.round(progress * 24) + rand(-4, 4));
    const dt = daysAgo(i);
    await client.query(
      `INSERT INTO daily_checkins
         (user_id, checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes,
          mind_score, body_score, heart_score, spirit_score, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [userId, dt.toISOString().slice(0, 10), energy, mood, sleep, hydration, movement,
       mind, body, heart, spirit, null, dt]
    );
  }
}

async function betaAssessment(client, userId, focus, opts = {}) {
  const {
    vitality = 68, mental = 71, emotional = 66, physical = 62, spiritual = 70, raw = 64,
    headline = 'A strong foundation with room to restore energy and calm.',
  } = opts;
  const dt = daysAgo(29);
  await client.query(
    `INSERT INTO assessment_responses
       (user_id, started_at, completed_at, raw_score, vitality_score, mental_score, emotional_score, physical_score, spiritual_score, summary_json, top_focus_areas_json, created_at)
     VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$2)`,
    [userId, dt, raw, vitality, mental, emotional, physical, spiritual,
     JSON.stringify({ headline }), JSON.stringify(focus)]
  );
}

async function betaJournal(client, userId, entries) {
  for (const e of entries) {
    const dt = daysAgo(e.daysBack);
    await client.query(
      `INSERT INTO journal_entries (user_id, mood, content, created_at) VALUES ($1,$2,$3,$4)`,
      [userId, e.mood, e.content, dt]
    );
  }
}

async function betaHabits(client, userId, habits) {
  for (const h of habits) {
    const created = daysAgo(h.days || 14);
    const { rows } = await client.query(
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
        await client.query(
          `INSERT INTO habit_ticks (user_id, habit_id, tick_date, created_at) VALUES ($1,$2,$3,$4)`,
          [userId, habitId, dt.toISOString().slice(0, 10), dt]
        );
      }
    }
  }
}

async function betaJourney(client, userId, journeyType, { daysAgo: dAgo = 0, milestones = [] } = {}) {
  const started = new Date();
  started.setDate(started.getDate() - dAgo);
  const json = milestones.map((key) => ({ key, completed: true, completed_at: started.toISOString() }));
  await client.query(
    `INSERT INTO member_journeys (user_id, journey_type, status, started_at, milestones_json)
     VALUES ($1,$2,'active',$3,$4)
     ON CONFLICT (user_id, journey_type)
     DO UPDATE SET status='active', started_at=EXCLUDED.started_at, milestones_json=EXCLUDED.milestones_json`,
    [userId, journeyType, started, JSON.stringify(json)]
  );
}

async function betaNotification(client, userId, { type, title, message, data = null, daysAgo: dAgo = 0, read = false }) {
  const created = new Date();
  created.setDate(created.getDate() - dAgo);
  await client.query(
    `INSERT INTO notifications (user_id, type, title, message, data, read, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [userId, type, title, message, data ? JSON.stringify(data) : null, read, created]
  );
}

// Insert a marketplace booking (member ↔ practitioner). Times are chosen per
// call so fixtures never overlap on the same provider/day.
async function betaInsertBooking(client, opts) {
  const {
    patientId, providerId, serviceId, price = 0, currency = 'USD',
    dayOffset, startHour, durationMin = 60, status, cancellationReason = null,
    patientNotes = null,
  } = opts;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  const bookingDate = date.toISOString().slice(0, 10);
  const start = `${String(startHour).padStart(2, '0')}:00:00`;
  const endHourTotal = startHour * 60 + durationMin;
  const end = `${String(Math.floor(endHourTotal / 60)).padStart(2, '0')}:${String(endHourTotal % 60).padStart(2, '0')}:00`;

  // Coherent timestamps for the lifecycle.
  const createdAt = new Date(date);
  createdAt.setDate(createdAt.getDate() - 3);
  const confirmedAt = ['confirmed', 'completed'].includes(status)
    ? new Date(createdAt.getTime() + 3600 * 1000) : null;
  const completedAt = status === 'completed' ? new Date(date.getTime() + endHourTotal * 60 * 1000) : null;
  const cancelledAt = status === 'cancelled' ? new Date(createdAt.getTime() + 7200 * 1000) : null;

  const { rows } = await client.query(
    `INSERT INTO bookings
       (patient_id, provider_id, service_id, booking_date, start_time, end_time, status,
        total_price, platform_fee, provider_payout, currency, patient_notes, cancellation_reason,
        confirmed_at, completed_at, cancelled_at, payment_status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,$9,$10,$11,$12,$13,$14,'unpaid',$15,NOW())
     RETURNING id`,
    [patientId, providerId, serviceId, bookingDate, start, end, status,
     price, currency, patientNotes, cancellationReason, confirmedAt, completedAt, cancelledAt, createdAt]
  );
  const bookingId = rows[0].id;
  // One status-history row reflecting the final state (cascades on booking delete).
  await client.query(
    `INSERT INTO booking_status_history (booking_id, status, changed_by, reason, created_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [bookingId, status, patientId, cancellationReason, createdAt]
  );
  return bookingId;
}

const BETA_MARIA_JOURNAL = [
  { daysBack: 2, mood: 'good', content: "Kept up my morning walk three days running now. Small, but it's the first routine that's actually stuck this year." },
  { daysBack: 6, mood: 'okay', content: "Busy stretch at work. Used the breathing practice between calls and it genuinely took the edge off. Noting it so I remember it works." },
  { daysBack: 12, mood: 'great', content: "Slept a full night for the first time in ages and the difference in my energy is night and day. Excited to keep building on this." },
];

// Insert one synthetic catalog provider (owner user + profile + services +
// weekly availability). Namespaced + idempotent: the owner is upserted by a
// stable email and its provider_profiles row is deleted (cascading services /
// availability) before re-insert, so re-running yields identical counts.
async function betaInsertCatalogProvider(client, prov) {
  const email = `${prov.key}.provider@example.test`;
  const ownerLanguage = prov.languages.includes('English') && !prov.languages.includes('Spanish')
    ? 'English' : 'Spanish';
  const ownerId = await betaUpsertUser(client, email, {
    firstName: prov.firstName, lastName: prov.lastName, role: 'practitioner',
    country: prov.country, language: ownerLanguage, lovePoints: 0,
    onboardingStatus: 'complete', isProvider: true,
  });
  // Detach non-cascading FK refs (recommendations) before dropping the profile.
  await client.query(
    'UPDATE recommendations SET linked_provider_id=NULL WHERE linked_provider_id IN (SELECT id FROM provider_profiles WHERE user_id=$1)',
    [ownerId]
  );
  await client.query('DELETE FROM provider_profiles WHERE user_id=$1', [ownerId]);

  const meta = { meta: { languages: prov.languages, modality: prov.modality, licensed: prov.licensed, days: prov.days } };
  const { rows } = await client.query(
    `INSERT INTO provider_profiles
       (user_id, provider_type, business_name, description, address, city, country,
        latitude, longitude, phone, email, hours_of_operation, specialties, price_range,
        rating, review_count, verified, vtv_certified, featured, status, claimed,
        approval_status, hidden, auto_confirm_bookings, booking_buffer_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
             'active',true,'approved',false,false,15)
     RETURNING id`,
    [ownerId, prov.type, prov.business, prov.description, prov.address, prov.city, prov.country,
     prov.lat, prov.lng, prov.phone, email, JSON.stringify(meta), JSON.stringify(prov.specialties),
     prov.priceRange, prov.rating, prov.reviewCount, prov.verified, prov.vtv, prov.featured]
  );
  const profileId = rows[0].id;

  for (const s of prov.services) {
    await client.query(
      `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
       VALUES ($1,$2,$3,$4,'USD',$5,$6)`,
      [profileId, s.name, s.description, s.price, s.duration, s.category]
    );
  }
  for (const dow of prov.days) {
    await client.query(
      `INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time, is_available)
       VALUES ($1,$2,'09:00:00','17:00:00',true)`,
      [profileId, dow]
    );
  }
  return profileId;
}

async function seedBetaScenario() {
  // ---- GUARD: never run against production, and require explicit opt-in. ----
  const { rows: dbRows } = await db.query('SELECT current_database() AS db');
  const dbName = dbRows[0] && dbRows[0].db;
  if (dbName === 'luca_passport') {
    throw new Error(`Refusing to seed: target database is '${dbName}' (production). The beta demo seed only runs against the synthetic beta-demo database.`);
  }
  if (!process.env.ALLOW_BETA_DEMO_SEED) {
    throw new Error('Refusing to seed: set ALLOW_BETA_DEMO_SEED=1 to run the beta demo scenario (safety guard).');
  }
  console.log(`✓ safety guard passed (database='${dbName}', ALLOW_BETA_DEMO_SEED set)`);

  const creds = ensurePrincipalPasswords();
  const memberPwHash = await bcrypt.hash(creds[BETA_MEMBER_EMAIL], 10);
  const practitionerPwHash = await bcrypt.hash(creds[BETA_PRACTITIONER_EMAIL], 10);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // --- Practitioner principal: Dr. Mateo Reyes (member + approved provider) ---
    const reyesId = await betaUpsertUser(client, BETA_PRACTITIONER_EMAIL, {
      firstName: 'Mateo', lastName: 'Reyes', role: 'practitioner', country: 'El Salvador',
      lovePoints: 80, onboardingStatus: 'complete', isProvider: true,
    }, practitionerPwHash);

    // Idempotent: drop the practitioner's provider_profiles row — this cascades
    // to provider_services, provider_availability, provider_time_slots and ALL
    // fixture bookings (bookings.provider_id ON DELETE CASCADE), so re-running
    // yields identical counts with no orphans.
    await client.query(
      'UPDATE recommendations SET linked_provider_id=NULL WHERE linked_provider_id IN (SELECT id FROM provider_profiles WHERE user_id=$1)',
      [reyesId]
    );
    await client.query('DELETE FROM provider_profiles WHERE user_id=$1', [reyesId]);

    const profRes = await client.query(
      `INSERT INTO provider_profiles
         (user_id, provider_type, business_name, description, address, city, country,
          latitude, longitude, phone, email, hours_of_operation, specialties, price_range,
          rating, review_count, verified, vtv_certified,
          featured, status, claimed, approval_status, hidden, auto_confirm_bookings, booking_buffer_minutes)
       VALUES ($1,'doctor',$2,$3,$4,$5,'El Salvador',$6,$7,$8,$9,$10,$11,'$$',4.9,27,true,true,true,
               'active',true,'approved',false,false,15)
       RETURNING id`,
      [
        reyesId,
        'Dr. Mateo Reyes — Integrative Wellness',
        'Root-cause, whole-person care blending functional medicine with nervous-system and lifestyle work. Helping members calm stress, restore sleep, and rebuild lasting vitality.',
        'Calle La Reforma 123, Colonia San Benito',
        'San Salvador',
        13.6929, -89.2182,
        '+503 2200 1234',
        BETA_PRACTITIONER_EMAIL,
        JSON.stringify({ meta: { languages: ['Spanish', 'English'], modality: 'hybrid', licensed: true, days: [1, 2, 3, 4, 5] } }),
        JSON.stringify(['Stress & Anxiety', 'Sleep', 'Optimal Health', 'Energy & Vitality']),
      ]
    );
    const profileId = profRes.rows[0].id;

    // Two bookable services.
    const svcConsult = (await client.query(
      `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
       VALUES ($1,$2,$3,$4,'USD',$5,$6) RETURNING id`,
      [profileId, 'Integrative Wellness Consultation',
       'A comprehensive 60-minute session to map your stress, sleep and energy and build a personalised plan.',
       120, 60, 'Consultation']
    )).rows[0].id;
    const svcFollowUp = (await client.query(
      `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
       VALUES ($1,$2,$3,$4,'USD',$5,$6) RETURNING id`,
      [profileId, 'Follow-up Session',
       'A focused 30-minute check-in to review progress and adjust your plan.',
       75, 30, 'Follow-up']
    )).rows[0].id;

    // Weekly availability: Mon–Fri, 09:00–17:00.
    for (let dow = 1; dow <= 5; dow++) {
      await client.query(
        `INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1,$2,'09:00:00','17:00:00',true)`,
        [profileId, dow]
      );
    }

    // The practitioner is also a member: give his own member view a little life.
    await betaClearMember(client, reyesId);
    await betaAssessment(client, reyesId, ['Optimal Health', 'Energy & Vitality'],
      { vitality: 78, mental: 80, emotional: 74, physical: 76, spiritual: 79, raw: 77,
        headline: 'Thriving and steady — modelling the balance he coaches.' });
    await betaSeedCheckins(client, reyesId, 10);
    await betaNotification(client, reyesId, {
      type: 'welcome', title: 'Welcome to your practitioner portal',
      message: 'Your provider profile is live in the marketplace. New booking requests will appear here for you to confirm or decline.',
      data: { tab: 'provider' }, daysAgo: 2, read: false,
    });

    // --- Member principal: Maria Elena Campos ---
    const mariaId = await betaUpsertUser(client, BETA_MEMBER_EMAIL, {
      firstName: 'Maria', lastName: 'Campos', role: 'patient', country: 'El Salvador',
      lovePoints: 140, onboardingStatus: 'complete', isProvider: false,
    }, memberPwHash);
    await betaClearMember(client, mariaId);
    await betaAssessment(client, mariaId, ['Stress & Anxiety', 'Sleep', 'Optimal Health'],
      { vitality: 70, mental: 66, emotional: 64, physical: 72, spiritual: 68, raw: 68,
        headline: 'Capable and motivated, with a clear invitation to protect sleep and soften stress.' });
    await betaSeedCheckins(client, mariaId, 14);
    await betaJournal(client, mariaId, BETA_MARIA_JOURNAL);
    await betaHabits(client, mariaId, [
      { name: 'Morning walk', icon: '🚶', completionRate: 0.8, days: 14 },
      { name: 'Evening wind-down', icon: '🌙', completionRate: 0.6, days: 14 },
    ]);
    await betaJourney(client, mariaId, 'optimal_health', { daysAgo: 14, milestones: ['intake', 'streak7'] });
    await betaNotification(client, mariaId, {
      type: 'welcome', title: 'Your Optimal Health journey is underway',
      message: "Beautiful start, Maria — you've completed your intake and a check-in streak. Your next milestone is your first practitioner session.",
      data: { tab: 'dashboard' }, daysAgo: 10, read: true,
    });
    await betaNotification(client, mariaId, {
      type: 'tip', title: 'A tip for steadier sleep',
      message: 'Try the evening wind-down practice tonight — a few minutes of slow breathing before bed can make tomorrow feel very different.',
      data: { tab: 'dashboard' }, daysAgo: 3, read: false,
    });

    // Maria's booking history with Dr. Reyes: exactly one completed, one
    // cancelled, one confirmed-upcoming. She adds a fresh request via the UI.
    await betaInsertBooking(client, {
      patientId: mariaId, providerId: profileId, serviceId: svcConsult, price: 120,
      dayOffset: -18, startHour: 10, durationMin: 60, status: 'completed',
      patientNotes: "Looking forward to getting started on my stress and sleep.",
    });
    await betaInsertBooking(client, {
      patientId: mariaId, providerId: profileId, serviceId: svcFollowUp, price: 75,
      dayOffset: -8, startHour: 11, durationMin: 30, status: 'cancelled',
      cancellationReason: 'Schedule conflict — rebooked for a later date.',
    });
    await betaInsertBooking(client, {
      patientId: mariaId, providerId: profileId, serviceId: svcFollowUp, price: 75,
      dayOffset: 5, startHour: 10, durationMin: 30, status: 'confirmed',
      patientNotes: "Checking in on how the new routine is going.",
    });

    // --- Supporting members + a spread of booking states for the roster ---
    const supporting = {};
    for (const s of BETA_SUPPORTING) {
      const uid = await betaUpsertUser(client, s.email, {
        firstName: s.firstName, lastName: s.lastName, role: 'patient', country: 'El Salvador',
        lovePoints: rand(20, 90), onboardingStatus: 'complete', isProvider: false,
      });
      await betaClearMember(client, uid);
      await betaAssessment(client, uid, ['Optimal Health', 'Energy & Vitality']);
      await betaSeedCheckins(client, uid, 7);
      supporting[s.email] = uid;
    }
    // carlos → confirmed upcoming; lucia → completed; diego → pending (gives the
    // practitioner an existing incoming request); ana → cancelled; pablo → completed.
    await betaInsertBooking(client, { patientId: supporting['carlos.demo@example.test'], providerId: profileId, serviceId: svcConsult, price: 120, dayOffset: 3, startHour: 14, durationMin: 60, status: 'confirmed' });
    await betaInsertBooking(client, { patientId: supporting['lucia.demo@example.test'], providerId: profileId, serviceId: svcConsult, price: 120, dayOffset: -20, startHour: 9, durationMin: 60, status: 'completed' });
    await betaInsertBooking(client, { patientId: supporting['diego.demo@example.test'], providerId: profileId, serviceId: svcFollowUp, price: 75, dayOffset: 6, startHour: 15, durationMin: 30, status: 'pending', patientNotes: 'First time booking — would love some guidance on energy levels.' });
    await betaInsertBooking(client, { patientId: supporting['ana.demo@example.test'], providerId: profileId, serviceId: svcFollowUp, price: 75, dayOffset: -15, startHour: 13, durationMin: 30, status: 'cancelled', cancellationReason: 'Unable to attend — will rebook.' });
    await betaInsertBooking(client, { patientId: supporting['pablo.demo@example.test'], providerId: profileId, serviceId: svcConsult, price: 120, dayOffset: -25, startHour: 16, durationMin: 60, status: 'completed' });

    // --- InvestorDemoV1 marketplace catalog (fictional practitioner directory) ---
    // Adds the breadth the marketplace + map showcase: many specialties/wellness
    // categories, several public cities, EN/ES, virtual/in-person/hybrid, licensed
    // vs wellness, varied prices and availability. Each is fully synthetic and
    // namespaced; none is a principal login.
    for (const prov of INVESTOR_PROVIDERS) {
      await betaInsertCatalogProvider(client, prov);
    }

    await client.query('COMMIT');
    console.log('✓ beta scenario committed');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // ---- Verification counts (read-only, after commit) ----
  const counts = {};
  counts.fixture_users = (await db.query('SELECT COUNT(*)::int c FROM users WHERE email = ANY($1)', [BETA_ALL_EMAILS])).rows[0].c;
  counts.provider_profiles = (await db.query('SELECT COUNT(*)::int c FROM provider_profiles WHERE user_id = (SELECT id FROM users WHERE email=$1)', [BETA_PRACTITIONER_EMAIL])).rows[0].c;
  counts.provider_services = (await db.query('SELECT COUNT(*)::int c FROM provider_services WHERE provider_id = (SELECT id FROM provider_profiles WHERE user_id=(SELECT id FROM users WHERE email=$1))', [BETA_PRACTITIONER_EMAIL])).rows[0].c;
  counts.provider_availability = (await db.query('SELECT COUNT(*)::int c FROM provider_availability WHERE provider_id = (SELECT id FROM provider_profiles WHERE user_id=(SELECT id FROM users WHERE email=$1))', [BETA_PRACTITIONER_EMAIL])).rows[0].c;
  counts.bookings = (await db.query('SELECT COUNT(*)::int c FROM bookings WHERE provider_id = (SELECT id FROM provider_profiles WHERE user_id=(SELECT id FROM users WHERE email=$1))', [BETA_PRACTITIONER_EMAIL])).rows[0].c;
  counts.notifications = (await db.query('SELECT COUNT(*)::int c FROM notifications WHERE user_id = ANY(SELECT id FROM users WHERE email = ANY($1))', [BETA_ALL_EMAILS])).rows[0].c;

  // Marketplace breadth across the whole InvestorDemoV1 fixture (principal + catalog).
  const allProviderEmails = [BETA_PRACTITIONER_EMAIL, ...INVESTOR_PROVIDER_EMAILS];
  counts.marketplace_providers = (await db.query(
    "SELECT COUNT(*)::int c FROM provider_profiles WHERE status='active' AND hidden=false AND user_id = ANY(SELECT id FROM users WHERE email = ANY($1))",
    [allProviderEmails])).rows[0].c;
  counts.provider_types = (await db.query(
    'SELECT COUNT(DISTINCT provider_type)::int c FROM provider_profiles WHERE user_id = ANY(SELECT id FROM users WHERE email = ANY($1))',
    [allProviderEmails])).rows[0].c;
  counts.cities = (await db.query(
    'SELECT COUNT(DISTINCT city)::int c FROM provider_profiles WHERE user_id = ANY(SELECT id FROM users WHERE email = ANY($1))',
    [allProviderEmails])).rows[0].c;
  counts.catalog_services = (await db.query(
    'SELECT COUNT(*)::int c FROM provider_services WHERE provider_id = ANY(SELECT id FROM provider_profiles WHERE user_id = ANY(SELECT id FROM users WHERE email = ANY($1)))',
    [allProviderEmails])).rows[0].c;
  const specialtyRows = (await db.query(
    'SELECT specialties FROM provider_profiles WHERE user_id = ANY(SELECT id FROM users WHERE email = ANY($1))',
    [allProviderEmails])).rows;
  const specialtySet = new Set();
  for (const r of specialtyRows) {
    const arr = Array.isArray(r.specialties) ? r.specialties : (r.specialties ? JSON.parse(r.specialties) : []);
    for (const s of arr) specialtySet.add(s);
  }
  counts.distinct_specialties = specialtySet.size;
  console.log('✓ InvestorDemoV1 fixture counts:', JSON.stringify(counts));
  console.log('✓ Specialties/wellness categories:', JSON.stringify([...specialtySet].sort()));
  console.log(`✓ Principal credentials written to ${BETA_CREDS_PATH} (0600, not printed here).`);
  console.log('✓ Member principal:', BETA_MEMBER_EMAIL, '| Practitioner principal:', BETA_PRACTITIONER_EMAIL);
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
  // --beta: run ONLY the guarded, self-contained Solaris Beta V1 investor
  // scenario (marketplace booking loop). It never touches the legacy showcase
  // seeders and requires the ALLOW_BETA_DEMO_SEED safety flag.
  if (BETA) {
    console.log('Seeding Solaris Beta V1 investor scenario…');
    await seedBetaScenario();
    console.log('Done.');
    return;
  }
  // Ensure the system intake templates exist before seeding any intake demo data.
  try {
    await seedIntakeTemplates(db);
    console.log('✓ intake form templates seeded');
  } catch (e) {
    console.warn(`! intake templates seed skipped: ${e.message}`);
  }
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

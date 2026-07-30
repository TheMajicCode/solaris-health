/**
 * SOLARIS HOLISTIC HEALTH — Seed Script
 * Seeds: demo users (patient/practitioner/admin), assessment template (4 aspects + 8 systems),
 * marketplace listings (practitioners/clinics/services/workshops), and a sample assessment result.
 */
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const SYSTEMS = [
  { key: 'bioelectrical', name: 'Bioelectrical', q: 'How energized and "switched on" does your body feel day to day?', low: 'Drained', high: 'Electric' },
  { key: 'hydration', name: 'Hydration', q: 'How well-hydrated and supple do you feel throughout the day?', low: 'Parched', high: 'Hydrated' },
  { key: 'circadian', name: 'Circadian Rhythm', q: 'How aligned is your sleep-wake rhythm with the sun?', low: 'Disrupted', high: 'In sync' },
  { key: 'microbiome', name: 'Microbiome', q: 'How comfortable and regular is your digestion?', low: 'Unsettled', high: 'Balanced' },
  { key: 'respiratory', name: 'Respiratory', q: 'How full and easy is your breathing?', low: 'Shallow', high: 'Deep' },
  { key: 'neurological', name: 'Neurological', q: 'How clear, calm, and focused does your mind feel?', low: 'Foggy', high: 'Sharp' },
  { key: 'cardiovascular', name: 'Cardiovascular', q: 'How strong and steady does your heart and circulation feel?', low: 'Sluggish', high: 'Strong' },
  { key: 'nutritional', name: 'Nutritional', q: 'How nourished and well-fueled does your body feel?', low: 'Depleted', high: 'Nourished' },
];

const ASPECTS = [
  { key: 'physical', name: 'Physical Health', q: 'Your energy levels, movement, and how your body feels throughout the day.', low: 'Restless', high: 'Vibrant' },
  { key: 'mental', name: 'Mental Health', q: 'Your focus, memory, and cognitive load. How "quiet" is your mind today?', low: 'Foggy', high: 'Sharp' },
  { key: 'emotional', name: 'Emotional Health', q: 'Resilience to stress, your sense of joy, and how you process feelings.', low: 'Heaviness', high: 'Buoyant' },
  { key: 'spiritual', name: 'Spiritual Health', q: 'A sense of purpose, connection to something larger, and inner peace.', low: 'Disconnected', high: 'Fulfilled' },
];

const PRACTITIONERS = [
  { title: 'Dr. Elena Marquez', specialty: 'Holistic Dentistry', city: 'San Salvador', focus: ['oral-systemic health', 'smile restoration'], systems: ['microbiome', 'nutritional'], rating: 4.9, reviews: 124, price: 90, featured: true, img: 'https://southbayprosthodontics.com/x/lc-content/uploads/2024/09/Untitled-design-3.png' },
  { title: 'Dr. Rafael Torres', specialty: 'Functional Medicine', city: 'Santa Tecla', focus: ['fatigue', 'gut health', 'inflammation'], systems: ['microbiome', 'bioelectrical', 'nutritional'], rating: 4.8, reviews: 98, price: 140 },
  { title: 'Sofia Vega', specialty: 'Nutritionist', city: 'San Salvador', focus: ['metabolic reset', 'meal structure'], systems: ['nutritional', 'hydration'], rating: 4.7, reviews: 76, price: 70 },
  { title: 'Mateo Cruz', specialty: 'Chiropractor', city: 'Antiguo Cuscatlán', focus: ['posture', 'pain', 'recovery'], systems: ['cardiovascular', 'bioelectrical'], rating: 4.6, reviews: 64, price: 80 },
  { title: 'Isabella Romero', specialty: 'Breathwork & Nervous System Guide', city: 'El Tunco', focus: ['stress', 'sleep', 'resilience'], systems: ['respiratory', 'neurological', 'circadian'], rating: 4.9, reviews: 142, price: 60, featured: true },
  { title: 'Karla Benítez', specialty: 'Massage Therapist', city: 'San Benito', focus: ['tension relief', 'lymphatic support'], systems: ['cardiovascular', 'respiratory'], rating: 4.8, reviews: 88, price: 75 },
  { title: 'Daniel Herrera', specialty: 'Therapist / Coach', city: 'Virtual', focus: ['emotional health', 'purpose', 'burnout'], systems: ['neurological'], rating: 4.7, reviews: 53, price: 110 },
  { title: 'Dr. Lucia Campos', specialty: 'Integrative Medicine', city: 'San Salvador', focus: ['prevention', "women's wellness", 'root-cause'], systems: ['cardiovascular', 'nutritional', 'circadian'], rating: 4.9, reviews: 115, price: 130 },
];

const CLINICS = [
  { title: 'Aura Holistic Dental Clinic', type: 'clinic', node: 'care_node', city: 'San Salvador', desc: 'A serene, international-ready clinic blending oral-systemic dentistry with whole-body wellness.', rating: 4.9, reviews: 124, featured: true },
  { title: 'Solaris Functional Health Center', type: 'clinic', node: 'care_node', city: 'Santa Tecla', desc: 'Root-cause functional medicine, advanced diagnostics, and personalized protocols.', rating: 4.8, reviews: 87 },
  { title: 'Casa Respiro Recovery Studio', type: 'place', node: 'place_node', city: 'El Tunco', desc: 'A coastal sanctuary for breathwork, recovery, and nervous-system reset.', rating: 4.9, reviews: 64 },
  { title: 'Vital Lab Diagnostics', type: 'diagnostics', node: 'diagnostics_node', city: 'San Salvador', desc: 'Comprehensive lab panels and imaging with same-week results.', rating: 4.7, reviews: 41 },
];

const SERVICES = [
  { title: 'Holistic Dental Consultation', price: 90, duration: 60, systems: ['microbiome'] },
  { title: 'Functional Medicine Intake', price: 140, duration: 90, systems: ['nutritional', 'microbiome'] },
  { title: 'Nutrition Reset Session', price: 70, duration: 60, systems: ['nutritional'] },
  { title: 'Chiropractic Alignment Session', price: 80, duration: 45, systems: ['cardiovascular'] },
  { title: 'Recovery Massage', price: 75, duration: 60, systems: ['cardiovascular', 'respiratory'] },
  { title: 'Breathwork Reset', price: 60, duration: 50, systems: ['respiratory', 'neurological'] },
  { title: 'Stress & Sleep Review', price: 65, duration: 45, systems: ['circadian', 'neurological'] },
  { title: 'Basic Lab Review', price: 50, duration: 30, systems: ['nutritional'] },
];

const WORKSHOPS = [
  { title: 'Nervous System Reset Evening', price: 45, systems: ['neurological', 'respiratory'], featured: true },
  { title: 'Better Sleep Foundations', price: 35, systems: ['circadian'] },
  { title: 'Oral Health & Whole Body Connection', price: 40, systems: ['microbiome'] },
  { title: 'Healing Habits for Busy Professionals', price: 50, systems: ['neurological', 'nutritional'] },
];

async function reset() {
  // Clear Solaris tables for idempotent re-seed (keep users we manage by email)
  await db.query('TRUNCATE assessment_answers, body_system_scores, aspect_scores, assessment_responses, assessment_questions, assessment_templates, recommendations, booking_requests, daily_checkins, documents, habit_plans, luca_messages RESTART IDENTITY CASCADE');
  // practitioner_profiles.listing_id references listings — detach before clearing,
  // otherwise the FK aborts the seed and leaves assessment templates empty.
  await db.query("UPDATE practitioner_profiles SET listing_id = NULL WHERE listing_id IS NOT NULL");
  await db.query("DELETE FROM listings");
}

async function seedUsers() {
  const mk = async (email, pw, role, first, last, status) => {
    const hash = await bcrypt.hash(pw, 10);
    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rows.length) {
      const r = await db.query(
        `UPDATE users SET password_hash=$1, role=$2, first_name=$3, last_name=$4, full_name=$5,
          onboarding_status=$6, current_phase='active', country='El Salvador', language='English' WHERE email=$7 RETURNING id`,
        [hash, role, first, last, `${first} ${last}`, status, email]);
      return r.rows[0].id;
    }
    const r = await db.query(
      `INSERT INTO users (email,password_hash,role,first_name,last_name,full_name,onboarding_status,current_phase,country,language,love_points)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active','El Salvador','English',135) RETURNING id`,
      [email, hash, role, first, last, `${first} ${last}`, status]);
    return r.rows[0].id;
  };
  const patient = await mk('sarah@solaris.health', 'demo123', 'patient', 'Sarah', 'Mitchell', 'complete');
  const majd = await mk('majd@luca.health', 'demo123', 'patient', 'Majd', 'Faiz', 'complete');
  const prac = await mk('elena@solaris.health', 'demo123', 'practitioner', 'Elena', 'Marquez', 'complete');
  const admin = await mk('admin@solaris.health', 'admin123', 'admin', 'Solaris', 'Admin', 'complete');
  return { patient, majd, prac, admin };
}

async function seedTemplate() {
  const t = await db.query(
    `INSERT INTO assessment_templates (name,version,status,description)
     VALUES ('The Solaris Method','v1','active','A 360° reflection across 4 Aspects of Being and 8 Body Systems.') RETURNING id`);
  const tid = t.rows[0].id;
  let order = 0;
  for (const a of ASPECTS) {
    await db.query(
      `INSERT INTO assessment_questions (template_id,section_key,aspect_key,question_text,low_label,high_label,question_type,sort_order)
       VALUES ($1,'aspects',$2,$3,$4,$5,'scale',$6)`,
      [tid, a.key, a.q, a.low, a.high, order++]);
  }
  for (const s of SYSTEMS) {
    await db.query(
      `INSERT INTO assessment_questions (template_id,section_key,system_key,question_text,low_label,high_label,question_type,sort_order)
       VALUES ($1,'systems',$2,$3,$4,$5,'scale',$6)`,
      [tid, s.key, s.q, s.low, s.high, order++]);
  }
  return tid;
}

async function seedListings(pracUserId) {
  const ins = async (o) => {
    await db.query(
      `INSERT INTO listings (listing_type,node_type,status,title,specialty,tagline,short_description,full_description,
        city,country,price,currency,duration_minutes,focus_areas_json,supports_systems_json,rating,reviews_count,
        trust_score,featured,booking_enabled,cover_image_url,owner_user_id)
       VALUES ($1,$2,'published',$3,$4,$5,$6,$7,$8,'El Salvador',$9,'USD',$10,$11,$12,$13,$14,$15,$16,true,$17,$18)`,
      [o.listing_type, o.node_type, o.title, o.specialty || null, o.tagline || null, o.short_description || null,
       o.full_description || null, o.city, o.price || null, o.duration || null,
       JSON.stringify(o.focus || []), JSON.stringify(o.systems || []), o.rating || 0, o.reviews || 0,
       o.trust || 70, o.featured || false, o.img || null, o.owner || null]);
  };
  let i = 0;
  for (const p of PRACTITIONERS) {
    await ins({
      listing_type: 'practitioner', node_type: 'practitioner_node', title: p.title, specialty: p.specialty,
      tagline: p.focus[0], short_description: `${p.specialty} focused on ${p.focus.join(', ')}.`,
      full_description: `${p.title} is a verified Solaris practitioner specializing in ${p.specialty}. Focus areas: ${p.focus.join(', ')}.`,
      city: p.city, price: p.price, duration: 60, focus: p.focus, systems: p.systems,
      rating: p.rating, reviews: p.reviews, trust: 80, featured: p.featured, img: p.img,
      owner: i === 0 ? pracUserId : null, // link Elena to practitioner account
    });
    i++;
  }
  for (const c of CLINICS) {
    await ins({ listing_type: c.type, node_type: c.node, title: c.title, tagline: 'Curated Solaris partner',
      short_description: c.desc, full_description: c.desc, city: c.city, rating: c.rating, reviews: c.reviews,
      trust: 85, featured: c.featured });
  }
  for (const s of SERVICES) {
    await ins({ listing_type: 'service', node_type: 'commerce_node', title: s.title, specialty: 'Service',
      short_description: `${s.title} — ${s.duration} min session.`, city: 'San Salvador', price: s.price,
      duration: s.duration, systems: s.systems, rating: 4.7, reviews: 20, trust: 75 });
  }
  for (const w of WORKSHOPS) {
    await ins({ listing_type: 'workshop', node_type: 'experience_node', title: w.title, specialty: 'Workshop',
      short_description: `${w.title} — a guided group experience.`, city: 'San Salvador', price: w.price,
      duration: 90, systems: w.systems, rating: 4.8, reviews: 30, trust: 78, featured: w.featured });
  }
}

async function seedSampleResult(userId, templateId) {
  // A realistic assessment for Sarah
  const aspects = { physical: 64, mental: 72, emotional: 58, spiritual: 80 };
  const systems = { bioelectrical: 70, hydration: 52, circadian: 48, microbiome: 66, respiratory: 74, neurological: 71, cardiovascular: 68, nutritional: 60 };
  const band = (s) => s >= 80 ? 'thriving' : s >= 60 ? 'balanced' : s >= 40 ? 'attention' : 'priority';
  const avg = (o) => Math.round(Object.values(o).reduce((a, b) => a + b, 0) / Object.values(o).length);
  const vitality = Math.round(avg(aspects) * 0.5 + avg(systems) * 0.5);
  const names = { bioelectrical: 'Bioelectrical', hydration: 'Hydration', circadian: 'Circadian Rhythm', microbiome: 'Microbiome', respiratory: 'Respiratory', neurological: 'Neurological', cardiovascular: 'Cardiovascular', nutritional: 'Nutritional', physical: 'Physical', mental: 'Mental', emotional: 'Emotional', spiritual: 'Spiritual' };
  const combined = [
    ...Object.entries(systems).map(([k, v]) => ({ key: k, name: names[k], score: v })),
    ...Object.entries(aspects).map(([k, v]) => ({ key: k, name: names[k], score: v })),
  ].sort((a, b) => a.score - b.score);
  const topFocus = combined.slice(0, 3);
  const summary = { headline: 'A solid foundation with clear growth areas', strengths: combined.slice(-2).map(c => c.name), focus: topFocus.map(c => c.name) };

  const r = await db.query(
    `INSERT INTO assessment_responses (user_id,template_id,completed_at,raw_score,vitality_score,mental_score,emotional_score,physical_score,spiritual_score,summary_json,top_focus_areas_json)
     VALUES ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [userId, templateId, vitality, vitality, aspects.mental, aspects.emotional, aspects.physical, aspects.spiritual, JSON.stringify(summary), JSON.stringify(topFocus)]);
  const rid = r.rows[0].id;
  for (const [k, v] of Object.entries(systems))
    await db.query('INSERT INTO body_system_scores (response_id,user_id,system_key,system_name,score,severity_band) VALUES ($1,$2,$3,$4,$5,$6)', [rid, userId, k, names[k], v, band(v)]);
  for (const [k, v] of Object.entries(aspects))
    await db.query('INSERT INTO aspect_scores (response_id,user_id,aspect_key,aspect_name,score) VALUES ($1,$2,$3,$4,$5)', [rid, userId, k, names[k], v]);

  // Recommendations
  const recs = [
    { type: 'habit', title: 'Get 10 minutes of morning sunlight within 30 min of waking', desc: 'Anchor your circadian rhythm.' },
    { type: 'habit', title: 'Increase water intake to 2.5L with morning minerals', desc: 'Support hydration across every system.' },
    { type: 'habit', title: 'Add a 10-minute screen-free wind-down each night', desc: 'Calm the nervous system before sleep.' },
  ];
  for (const rec of recs)
    await db.query('INSERT INTO recommendations (user_id,response_id,source_type,recommendation_type,title,description,priority) VALUES ($1,$2,$3,$4,$5,$6,1)', [userId, rid, 'rules', rec.type, rec.title, rec.desc]);
  const matched = await db.query("SELECT id,title,short_description,listing_type FROM listings WHERE listing_type IN ('practitioner','workshop') ORDER BY featured DESC LIMIT 2");
  for (const m of matched.rows)
    await db.query('INSERT INTO recommendations (user_id,response_id,source_type,recommendation_type,title,description,linked_listing_id,priority) VALUES ($1,$2,$3,$4,$5,$6,$7,2)', [userId, rid, 'rules', m.listing_type, m.title, m.short_description, m.id]);

  // a few check-ins
  for (let d = 6; d >= 0; d--) {
    await db.query(
      `INSERT INTO daily_checkins (user_id,checkin_date,energy_score,mood_score,sleep_hours,hydration_glasses,movement_minutes)
       VALUES ($1, CURRENT_DATE - $2::int, $3,$4,$5,$6,$7)`,
      [userId, d, 60 + Math.round(Math.random() * 30), 60 + Math.round(Math.random() * 30), 6 + Math.random() * 2, 4 + Math.round(Math.random() * 4), 20 + Math.round(Math.random() * 40)]);
  }
}

// --- Scoped reset for a single member (M2: `seed:reset -- --email=<email>`) ---
// Wipes ONLY that member's journey data (check-ins, chat, assessment result,
// recommendations, pending bookings, habit plans, docs) and reseeds a fresh
// sample result against the active template. Keeps the user row and every other
// member's data intact — safe to run against the live demo without a full wipe.
function parseEmailArg() {
  const arg = process.argv.find((a) => a.startsWith('--email='));
  return arg ? arg.split('=')[1].trim().toLowerCase() : null;
}

/**
 * seedGpsReceipts — GPS shadow-receipt demo data (spec A4 §3).
 *
 * Seeds 5 `gps-receipt/1.0` receipts for the primary demo member so the
 * Payments → "How your value flows" view is populated out of the box:
 *   • 3 SETTLED   (completed consultations, value routed)
 *   • 2 SCHEDULED (higher-value sessions, envelope held to completion)
 *
 * Money is SIMULATED (shadow mode) — allocations use the ratified v0.1 policy
 * (90% earned value / 10% envelope). Subject ids are looked up from
 * solaris_subjects at seed time (never hardcoded). Idempotent: prior demo rows
 * (idempotency_key 'seed-gps-demo-%') are removed first, so it is safe to
 * re-run. The payer is the demo member; the practitioner is the demo
 * practitioner (alejandro@solaris.health, falling back to elena@).
 */
async function seedGpsReceipts() {
  const { computeAllocations } = require('./src/lib/payments/allocation-policy');
  const { buildReceipt } = require('./src/lib/gps-shadow');
  const { POLICY_ID, POLICY_HASH } = require('./src/lib/payments/allocation-policy');

  // Payer = primary demo member; look up subject_id at seed time.
  const member = await db.query(
    `SELECT u.id AS user_id, s.subject_id, u.email
       FROM users u JOIN solaris_subjects s ON s.user_id = u.id
      WHERE lower(u.email) = 'sarah@solaris.health' LIMIT 1`
  );
  if (!member.rows.length) {
    console.warn('  (skip GPS seed: demo member sarah@solaris.health has no subject_id)');
    return 0;
  }
  const { user_id: payerUserId, subject_id: payerSubjectId } = member.rows[0];

  // Practitioner (for merchant labelling + provider_id) — alejandro, else elena.
  const prac = await db.query(
    `SELECT u.id AS user_id, pp.id AS profile_id, COALESCE(pp.business_name, u.full_name) AS label
       FROM users u
       LEFT JOIN provider_profiles pp ON pp.user_id = u.id
      WHERE lower(u.email) IN ('alejandro@solaris.health','elena@solaris.health')
      ORDER BY (lower(u.email) = 'alejandro@solaris.health') DESC LIMIT 1`
  );
  const providerProfileId = prac.rows[0]?.profile_id || null;
  const merchantLabel = prac.rows[0]?.label || 'Aura clinic';

  // Idempotent: clear prior demo receipts (cascades from payment_intents).
  await db.query("DELETE FROM payment_intents WHERE idempotency_key LIKE 'seed-gps-demo-%'");

  // 3 SETTLED (completed) + 2 SCHEDULED (envelope held). amount in cents.
  const ROWS = [
    { amount: 9000,  purpose: 'consultation', state: 'SETTLED',   daysAgo: 21 },
    { amount: 14000, purpose: 'consultation', state: 'SETTLED',   daysAgo: 14 },
    { amount: 7000,  purpose: 'consultation', state: 'SETTLED',   daysAgo: 7 },
    { amount: 60000, purpose: 'treatment',    state: 'SCHEDULED', daysAgo: 3 },
    { amount: 75000, purpose: 'membership',   state: 'SCHEDULED', daysAgo: 1 },
  ];

  let n = 0;
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const feeCents = Math.round(r.amount * 0.0265) + 30; // realistic Wompi-style fee
    const idem = `seed-gps-demo-${i + 1}`;

    const intentRes = await db.query(
      `INSERT INTO payment_intents
         (subject_id, user_id, provider_id, merchant_id, merchant_label,
          amount_cents, currency, purpose, status, provider, provider_ref,
          provider_fee_cents, idempotency_key, paid_at, created_at, observed_at)
       VALUES ($1,$2,$3,'aura-clinic',$4,$5,'USD',$6,'paid','wompi',$7,$8,$9,
               now() - ($10::int * interval '1 day'),
               now() - ($10::int * interval '1 day'),
               now() - ($10::int * interval '1 day'))
       RETURNING id, subject_id, amount_cents, currency, purpose, user_id`,
      [payerSubjectId, payerUserId, providerProfileId, merchantLabel, r.amount,
       r.purpose, `seed-gps-demo-ref-${i + 1}`, feeCents, idem, r.daysAgo]
    );
    const intent = intentRes.rows[0];

    const { legs, envelopeCents, earnedValueCents, envelopeBps } = computeAllocations(intent.amount_cents);
    const receipt = buildReceipt(intent, legs, feeCents);
    // Demo settlement realism: reflect the row's lifecycle state + confidence.
    receipt._meta.confidence_level = 4;
    receipt.settlement_summary = r.state === 'SETTLED'
      ? { settled_cents: intent.amount_cents, pending_cents: 0, simulated_cents: 0 }
      : { settled_cents: 0, pending_cents: intent.amount_cents, simulated_cents: 0 };

    await db.query(
      `INSERT INTO gps_shadow_receipts
         (receipt_id, receipt_version, intent_id, subject_id, user_id,
          policy_id, policy_hash, eligible_cents, earned_cents, envelope_cents,
          envelope_bps, settlement_state, receipt, level, source, consent_scope,
          created_at, observed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'L3-financial',$14,'payments',
               now() - ($15::int * interval '1 day'),
               now() - ($15::int * interval '1 day'))
       ON CONFLICT (receipt_id) DO NOTHING`,
      [receipt.receipt_id, receipt.receipt_version, intent.id, intent.subject_id, intent.user_id,
       POLICY_ID, POLICY_HASH, intent.amount_cents, earnedValueCents, envelopeCents,
       envelopeBps, r.state, receipt, POLICY_ID, r.daysAgo]
    );
    n += 1;
  }
  console.log(`✓ Seeded ${n} GPS shadow receipts (3 SETTLED + 2 SCHEDULED) for ${member.rows[0].email}.`);
  return n;
}

/**
 * seedAlejandroProfile — give the practitioner demo account alejandro@solaris.health
 * a real, bookable marketplace profile (spec: fill demo gaps).
 *
 * Without a provider_profiles row, alejandro never appears in Explore or LUCA's
 * "Curate for me" rail and the practitioner login has no profile to manage.
 * This upserts an `active`/`approved` integrative-nutrition profile plus 3
 * services and 3 weekly availability slots. Idempotent: any existing profile
 * (and its services/availability) is removed first, so re-runs are safe.
 */
async function seedAlejandroProfile() {
  const u = await db.query("SELECT id FROM users WHERE lower(email)='alejandro@solaris.health' LIMIT 1");
  if (!u.rows.length) { console.warn('  (skip alejandro profile: user not found)'); return 0; }
  const userId = u.rows[0].id;

  // Idempotent: remove any existing profile + its services/availability first.
  const existing = await db.query('SELECT id FROM provider_profiles WHERE user_id=$1', [userId]);
  for (const row of existing.rows) {
    await db.query('DELETE FROM provider_services WHERE provider_id=$1', [row.id]);
    await db.query('DELETE FROM provider_availability WHERE provider_id=$1', [row.id]);
  }
  await db.query('DELETE FROM provider_profiles WHERE user_id=$1', [userId]);

  const prof = await db.query(
    `INSERT INTO provider_profiles
       (user_id, provider_type, business_name, description, city, country,
        specialties, price_range, rating, review_count, verified, status,
        approval_status, hidden, auto_confirm_bookings, claimed, featured)
     VALUES ($1,'nutritionist',$2,$3,'San Salvador','El Salvador',
             $4,$5,$6,$7,true,'active','approved',false,true,true,true)
     RETURNING id`,
    [userId,
      'Alejandro Reyes — Nutrición Integrativa',
      'Integrative-medicine practitioner blending functional nutrition, metabolic health, and lifestyle medicine. Alejandro helps members restore energy, balance blood sugar, and build sustainable habits rooted in whole foods and circadian alignment.',
      JSON.stringify(['Integrative Medicine', 'Functional Nutrition', 'Metabolic Health']),
      '$60–$180', 4.8, 57]
  );
  const pid = prof.rows[0].id;

  const services = [
    ['Integrative Nutrition Intake', 'Comprehensive 90-minute root-cause intake covering diet, labs, sleep, and stress.', 120, 90, 'Consultation'],
    ['Metabolic Reset Program', '4-week personalized protocol to stabilize energy and blood sugar.', 180, 45, 'Program'],
    ['Follow-up Consultation', 'Progress review and protocol adjustment.', 60, 30, 'Consultation'],
  ];
  for (const s of services) {
    await db.query(
      `INSERT INTO provider_services (provider_id, service_name, description, price, currency, duration_minutes, category)
       VALUES ($1,$2,$3,$4,'USD',$5,$6)`,
      [pid, s[0], s[1], s[2], s[3], s[4]]
    );
  }
  // Availability: Mon / Wed / Fri, 09:00–17:00 (day_of_week 1,3,5).
  for (const dow of [1, 3, 5]) {
    await db.query(
      `INSERT INTO provider_availability (provider_id, day_of_week, start_time, end_time, is_available)
       VALUES ($1,$2,'09:00','17:00',true)`,
      [pid, dow]
    );
  }
  console.log('✓ Seeded practitioner profile for alejandro@solaris.health (3 services, 3 weekly slots).');
  return 1;
}

/**
 * seedSarahAssessment — populate assessment history for sarah@solaris.health so
 * the dashboard vitality-over-time trend renders a real line (spec: fill demo gaps).
 *
 * Sarah has exactly ONE assessment_response, so the trend chart has a single
 * point. This adds 3 historical snapshots (30/60/90 days back) trending gently
 * upward toward her current values, each with matching body_system_scores,
 * aspect_scores, and assessment_answers. It also backfills answers on her current
 * (real) response. Idempotent: seeded history is tagged summary_json._seed
 * 'sarah-history' and removed before re-inserting; the real response is untouched.
 */
async function seedSarahAssessment() {
  const u = await db.query("SELECT id FROM users WHERE lower(email)='sarah@solaris.health' LIMIT 1");
  if (!u.rows.length) { console.warn('  (skip sarah assessment: user not found)'); return 0; }
  const userId = u.rows[0].id;

  const tpl = await db.query("SELECT id FROM assessment_templates WHERE status='active' ORDER BY created_at DESC LIMIT 1");
  const templateId = tpl.rows[0]?.id || null;

  // Map system/aspect key -> question id for the answer rows.
  const qrows = await db.query('SELECT id, system_key, aspect_key FROM assessment_questions WHERE template_id=$1', [templateId]);
  const qBySystem = {}; const qByAspect = {};
  for (const q of qrows.rows) {
    if (q.system_key) qBySystem[q.system_key] = q.id;
    if (q.aspect_key) qByAspect[q.aspect_key] = q.id;
  }

  const SYS_NAMES = { bioelectrical: 'Bioelectrical', hydration: 'Hydration', circadian: 'Circadian Rhythm', microbiome: 'Microbiome', respiratory: 'Respiratory', neurological: 'Neurological', cardiovascular: 'Cardiovascular', nutritional: 'Nutritional' };
  const ASP_NAMES = { mental: 'Mental', emotional: 'Emotional', physical: 'Physical', spiritual: 'Spiritual' };
  const band = (s) => (s >= 80 ? 'thriving' : s >= 60 ? 'balanced' : s >= 40 ? 'attention' : 'priority');

  // Idempotent: remove previously seeded history (children first).
  const seeded = await db.query("SELECT id FROM assessment_responses WHERE user_id=$1 AND summary_json->>'_seed'='sarah-history'", [userId]);
  for (const r of seeded.rows) {
    await db.query('DELETE FROM assessment_answers WHERE response_id=$1', [r.id]);
    await db.query('DELETE FROM body_system_scores WHERE response_id=$1', [r.id]);
    await db.query('DELETE FROM aspect_scores WHERE response_id=$1', [r.id]);
    await db.query('DELETE FROM assessment_responses WHERE id=$1', [r.id]);
  }

  // Historical snapshots trending gently upward toward current values.
  const HISTORY = [
    { daysAgo: 90, aspects: { mental: 58, emotional: 45, physical: 52, spiritual: 68 }, systems: { bioelectrical: 58, hydration: 42, circadian: 40, microbiome: 56, respiratory: 64, neurological: 60, cardiovascular: 58, nutritional: 52 } },
    { daysAgo: 60, aspects: { mental: 63, emotional: 50, physical: 57, spiritual: 72 }, systems: { bioelectrical: 63, hydration: 46, circadian: 43, microbiome: 60, respiratory: 68, neurological: 64, cardiovascular: 62, nutritional: 55 } },
    { daysAgo: 30, aspects: { mental: 68, emotional: 54, physical: 60, spiritual: 76 }, systems: { bioelectrical: 67, hydration: 49, circadian: 45, microbiome: 63, respiratory: 71, neurological: 68, cardiovascular: 65, nutritional: 58 } },
  ];

  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  let n = 0;
  for (const h of HISTORY) {
    const vitality = Math.round(avg(Object.values(h.aspects)) * 0.5 + avg(Object.values(h.systems)) * 0.5);
    const combined = [
      ...Object.entries(h.systems).map(([k, v]) => ({ name: SYS_NAMES[k], score: v })),
      ...Object.entries(h.aspects).map(([k, v]) => ({ name: ASP_NAMES[k], score: v })),
    ].sort((a, b) => a.score - b.score);
    const topFocus = combined.slice(0, 3);
    const summary = {
      headline: vitality >= 70 ? 'You are thriving with room to optimize' : vitality >= 50 ? 'A solid foundation with clear growth areas' : 'Your body is asking for support — and that is okay',
      strengths: combined.slice(-2).map((c) => c.name),
      focus: topFocus.map((c) => c.name),
      _seed: 'sarah-history',
    };
    const resp = await db.query(
      `INSERT INTO assessment_responses
         (user_id, template_id, completed_at, created_at, raw_score, vitality_score, mental_score, emotional_score, physical_score, spiritual_score, summary_json, top_focus_areas_json)
       VALUES ($1,$2, now()-($3::int*interval '1 day'), now()-($3::int*interval '1 day'), $4::int,$4::int,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [userId, templateId, h.daysAgo, vitality, h.aspects.mental, h.aspects.emotional, h.aspects.physical, h.aspects.spiritual, JSON.stringify(summary), JSON.stringify(topFocus)]
    );
    const rid = resp.rows[0].id;
    for (const [k, v] of Object.entries(h.systems)) {
      await db.query('INSERT INTO body_system_scores (response_id,user_id,system_key,system_name,score,severity_band) VALUES ($1,$2,$3,$4,$5,$6)', [rid, userId, k, SYS_NAMES[k], v, band(v)]);
      if (qBySystem[k]) await db.query('INSERT INTO assessment_answers (response_id,question_id,system_key,answer_number,normalized_score) VALUES ($1,$2,$3,$4,$4)', [rid, qBySystem[k], k, v]);
    }
    for (const [k, v] of Object.entries(h.aspects)) {
      await db.query('INSERT INTO aspect_scores (response_id,user_id,aspect_key,aspect_name,score) VALUES ($1,$2,$3,$4,$5)', [rid, userId, k, ASP_NAMES[k], v]);
      if (qByAspect[k]) await db.query('INSERT INTO assessment_answers (response_id,question_id,aspect_key,answer_number,normalized_score) VALUES ($1,$2,$3,$4,$4)', [rid, qByAspect[k], k, v]);
    }
    n += 1;
  }

  // Backfill answers on the CURRENT (real) response so its answer log isn't empty.
  const cur = await db.query("SELECT id FROM assessment_responses WHERE user_id=$1 AND (summary_json->>'_seed') IS DISTINCT FROM 'sarah-history' ORDER BY created_at DESC LIMIT 1", [userId]);
  if (cur.rows.length) {
    const rid = cur.rows[0].id;
    await db.query('DELETE FROM assessment_answers WHERE response_id=$1', [rid]);
    const sys = await db.query('SELECT system_key, score FROM body_system_scores WHERE response_id=$1', [rid]);
    for (const row of sys.rows) if (qBySystem[row.system_key]) await db.query('INSERT INTO assessment_answers (response_id,question_id,system_key,answer_number,normalized_score) VALUES ($1,$2,$3,$4,$4)', [rid, qBySystem[row.system_key], row.system_key, row.score]);
    const asp = await db.query('SELECT aspect_key, score FROM aspect_scores WHERE response_id=$1', [rid]);
    for (const row of asp.rows) if (qByAspect[row.aspect_key]) await db.query('INSERT INTO assessment_answers (response_id,question_id,aspect_key,answer_number,normalized_score) VALUES ($1,$2,$3,$4,$4)', [rid, qByAspect[row.aspect_key], row.aspect_key, row.score]);
  }

  console.log(`✓ Seeded ${n} historical assessment snapshots + backfilled answers for sarah@solaris.health.`);
  return n;
}

async function resetMember(email) {
  const u = await db.query('SELECT id, first_name, last_name FROM users WHERE lower(email)=lower($1)', [email]);
  if (!u.rows.length) throw new Error(`No member found with email: ${email}`);
  const userId = u.rows[0].id;

  // Ensure an active template exists to reseed against (bootstrap if the DB is empty).
  let t = await db.query("SELECT id FROM assessment_templates WHERE status='active' ORDER BY id DESC LIMIT 1");
  let tid = t.rows.length ? t.rows[0].id : await seedTemplate();

  // Delete this member's derived/journey rows. Children of assessment_responses
  // (body_system_scores, aspect_scores) also carry user_id, so clear them directly.
  const perUser = [
    'body_system_scores', 'aspect_scores', 'recommendations', 'assessment_responses',
    'daily_checkins', 'luca_messages', 'booking_requests', 'habit_plans', 'documents',
  ];
  for (const tbl of perUser) {
    await db.query(`DELETE FROM ${tbl} WHERE user_id=$1`, [userId]).catch((e) => {
      console.warn(`  (skip ${tbl}: ${e.message})`);
    });
  }
  await seedSampleResult(userId, tid);
  console.log(`✓ Reset member ${email} (id=${userId}) — fresh assessment + 7-day check-ins seeded.`);
}

(async () => {
  try {
    const email = parseEmailArg();
    if (email) {
      console.log(`Scoped reset for single member: ${email}`);
      await resetMember(email);
      process.exit(0);
    }
    if (process.argv.includes('--gps')) {
      console.log('Seeding GPS shadow receipts only...');
      await seedGpsReceipts();
      process.exit(0);
    }
    if (process.argv.includes('--demo-gaps')) {
      console.log('Filling demo gaps (alejandro profile + sarah assessment history)...');
      await seedAlejandroProfile();
      await seedSarahAssessment();
      process.exit(0);
    }
    console.log('Resetting Solaris tables...');
    await reset();
    console.log('Seeding users...');
    const { patient, majd, prac } = await seedUsers();
    console.log('Seeding assessment template...');
    const tid = await seedTemplate();
    console.log('Seeding listings...');
    await seedListings(prac);
    console.log('Seeding sample results for Sarah & Majd...');
    await seedSampleResult(patient, tid);
    await seedSampleResult(majd, tid);
    console.log('Seeding GPS shadow receipts...');
    await seedGpsReceipts().catch((e) => console.warn('  (GPS seed skipped:', e.message, ')'));
    console.log('Filling demo gaps (alejandro profile + sarah assessment history)...');
    await seedAlejandroProfile().catch((e) => console.warn('  (alejandro profile skipped:', e.message, ')'));
    await seedSarahAssessment().catch((e) => console.warn('  (sarah assessment skipped:', e.message, ')'));
    console.log('✓ Solaris seed complete.');
    console.log('  Patient:      sarah@solaris.health / demo123');
    console.log('  Patient:      majd@luca.health / demo123');
    console.log('  Practitioner: elena@solaris.health / demo123');
    console.log('  Admin:        admin@solaris.health / admin123');
    process.exit(0);
  } catch (e) {
    console.error('Seed error:', e);
    process.exit(1);
  }
})();

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

(async () => {
  try {
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

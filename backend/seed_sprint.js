/**
 * SOLARIS OVERNIGHT SPRINT — Seed data
 * Idempotent seed for the identity-first Solaris demo.
 *
 * Seeds: 1 community, 6 users (one per role, mock Nostr keys),
 * 12 organizations (map pins incl. Aura), wallets, a data-driven
 * split policy (90/3/2/2/2/1 in basis points), 5 simulated payments
 * with split receipts, 20 contribution events, 12 appointments,
 * a treatment plan for Sarah, personas, health records, per-role
 * LUCA guidance, and the LUCA-Aura clinic agent.
 *
 * All values are MOCK/simulated. No real keys or payments.
 *
 * Run:
 *   DATABASE_URL="postgresql://luca_user:luca_prod_2026@localhost:5432/luca_passport" \
 *   node backend/seed_sprint.js
 */
const bcrypt = require('bcryptjs');
const db = require('./src/db');

// --- Default split policy in basis points (10000 = 100%) ---
const AURA_SPLIT_BPS = [
  { role: 'provider',           recipient_ref: 'org:aura',            share_bps: 9000, immutable: false },
  { role: 'onboarder',          recipient_ref: 'user:onboarder',      share_bps: 300,  immutable: true },
  { role: 'infrastructure',     recipient_ref: 'network:infra',       share_bps: 200,  immutable: false },
  { role: 'community_treasury', recipient_ref: 'community:home',      share_bps: 200,  immutable: false, location_routing: 'home' },
  { role: 'software',           recipient_ref: 'network:software',    share_bps: 200,  immutable: false },
  { role: 'patient_education',  recipient_ref: 'user:payer',          share_bps: 100,  immutable: false },
];

function computeLegs(amountSats, policy) {
  // Largest-remainder rounding so the legs sum exactly to amountSats.
  const raw = policy.map((r) => ({ ...r, exact: (amountSats * r.share_bps) / 10000 }));
  let floored = raw.map((r) => ({ ...r, amount_sats: Math.floor(r.exact), frac: r.exact - Math.floor(r.exact) }));
  let allocated = floored.reduce((s, r) => s + r.amount_sats, 0);
  let remainder = amountSats - allocated;
  floored.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) floored[i % floored.length].amount_sats += 1;
  return floored.map((r) => ({
    role: r.role,
    recipient_ref: r.recipient_ref,
    share_bps: r.share_bps,
    amount_sats: r.amount_sats,
    proof_mock: 'proof_' + Math.random().toString(36).slice(2, 12),
  }));
}

function mockHash(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// User definitions
const USERS = [
  { key: 'sarah',   email: 'sarah@solaris.health',   role: 'patient',       name: 'Sarah Mitchell',    points: 45,    created_via: 'nostr'  },
  { key: 'elena',   email: 'elena@solaris.health',   role: 'practitioner',  name: 'Dr. Elena Vasquez', points: 850,   created_via: 'nostr'  },
  { key: 'aura',    email: 'aura@solaris.health',    role: 'clinic_admin',  name: 'Aura Admin',        points: 1200,  created_via: 'google' },
  { key: 'marco',   email: 'marco@solaris.health',   role: 'vendor',        name: 'Marco Farms',       points: 280,   created_via: 'nostr'  },
  { key: 'builder', email: 'builder@solaris.health', role: 'builder',       name: 'Alex Builder',      points: 4500,  created_via: 'google' },
  { key: 'solaris', email: 'solaris@solaris.health', role: 'solaris_admin', name: 'Solaris Network',   points: 15000, created_via: 'nostr'  },
];

async function upsertUser(u, passwordHash, communityId) {
  const npub = `npub1mock${u.key}${'x'.repeat(Math.max(0, 50 - u.key.length))}`.slice(0, 63);
  const nsec = `nsec1mock${u.key}${'x'.repeat(Math.max(0, 50 - u.key.length))}`.slice(0, 63);
  const did = `did:nostr:mock:${u.key}`;
  const existing = await db.query('SELECT id FROM users WHERE email=$1', [u.email]);
  if (existing.rows.length) {
    const id = existing.rows[0].id;
    await db.query(
      `UPDATE users SET role=$2, display_name=$3, level_points=$4, created_via=$5,
         nostr_npub=$6, nostr_nsec_encrypted_mock=$7, did=$8, key_custody=$9,
         home_community_id=$10, password_hash=$11, updated_at=NOW()
       WHERE id=$1`,
      [id, u.role, u.name, u.points, u.created_via, npub, nsec, did,
       u.created_via === 'google' ? 'app_managed' : 'self', communityId, passwordHash]
    );
    return id;
  }
  const ins = await db.query(
    `INSERT INTO users (email, password_hash, role, display_name, level_points, created_via,
        nostr_npub, nostr_nsec_encrypted_mock, did, key_custody, home_community_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [u.email, passwordHash, u.role, u.name, u.points, u.created_via,
     npub, nsec, did, u.created_via === 'google' ? 'app_managed' : 'self', communityId]
  );
  return ins.rows[0].id;
}

// 12 organizations (Aura + 11 pins). lat/lng around El Salvador + 2 international.
const ORGS = [
  { name: 'Aura Dental',            type: 'clinic', health: 72, wealth: 45, sovereignty: 31, lat: 13.6929, lng: -89.2182, visibility: 'public',       services: ['Holistic dentistry', 'Ozone therapy', 'Biocompatible restorations'], desc: 'Holistic dental clinic — the first Aura node.' },
  { name: 'Verde Organic Farm',     type: 'farm',   health: 60, wealth: 38, sovereignty: 42, lat: 13.7100, lng: -89.2035, visibility: 'public',       services: ['Recovery foods', 'Herbal supplements'], desc: 'Regenerative farm supplying recovery nutrition.' },
  { name: 'La Libertad Wellness',   type: 'clinic', health: 55, wealth: 30, sovereignty: 22, lat: 13.4883, lng: -89.3222, visibility: 'discoverable', services: ['Physiotherapy', 'Massage'], desc: 'Coastal wellness and recovery center.' },
  { name: 'Santa Ana Herbal Co',    type: 'vendor', health: 48, wealth: 52, sovereignty: 35, lat: 13.9942, lng: -89.5597, visibility: 'public',       services: ['Herbal remedies', 'Teas'], desc: 'Traditional herbal vendor.' },
  { name: 'San Miguel Family Clinic',type:'clinic', health: 50, wealth: 25, sovereignty: 18, lat: 13.4833, lng: -88.1833, visibility: 'discoverable', services: ['General practice', 'Pediatrics'], desc: 'Community family clinic.' },
  { name: 'Suchitoto Apothecary',   type: 'vendor', health: 44, wealth: 40, sovereignty: 28, lat: 13.9411, lng: -89.0281, visibility: 'discoverable', services: ['Tinctures', 'Salves'], desc: 'Artisan apothecary.' },
  { name: 'Ataco Coffee Collective', type:'farm',   health: 58, wealth: 61, sovereignty: 49, lat: 13.8722, lng: -89.8489, visibility: 'public',       services: ['Organic coffee', 'Cacao'], desc: 'Farmer collective, self-custodial payments.' },
  { name: 'Antigua Holistic Center', type:'clinic', health: 66, wealth: 43, sovereignty: 37, lat: 14.5586, lng: -90.7295, visibility: 'public',       services: ['Acupuncture', 'Nutrition'], desc: 'Guatemala holistic node.' },
  { name: 'San Jose Bio-Dental',    type: 'clinic', health: 69, wealth: 47, sovereignty: 33, lat: 9.9281,  lng: -84.0907, visibility: 'discoverable', services: ['Biological dentistry'], desc: 'Costa Rica partner clinic.' },
  { name: 'Panama Vitality Hub',    type: 'clinic', health: 52, wealth: 35, sovereignty: 24, lat: 8.9824,  lng: -79.5199, visibility: 'discoverable', services: ['Integrative medicine'], desc: 'Panama City wellness hub.' },
  { name: 'Lisbon Longevity Lab',   type: 'clinic', health: 74, wealth: 58, sovereignty: 55, lat: 38.7223, lng: -9.1393,  visibility: 'public',       services: ['Longevity', 'Diagnostics'], desc: 'International node — Portugal.' },
  { name: 'Bali Healing Retreat',   type: 'clinic', health: 63, wealth: 41, sovereignty: 46, lat: -8.5069, lng: 115.2625, visibility: 'public',       services: ['Detox', 'Yoga therapy'], desc: 'International node — Indonesia.' },
];

const GUIDANCE = [
  {
    role: 'patient',
    job: 'Guide the healing journey + show how their data/value stays theirs',
    first_message_template: "Welcome {name} — I'm LUCA, your guide. Your health record, your keys, your data: yours. Want to see your treatment plan or learn how your passport works?",
    top_actions: ['View treatment plan', 'Understand aftercare (educational)', 'Pay simulated invoice & SEE the split', 'Export data', 'Earn first education credit'],
    tone: 'Caring, reassuring, zero jargon',
  },
  {
    role: 'practitioner',
    job: 'Reduce admin load; surface patient tasks',
    first_message_template: 'Good morning {name}. 3 follow-ups pending, 2 plans awaiting review. Where shall we start?',
    top_actions: ['Review/approve plan drafts', 'Draft follow-up messages (approve to send)', "See today's schedule", 'Log care milestone → ledger', 'View own credentials'],
    tone: 'Efficient, respectful, clinical-adjacent',
  },
  {
    role: 'clinic_admin',
    job: 'Run the node: ops + money + growth',
    first_message_template: 'Aura at a glance: {n} appointments today, {sats} received this week, treasury at {t}. One suggestion ready.',
    top_actions: ['Payments & split receipts review', 'Follow-up queue', 'Onboard a patient (creates identity + onboarder leg)', 'Adjust split policy (except immutable legs)', 'View GPS dials & how to raise them'],
    tone: 'Business-owner peer, numbers-first',
  },
  {
    role: 'vendor',
    job: 'Sell into the network; get paid fairly',
    first_message_template: 'Your stand on the map is {visibility}. 2 community orders this week. Want to see where your earnings split went?',
    top_actions: ['Manage listing/visibility', 'View orders (mock)', 'See split receipts', 'Log contribution (supplying recovery food etc.)', 'Level progress'],
    tone: 'Friendly, practical, encouraging',
  },
  {
    role: 'builder',
    job: 'Turn contributions into reputation + income',
    first_message_template: "You're Level {lvl} ({band}). Your referral yesterday earned {pts} points and {sats} simulated sats. Next best contribution?",
    top_actions: ['Log contribution w/ evidence', 'Browse open needs (mock bounty list)', 'Leaderboard position', 'Connect wallet (mock)', 'Understand GPS splits technically'],
    tone: 'Peer-builder, technically honest',
  },
  {
    role: 'solaris_admin',
    job: 'Steward the network honestly',
    first_message_template: 'Network: {n} orgs, {m} members, treasury {t}. 1 pending org application, 2 attestations awaiting review.',
    top_actions: ['Review org applications', 'Attest/dispute contribution events', 'View any community treasury flows', 'Manage map visibility approvals', 'Audit log'],
    tone: 'Neutral, transparent, governance-minded',
  },
];

async function main() {
  console.log('Seeding Solaris sprint data...');
  const passwordHash = await bcrypt.hash('demo123', 10);

  // Clean sprint tables (brand new; safe). Order respects FKs via CASCADE.
  await db.query(`TRUNCATE split_receipts, payments, treatment_plans, appointments,
      contribution_events, personas, wallets, health_records, vault_exports,
      split_policies_v2, organizations, communities, luca_guidance
      RESTART IDENTITY CASCADE`);

  // --- Community ---
  const comm = await db.query(
    `INSERT INTO communities (name, region, treasury_wallet_mock, treasury_balance_sats)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    ['El Salvador Health Network', 'Central America', 'lnurl1mock_treasury_elsalvador', 4250000]
  );
  const communityId = comm.rows[0].id;

  // --- Users ---
  const uid = {};
  for (const u of USERS) {
    uid[u.key] = await upsertUser(u, passwordHash, communityId);
  }
  // onboarder relationships (immutable-after-set): sarah onboarded by aura
  await db.query('UPDATE users SET onboarder_user_id=$1 WHERE id=$2', [uid.aura, uid.sarah]);
  await db.query('UPDATE users SET onboarder_user_id=$1 WHERE id=$2', [uid.builder, uid.marco]);

  // --- Organizations ---
  const orgId = {};
  for (const o of ORGS) {
    const steward = o.name === 'Aura Dental' ? uid.aura : (o.type === 'farm' || o.type === 'vendor' ? uid.marco : uid.elena);
    const npub = 'npub1mockorg' + o.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const r = await db.query(
      `INSERT INTO organizations (name, type, steward_user_id, did, npub_mock, community_id,
          health_dial, wealth_dial, sovereignty_dial, lat, lng, visibility, description, services)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [o.name, o.type, steward, 'did:nostr:mock:org:' + o.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20),
       npub, communityId, o.health, o.wealth, o.sovereignty, o.lat, o.lng, o.visibility, o.desc, o.services]
    );
    orgId[o.name] = r.rows[0].id;
  }
  const auraId = orgId['Aura Dental'];

  // --- Wallets (6 users + Aura org + community) ---
  const walletBalances = { sarah: 12000, elena: 340000, aura: 890000, marco: 156000, builder: 720000, solaris: 2100000 };
  for (const u of USERS) {
    await db.query(
      `INSERT INTO wallets (owner_type, owner_id, balance_sats_simulated, lightning_address_mock)
       VALUES ('user',$1,$2,$3)`,
      [uid[u.key], walletBalances[u.key] || 0, `${u.key}@solaris.mock`]
    );
  }
  await db.query(
    `INSERT INTO wallets (owner_type, owner_id, balance_sats_simulated, lightning_address_mock)
     VALUES ('org',$1,$2,$3)`,
    [auraId, 3400000, 'aura@solaris.mock']
  );
  await db.query(
    `INSERT INTO wallets (owner_type, owner_id, balance_sats_simulated, lightning_address_mock)
     VALUES ('community',$1,$2,$3)`,
    [communityId, 4250000, 'treasury-elsalvador@solaris.mock']
  );

  // --- Split policy for Aura ---
  const pol = await db.query(
    `INSERT INTO split_policies_v2 (owner_org_id, name, recipients, active)
     VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [auraId, 'Aura Standard Split (90/3/2/2/2/1)', JSON.stringify(AURA_SPLIT_BPS)]
  );
  const policyId = pol.rows[0].id;

  // --- Treatment plan for Sarah ---
  await db.query(
    `INSERT INTO treatment_plans (org_id, patient_id, practitioner_id, title, items, total_sats, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [auraId, uid.sarah, uid.elena, 'Holistic Dental Restoration Plan',
     JSON.stringify([
       { name: 'Comprehensive biocompatible assessment', sats: 300000 },
       { name: 'Ozone therapy (2 sessions)', sats: 500000 },
       { name: 'Biocompatible restoration', sats: 700000 },
     ]),
     1500000, 'pending', 'Discuss aftercare with your practitioner. Educational guidance only.']
  );

  // --- Payments + split receipts (5) ---
  const payments = [
    { payer: 'sarah',   amount: 1500000, desc: 'Holistic Dental Restoration Plan' },
    { payer: 'marco',   amount: 250000,  desc: 'Dental cleaning & checkup' },
    { payer: 'builder', amount: 480000,  desc: 'Ozone therapy session' },
    { payer: 'elena',   amount: 120000,  desc: 'Consultation' },
    { payer: 'sarah',   amount: 90000,   desc: 'Follow-up visit' },
  ];
  for (const p of payments) {
    const pay = await db.query(
      `INSERT INTO payments (payer_user_id, org_id, amount_sats, status, invoice_mock, description)
       VALUES ($1,$2,$3,'simulated_settled',$4,$5) RETURNING id`,
      [uid[p.payer], auraId, p.amount, mockHash('lnbc_invoice'), p.desc]
    );
    const paymentId = pay.rows[0].id;
    const legs = computeLegs(p.amount, AURA_SPLIT_BPS);
    const rec = await db.query(
      `INSERT INTO split_receipts (payment_id, policy_id, payer_user_id, org_id, amount_sats, legs, receipt_hash_mock)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [paymentId, policyId, uid[p.payer], auraId, p.amount, JSON.stringify(legs), mockHash('receipt')]
    );
    await db.query('UPDATE payments SET split_receipt_id=$1 WHERE id=$2', [rec.rows[0].id, paymentId]);
    // Credit patient_education leg to payer wallet
    const eduLeg = legs.find((l) => l.role === 'patient_education');
    if (eduLeg) {
      await db.query(
        `UPDATE wallets SET balance_sats_simulated = balance_sats_simulated + $1, updated_at=NOW()
         WHERE owner_type='user' AND owner_id=$2`,
        [eduLeg.amount_sats, uid[p.payer]]
      );
    }
  }

  // --- Appointments (12) ---
  const apptTitles = ['Initial consultation', 'Ozone therapy', 'Restoration', 'Cleaning', 'Follow-up',
    'Assessment', 'Check-up', 'Aftercare review', 'X-ray review', 'Nutrition consult', 'Recovery check', 'Annual exam'];
  const patients = [uid.sarah, uid.marco, uid.builder, uid.elena];
  for (let i = 0; i < 12; i++) {
    const dayOffset = i - 3; // some past, some future
    const status = dayOffset < 0 ? 'completed' : (dayOffset === 0 ? 'confirmed' : (i % 4 === 0 ? 'pending' : 'confirmed'));
    const followUp = dayOffset < 0 ? (i % 2 === 0 ? 'draft' : 'sent') : 'none';
    await db.query(
      `INSERT INTO appointments (org_id, patient_id, practitioner_id, title, scheduled_at, status, notes, follow_up_status, follow_up_draft)
       VALUES ($1,$2,$3,$4, NOW() + ($5 || ' days')::interval, $6, $7, $8, $9)`,
      [auraId, patients[i % patients.length], uid.elena, apptTitles[i],
       String(dayOffset) , status, 'Mock appointment note.', followUp,
       followUp === 'draft' ? 'Hi, thanks for visiting Aura. Remember to rinse gently and avoid hard foods for 48h. Reply with any questions.' : null]
    );
  }

  // --- Contribution events (20) ---
  const kinds = ['referral', 'hosting', 'maintenance', 'education', 'care_milestone', 'coordination'];
  const contributors = ['builder', 'marco', 'elena', 'aura', 'solaris', 'sarah'];
  for (let i = 0; i < 20; i++) {
    const kind = kinds[i % kinds.length];
    const contributor = contributors[i % contributors.length];
    const points = [10, 25, 50, 15, 100, 30][i % 6];
    await db.query(
      `INSERT INTO contribution_events (contributor_user_id, kind, subject_ref, evidence, points, signature_mock, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid[contributor], kind, `subject:${kind}:${i}`,
       JSON.stringify({ note: `Mock evidence for ${kind}`, url: `https://mock.solaris/evidence/${i}` }),
       points, mockHash('sig'), i % 7 === 0 ? 'pending' : 'attested']
    );
  }

  // --- Personas (Main + Anonymous per user) ---
  for (const u of USERS) {
    await db.query(
      `INSERT INTO personas (user_id, label, npub_mock) VALUES ($1,'Main',$2),($1,'Anonymous',$3)`,
      [uid[u.key], `npub1mock${u.key}main`, `npub1mock${u.key}anon`]
    );
  }

  // --- Health records for Sarah ---
  await db.query(
    `INSERT INTO health_records (user_id, kind, title, body_md, private) VALUES
     ($1,'assessment','Holistic Intake Assessment',$2,TRUE),
     ($1,'note','Aftercare Notes',$3,TRUE)`,
    [uid.sarah,
     '# Holistic Intake\n\n**Mock content.** General wellness good. Recommends biocompatible restoration. _Educational only — discuss with your practitioner._',
     '# Aftercare\n\n**Mock content.** Rinse gently, avoid hard foods 48h. Hydrate. _Educational only._']
  );

  // --- LUCA guidance (per-role) ---
  for (const g of GUIDANCE) {
    await db.query(
      `INSERT INTO luca_guidance (role, job, first_message_template, top_actions, tone)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (role) DO UPDATE SET job=EXCLUDED.job,
         first_message_template=EXCLUDED.first_message_template,
         top_actions=EXCLUDED.top_actions, tone=EXCLUDED.tone`,
      [g.role, g.job, g.first_message_template, JSON.stringify(g.top_actions), g.tone]
    );
  }

  // --- LUCA-Aura agent (delete-by-name then insert for idempotency) ---
  await db.query(`DELETE FROM agents WHERE name=$1`, ['LUCA-Aura']);
  await db.query(
    `INSERT INTO agents (owner_id, name, purpose, permissions, active)
     VALUES ($1,$2,$3,$4,TRUE)`,
    [uid.aura, 'LUCA-Aura',
     'Clinic guide agent for the Aura node. Drafts patient follow-ups (human approves before send), surfaces daily ops, and explains GPS value splits. AI suggests, humans approve. No real money or record changes without an approval click.',
     JSON.stringify({ draft_followups: true, view_appointments: true, view_payments: true, send_without_approval: false, wallet_permission: 'none' })]
  );

  // --- Summary counts ---
  const counts = {};
  for (const t of ['communities', 'organizations', 'wallets', 'split_policies_v2', 'payments',
    'split_receipts', 'appointments', 'contribution_events', 'personas', 'health_records',
    'treatment_plans', 'luca_guidance']) {
    const r = await db.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    counts[t] = r.rows[0].c;
  }
  const ucount = await db.query(`SELECT COUNT(*)::int AS c FROM users WHERE email LIKE '%@solaris.health'`);
  counts['sprint_users'] = ucount.rows[0].c;
  console.log('Seed complete. Counts:', JSON.stringify(counts, null, 2));
  await db.pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

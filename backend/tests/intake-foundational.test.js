/**
 * Intake + Foundational Health Data tests (spec A5).
 *
 * Proves:
 *   • Submitting an intake persists Foundational Health Data at provenance L2,
 *     bound to the member's Solaris subject id (never email/vendor id).
 *   • GET /api/intake/foundational returns the snapshot + a <12mo prefill flag.
 *   • The 48h reminder pass is idempotent (never sends a second reminder).
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { saveFoundational, getFoundational } = require('../src/lib/foundational');
const { sendIntakeReminders } = require('../src/lib/intake-messages');
const { subjectIdForUser } = require('../src/lib/identity');

let token;
let userId;

beforeAll(async () => {
  process.env.LUCA_AI_MODE = 'mock';
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (userId) {
    const subj = await subjectIdForUser(userId).catch(() => null);
    if (subj) await db.query('DELETE FROM foundational_health_data WHERE subject_id=$1', [subj]);
    await db.query('DELETE FROM patient_messages WHERE recipient_id=$1', [userId]);
    await db.query('DELETE FROM patient_intake_submissions WHERE patient_id=$1', [userId]);
    await db.query('DELETE FROM users WHERE id=$1', [userId]);
  }
  await db.pool.end();
});

describe('foundational health data lib', () => {
  it('saves foundational data at L2 bound to a Solaris subject id', async () => {
    const row = await saveFoundational(db, {
      userId,
      responses: {
        full_name: 'Ada Lovelace',
        allergies: 'Penicillin',
        systemic_conditions: ['Thyroid Disorder'],
        visit_reason: 'General wellness',
      },
    });
    expect(row).toBeTruthy();
    expect(row.level).toBe(2);
    expect(row.source).toBe('self');
    expect(String(row.subject_id)).toMatch(/^sol_[0-9a-f]{32}$/);
  });

  it('getFoundational returns the snapshot and a <12mo prefill flag', async () => {
    const f = await getFoundational(db, userId);
    expect(f).toBeTruthy();
    expect(f.data.full_name).toBe('Ada Lovelace');
    expect(f.data.allergies).toBe('Penicillin');
    expect(f.level).toBe(2);
    expect(f.updatedWithin12Months).toBe(true);
  });

  it('merges new answers over the prior snapshot (does not drop earlier keys)', async () => {
    await saveFoundational(db, { userId, responses: { phone: '+1 555 0100' } });
    const f = await getFoundational(db, userId);
    expect(f.data.full_name).toBe('Ada Lovelace'); // preserved
    expect(f.data.phone).toBe('+1 555 0100');       // added
  });
});

describe('GET /api/intake/foundational', () => {
  it('returns the member snapshot', async () => {
    const res = await request(app)
      .get('/api/intake/foundational')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.foundational).toBeTruthy();
    expect(res.body.foundational.data.full_name).toBe('Ada Lovelace');
    expect(res.body.foundational.updatedWithin12Months).toBe(true);
  });
});

describe('POST /api/intake/submit persists foundational', () => {
  it('self-initiated foundational submission saves Part A and reports foundationalSaved', async () => {
    const tpl = await db.query(
      "SELECT id FROM intake_form_templates WHERE clinic_type='foundational' AND is_system=TRUE LIMIT 1"
    );
    const templateId = tpl.rows[0] && tpl.rows[0].id;
    expect(templateId).toBeTruthy();
    const res = await request(app)
      .post('/api/intake/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId, responses: { full_name: 'Ada L.', allergies: 'None known' } });
    expect(res.status).toBe(200);
    expect(res.body.foundationalSaved).toBe(true);
  });
});

describe('48h intake reminders are idempotent', () => {
  let bookingId;
  let submissionId;
  let providerUserId; // set to a valid user id in beforeAll

  beforeAll(async () => {
    // A booking ~24h out so it falls inside the 48h reminder window.
    providerUserId = userId; // any valid users.id satisfies the FK
    const pp = await db.query('SELECT id FROM provider_profiles LIMIT 1');
    const providerProfileId = pp.rows[0] && pp.rows[0].id;
    const b = await db.query(
      `INSERT INTO bookings (patient_id, provider_id, booking_date, start_time, end_time, status)
       VALUES ($1, $2, (now() + interval '24 hours')::date,
               (now() + interval '24 hours')::time, (now() + interval '25 hours')::time, 'confirmed')
       RETURNING id`,
      [userId, providerProfileId]
    );
    bookingId = b.rows[0].id;
    const s = await db.query(
      `INSERT INTO patient_intake_submissions (patient_id, provider_id, booking_id, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [userId, providerUserId, bookingId]
    );
    submissionId = s.rows[0].id;
  });

  afterAll(async () => {
    await db.query('DELETE FROM patient_intake_submissions WHERE id=$1', [submissionId]);
    await db.query('DELETE FROM bookings WHERE id=$1', [bookingId]);
  });

  it('sends exactly one reminder no matter how many times it runs', async () => {
    const n1 = await sendIntakeReminders(db);
    const n2 = await sendIntakeReminders(db);
    expect(n1).toBeGreaterThanOrEqual(1);
    expect(n2).toBe(0);
    const msgs = await db.query(
      `SELECT COUNT(*)::int AS c FROM patient_messages
        WHERE recipient_id=$1 AND related_intake_id=$2 AND subject LIKE 'Reminder%'`,
      [userId, submissionId]
    );
    expect(msgs.rows[0].c).toBe(1);
  });
});

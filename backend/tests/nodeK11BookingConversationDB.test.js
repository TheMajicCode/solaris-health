/**
 * NODE K1.1 §2 — booking ↔ conversation, REAL disposable-Postgres integration.
 *
 * These tests run against a real, empty, disposable local Postgres cluster
 * (socket-only, random creds) provisioned by the canonical bootstrap. They do
 * NOT rename or reuse any official screenshot/seed fixture — every row is
 * created here through the real API + SQL, then cleaned up.
 *
 * Coverage (all required by §2):
 *   1. first booking creates exactly one canonical conversation
 *   2. repeated bookings reuse the same canonical conversation
 *   3. a transaction failure rolls back BOTH booking and conversation
 *   4. two providers with identical names never cross-link
 *   5. a provider whose business name differs from the practitioner still links
 *   6. a member cannot read another member's conversation / booking context
 *   7. a practitioner sees only conversations they are authorized for
 *   8. the conversations list returns stable, server-derived booking provider ids
 *
 * The booking→conversation link and the conversations-list booking signals are
 * derived ENTIRELY server-side from authenticated participants + provider_profiles
 * + the member's own bookings. No practitioner id is ever accepted from a name
 * match or from the browser.
 */
process.env.LUCA_AI_MODE = 'mock';

const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');

// --- helpers -----------------------------------------------------------------

// A booking date safely inside the [2h, 90d] window.
function futureDate(daysAhead = 10) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

async function registerMember() {
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  return { token: res.body.token, id: res.body.user.id, email: res.body.user.email };
}

// Register a user, promote to practitioner, re-login so the JWT carries the role,
// then create an approved+claimed provider_profile owned by that practitioner.
async function registerPractitionerWithProfile({ fullName, businessName }) {
  const payload = global.makeUserPayload({ fullName });
  const reg = await request(app).post('/api/auth/register').send(payload);
  const userId = reg.body.user.id;
  await db.query("UPDATE users SET role='practitioner', full_name=$2 WHERE id=$1", [userId, fullName]);
  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ email: reg.body.user.email, password: payload.password });
  const prof = await db.query(
    `INSERT INTO provider_profiles
       (user_id, provider_type, business_name, approval_status, claimed, status, auto_confirm_bookings)
     VALUES ($1,'practitioner',$2,'approved',true,'active',true)
     RETURNING id`,
    [userId, businessName]
  );
  return { token: relogin.body.token, userId, providerId: prof.rows[0].id, email: reg.body.user.email };
}

async function requestBooking(token, providerId, { date, startTime }) {
  return request(app)
    .post('/api/bookings/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerId, date, startTime });
}

async function getConversations(token) {
  return request(app)
    .get('/api/messages/conversations')
    .set('Authorization', `Bearer ${token}`);
}

const created = { users: [], providers: [] };
function track(u) { if (u?.userId) created.users.push(u.userId); if (u?.id) created.users.push(u.id); if (u?.providerId) created.providers.push(u.providerId); }

afterAll(async () => {
  // Clean up only the rows this suite created (never touch fixtures).
  for (const pid of created.providers) {
    await db.query('DELETE FROM bookings WHERE provider_id=$1', [pid]).catch(() => {});
    await db.query('DELETE FROM provider_profiles WHERE id=$1', [pid]).catch(() => {});
  }
  for (const uid of created.users) {
    await db.query('DELETE FROM conversations WHERE patient_id=$1 OR practitioner_id=$1', [uid]).catch(() => {});
    await db.query('DELETE FROM users WHERE id=$1', [uid]).catch(() => {});
  }
  await db.pool.end();
});

describe('K1.1 §2 — canonical conversation creation (real DB)', () => {
  it('first booking creates exactly one canonical conversation, reused on repeat', async () => {
    const member = await registerMember(); track(member);
    const prac = await registerPractitionerWithProfile({ fullName: 'Dr. Reuse Owner', businessName: 'Reuse Wellness' }); track(prac);

    const date = futureDate(10);
    const b1 = await requestBooking(member.token, prac.providerId, { date, startTime: '09:00' });
    expect(b1.status).toBe(201);
    expect(b1.body.conversationId).toBeTruthy();

    let convCount = await db.query(
      'SELECT count(*)::int AS n FROM conversations WHERE patient_id=$1 AND practitioner_id=$2',
      [member.id, prac.userId]
    );
    expect(convCount.rows[0].n).toBe(1);

    // Repeat booking (different slot) — must REUSE the same conversation row.
    const b2 = await requestBooking(member.token, prac.providerId, { date, startTime: '11:00' });
    expect(b2.status).toBe(201);
    expect(b2.body.conversationId).toBe(b1.body.conversationId);

    convCount = await db.query(
      'SELECT count(*)::int AS n FROM conversations WHERE patient_id=$1 AND practitioner_id=$2',
      [member.id, prac.userId]
    );
    expect(convCount.rows[0].n).toBe(1);

    // The conversations list returns BOTH bookings' ids + the stable provider id.
    const convs = await getConversations(member.token);
    expect(convs.status).toBe(200);
    const conv = convs.body.conversations.find((c) => c.otherId === prac.userId);
    expect(conv).toBeTruthy();
    expect(conv.hasBooking).toBe(true);
    expect(conv.bookingIds.sort()).toEqual([b1.body.booking.id, b2.body.booking.id].sort());
    expect(conv.bookingProviderIds).toEqual([prac.providerId]); // server-derived, stable
  });

  it('a transaction failure rolls back BOTH the booking and the conversation', async () => {
    const member = await registerMember(); track(member);
    const prac = await registerPractitionerWithProfile({ fullName: 'Dr. Rollback Owner', businessName: 'Rollback Clinic' }); track(prac);

    // Force the in-transaction conversation upsert to fail via a BEFORE INSERT
    // trigger. Because find/create-conversation runs inside the SAME txn as the
    // booking insert, the whole request must roll back — no threadless booking.
    await db.query(`
      CREATE OR REPLACE FUNCTION k11_fail_conv() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'k11 forced failure'; END; $$ LANGUAGE plpgsql;`);
    await db.query(`CREATE TRIGGER k11_conv_fail BEFORE INSERT ON conversations
      FOR EACH ROW EXECUTE FUNCTION k11_fail_conv();`);

    let res;
    try {
      res = await requestBooking(member.token, prac.providerId, { date: futureDate(12), startTime: '10:00' });
    } finally {
      await db.query('DROP TRIGGER IF EXISTS k11_conv_fail ON conversations;');
      await db.query('DROP FUNCTION IF EXISTS k11_fail_conv();');
    }
    expect(res.status).toBe(500);

    const bookings = await db.query('SELECT count(*)::int AS n FROM bookings WHERE patient_id=$1 AND provider_id=$2', [member.id, prac.providerId]);
    expect(bookings.rows[0].n).toBe(0); // booking rolled back
    const convs = await db.query('SELECT count(*)::int AS n FROM conversations WHERE patient_id=$1 AND practitioner_id=$2', [member.id, prac.userId]);
    expect(convs.rows[0].n).toBe(0); // conversation rolled back
  });
});

describe('K1.1 §2 — no cross-linking / authorization (real DB)', () => {
  it('two providers with identical names never cross-link', async () => {
    const member = await registerMember(); track(member);
    const pracA = await registerPractitionerWithProfile({ fullName: 'Dr. Same Name', businessName: 'Clinic A' }); track(pracA);
    const pracB = await registerPractitionerWithProfile({ fullName: 'Dr. Same Name', businessName: 'Clinic B' }); track(pracB);

    // Member books ONLY provider A.
    const bA = await requestBooking(member.token, pracA.providerId, { date: futureDate(14), startTime: '09:30' });
    expect(bA.status).toBe(201);

    // Give the member an (empty) conversation with B too, to prove the booking
    // link is by id, not by the identical name.
    await db.query('INSERT INTO conversations (patient_id, practitioner_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [member.id, pracB.userId]);

    const convs = await getConversations(member.token);
    const convA = convs.body.conversations.find((c) => c.otherId === pracA.userId);
    const convB = convs.body.conversations.find((c) => c.otherId === pracB.userId);
    expect(convA.hasBooking).toBe(true);
    expect(convA.bookingProviderIds).toEqual([pracA.providerId]);
    expect(convB.hasBooking).toBe(false);        // identical name, NO booking → no link
    expect(convB.bookingIds).toEqual([]);
  });

  it('a provider whose business name differs from the practitioner still links by id', async () => {
    const member = await registerMember(); track(member);
    const prac = await registerPractitionerWithProfile({ fullName: 'Dr. Ana Ruiz', businessName: 'Sunrise Wellness Collective' }); track(prac);
    const b = await requestBooking(member.token, prac.providerId, { date: futureDate(9), startTime: '08:00' });
    expect(b.status).toBe(201);
    const convs = await getConversations(member.token);
    const conv = convs.body.conversations.find((c) => c.otherId === prac.userId);
    expect(conv.hasBooking).toBe(true);
    expect(conv.bookingIds).toContain(b.body.booking.id);
    expect(conv.bookingProviderIds).toEqual([prac.providerId]);
  });

  it('a member cannot read another member\'s conversation or booking context', async () => {
    const m1 = await registerMember(); track(m1);
    const m2 = await registerMember(); track(m2);
    const prac = await registerPractitionerWithProfile({ fullName: 'Dr. Private Owner', businessName: 'Private Clinic' }); track(prac);
    const b = await requestBooking(m1.token, prac.providerId, { date: futureDate(8), startTime: '13:00' });
    expect(b.status).toBe(201);

    // m2 lists conversations — must NOT see m1's conversation or booking ids.
    const convs = await getConversations(m2.token);
    expect(convs.status).toBe(200);
    const leaked = convs.body.conversations.find((c) => c.bookingIds.includes(b.body.booking.id));
    expect(leaked).toBeUndefined();
    expect(convs.body.conversations.find((c) => c.otherId === prac.userId)).toBeUndefined();
  });

  it('a practitioner sees only conversations they are authorized for', async () => {
    const member = await registerMember(); track(member);
    const pracX = await registerPractitionerWithProfile({ fullName: 'Dr. Auth X', businessName: 'X Clinic' }); track(pracX);
    const pracY = await registerPractitionerWithProfile({ fullName: 'Dr. Auth Y', businessName: 'Y Clinic' }); track(pracY);
    const b = await requestBooking(member.token, pracX.providerId, { date: futureDate(11), startTime: '15:00' });
    expect(b.status).toBe(201);

    // Practitioner X sees the conversation with the member.
    const xConvs = await getConversations(pracX.token);
    expect(xConvs.body.conversations.some((c) => c.otherId === member.id)).toBe(true);

    // Practitioner Y (no booking, no conversation) sees nothing for this member.
    const yConvs = await getConversations(pracY.token);
    expect(yConvs.body.conversations.some((c) => c.otherId === member.id)).toBe(false);
  });
});

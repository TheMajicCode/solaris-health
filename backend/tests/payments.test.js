/**
 * Payments MVP tests (spec A4 §2, M6).
 *
 * Proves:
 *   • POST /api/payments/checkout creates a PaymentIntent + a hosted checkout
 *     URL (mock adapter) and is idempotent on the idempotency key.
 *   • The webhook confirms a booking EXACTLY ONCE (replay-safe), writes the
 *     allocation ledger, and never trusts an invalid signature.
 *   • Allocation ledger obeys the A4 four-bucket rule: envelope ≤ 10%, the
 *     Solaris coordination fee is earned_value (outside the envelope), and the
 *     per-leg cents sum EXACTLY to the eligible value. No referral leg.
 *   • A member inbox receipt (notification) is created on paid.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { subjectIdForUser } = require('../src/lib/identity');
const { MockPaymentAdapter } = require('../src/adapters/MockPaymentAdapter');
const { computeAllocations, ENVELOPE_CAP_BPS } = require('../src/lib/payments/allocation-policy');

let token;
let userId;
let providerId;
let bookingId;

beforeAll(async () => {
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.WOMPI_EVENTS_SECRET = 'test_events_secret';
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  if (bookingId) {
    await db.query('DELETE FROM booking_status_history WHERE booking_id=$1', [bookingId]).catch(() => {});
    await db.query('DELETE FROM bookings WHERE id=$1', [bookingId]).catch(() => {});
  }
  if (providerId) await db.query('DELETE FROM provider_profiles WHERE id=$1', [providerId]).catch(() => {});
  if (userId) {
    const subj = await subjectIdForUser(userId).catch(() => null);
    if (subj) {
      const its = await db.query('SELECT id FROM payment_intents WHERE subject_id=$1', [subj]);
      for (const r of its.rows) {
        await db.query('DELETE FROM gps_shadow_receipts WHERE intent_id=$1', [r.id]).catch(() => {});
        await db.query('DELETE FROM allocations WHERE intent_id=$1', [r.id]);
        await db.query('DELETE FROM payment_events WHERE intent_id=$1', [r.id]);
      }
      await db.query('DELETE FROM payment_intents WHERE subject_id=$1', [subj]);
    }
    await db.query('DELETE FROM notifications WHERE user_id=$1', [userId]);
    await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM users WHERE id=$1', [userId]);
  }
  await db.pool.end();
});

test('allocation policy: four buckets, envelope ≤ 10%, exact sum, no referral leg', () => {
  const { legs, envelopeCents, earnedValueCents, envelopeBps } = computeAllocations(12345);
  const sum = legs.reduce((s, l) => s + l.amountCents, 0);
  expect(sum).toBe(12345);
  expect(envelopeCents + earnedValueCents).toBe(12345); // only these two buckets in the pilot
  expect(envelopeBps).toBeLessThanOrEqual(ENVELOPE_CAP_BPS);
  // Solaris coordination is earned_value (outside envelope)
  const coord = legs.find((l) => l.key === 'solaris_coord');
  expect(coord.bucket).toBe('earned_value');
  // No referral / community-lineage leg
  expect(legs.find((l) => /referral|lineage/i.test(l.key))).toBeUndefined();
});

test('checkout creates a PaymentIntent + hosted checkout URL and is idempotent', async () => {
  const key = 'test_idem_' + Date.now();
  const r1 = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ amountCents: 10000, currency: 'USD', purpose: 'consultation', idempotencyKey: key });
  expect(r1.status).toBe(201);
  expect(r1.body.intentId).toBeTruthy();
  expect(r1.body.checkoutUrl).toMatch(/^https?:\/\//);
  expect(r1.body.status).toBe('pending');

  // Replaying the same idempotency key returns the same intent, no dup.
  const r2 = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ amountCents: 10000, currency: 'USD', purpose: 'consultation', idempotencyKey: key });
  expect(r2.status).toBe(200);
  expect(r2.body.reused).toBe(true);
  expect(r2.body.intentId).toBe(r1.body.intentId);
});

test('webhook confirms booking exactly once, writes ledger, rejects bad signature', async () => {
  const key = 'test_pay_' + Date.now();
  const chk = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ amountCents: 20000, currency: 'USD', purpose: 'treatment', idempotencyKey: key });
  const intentId = chk.body.intentId;

  const adapter = new MockPaymentAdapter({ eventsSecret: process.env.WOMPI_EVENTS_SECRET });
  const goodEvent = adapter.buildSignedEvent({
    providerRef: chk.body.providerRef, reference: intentId, status: 'APPROVED', amountCents: 20000, currency: 'USD',
  });

  // Invalid signature -> not processed.
  const bad = JSON.parse(JSON.stringify(goodEvent));
  bad.signature.checksum = 'deadbeef';
  const rBad = await request(app).post('/api/payments/webhook').send(bad);
  expect(rBad.status).toBe(200);
  expect(rBad.body.processed).toBe(false);

  // Valid signature -> confirmed once.
  const rOk = await request(app).post('/api/payments/webhook').send(goodEvent);
  expect(rOk.status).toBe(200);
  expect(rOk.body.confirmed).toBe(true);

  // Replay the same valid event -> NOT confirmed again (already_paid).
  const rReplay = await request(app).post('/api/payments/webhook').send(goodEvent);
  expect(rReplay.status).toBe(200);
  expect(rReplay.body.confirmed).toBe(false);

  // Ledger written exactly once (6 legs), sums to the gross.
  const al = await db.query('SELECT bucket, amount_cents FROM allocations WHERE intent_id=$1', [intentId]);
  expect(al.rows.length).toBe(6);
  const sum = al.rows.reduce((s, r) => s + Number(r.amount_cents), 0);
  expect(sum).toBe(20000);
  const envelope = al.rows.filter((r) => r.bucket === 'gps_envelope').reduce((s, r) => s + Number(r.amount_cents), 0);
  expect(envelope).toBe(2000); // 10%

  // Intent is paid; GET /intents returns it with the simulated note.
  const list = await request(app).get('/api/payments/intents').set('Authorization', `Bearer ${token}`);
  const found = list.body.intents.find((i) => i.id === intentId);
  expect(found.status).toBe('paid');
  expect(found.simulated).toBe(true);
  expect(found.envelopeCents).toBe(2000);

  // Inbox receipt created.
  const notif = await db.query("SELECT * FROM notifications WHERE user_id=$1 AND type='payment'", [userId]);
  expect(notif.rows.length).toBeGreaterThanOrEqual(1);

  // --- M7: a gps-receipt/1.0 shadow receipt was generated (exactly once).
  const sr = await db.query('SELECT * FROM gps_shadow_receipts WHERE intent_id=$1', [intentId]);
  expect(sr.rows.length).toBe(1);
  const receipt = typeof sr.rows[0].receipt === 'string' ? JSON.parse(sr.rows[0].receipt) : sr.rows[0].receipt;
  expect(receipt.receipt_version).toBe('gps-receipt/1.0');
  expect(receipt.issuer_id).toBe('gps:identity:solaris');
  expect(receipt.policy.hash).toMatch(/^sha256:/);
  // Four-bucket invariant: earned + envelope sum EXACTLY to eligible; envelope ≤ 10%.
  expect(receipt.eligible_value.amount_cents).toBe(20000);
  expect(receipt.earned_value_summary.amount_cents + receipt.gps_envelope.amount_cents).toBe(20000);
  expect(receipt.gps_envelope.amount_cents).toBe(2000);
  expect(receipt.gps_envelope.bps).toBeLessThanOrEqual(1000);
  // Solaris coordination is in EARNED value, not the envelope.
  const coord = receipt.allocations.find((a) => /coordination/i.test(a.recipient_label));
  expect(coord.bucket).toBe('earned_value');
  // Money is simulated; nothing settled.
  expect(receipt.settlement_summary.settled_cents).toBe(0);
  expect(receipt.allocations.every((a) => a.status === 'SIMULATED' && a.settled_cents === 0)).toBe(true);
});

test('GET /api/gps/receipts returns the member shadow receipts', async () => {
  const res = await request(app).get('/api/gps/receipts').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.receipts)).toBe(true);
  expect(res.body.receipts.length).toBeGreaterThanOrEqual(1);
  const r = res.body.receipts[0];
  expect(r.receiptVersion).toBe('gps-receipt/1.0');
  expect(r.settlementState).toBeTruthy();
  expect(r.receipt.earned_value_summary.amount_cents + r.receipt.gps_envelope.amount_cents)
    .toBe(r.eligibleCents);
});

test('checkout for a booking derives price, marks pending, and webhook confirms + marks paid', async () => {
  // Minimal provider + booking owned by the member.
  const prov = await db.query(
    "INSERT INTO provider_profiles (provider_type, business_name) VALUES ('practitioner','Test Clinic') RETURNING id");
  providerId = prov.rows[0].id;
  const bk = await db.query(
    `INSERT INTO bookings (patient_id, provider_id, booking_date, start_time, end_time, status, total_price, currency)
     VALUES ($1,$2, CURRENT_DATE + 3, '10:00', '11:00', 'pending', 150.00, 'USD') RETURNING id`,
    [userId, providerId]);
  bookingId = bk.rows[0].id;

  // Checkout WITHOUT amountCents -> derives 15000 from the booking price.
  const chk = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ bookingId, purpose: 'consultation' });
  expect(chk.status).toBe(201);
  expect(chk.body.amountCents).toBe(15000);
  expect(chk.body.bookingId).toBe(bookingId);
  expect(chk.body.checkoutUrl).toMatch(/^https?:\/\//);

  // Booking now shows a pending charge.
  const pend = await db.query('SELECT payment_status, status FROM bookings WHERE id=$1', [bookingId]);
  expect(pend.rows[0].payment_status).toBe('pending');

  // Re-checkout reuses the open intent (no duplicate rows).
  const chk2 = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ bookingId, purpose: 'consultation' });
  expect(chk2.body.reused).toBe(true);
  expect(chk2.body.intentId).toBe(chk.body.intentId);

  // Approved webhook -> booking paid + auto-confirmed.
  const adapter = new MockPaymentAdapter({ eventsSecret: process.env.WOMPI_EVENTS_SECRET });
  const event = adapter.buildSignedEvent({
    providerRef: chk.body.providerRef, reference: chk.body.intentId, status: 'APPROVED', amountCents: 15000, currency: 'USD',
  });
  const ok = await request(app).post('/api/payments/webhook').send(event);
  expect(ok.body.confirmed).toBe(true);

  const paid = await db.query('SELECT payment_status, status FROM bookings WHERE id=$1', [bookingId]);
  expect(paid.rows[0].payment_status).toBe('paid');
  expect(paid.rows[0].status).toBe('confirmed');
});

test('checkout rejects a booking that is not the caller\'s', async () => {
  // A second member cannot pay for the first member's booking.
  const other = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  const r = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${other.body.token}`)
    .send({ bookingId, purpose: 'consultation' });
  expect(r.status).toBe(403);
  // Cleanup the throwaway user.
  await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [other.body.user.id]).catch(() => {});
  await db.query('DELETE FROM users WHERE id=$1', [other.body.user.id]).catch(() => {});
});

test('shadow receipt serializes into the vault export', async () => {
  const { buildVaultExport } = require('../src/lib/vault-export');
  const sr = await db.query('SELECT * FROM gps_shadow_receipts WHERE user_id=$1', [userId]);
  const files = buildVaultExport({
    user: { id: userId, email: 'x@example.com' },
    gpsReceipts: sr.rows,
  });
  const jsonl = files.find((f) => f.path === 'payments/gps-receipts.jsonl');
  expect(jsonl).toBeTruthy();
  const first = JSON.parse(jsonl.contents.trim().split('\n')[0]);
  expect(first.receipt_version).toBe('gps-receipt/1.0');
});

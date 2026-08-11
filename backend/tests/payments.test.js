/**
 * Payments — Beta V1 booking-only gate (S1B-R2).
 *
 * Online payments are HARD-DISABLED for this release. This suite proves the
 * booking-only contract and preserves EXACTLY SEVEN backend test blocks
 * (§3.5, §7, §10). Mapping (contract §6/§7):
 *   1. AT-6              — allocation-policy invariants retained (arithmetic
 *                          does not drift).
 *   2. AT-1/AT-2/AT-2b   — the adapter factory ALWAYS returns MockPaymentAdapter
 *                          (flag off, creds present, flag forced on) and the
 *                          Wompi path is code-unreachable.
 *   3. AT-3              — checkout is disabled, fail-closed, no side effects.
 *   4. AT-4A             — webhook is disabled (clean R2), no side effects.
 *   5. AT-5              — a booking completes without any payment.
 *   6. AT-7              — a SIMULATED GPS receipt (directly inserted, NOT from a
 *                          Wompi webhook) serializes into the vault export.
 *   7. AT-10             — simulation stores no PHI, mutates no real status, and
 *                          is atomic (forced mid-transaction failure rolls back).
 *
 * No test is `.skip`-ed. No live/sandbox Wompi call is made.
 */
const request = require('supertest');
const app = require('../src/server');
const db = require('../src/db');
const { subjectIdForUser } = require('../src/lib/identity');
const { getPaymentProvider, _resetProviderCache } = require('../src/adapters');
const { MockPaymentAdapter } = require('../src/adapters/MockPaymentAdapter');
const { computeAllocations, ENVELOPE_CAP_BPS, POLICY_ID } = require('../src/lib/payments/allocation-policy');
const { generateShadowReceipt } = require('../src/lib/gps-shadow');
const { buildVaultExport } = require('../src/lib/vault-export');

// The exact typed disabled response fixed by the contract (§5). Any drift here
// is a contract violation.
const DISABLED_BODY = {
  error: 'Online payments are disabled for this release.',
  code: 'ONLINE_PAYMENTS_DISABLED',
  enabled: false,
};

let token;
let userId;
let otherUserId;
let providerId;
let orgId;
let treatmentPlanId;
let appointmentId;
let bookingId; // owned booking used by AT-3

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;

  // A minimal provider + a member-owned booking for the checkout tests.
  const prov = await db.query(
    "INSERT INTO provider_profiles (provider_type, business_name) VALUES ('practitioner','Test Clinic') RETURNING id");
  providerId = prov.rows[0].id;
  const bk = await db.query(
    `INSERT INTO bookings (patient_id, provider_id, booking_date, start_time, end_time, status, total_price, currency)
     VALUES ($1,$2, CURRENT_DATE + 3, '10:00', '11:00', 'pending', 150.00, 'USD') RETURNING id`,
    [userId, providerId]);
  bookingId = bk.rows[0].id;
});

afterAll(async () => {
  try {
    await db.query('DELETE FROM split_receipts WHERE payer_user_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM payments WHERE payer_user_id=$1', [userId]).catch(() => {});
    await db.query("DELETE FROM wallets WHERE owner_type='user' AND owner_id=$1", [userId]).catch(() => {});
    if (treatmentPlanId) await db.query('DELETE FROM treatment_plans WHERE id=$1', [treatmentPlanId]).catch(() => {});
    if (appointmentId) await db.query('DELETE FROM appointments WHERE id=$1', [appointmentId]).catch(() => {});
    if (orgId) await db.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => {});
    const bks = await db.query('SELECT id FROM bookings WHERE patient_id=$1', [userId]).catch(() => ({ rows: [] }));
    for (const r of bks.rows) {
      await db.query('DELETE FROM booking_status_history WHERE booking_id=$1', [r.id]).catch(() => {});
      await db.query('DELETE FROM bookings WHERE id=$1', [r.id]).catch(() => {});
    }
    if (providerId) await db.query('DELETE FROM provider_profiles WHERE id=$1', [providerId]).catch(() => {});
    const subj = await subjectIdForUser(userId).catch(() => null);
    if (subj) {
      const its = await db.query('SELECT id FROM payment_intents WHERE subject_id=$1', [subj]);
      for (const r of its.rows) {
        await db.query('DELETE FROM gps_shadow_receipts WHERE intent_id=$1', [r.id]).catch(() => {});
        await db.query('DELETE FROM allocations WHERE intent_id=$1', [r.id]).catch(() => {});
        await db.query('DELETE FROM payment_events WHERE intent_id=$1', [r.id]).catch(() => {});
      }
      await db.query('DELETE FROM payment_intents WHERE subject_id=$1', [subj]).catch(() => {});
    }
    await db.query('DELETE FROM email_notifications WHERE user_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM notifications WHERE user_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [userId]).catch(() => {});
    if (otherUserId) {
      await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [otherUserId]).catch(() => {});
      await db.query('DELETE FROM users WHERE id=$1', [otherUserId]).catch(() => {});
    }
    await db.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => {});
  } finally {
    await db.pool.end();
  }
});

// 1) AT-6 — allocation policy invariants retained (payments.test.js:58 preserved).
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

// 2) AT-1 + AT-2 + AT-2b — the factory can never resolve Wompi in Beta.
test('adapter factory is hard-disabled: always MockPaymentAdapter, checkout still 403 (AT-1/AT-2/AT-2b)', async () => {
  const saved = {
    ONLINE_PAYMENTS_ENABLED: process.env.ONLINE_PAYMENTS_ENABLED,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY,
    WOMPI_PRIVATE_KEY: process.env.WOMPI_PRIVATE_KEY,
    WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET,
    WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET,
  };
  try {
    // AT-1 — flag absent -> Mock.
    delete process.env.ONLINE_PAYMENTS_ENABLED;
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.WOMPI_PUBLIC_KEY;
    delete process.env.WOMPI_PRIVATE_KEY;
    delete process.env.WOMPI_EVENTS_SECRET;
    delete process.env.WOMPI_INTEGRITY_SECRET;
    _resetProviderCache();
    expect(getPaymentProvider()).toBeInstanceOf(MockPaymentAdapter);

    // AT-2 — full Wompi credentials + PAYMENT_PROVIDER='wompi', flag unset -> STILL Mock.
    process.env.WOMPI_PUBLIC_KEY = 'pub_test_x';
    process.env.WOMPI_PRIVATE_KEY = 'prv_test_x';
    process.env.WOMPI_EVENTS_SECRET = 'evt_test_x';
    process.env.WOMPI_INTEGRITY_SECRET = 'int_test_x';
    process.env.PAYMENT_PROVIDER = 'wompi';
    _resetProviderCache();
    expect(getPaymentProvider()).toBeInstanceOf(MockPaymentAdapter);

    // AT-2b — flag forced 'true' + Wompi creds + provider='wompi' -> STILL Mock,
    // and checkout STILL returns the typed disabled 403 (Wompi is unreachable).
    process.env.ONLINE_PAYMENTS_ENABLED = 'true';
    _resetProviderCache();
    expect(getPaymentProvider()).toBeInstanceOf(MockPaymentAdapter);

    const chk = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookingId, purpose: 'consultation' });
    expect(chk.status).toBe(403);
    expect(chk.body).toEqual(DISABLED_BODY);

    // AT-2b — malformed / truthy-looking values all resolve disabled.
    for (const bad of ['yes', '1', ' TRUE ', '']) {
      process.env.ONLINE_PAYMENTS_ENABLED = bad;
      _resetProviderCache();
      expect(getPaymentProvider()).toBeInstanceOf(MockPaymentAdapter);
    }
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    _resetProviderCache();
  }
});

// 3) AT-3 — checkout disabled, fail-closed, no side effects.
test('checkout is disabled: 403 typed body, no intent row, booking unchanged, no provider call (AT-3)', async () => {
  const subj = await subjectIdForUser(userId);
  const before = await db.query('SELECT COUNT(*)::int AS n FROM payment_intents WHERE subject_id=$1', [subj]);
  const bkBefore = await db.query('SELECT payment_status FROM bookings WHERE id=$1', [bookingId]);
  const spy = jest.spyOn(MockPaymentAdapter.prototype, 'createCheckout');

  const res = await request(app)
    .post('/api/payments/checkout')
    .set('Authorization', `Bearer ${token}`)
    .send({ bookingId, purpose: 'consultation' });

  expect(res.status).toBe(403);
  expect(res.body).toEqual(DISABLED_BODY);

  const after = await db.query('SELECT COUNT(*)::int AS n FROM payment_intents WHERE subject_id=$1', [subj]);
  expect(after.rows[0].n).toBe(before.rows[0].n); // no intent inserted
  const bkAfter = await db.query('SELECT payment_status FROM bookings WHERE id=$1', [bookingId]);
  expect(bkAfter.rows[0].payment_status).toBe(bkBefore.rows[0].payment_status); // unchanged
  expect(spy).not.toHaveBeenCalled(); // no provider method invoked
  spy.mockRestore();
});

// 4) AT-4A — webhook disabled in the clean R2 workspace (non-secret body).
test('webhook is disabled: 200 typed body, no verifyWebhook, no event row, no confirm (AT-4A)', async () => {
  const verifySpy = jest.spyOn(MockPaymentAdapter.prototype, 'verifyWebhook');
  const eventsBefore = await db.query('SELECT COUNT(*)::int AS n FROM payment_events');

  // A non-secret, Wompi-shaped event body (valid or invalid signature is moot —
  // the handler returns before verification).
  const body = { event: 'transaction.updated', signature: { checksum: 'deadbeef' }, data: { transaction: { id: 'txn_x', reference: 'ref_x', status: 'APPROVED', amount_in_cents: 20000, currency: 'USD' } } };
  const res = await request(app).post('/api/payments/webhook').send(body);

  expect(res.status).toBe(200);
  expect(res.body).toEqual(DISABLED_BODY);
  expect(verifySpy).not.toHaveBeenCalled(); // no provider verification
  const eventsAfter = await db.query('SELECT COUNT(*)::int AS n FROM payment_events');
  expect(eventsAfter.rows[0].n).toBe(eventsBefore.rows[0].n); // no DB write
  verifySpy.mockRestore();
});

// 5) AT-5 — a booking completes without any payment.
test('booking completes without payment: 201 booking/reference/autoConfirmed, no intent (AT-5)', async () => {
  const subj = await subjectIdForUser(userId);
  const before = await db.query('SELECT COUNT(*)::int AS n FROM payment_intents WHERE subject_id=$1', [subj]);

  const res = await request(app)
    .post('/api/bookings/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerId, date: null, startTime: '10:00' });

  // Build a valid future date within the booking window (>= 2h, <= 90d ahead).
  const d = new Date();
  d.setDate(d.getDate() + 5);
  const date = d.toISOString().slice(0, 10);
  const res2 = await request(app)
    .post('/api/bookings/request')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerId, date, startTime: '10:00' });

  expect(res2.status).toBe(201);
  expect(res2.body.booking).toBeTruthy();
  expect(res2.body.reference).toBeTruthy();
  expect(['pending', 'confirmed']).toContain(res2.body.booking.status);
  expect(typeof res2.body.autoConfirmed).toBe('boolean');

  // No checkout was created and no payment intent exists.
  const after = await db.query('SELECT COUNT(*)::int AS n FROM payment_intents WHERE subject_id=$1', [subj]);
  expect(after.rows[0].n).toBe(before.rows[0].n);
  // The first (date:null) request must have been rejected, not created.
  expect(res.status).toBe(400);
});

// 6) AT-7 — a directly-inserted SIMULATED receipt serializes into the vault export.
test('simulated GPS receipt (directly inserted, not a webhook) serializes into the vault export (AT-7)', async () => {
  const subjectId = await subjectIdForUser(userId);
  const ins = await db.query(
    `INSERT INTO payment_intents
       (subject_id, user_id, amount_cents, currency, purpose, status, provider, source, idempotency_key)
     VALUES ($1,$2,$3,'USD','consultation','paid','mock','simulated',$4)
     RETURNING *`,
    [subjectId, userId, 20000, 'at7_' + Date.now()]);
  const intent = ins.rows[0];

  const { legs } = computeAllocations(intent.amount_cents);
  for (const leg of legs) {
    await db.query(
      `INSERT INTO allocations
         (intent_id, subject_id, recipient_label, bucket, canonical_domain_id, share_bps, amount_cents, settlement_status, source, consent_scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'SIMULATED',$8,'payments')`,
      [intent.id, intent.subject_id, leg.label, leg.bucket, leg.canonicalDomainId, leg.shareBps, leg.amountCents, POLICY_ID]);
  }
  // Persist the shadow receipt directly (not via a Wompi webhook path).
  await generateShadowReceipt(db, intent, legs, null);

  const sr = await db.query('SELECT * FROM gps_shadow_receipts WHERE user_id=$1', [userId]);
  expect(sr.rows.length).toBeGreaterThanOrEqual(1);

  const files = buildVaultExport({ user: { id: userId, email: 'x@example.com' }, gpsReceipts: sr.rows });
  const jsonl = files.find((f) => f.path === 'payments/gps-receipts.jsonl');
  expect(jsonl).toBeTruthy();

  const lines = jsonl.contents.trim().split('\n');
  expect(lines.length).toBeGreaterThanOrEqual(1);
  for (const line of lines) {
    const receipt = JSON.parse(line);
    expect(receipt.receipt_version).toBe('gps-receipt/1.0');
    expect(receipt.settlement_summary.settled_cents).toBe(0);
    expect(receipt.allocations.length).toBeGreaterThanOrEqual(1);
    expect(receipt.allocations.every((a) => a.status === 'SIMULATED' && a.settled_cents === 0)).toBe(true);
  }
});

// 7) AT-10 — simulation stores no PHI, mutates no real status, and is atomic.
test('simulate: no PHI, no real-status mutation, fixed description, atomic rollback (AT-10)', async () => {
  const FIXED = 'Simulated GPS demonstration';
  const PHI = 'Alejandro anxiety diagnosis 2026-08-01';

  // Real rows with known status columns, snapshotted before the call.
  const org = await db.query("INSERT INTO organizations (name, type) VALUES ('Test Org','clinic') RETURNING id");
  orgId = org.rows[0].id;
  const bk = await db.query(
    `INSERT INTO bookings (patient_id, provider_id, booking_date, start_time, end_time, status, payment_status, total_price, currency)
     VALUES ($1,$2, CURRENT_DATE + 4, '09:00', '10:00', 'pending', 'unpaid', 100.00, 'USD') RETURNING id, status, payment_status`,
    [userId, providerId]);
  const at10BookingId = bk.rows[0].id;
  const appt = await db.query(
    "INSERT INTO appointments (org_id, patient_id, title, status) VALUES ($1,$2,'Visit','confirmed') RETURNING id, status",
    [orgId, userId]);
  appointmentId = appt.rows[0].id;
  const tp = await db.query(
    "INSERT INTO treatment_plans (org_id, patient_id, title, status) VALUES ($1,$2,'Plan','pending') RETURNING id, status",
    [orgId, userId]);
  treatmentPlanId = tp.rows[0].id;

  const snapBk = bk.rows[0];
  const snapAppt = appt.rows[0];
  const snapTp = tp.rows[0];

  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const noPhiInSpies = () => {
    for (const s of [logSpy, errSpy, warnSpy]) {
      for (const call of s.mock.calls) {
        const joined = call.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        expect(joined).not.toContain('Alejandro');
        expect(joined).not.toContain('anxiety');
        expect(joined).not.toContain('diagnosis');
      }
    }
  };

  try {
    // --- Part 1: legacy PHI description + treatmentPlanId are ignored entirely.
    const res = await request(app)
      .post('/api/payments/simulate')
      .set('Authorization', `Bearer ${token}`)
      .send({ orgId, amountSats: 100000, description: PHI, treatmentPlanId });

    expect(res.status).toBe(201);
    expect(res.body.payment.description).toBe(FIXED);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('Alejandro');
    expect(bodyStr).not.toContain('anxiety');
    expect(bodyStr).not.toContain('diagnosis');

    // Stored payment description is exactly the fixed neutral string.
    const stored = await db.query('SELECT description FROM payments WHERE id=$1', [res.body.payment.id]);
    expect(stored.rows[0].description).toBe(FIXED);

    // GET /mine exposes only the fixed description, no PHI.
    const mine = await request(app).get('/api/payments/mine').set('Authorization', `Bearer ${token}`);
    expect(mine.status).toBe(200);
    expect(mine.body.payments.length).toBeGreaterThanOrEqual(1);
    for (const p of mine.body.payments) expect(p.description).toBe(FIXED);
    expect(JSON.stringify(mine.body)).not.toContain('Alejandro');

    // Zero mutation to real booking/appointment/treatment-plan status columns.
    const bkNow = await db.query('SELECT status, payment_status FROM bookings WHERE id=$1', [at10BookingId]);
    expect(bkNow.rows[0].status).toBe(snapBk.status);
    expect(bkNow.rows[0].payment_status).toBe(snapBk.payment_status);
    const apptNow = await db.query('SELECT status FROM appointments WHERE id=$1', [appointmentId]);
    expect(apptNow.rows[0].status).toBe(snapAppt.status);
    const tpNow = await db.query('SELECT status FROM treatment_plans WHERE id=$1', [treatmentPlanId]);
    expect(tpNow.rows[0].status).toBe(snapTp.status);
    noPhiInSpies();

    // --- Part 1b: strict bounded amountSats. Every non-integer / partial /
    //     out-of-range value is rejected 400 with no new payment row.
    const payCountBeforeBad = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1', [userId]);
    const badAmounts = ['10abc', '1.5', 1.5, '', '-5', -5, 0, '0', 'NaN', null, {}, [], true, Number.MAX_SAFE_INTEGER + 1];
    for (const bad of badAmounts) {
      const r = await request(app)
        .post('/api/payments/simulate')
        .set('Authorization', `Bearer ${token}`)
        .send({ orgId, amountSats: bad });
      expect(r.status).toBe(400);
    }
    const payCountAfterBad = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1', [userId]);
    expect(payCountAfterBad.rows[0].n).toBe(payCountBeforeBad.rows[0].n);

    // --- Part 2 (atomicity): inject a deterministic failure AFTER the payments
    //     INSERT but BEFORE the write set completes; assert a clean ROLLBACK.
    const payBefore = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1', [userId]);
    const recBefore = await db.query('SELECT COUNT(*)::int AS n FROM split_receipts WHERE payer_user_id=$1', [userId]);
    const linkBefore = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1 AND split_receipt_id IS NOT NULL', [userId]);
    const wBefore = await db.query("SELECT COALESCE(balance_sats_simulated,0)::bigint AS b FROM wallets WHERE owner_type='user' AND owner_id=$1", [userId]);
    const balBefore = wBefore.rows.length ? wBefore.rows[0].b : '0';

    const realConnect = db.pool.connect.bind(db.pool);
    // Poison ONLY the transaction client (the endpoint acquires it via the
    // promise form `await db.pool.connect()`). Fail on the split_receipts
    // INSERT — this runs AFTER the payments row is written on the txn client,
    // so at least one write has been issued. ROLLBACK / other statements pass
    // through to the real client so the transaction unwinds cleanly and the
    // client is safe to release.
    const wrapTxnClient = (client) => {
      const origQuery = client.query.bind(client);
      client.query = (...args) => {
        const sql = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].text) || '';
        if (/INSERT INTO split_receipts/i.test(sql)) {
          return Promise.reject(new Error('INJECTED deterministic mid-transaction failure'));
        }
        return origQuery(...args);
      };
      return client;
    };
    // pg-pool's `pool.query` (used by db.query for the endpoint's
    // pre-transaction SELECTs) invokes `connect(cb)` in CALLBACK form; the
    // endpoint's transaction uses the no-arg PROMISE form. Support both:
    // callback-form connects get a clean client, promise-form connects get the
    // poisoned txn client.
    const connectSpy = jest.spyOn(db.pool, 'connect').mockImplementation((maybeCb) => {
      if (typeof maybeCb === 'function') {
        realConnect().then(
          (client) => maybeCb(null, client, client.release.bind(client)),
          (err) => maybeCb(err)
        );
        return undefined;
      }
      return realConnect().then(wrapTxnClient);
    });

    let failRes;
    try {
      failRes = await request(app)
        .post('/api/payments/simulate')
        .set('Authorization', `Bearer ${token}`)
        .send({ orgId, amountSats: 50000 });
    } finally {
      connectSpy.mockRestore();
    }
    expect(failRes.status).toBe(500);

    // After the forced ROLLBACK: zero new rows and zero balance change.
    const payAfter = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1', [userId]);
    const recAfter = await db.query('SELECT COUNT(*)::int AS n FROM split_receipts WHERE payer_user_id=$1', [userId]);
    const linkAfter = await db.query('SELECT COUNT(*)::int AS n FROM payments WHERE payer_user_id=$1 AND split_receipt_id IS NOT NULL', [userId]);
    expect(payAfter.rows[0].n).toBe(payBefore.rows[0].n);
    expect(recAfter.rows[0].n).toBe(recBefore.rows[0].n);
    expect(linkAfter.rows[0].n).toBe(linkBefore.rows[0].n);
    const wAfter = await db.query("SELECT COALESCE(balance_sats_simulated,0)::bigint AS b FROM wallets WHERE owner_type='user' AND owner_id=$1", [userId]);
    const balAfter = wAfter.rows.length ? wAfter.rows[0].b : '0';
    expect(String(balAfter)).toBe(String(balBefore));

    // The transaction client was released — a normal query still succeeds.
    const ping = await db.query('SELECT 1 AS ok');
    expect(ping.rows[0].ok).toBe(1);

    // Real rows still untouched after the failed attempt.
    const bkNow2 = await db.query('SELECT status, payment_status FROM bookings WHERE id=$1', [at10BookingId]);
    expect(bkNow2.rows[0].status).toBe(snapBk.status);
    expect(bkNow2.rows[0].payment_status).toBe(snapBk.payment_status);
    noPhiInSpies();
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
    await db.query('DELETE FROM bookings WHERE id=$1', [at10BookingId]).catch(() => {});
  }
});

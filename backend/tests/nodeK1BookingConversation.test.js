/**
 * NODE K1 — §F booking ↔ canonical conversation link: POST /api/bookings/request
 *
 * These tests exercise the booking route's NEW behaviour in isolation with a
 * fully MOCKED data layer — no real Postgres, and NOT the live :5055 backend
 * shared by Demo/Stable. We assert that a booking against a real, approved,
 * CLAIMED practitioner owner also upserts the canonical member↔practitioner
 * conversation INSIDE the same transaction (reusing the existing
 * UNIQUE(patient_id, practitioner_id) row — no conversation-per-booking, no new
 * inbox model, no new migration), while a booking against an unmapped/demo
 * provider still succeeds but returns conversationId:null.
 *
 * Acceptance guards:
 *   • Mapped/approved/claimed practitioner  → 201, conversationId returned, the
 *     conversation upsert (ON CONFLICT … DO UPDATE) runs on the txn client.
 *   • Unmapped / demo provider              → 201, conversationId:null, NO
 *     conversation insert (backward compatible).
 *   • Conversation upsert fails             → whole booking rolls back (500 +
 *     ROLLBACK), so we never leave a threadless booking for a mapped owner.
 */

// ----- mock the data + cross-cutting modules BEFORE requiring the router -----
let mockProviderRow;          // configured per-test
let mockConvShouldFail = false;

const mockDbQuery = jest.fn((sql) => {
  const s = String(sql);
  if (/FROM provider_profiles/i.test(s)) return Promise.resolve({ rows: mockProviderRow ? [mockProviderRow] : [] });
  if (/FROM provider_services/i.test(s)) return Promise.resolve({ rows: [] });
  if (/FROM users WHERE id=/i.test(s)) return Promise.resolve({ rows: [{ full_name: 'Test Patient', email: 'patient@example.test' }] });
  return Promise.resolve({ rows: [] });
});

const mockClientQuery = jest.fn((sql, params) => {
  const s = String(sql);
  if (/^\s*BEGIN/i.test(s)) return Promise.resolve({});
  if (/^\s*COMMIT/i.test(s)) return Promise.resolve({});
  if (/^\s*ROLLBACK/i.test(s)) return Promise.resolve({});
  if (/FOR UPDATE/i.test(s)) return Promise.resolve({ rows: [] });                 // clash check: no conflicts
  if (/INSERT INTO bookings/i.test(s)) return Promise.resolve({ rows: [{ id: 'booking-uuid-abcdef01', status: params[6] }] });
  if (/INSERT INTO booking_status_history/i.test(s)) return Promise.resolve({ rows: [] });
  if (/UPDATE provider_time_slots/i.test(s)) return Promise.resolve({ rows: [] });
  if (/INSERT INTO conversations/i.test(s)) {
    if (mockConvShouldFail) return Promise.reject(new Error('conversation upsert failed'));
    return Promise.resolve({ rows: [{ id: 'conv-uuid-1' }] });
  }
  return Promise.resolve({ rows: [] });
});

const mockRelease = jest.fn();

jest.mock('../src/db', () => ({
  query: (...a) => mockDbQuery(...a),
  pool: { connect: () => Promise.resolve({ query: (...a) => mockClientQuery(...a), release: mockRelease }) },
}));

jest.mock('../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    const raw = req.headers['x-test-user'];
    if (raw) { try { req.user = JSON.parse(raw); } catch { req.user = {}; } }
    else req.user = {};
    next();
  },
  generateToken: () => 't', verifyToken: () => ({}),
}));

jest.mock('../src/lib/notifications', () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/lib/booking-emails', () => ({ sendBookingEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/lib/time-slots', () => ({
  generateSlots: () => [],
  priceSplit: (p) => ({ total: p, platformFee: 0, providerPayout: p }),
  withinBookingWindow: () => true,
  hoursUntil: () => 100,
  ymd: () => '2026-01-01',
  timeToMinutes: (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; },
}));

const express = require('express');
const request = require('supertest');
const bookingsRouter = require('../src/routes/bookings');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingsRouter);
  return app;
}

const withUser = (r, user) => r.set('x-test-user', JSON.stringify(user));
const validBody = { providerId: 'prov-1', date: '2026-02-01', startTime: '10:00' };

const MAPPED_PRACTITIONER = {
  id: 'prov-1', business_name: 'Green Clinic', address: '1 Main St',
  user_id: 'practitioner-user-1', auto_confirm_bookings: false,
  owner_role: 'practitioner', approval_status: 'approved', claimed: true,
};
const DEMO_PROVIDER = {
  id: 'prov-1', business_name: 'Demo Wellness', address: '2 Sample Ave',
  user_id: null, auto_confirm_bookings: false,
  owner_role: null, approval_status: null, claimed: false,
};

beforeEach(() => {
  mockDbQuery.mockClear();
  mockClientQuery.mockClear();
  mockRelease.mockClear();
  mockProviderRow = undefined;
  mockConvShouldFail = false;
});

describe('POST /api/bookings/request — canonical conversation link (§F)', () => {
  it('mapped/approved/claimed practitioner → 201 with conversationId and an in-txn upsert', async () => {
    mockProviderRow = MAPPED_PRACTITIONER;
    const res = await withUser(request(makeApp()).post('/api/bookings/request'), { userId: 'patient-1' })
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBe('conv-uuid-1');

    const calls = mockClientQuery.mock.calls.map((c) => String(c[0]));
    const convCall = mockClientQuery.mock.calls.find((c) => /INSERT INTO conversations/i.test(String(c[0])));
    expect(convCall).toBeTruthy();
    // Upsert reuses the canonical row (never one-per-booking).
    expect(String(convCall[0])).toMatch(/ON CONFLICT \(patient_id, practitioner_id\) DO UPDATE/i);
    // patient = authenticated member; practitioner = server-derived owner (not client-supplied).
    expect(convCall[1]).toEqual(['patient-1', 'practitioner-user-1']);
    // Runs inside the committed transaction, after the booking insert, before COMMIT.
    expect(calls).toContain('COMMIT');
    const convIdx = calls.findIndex((s) => /INSERT INTO conversations/i.test(s));
    const commitIdx = calls.findIndex((s) => /^\s*COMMIT/i.test(s));
    const bookingIdx = calls.findIndex((s) => /INSERT INTO bookings/i.test(s));
    expect(bookingIdx).toBeLessThan(convIdx);
    expect(convIdx).toBeLessThan(commitIdx);
  });

  it('unmapped / demo provider → 201 with conversationId:null and NO conversation insert', async () => {
    mockProviderRow = DEMO_PROVIDER;
    const res = await withUser(request(makeApp()).post('/api/bookings/request'), { userId: 'patient-1' })
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBeNull();
    const convCall = mockClientQuery.mock.calls.find((c) => /INSERT INTO conversations/i.test(String(c[0])));
    expect(convCall).toBeUndefined();
    // The booking itself still committed.
    const calls = mockClientQuery.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('COMMIT');
  });

  it('conversation upsert failure rolls the whole booking back (500 + ROLLBACK)', async () => {
    mockProviderRow = MAPPED_PRACTITIONER;
    mockConvShouldFail = true;
    const res = await withUser(request(makeApp()).post('/api/bookings/request'), { userId: 'patient-1' })
      .send(validBody);

    expect(res.status).toBe(500);
    const calls = mockClientQuery.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it('an approved but UNCLAIMED provider does not create a conversation', async () => {
    mockProviderRow = { ...MAPPED_PRACTITIONER, claimed: false };
    const res = await withUser(request(makeApp()).post('/api/bookings/request'), { userId: 'patient-1' })
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.conversationId).toBeNull();
    const convCall = mockClientQuery.mock.calls.find((c) => /INSERT INTO conversations/i.test(String(c[0])));
    expect(convCall).toBeUndefined();
  });
});

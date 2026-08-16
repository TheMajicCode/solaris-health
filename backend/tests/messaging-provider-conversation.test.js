/**
 * NODE E2 — secure practitioner messaging: POST /api/messages/conversations/provider
 *
 * These tests exercise the new provider-conversation route in isolation with a
 * fully MOCKED data layer — no real Postgres, and NOT the live :5055 backend
 * shared by Demo/Stable. The `../src/db`, `../src/lib/helpers` and
 * `../src/middleware/auth` modules are jest-mocked so the route's guards and
 * SQL-shaped decisions are asserted deterministically and offline.
 *
 * Acceptance guards:
 *   • Unauthenticated / unknown requester → 401.
 *   • Non patient/member role → 403.
 *   • Missing / non-string providerId → neutral 404 (no enumeration).
 *   • Ineligible provider (hidden/unclaimed/pending/…): query returns no row →
 *     the SAME neutral 404.
 *   • Malformed provider id (query throws) → the SAME neutral 404.
 *   • Eligible provider → 200, conversation upserted, recipientReady reflects
 *     whether the practitioner has published an encryption key. The client only
 *     ever supplies providerId (never a practitioner user id / contactId).
 */

// ----- mock the data + cross-cutting modules BEFORE requiring the router -----
const mockQuery = jest.fn();
jest.mock('../src/db', () => ({ query: (...a) => mockQuery(...a), pool: {} }));
jest.mock('../src/lib/helpers', () => ({ audit: jest.fn().mockResolvedValue(undefined) }));

// Auth middleware: trust an injected `x-test-user` JSON header so each test can
// present whatever { userId } it needs (or none → 401 path via getUser).
jest.mock('../src/middleware/auth', () => ({
  authMiddleware: (req, res, next) => {
    const raw = req.headers['x-test-user'];
    if (raw) { try { req.user = JSON.parse(raw); } catch { req.user = {}; } }
    else req.user = {};
    next();
  },
  generateToken: () => 't', verifyToken: () => ({}),
}));

// notifications / crypto are pulled in by the router module graph but unused here.
jest.mock('../src/lib/notifications', () => ({ createNotification: jest.fn() }));

const express = require('express');
const request = require('supertest');
const messagesRouter = require('../src/routes/messages');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messagesRouter);
  return app;
}

const withUser = (r, user) => r.set('x-test-user', JSON.stringify(user));
const NEUTRAL = 'This profile is not available for secure messaging yet';

beforeEach(() => { mockQuery.mockReset(); });

describe('POST /api/messages/conversations/provider', () => {
  it('401 when the requester resolves to no user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // getUser → none
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'ghost' })
      .send({ providerId: 'p1' });
    expect(res.status).toBe(401);
  });

  it('403 when the requester is not a patient/member', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'practitioner' }] }); // getUser
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'u1' })
      .send({ providerId: 'p1' });
    expect(res.status).toBe(403);
  });

  it('neutral 404 when providerId is missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'patient' }] }); // getUser
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'u1' })
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(NEUTRAL);
  });

  it('neutral 404 when providerId is not a string', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'patient' }] }); // getUser
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'u1' })
      .send({ providerId: { evil: true } });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(NEUTRAL);
  });

  it('neutral 404 when the provider is ineligible (no matching row)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'patient' }] }) // getUser
      .mockResolvedValueOnce({ rows: [] });                             // eligibility join → none
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'u1' })
      .send({ providerId: 'hidden-or-unclaimed' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(NEUTRAL);
  });

  it('neutral 404 when the eligibility query throws (malformed id)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'u1', role: 'patient' }] }) // getUser
      .mockRejectedValueOnce(new Error('invalid input syntax for type uuid'));
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'u1' })
      .send({ providerId: 'not-a-uuid' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(NEUTRAL);
  });

  it('200 with recipientReady=true for an eligible provider whose practitioner has a key', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'patient-1', role: 'patient' }] })                       // getUser
      .mockResolvedValueOnce({ rows: [{ provider_id: 'prof-9', user_id: 'prac-7', user_role: 'practitioner', full_name: 'Dr Mateo Reyes', avatar_url: null }] }) // eligibility
      .mockResolvedValueOnce({ rows: [{ id: 'conv-1', patient_id: 'patient-1', practitioner_id: 'prac-7' }] }) // upsert
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });                            // encryption key exists
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'patient-1' })
      .send({ providerId: 'prof-9' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      conversationId: 'conv-1',
      otherId: 'prac-7',
      otherName: 'Dr Mateo Reyes',
      otherRole: 'practitioner',
      recipientReady: true,
    });
  });

  it('200 with recipientReady=false when the practitioner has no key yet', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'patient-1', role: 'member' }] })                        // getUser (member alias)
      .mockResolvedValueOnce({ rows: [{ provider_id: 'prof-9', user_id: 'prac-7', user_role: 'practitioner', full_name: 'Dr Mateo Reyes', avatar_url: null }] }) // eligibility
      .mockResolvedValueOnce({ rows: [{ id: 'conv-1', patient_id: 'patient-1', practitioner_id: 'prac-7' }] }) // upsert
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });                                             // no encryption key
    const res = await withUser(request(makeApp()).post('/api/messages/conversations/provider'), { userId: 'patient-1' })
      .send({ providerId: 'prof-9' });
    expect(res.status).toBe(200);
    expect(res.body.recipientReady).toBe(false);
  });
});

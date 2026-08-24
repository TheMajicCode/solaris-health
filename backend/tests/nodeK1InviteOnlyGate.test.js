/**
 * NODE K1 — §G invite-only Beta gate: POST /api/auth/register
 *
 * The BETA_INVITE_ONLY 12-factor gate is exercised in ISOLATION with a fully
 * MOCKED data layer — no real Postgres, and NOT the live :5055 backend shared by
 * Demo/Stable. The gate refuses public self-registration BEFORE any DB work when
 * enabled, and is a no-op (default) when unset, so registration proceeds to the
 * normal DB path. This proves the gate is real server-side enforcement (not just
 * a hidden frontend button) while remaining DEFAULT-OFF until the Beta cutover.
 */

const mockQuery = jest.fn();
jest.mock('../src/db', () => ({ query: (...a) => mockQuery(...a), pool: {} }));
// The register handler pulls these in via the module graph; stub so require works
// and no real side effects run. None are reached on the gate-ON path.
jest.mock('../src/lib/identity', () => ({ ensureSubjectForUser: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/lib/gps-engine', () => ({ ensureReferralCode: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/lib/notification-provider', () => ({ send: jest.fn().mockResolvedValue(undefined) }));

const express = require('express');
const request = require('supertest');
const authRouter = require('../src/routes/auth');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

const NEUTRAL = 'Solaris is currently invite-only. Please join the waitlist to request access.';
const VALID = { email: 'invitee@example.test', password: 'Passw0rd123', firstName: 'A', lastName: 'B' };

const prevFlag = process.env.BETA_INVITE_ONLY;
beforeEach(() => { mockQuery.mockReset(); });
afterAll(() => {
  if (prevFlag === undefined) delete process.env.BETA_INVITE_ONLY;
  else process.env.BETA_INVITE_ONLY = prevFlag;
});

describe('POST /api/auth/register — invite-only gate (§G)', () => {
  it('refuses public registration with 403 (before any DB work) when BETA_INVITE_ONLY=true', async () => {
    process.env.BETA_INVITE_ONLY = 'true';
    const res = await request(makeApp()).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(NEUTRAL);
    expect(res.body.token).toBeUndefined();
    // Gate short-circuits BEFORE touching the database.
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('is case/whitespace tolerant ("  TRUE  ") and still refuses', async () => {
    process.env.BETA_INVITE_ONLY = '  TRUE  ';
    const res = await request(makeApp()).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('is a no-op when unset (default) — registration proceeds to the DB path', async () => {
    delete process.env.BETA_INVITE_ONLY;
    // Simulate an already-registered email so the handler returns 400 immediately
    // after the gate, proving control passed the gate and reached DB logic.
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });
    const res = await request(makeApp()).post('/api/auth/register').send(VALID);
    expect(res.status).not.toBe(403);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('is a no-op when explicitly "false"', async () => {
    process.env.BETA_INVITE_ONLY = 'false';
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });
    const res = await request(makeApp()).post('/api/auth/register').send(VALID);
    expect(res.status).not.toBe(403);
    expect(mockQuery).toHaveBeenCalled();
  });
});

'use strict';
/**
 * WEB-R1: exercise the real router and JWT/revocation middleware with synthetic
 * sessions and a fully mocked database. Never import server.js or open a pool.
 */
const TEST_JWT_SECRET = 'web-r1-synthetic-session-secret-for-tests-only';
process.env.JWT_SECRET = TEST_JWT_SECRET;

jest.mock('../src/db', () => ({ query: jest.fn() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');
const contextRouter = require('../src/routes/luca-context');

const OWNER_ID = 'aabbccdd-1234-4abc-8def-001122334455';
const OTHER_ID = 'bbccddee-2345-4bcd-9efa-112233445566';
const TOKEN_ID = 'web-r1-synthetic-token';
const PRIVATE_ERROR = 'WEB_R1_SYNTHETIC_PRIVATE_DETAIL';
const app = express();
app.set('query parser', 'extended');
app.use('/api/luca', contextRouter);

function token(claims = {}, options = {}, secret = TEST_JWT_SECRET) {
  return jwt.sign({ userId: OWNER_ID, role: 'patient', jti: TOKEN_ID, ...claims }, secret, {
    expiresIn: '5m',
    ...options,
  });
}

function getContext(query = '', session = token()) {
  return request(app).get(`/api/luca/context${query}`).set('Authorization', `Bearer ${session}`);
}

function contextQueries() {
  return db.query.mock.calls.filter(([sql]) => !sql.includes('FROM revoked_tokens'));
}

function expectNoContextReads() {
  expect(contextQueries()).toEqual([]);
}

let contextRows;
let contextReadCount;
let failAt;
let revokedRows;
let revocationFailure;
let errorSpy;

beforeEach(() => {
  contextRows = [
    [{
      id: OWNER_ID,
      role: 'patient',
      display_name: 'Synthetic owner',
      full_name: 'Synthetic full name',
      email: 'synthetic-owner@example.invalid',
      password_hash: 'not-a-real-password-hash',
      level_points: 5,
      nostr_npub: null,
      did: 'did:example:web-r1-synthetic',
      key_custody: 'self',
    }],
    [{
      role: 'patient',
      job: 'Synthetic guidance',
      first_message_template: 'Welcome, {name}',
      top_actions: '["Review your plan"]',
      tone: 'warm',
    }],
    [{
      id: 'synthetic-appointment',
      title: 'Synthetic appointment',
      scheduled_at: '2026-09-13T12:00:00.000Z',
      status: 'scheduled',
      follow_up_status: 'draft',
      org_name: 'Synthetic clinic',
    }],
    [{ c: 2 }],
    [{ c: 3 }],
    [{
      id: 'synthetic-contribution',
      kind: 'self_care',
      points: 5,
      status: 'recorded',
      created_at: '2026-09-12T12:00:00.000Z',
    }],
  ];
  contextReadCount = 0;
  failAt = -1;
  revokedRows = [];
  revocationFailure = false;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  db.query.mockReset();
  db.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM revoked_tokens')) {
      if (revocationFailure) throw new Error(PRIVATE_ERROR);
      return { rows: revokedRows };
    }
    const index = contextReadCount++;
    if (index === failAt) {
      throw Object.assign(new Error(PRIVATE_ERROR), { code: '08006', detail: OWNER_ID });
    }
    if (!contextRows[index]) throw new Error('Unexpected context query in test');
    return { rows: contextRows[index] };
  });
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('LUCA context account boundary', () => {
  test.each([
    ['omitted', '', OWNER_ID],
    ['same account', `?user_id=${OWNER_ID}`, OWNER_ID],
    ['uppercase query', `?user_id=${OWNER_ID.toUpperCase()}`, OWNER_ID],
    ['uppercase session', `?user_id=${OWNER_ID}`, OWNER_ID.toUpperCase()],
  ])('%s uses the session account for every private-record query', async (_label, query, sessionId) => {
    const res = await getContext(query, token({ userId: sessionId }));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(OWNER_ID);
    expect(db.query.mock.calls[0]).toEqual([
      'SELECT id FROM revoked_tokens WHERE jti = $1', [TOKEN_ID],
    ]);
    expect(contextQueries().map(([, params]) => params)).toEqual([
      [sessionId], ['patient'], [sessionId], [sessionId], [sessionId], [sessionId],
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('preserves the complete success response and excludes unselected user fields', async () => {
    const res = await getContext();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: OWNER_ID,
        name: 'Synthetic owner',
        role: 'patient',
        npub: null,
        did: 'did:example:web-r1-synthetic',
        keyCustody: 'self',
      },
      level: { points: 5, level: 5, band: 'Bronze', color: '#B87333', pointsToNext: 5, progress: 0.5 },
      pending: {
        appointments: [{
          id: 'synthetic-appointment',
          title: 'Synthetic appointment',
          scheduledAt: '2026-09-13T12:00:00.000Z',
          status: 'scheduled',
          followUpStatus: 'draft',
          orgName: 'Synthetic clinic',
        }],
        followUpsPending: 2,
        receiptsCount: 3,
      },
      recentLedger: [{
        id: 'synthetic-contribution',
        kind: 'self_care',
        points: 5,
        status: 'recorded',
        createdAt: '2026-09-12T12:00:00.000Z',
      }],
      guidance: {
        role: 'patient',
        job: 'Synthetic guidance',
        firstMessageTemplate: 'Welcome, {name}',
        topActions: ['Review your plan'],
        tone: 'warm',
      },
      simulated: true,
    });
  });

  test('preserves empty-context defaults and already-decoded guidance actions', async () => {
    contextRows[0][0].level_points = null;
    contextRows[1][0].top_actions = ['Review your plan'];
    contextRows[2] = [];
    contextRows[3] = [{ c: 0 }];
    contextRows[4] = [{ c: 0 }];
    contextRows[5] = [];
    const res = await getContext();
    expect(res.status).toBe(200);
    expect(res.body.level).toEqual({
      points: 0, level: 0, band: 'Bronze', color: '#B87333', pointsToNext: 10, progress: 0,
    });
    expect(res.body.pending).toEqual({ appointments: [], followUpsPending: 0, receiptsCount: 0 });
    expect(res.body.recentLedger).toEqual([]);
    expect(res.body.guidance.topActions).toEqual(['Review your plan']);
  });

  test('preserves missing-guidance and name fallback behavior', async () => {
    contextRows[0][0].display_name = null;
    contextRows[1] = [];
    const res = await getContext();
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Synthetic full name');
    expect(res.body.guidance).toBeNull();
  });

  test.each(['patient', 'practitioner', 'staff', 'admin', 'partner'])('%s cannot select another account', async (role) => {
    const res = await getContext(`?user_id=${OTHER_ID}`, token({ role }));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expectNoContextReads();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('does not reveal whether a different requested account exists', async () => {
    contextRows[0] = [];
    const res = await getContext(`?user_id=${OTHER_ID}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expectNoContextReads();
  });

  test.each([
    ['empty', '?user_id='],
    ['no value', '?user_id'],
    ['non-UUID', '?user_id=not-a-uuid'],
    ['null text', '?user_id=null'],
    ['number', '?user_id=42'],
    ['leading whitespace', `?user_id=%20${OWNER_ID}`],
    ['trailing whitespace', `?user_id=${OWNER_ID}%20`],
    ['trailing newline', `?user_id=${OWNER_ID}%0A`],
    ['compact UUID', `?user_id=${OWNER_ID.replace(/-/g, '')}`],
    ['SQL-shaped value', '?user_id=%27%20OR%201%3D1--'],
    ['duplicate identical values', `?user_id=${OWNER_ID}&user_id=${OWNER_ID}`],
    ['duplicate different values', `?user_id=${OWNER_ID}&user_id=${OTHER_ID}`],
    ['array', `?user_id[]=${OWNER_ID}`],
    ['indexed array', `?user_id[0]=${OWNER_ID}`],
    ['object', `?user_id[id]=${OWNER_ID}`],
  ])('rejects %s input before context SQL', async (_label, query) => {
    const res = await getContext(query);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid user_id' });
    expectNoContextReads();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['missing', undefined], ['null', null], ['empty', ''], ['non-UUID', 'invalid-subject'],
    ['number', 42], ['array', [OWNER_ID]], ['object', { id: OWNER_ID }],
    ['trailing newline', `${OWNER_ID}\n`],
  ])('rejects a signed token with %s userId even when a query supplies an owner', async (_label, userId) => {
    const res = await getContext(`?user_id=${OWNER_ID}`, token({ userId }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expectNoContextReads();
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe('real authentication and revocation remain mandatory', () => {
  test('rejects a missing Authorization header without any database access', async () => {
    const res = await request(app).get(`/api/luca/context?user_id=${OWNER_ID}`);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each([
    ['malformed token', () => 'not-a-token'],
    ['wrong signature', () => token({}, {}, 'different-synthetic-signing-key')],
    ['expired token', () => token({}, { expiresIn: -1 })],
    ['missing jti', () => token({ jti: undefined })],
  ])('rejects %s before revocation or context reads', async (_label, makeToken) => {
    const res = await getContext(`?user_id=${OTHER_ID}`, makeToken());
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('denies a revoked session before context reads', async () => {
    revokedRows = [{ id: 'synthetic-revocation' }];
    const res = await getContext();
    expect(res.status).toBe(401);
    expectNoContextReads();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('fails closed when revocation storage is unavailable', async () => {
    revocationFailure = true;
    const res = await getContext();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
    expectNoContextReads();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('context storage failures', () => {
  test('returns 404 when the authenticated account is absent without querying related records', async () => {
    contextRows[0] = [];
    const res = await getContext();
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'User not found' });
    expect(contextQueries()).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['owner', 0], ['guidance', 1], ['appointments', 2], ['follow-ups', 3], ['receipts', 4], ['ledger', 5],
  ])('returns only a generic error on %s query failure', async (_label, index) => {
    failAt = index;
    const res = await getContext();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
    expect(contextQueries()).toHaveLength(index + 1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[luca-context] context unavailable');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PRIVATE_ERROR);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(OWNER_ID);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('08006');
  });

  test('does not expose invalid stored guidance or partial user context', async () => {
    contextRows[1][0].top_actions = PRIVATE_ERROR;
    const res = await getContext();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
    expect(contextQueries()).toHaveLength(2);
    expect(errorSpy).toHaveBeenCalledWith('[luca-context] context unavailable');
  });
});

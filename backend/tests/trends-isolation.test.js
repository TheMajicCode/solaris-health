'use strict';
/**
 * WEB-R2: exercise the real trends router and the real JWT/revocation
 * middleware with synthetic sessions and a fully mocked database.
 * Never import server.js or open a pool. Express's default query parser is
 * used deliberately, and asserted below to match production.
 */
const fs = require('fs');
const path = require('path');

const TEST_JWT_SECRET = 'web-r2-synthetic-session-secret-for-tests-only';
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
process.env.JWT_SECRET = TEST_JWT_SECRET;

jest.mock('../src/db', () => ({ query: jest.fn() }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');
const trendsRouter = require('../src/routes/trends');

const OWNER_ID = 'aabbccdd-1234-4abc-8def-001122334455';
const OTHER_ID = 'bbccddee-2345-4bcd-9efa-112233445566';
const TOKEN_ID = 'web-r2-synthetic-token';
const PRIVATE_ERROR = 'WEB_R2_SYNTHETIC_PRIVATE_DETAIL';
const ROLES = [
  'patient', 'practitioner', 'provider', 'admin', 'community_treasury',
  'infrastructure', 'onboarder', 'patient_education', 'software',
];

// No `app.set('query parser', ...)`: the default must match production.
const app = express();
app.use('/api/trends', trendsRouter);

function token(claims = {}, options = {}, secret = TEST_JWT_SECRET) {
  return jwt.sign({ userId: OWNER_ID, role: 'patient', jti: TOKEN_ID, ...claims }, secret, {
    expiresIn: '5m',
    ...options,
  });
}

function getVitals(query = '', session = token()) {
  return request(app).get(`/api/trends/vitals${query}`).set('Authorization', `Bearer ${session}`);
}

function isTrendsSql(sql) {
  return sql.includes('FROM daily_checkins') || sql.includes('FROM assessment_responses');
}

function trendsQueries() {
  return db.query.mock.calls.filter(([sql]) => isTrendsSql(sql));
}

function expectNoTrendsReads() {
  expect(trendsQueries()).toEqual([]);
}

let checkinRows;
let assessmentRows;
let failOn;
let revokedRows;
let revocationFailure;
let errorSpy;

beforeEach(() => {
  checkinRows = [
    {
      checkin_date: '2026-09-01', energy_score: 6, mood_score: 7, sleep_hours: '7.5',
      hydration_glasses: 5, movement_minutes: 20, nutrition_score: 6,
    },
    {
      checkin_date: '2026-09-02', energy_score: 8, mood_score: 5, sleep_hours: '6.0',
      hydration_glasses: 7, movement_minutes: 40, nutrition_score: null,
    },
  ];
  assessmentRows = [
    {
      d: '2026-09-02T10:00:00.000Z', vitality_score: 70, mental_score: 60,
      emotional_score: 65, physical_score: 72, spiritual_score: 80,
    },
  ];
  failOn = null;
  revokedRows = [];
  revocationFailure = false;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  db.query.mockReset();
  db.query.mockImplementation(async (sql) => {
    if (sql.includes('FROM revoked_tokens')) {
      if (revocationFailure) throw new Error(PRIVATE_ERROR);
      return { rows: revokedRows };
    }
    if (sql.includes('FROM daily_checkins')) {
      if (failOn === 'checkins') {
        throw Object.assign(new Error(PRIVATE_ERROR), { code: '08006', detail: OWNER_ID });
      }
      return { rows: checkinRows };
    }
    if (sql.includes('FROM assessment_responses')) {
      if (failOn === 'assessments') {
        throw Object.assign(new Error(PRIVATE_ERROR), { code: '08006', detail: OWNER_ID });
      }
      return { rows: assessmentRows };
    }
    throw new Error('Unexpected query in test');
  });
});

afterEach(() => {
  errorSpy.mockRestore();
});

afterAll(() => {
  // Do not leak the synthetic secret into other suites sharing this process.
  if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
});

describe('test fidelity', () => {
  test('uses the same query parser as production', () => {
    expect(app.get('query parser')).toBe('extended');
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
    expect(serverSource).not.toMatch(/query parser/);
  });
});

describe('trends account boundary', () => {
  test.each([
    ['omitted', '', OWNER_ID, OWNER_ID],
    ['same account', `?userId=${OWNER_ID}`, OWNER_ID, OWNER_ID],
    ['uppercase query, lowercase session', `?userId=${OWNER_ID.toUpperCase()}`, OWNER_ID, OWNER_ID],
    ['lowercase query, uppercase session', `?userId=${OWNER_ID}`, OWNER_ID.toUpperCase(), OWNER_ID.toUpperCase()],
  ])('%s binds the original session userId in both trends queries', async (_label, query, sessionId, bound) => {
    const res = await getVitals(query, token({ userId: sessionId }));
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0]).toEqual(['SELECT id FROM revoked_tokens WHERE jti = $1', [TOKEN_ID]]);
    const reads = trendsQueries();
    expect(reads).toHaveLength(2);
    expect(reads[0][0]).toContain('FROM daily_checkins');
    expect(reads[1][0]).toContain('FROM assessment_responses');
    expect(reads.map(([, params]) => params[0])).toEqual([bound, bound]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('a valid JWT sub for another account is never substituted for the session userId', async () => {
    const res = await getVitals('', token({ sub: OTHER_ID }));
    expect(res.status).toBe(200);
    expect(trendsQueries().map(([, params]) => params[0])).toEqual([OWNER_ID, OWNER_ID]);
  });

  test('a JWT sub naming another account does not authorize reading it', async () => {
    // Uses a formerly privileged role, so the unchanged route's leak makes this fail there.
    const res = await getVitals(`?userId=${OTHER_ID}`, token({ sub: OTHER_ID, role: 'admin' }));
    expect(res.status).toBe(403);
    expectNoTrendsReads();
  });

  test.each(ROLES)('%s cannot read another account', async (role) => {
    const res = await getVitals(`?userId=${OTHER_ID}`, token({ role }));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Not allowed' });
    expectNoTrendsReads();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['uppercase foreign ID', `?userId=${OTHER_ID.toUpperCase()}`, OWNER_ID],
    ['lowercase foreign ID with uppercase session', `?userId=${OTHER_ID}`, OWNER_ID.toUpperCase()],
  ])('%s is still denied', async (_label, query, sessionId) => {
    const res = await getVitals(query, token({ userId: sessionId, role: 'admin' }));
    expect(res.status).toBe(403);
    expectNoTrendsReads();
  });

  test.each([
    ['empty', '?userId='],
    ['no value', '?userId'],
    ['non-UUID', '?userId=not-a-uuid'],
    ['legacy numeric id', '?userId=999999'],
    ['null text', '?userId=null'],
    ['leading whitespace', `?userId=%20${OWNER_ID}`],
    ['trailing whitespace', `?userId=${OWNER_ID}%20`],
    ['trailing newline', `?userId=${OWNER_ID}%0A`],
    ['compact UUID', `?userId=${OWNER_ID.replace(/-/g, '')}`],
    ['SQL-shaped value', '?userId=%27%20OR%201%3D1--'],
    ['duplicate identical values', `?userId=${OWNER_ID}&userId=${OWNER_ID}`],
    ['duplicate different values', `?userId=${OWNER_ID}&userId=${OTHER_ID}`],
    ['percent-encoded duplicate key', `?userId=${OWNER_ID}&user%49d=${OTHER_ID}`],
    ['array', `?userId[]=${OWNER_ID}`],
    ['indexed array', `?userId[0]=${OWNER_ID}`],
    ['object', `?userId[id]=${OWNER_ID}`],
  ])('rejects %s input before trends SQL', async (_label, query) => {
    const res = await getVitals(query, token({ role: 'admin' }));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid userId' });
    expectNoTrendsReads();
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('a prototype-shaped key does not become a userId assertion', async () => {
    const res = await getVitals(`?__proto__[userId]=${OTHER_ID}`);
    expect(res.status).toBe(200);
    expect(trendsQueries().map(([, params]) => params[0])).toEqual([OWNER_ID, OWNER_ID]);
    expect(Object.prototype.userId).toBeUndefined();
  });

  test.each([
    ['missing', undefined], ['null', null], ['empty', ''], ['non-UUID', 'invalid-subject'],
    ['number', 42], ['array', [OWNER_ID]], ['object', { id: OWNER_ID }],
    ['trailing newline', `${OWNER_ID}\n`],
  ])('rejects a signed token with %s userId despite a valid sub and matching query', async (_label, userId) => {
    const res = await getVitals(`?userId=${OWNER_ID}`, token({ userId, sub: OWNER_ID, role: 'admin' }));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expectNoTrendsReads();
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe('successful payload is preserved', () => {
  test('returns the complete points, vitality and metrics payload', async () => {
    const res = await getVitals('?range=all');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      range: 'all',
      points: [
        { date: '2026-09-01', energy: 6, mood: 7, sleep: 7.5, hydration: 5, movement: 20, nutrition: 6 },
        { date: '2026-09-02', energy: 8, mood: 5, sleep: 6, hydration: 7, movement: 40, nutrition: null },
      ],
      vitality: [
        { date: '2026-09-02', vitality: 70, mental: 60, emotional: 65, physical: 72, spiritual: 80 },
      ],
      metrics: {
        energy: { count: 2, avg: 7, min: 6, max: 8, first: 6, last: 8, change: 2 },
        mood: { count: 2, avg: 6, min: 5, max: 7, first: 7, last: 5, change: -2 },
        sleep: { count: 2, avg: 6.8, min: 6, max: 7.5, first: 7.5, last: 6, change: -1.5 },
        hydration: { count: 2, avg: 6, min: 5, max: 7, first: 5, last: 7, change: 2 },
        movement: { count: 2, avg: 30, min: 20, max: 40, first: 20, last: 40, change: 20 },
        nutrition: { count: 1, avg: 6, min: 6, max: 6, first: 6, last: 6, change: 0 },
        vitality: { count: 1, avg: 70, min: 70, max: 70, first: 70, last: 70, change: 0 },
      },
    });
  });

  test('returns empty statistics when there is no data', async () => {
    checkinRows = [];
    assessmentRows = [];
    const res = await getVitals();
    expect(res.status).toBe(200);
    expect(res.body.points).toEqual([]);
    expect(res.body.vitality).toEqual([]);
    const empty = { count: 0, avg: null, min: null, max: null, first: null, last: null, change: null };
    for (const key of ['energy', 'mood', 'sleep', 'hydration', 'movement', 'nutrition', 'vitality']) {
      expect(res.body.metrics[key]).toEqual(empty);
    }
  });

  test('defaults the range to 30d and adds a date bound to both queries', async () => {
    const res = await getVitals();
    expect(res.status).toBe(200);
    expect(res.body.range).toBe('30d');
    for (const [sql, params] of trendsQueries()) {
      expect(sql).toContain('>= $2');
      expect(params).toHaveLength(2);
      expect(params[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('range=all omits the date bound from both queries', async () => {
    await getVitals('?range=all');
    for (const [sql, params] of trendsQueries()) {
      expect(sql).not.toContain('>= $2');
      expect(params).toEqual([OWNER_ID]);
    }
  });

  test.each(['7d', '90d', '1y', 'unrecognised'])('echoes range %s unchanged', async (range) => {
    const res = await getVitals(`?range=${range}`);
    expect(res.status).toBe(200);
    expect(res.body.range).toBe(range);
  });
});

describe('real authentication and revocation remain mandatory', () => {
  test('rejects a missing Authorization header without any database access', async () => {
    const res = await request(app).get(`/api/trends/vitals?userId=${OWNER_ID}`);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each([
    ['malformed token', () => 'not-a-token'],
    ['wrong signature', () => token({}, {}, 'different-synthetic-signing-key')],
    ['expired token', () => token({}, { expiresIn: -1 })],
    ['missing jti', () => token({ jti: undefined })],
  ])('rejects %s before revocation or trends reads', async (_label, makeToken) => {
    const res = await getVitals(`?userId=${OTHER_ID}`, makeToken());
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('denies a revoked session before trends reads', async () => {
    revokedRows = [{ id: 'synthetic-revocation' }];
    const res = await getVitals();
    expect(res.status).toBe(401);
    expectNoTrendsReads();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('keeps the existing fail-closed 503 when revocation storage is unavailable', async () => {
    revocationFailure = true;
    const res = await getVitals();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
    expectNoTrendsReads();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('trends storage failures', () => {
  test.each([
    ['daily check-ins', 'checkins', 1],
    ['assessments', 'assessments', 2],
  ])('returns only a generic error when the %s query fails', async (_label, position, attempted) => {
    failOn = position;
    const res = await getVitals();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
    expect(trendsQueries()).toHaveLength(attempted);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[trends] vitals unavailable');
    const logged = JSON.stringify(errorSpy.mock.calls);
    for (const secret of [PRIVATE_ERROR, OWNER_ID, '08006', 'daily_checkins', 'assessment_responses', 'SELECT']) {
      expect(logged).not.toContain(secret);
    }
    expect(JSON.stringify(res.body)).not.toContain(PRIVATE_ERROR);
  });
});

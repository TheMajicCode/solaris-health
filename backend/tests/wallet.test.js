'use strict';
/**
 * ECO-CLEAN-R1: exercise retired wallet routes with real JWT/revocation checks.
 * The database is mocked; do not load server.js or a database setup fixture.
 * Run this file with the standalone configuration recorded in the handoff.
 */
const TEST_JWT_SECRET = 'eco-clean-r1-synthetic-test-session-key';
process.env.JWT_SECRET = TEST_JWT_SECRET;

jest.mock('../src/db', () => ({ query: jest.fn() }));
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../src/db');
const walletRouter = require('../src/routes/wallet');
const passportRouter = require('../src/routes/passport');

const OWNER = 'aabbccdd-1234-4abc-8def-001122334455';
const OTHER = 'bbccddee-2345-4bcd-9efa-112233445566';
const TOKEN_ID = 'eco-clean-r1-synthetic-session';
const PRIVATE_DETAIL = 'SYNTHETIC_PRIVATE_WALLET_DATABASE_DETAIL';
const RETIRED = [
  ['get', '/chains'],
  ['post', '/connect'],
  ['put', '/disconnect'],
  ['put', '/primary'],
  ['get', '/nonce?address=synthetic-address'],
  ['post', '/verify-signature'],
  ['get', '/balance/ethereum/0x52908400098527886E0F7030069857D2E4169EE7'],
  ['get', '/balance/polygon/synthetic-address'],
  ['get', '/balance/solana/synthetic-address'],
  ['get', '/balance/bitcoin/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
  ['get', '/transactions/ethereum/synthetic-address'],
  ['get', '/transactions/solana/synthetic-address'],
  ['get', '/transactions/bitcoin/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'],
  ['post', '/me'],
  ['delete', '/me'],
  ['get', '/unknown-legacy-path'],
];
const app = express();
app.use(express.json());
app.use('/api/wallet', walletRouter);
app.use('/api/passport', passportRouter);

function token(claims = {}, options = {}, secret = TEST_JWT_SECRET) {
  return jwt.sign({ userId: OWNER, role: 'patient', jti: TOKEN_ID, ...claims }, secret, {
    expiresIn: '5m', ...options,
  });
}
function call(method, path, session = token()) {
  const req = request(app)[method](`/api/wallet${path}`);
  if (session !== null) req.set('Authorization', `Bearer ${session}`);
  return req;
}
function privateQueries() {
  return db.query.mock.calls.filter(([sql]) => !sql.includes('FROM revoked_tokens'));
}
function assertOnlyRevocation() {
  expect(db.query.mock.calls).toEqual([
    ['SELECT id FROM revoked_tokens WHERE jti = $1', [TOKEN_ID]],
  ]);
}

let rows;
let revoked;
let failRevocation;
let failWalletRead;
let errorSpy;
let fetchSpy;

beforeEach(() => {
  rows = [{
    id: 'synthetic-historical-record', user_id: OWNER,
    chain: 'ethereum', address: 'synthetic-historical-address', label: 'Old demo',
    provider: 'manual', verified: true, is_primary: true,
    verified_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z',
    address_enc: PRIVATE_DETAIL,
  }];
  revoked = false;
  failRevocation = false;
  failWalletRead = false;
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() => {
    throw new Error('External RPC must never run in a retired route');
  });
  db.query.mockReset();
  db.query.mockImplementation(async (sql, params) => {
    if (sql.includes('FROM revoked_tokens')) {
      if (failRevocation) throw new Error(PRIVATE_DETAIL);
      return { rows: revoked ? [{ id: 'synthetic-revocation' }] : [] };
    }
    if (sql.includes('FROM wallet_addresses')) {
      if (failWalletRead) throw Object.assign(new Error(PRIVATE_DETAIL), { detail: OWNER, code: '08006' });
      // SQL binding is independently asserted by owner-read tests below.
      return { rows: params[0] === OWNER ? rows : [] };
    }
    if (sql.includes('FROM users')) {
      return { rows: [{ id: OWNER, email: 'owner@example.invalid', full_name: 'Synthetic owner', role: 'patient' }] };
    }
    if (sql.includes('FROM passport_consents') || sql.includes('FROM ai_execution_receipts')) {
      return { rows: [] };
    }
    throw new Error('Unexpected database access in wallet retirement test');
  });
});

afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('retired wallet operations', () => {
  test.each(RETIRED)('%s %s is authenticated 410 with no wallet SQL or RPC', async (method, path) => {
    const res = await call(method, path);
    expect(res.status).toBe(410);
    expect(res.body).toEqual({
      error: 'LEGACY_WALLET_RETIRED',
      message: 'Legacy wallet connections and operations are no longer available.',
    });
    assertOnlyRevocation();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test.each(RETIRED)('%s %s still rejects a missing session', async (method, path) => {
    const res = await call(method, path, null);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test.each(['patient', 'practitioner', 'admin'])('%s cannot revive a connection with a request body', async (role) => {
    const res = await call('post', '/connect', token({ role })).send({
      userId: OTHER, chain: 'bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', makePrimary: true,
    });
    expect(res.status).toBe(410);
    assertOnlyRevocation();
  });

  test('HEAD /me is retired without querying historical data', async () => {
    const res = await call('head', '/me');
    expect(res.status).toBe(410);
    assertOnlyRevocation();
  });
});

describe('historical address access', () => {
  test.each(['patient', 'practitioner', 'admin'])('%s can read only its own historical records', async (role) => {
    const res = await call('get', `/me?userId=${OTHER}&user_id=${OTHER}`, token({ role, sub: OTHER }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      legacy: true, status: 'retired',
      wallets: [{
        id: rows[0].id, chain: rows[0].chain, address: rows[0].address,
        label: rows[0].label, provider: rows[0].provider, verified: true,
        isPrimary: true, verifiedAt: rows[0].verified_at, createdAt: rows[0].created_at,
        legacy: true, active: false,
      }],
    });
    const [[sql, params]] = privateQueries();
    expect(privateQueries()).toHaveLength(1);
    expect(sql).toMatch(/FROM wallet_addresses WHERE user_id=\$1/);
    expect(sql).not.toMatch(/SELECT \*/);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(params).toEqual([OWNER]);
    expect(JSON.stringify(res.body)).not.toContain(PRIVATE_DETAIL);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('an account without stored records receives an empty historical collection', async () => {
    const res = await call('get', '/me', token({ userId: OTHER }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ legacy: true, status: 'retired', wallets: [] });
    expect(privateQueries()[0][1]).toEqual([OTHER]);
  });

  test.each([undefined, null, '', 'invalid', 123, [OWNER], { id: OWNER }, `${OWNER}\n`])(
    'rejects invalid session account %j before historical SQL', async (userId) => {
      const res = await call('get', `/me?userId=${OWNER}`, token({ userId }));
      expect(res.status).toBe(401);
      assertOnlyRevocation();
    }
  );

  test('a historical read failure is generic and logs only a fixed marker', async () => {
    failWalletRead = true;
    const res = await call('get', '/me');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Server error' });
    expect(errorSpy.mock.calls).toEqual([['[wallet] historical metadata unavailable']]);
    expect(JSON.stringify([res.body, errorSpy.mock.calls])).not.toContain(PRIVATE_DETAIL);
    expect(JSON.stringify([res.body, errorSpy.mock.calls])).not.toContain(OWNER);
  });
});

describe('real session validation', () => {
  test.each(['/me', '/chains'])('%s denies revoked sessions before wallet reads or retired response', async (path) => {
    revoked = true;
    const res = await call('get', path);
    expect(res.status).toBe(401);
    assertOnlyRevocation();
  });

  test.each(['/me', '/chains'])('%s fails closed when the revocation store is unavailable', async (path) => {
    failRevocation = true;
    const res = await call('get', path);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
    assertOnlyRevocation();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test.each([
    ['malformed', () => 'not-a-token'],
    ['wrong signature', () => token({}, {}, 'wrong-synthetic-test-key')],
    ['expired', () => token({}, { expiresIn: -1 })],
    ['missing jti', () => token({ jti: undefined })],
  ])('rejects %s tokens before any database access', async (_label, makeToken) => {
    const res = await call('get', '/me', makeToken());
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('GET /me requires authentication', async () => {
    const res = await call('get', '/me', null);
    expect(res.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('passport compatibility', () => {
  test('keeps the wallet method key but never advertises retired records as active identity or payment support', async () => {
    const res = await request(app).get('/api/passport/sovereignty-status').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.identityMethods.find((method) => method.method === 'wallet')).toEqual({
      method: 'wallet', label: 'Historical wallet addresses', connected: false, legacy: true,
      detail: 'Legacy wallet connections are retired. Stored address metadata is not an active wallet or payment capability.',
    });
    expect(res.body.identityMethods.map((method) => method.method)).toEqual(['email', 'did', 'nostr', 'wallet']);
    expect(privateQueries().some(([sql]) => sql.includes('wallet_addresses'))).toBe(false);
  });
});

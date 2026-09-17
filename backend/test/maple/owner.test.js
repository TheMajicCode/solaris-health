'use strict';
/**
 * Owner-scoped access tests for the LUCA route (pure helpers, no DB/network).
 * Verifies: empty/unset allowlist disables Maple for EVERYONE; only exact ids
 * on the list match; ids are compared as strings; tampered/whitespace input is
 * handled. These are the server-enforced gate that keeps Maple owner-only.
 */
const test = require('node:test');
const assert = require('node:assert');

// The real router pulls in auth middleware, which refuses to load without these.
// We only exercise the PURE owner-allowlist helpers here (no DB/network/JWT use).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-not-a-real-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@127.0.0.1:5432/test';

const router = require('../../src/routes/luca');
const { parseOwnerAllowlist, isMapleOwner, isMapleAvailable } = router;

const AVAIL = { LUCA_MAPLE_ENABLED: 'true', LUCA_MAPLE_BASE_URL: 'http://127.0.0.1:8788/v1', LUCA_MAPLE_MODEL: 'llama3-3-70b', LUCA_MAPLE_API_KEY: 'k' };

test('empty/unset allowlist => Maple disabled for everyone', () => {
  assert.strictEqual(parseOwnerAllowlist({}).size, 0);
  assert.strictEqual(parseOwnerAllowlist({ LUCA_MAPLE_OWNER_USER_IDS: '' }).size, 0);
  assert.strictEqual(parseOwnerAllowlist({ LUCA_MAPLE_OWNER_USER_IDS: '   ' }).size, 0);
  assert.strictEqual(isMapleOwner('42', {}), false);
  assert.strictEqual(isMapleOwner('42', { LUCA_MAPLE_OWNER_USER_IDS: '' }), false);
});

test('only exact ids on the list match', () => {
  const env = { LUCA_MAPLE_OWNER_USER_IDS: 'u-owner, 42 ,99' };
  assert.deepStrictEqual([...parseOwnerAllowlist(env)].sort(), ['42', '99', 'u-owner']);
  assert.strictEqual(isMapleOwner('u-owner', env), true);
  assert.strictEqual(isMapleOwner('42', env), true);
  assert.strictEqual(isMapleOwner(42, env), true, 'numeric id compared as string');
  assert.strictEqual(isMapleOwner('43', env), false);
  assert.strictEqual(isMapleOwner('u-owner-2', env), false);
  assert.strictEqual(isMapleOwner('', env), false);
  assert.strictEqual(isMapleOwner(null, env), false);
  assert.strictEqual(isMapleOwner(undefined, env), false);
});

test('whitespace and empty fields are ignored', () => {
  const env = { LUCA_MAPLE_OWNER_USER_IDS: ' , ,7, ' };
  assert.deepStrictEqual([...parseOwnerAllowlist(env)], ['7']);
  assert.strictEqual(isMapleOwner('7', env), true);
});

// ── Item 1: DESIGNATION (owner) is separate from AVAILABILITY (enable/config) ─

test('isMapleAvailable is fail-closed: requires LUCA_MAPLE_ENABLED === "true"', () => {
  assert.strictEqual(isMapleAvailable(AVAIL), true);
  assert.strictEqual(isMapleAvailable({ ...AVAIL, LUCA_MAPLE_ENABLED: 'false' }), false, 'disabled => unavailable');
  assert.strictEqual(isMapleAvailable({ ...AVAIL, LUCA_MAPLE_ENABLED: undefined }), false, 'unset => unavailable');
  assert.strictEqual(isMapleAvailable({ ...AVAIL, LUCA_MAPLE_ENABLED: '1' }), false, 'only the exact string "true" enables');
});

test('isMapleAvailable requires a configured key (missing key => unavailable)', () => {
  assert.strictEqual(isMapleAvailable({ ...AVAIL, LUCA_MAPLE_API_KEY: undefined }), false);
  assert.strictEqual(isMapleAvailable({ ...AVAIL, LUCA_MAPLE_API_KEY: '' }), false);
});

test('designation and availability are independent (safe disable keeps owner id)', () => {
  // The owner is STILL designated private even while the path is disabled — the
  // safe disable procedure (LUCA_MAPLE_ENABLED=false) must not touch the owner list.
  const env = { ...AVAIL, LUCA_MAPLE_ENABLED: 'false', LUCA_MAPLE_OWNER_USER_IDS: 'u-owner' };
  assert.strictEqual(isMapleOwner('u-owner', env), true, 'still designated private');
  assert.strictEqual(isMapleAvailable(env), false, 'but not available => route returns truthful unavailable');
});

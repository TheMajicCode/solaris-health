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
const { parseOwnerAllowlist, isMapleOwner } = router;

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

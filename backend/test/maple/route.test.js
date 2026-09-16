'use strict';
/**
 * Route-level integration tests for POST /api/luca/messages on the Maple path.
 * All of luca.js's collaborators (db, auth, ai factory, phi-boundary, authority,
 * triggers, foundational, intelligence, journeys) are STUBBED via the require
 * cache BEFORE luca.js is loaded — so there is NO real database, NO network and
 * NO real Maple call. We drive the real Express router and assert behaviour.
 *
 * Covered (brief §"Checks, deployment and review"):
 *  - owner-only access (non-owner keeps existing cloud provider, unaffected)
 *  - tampered identity (body-supplied owner flag/userId is ignored)
 *  - NO Passport health-context egress on the Maple path
 *  - NO cross-provider fallback when Maple fails (truthful degraded instead)
 *  - request/history state kept per authenticated user
 *  - no secret / prompt / response / raw-error leakage into logs
 */
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

// ---- module stubs (seeded into require.cache before luca.js loads) ----------
const LUCA_DIR = path.resolve(__dirname, '../../src/routes');
function seed(rel, exportsObj) {
  const resolved = require.resolve(path.resolve(LUCA_DIR, rel));
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsObj };
}

// mutable harness the stubs read from
const H = {
  user: { userId: 'nobody' },
  dbCalls: [],
  getAIProviderCalled: false,
  mapleFactory: null,
  mapleCall: null,
  getExclusionsCalled: false,
  computeTriggersCalled: false,
  receipts: [],
};

seed('../db', {
  query: async (sql, params) => {
    H.dbCalls.push({ sql, params });
    return { rows: [] };
  },
});
seed('../middleware/auth', { authMiddleware: (req, _res, next) => { req.user = H.user; next(); } });
seed('../lib/ai', {
  getAIProvider: () => {
    H.getAIProviderCalled = true;
    return { id: 'cloud:test-model', async complete() { return JSON.stringify({ reply: 'CLOUD_REPLY', suggestions: [] }); } };
  },
});
seed('../lib/ai/maple', {
  createMapleProvider: (env, opts) => {
    if (!H.mapleFactory) throw new Error('maple_no_api_key');
    return H.mapleFactory(env, opts);
  },
});
seed('../lib/ai/receipts', { recordAIReceipt: async (r) => { H.receipts.push(r); } });
seed('../lib/phi-boundary', {
  redactForExternalAI: (t) => ({ text: t }),
  isExternalProvider: (ai) => typeof ai.id === 'string' && !/^(mock|local)/.test(ai.id),
});
seed('../lib/agent-authority', {
  checkCapability: async () => ({ allowed: true, reason: 'ok', grant: { id: 'g1' } }),
  recordGrantUse: () => {},
});
seed('../lib/luca-triggers', {
  computeTriggers: async () => { H.computeTriggersCalled = true; return {}; },
  buildTriggerInstructions: () => '',
  buildTriggerSuggestions: () => [],
});
seed('../lib/foundational', { getFoundational: async () => null });
seed('../lib/intelligence', { getExclusions: async () => { H.getExclusionsCalled = true; return new Set(); } });
seed('./journeys', { MILESTONE_DEFS_COUNT: {} });

// Now load the REAL router against the stubs.
const express = require('express');
const lucaRouter = require('../../src/routes/luca');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/luca', lucaRouter);
  return app;
}

function request(app, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const data = JSON.stringify(body);
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/luca/messages', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
        (res) => {
          let buf = '';
          res.on('data', (c) => (buf += c));
          res.on('end', () => { server.close(); resolve({ status: res.statusCode, json: JSON.parse(buf || '{}') }); });
        }
      );
      req.on('error', (e) => { server.close(); reject(e); });
      req.write(data); req.end();
    });
  });
}

function reset() {
  H.dbCalls = []; H.getAIProviderCalled = false; H.mapleFactory = null; H.mapleCall = null;
  H.getExclusionsCalled = false; H.computeTriggersCalled = false; H.receipts = [];
  delete process.env.LUCA_MAPLE_OWNER_USER_IDS;
}

// capture console during a call
async function captureLogs(fn) {
  const logs = [];
  const oL = console.log, oE = console.error, oW = console.warn;
  console.log = (...a) => logs.push(a.join(' '));
  console.error = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  try { return { result: await fn(), logs }; }
  finally { console.log = oL; console.error = oE; console.warn = oW; }
}

test('OWNER path: real Maple reply, NO health-context, NO cross-provider fallback', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => ({
    id: 'maple:llama3-3-70b',
    async complete({ system, prompt, context }) {
      H.mapleCall = { system, prompt, context };
      return JSON.stringify({ reply: 'MAPLE_REPLY', suggestions: [{ label: 'Tell me more', action: 'prefill_chat', target: null }] });
    },
  });
  const { status, json } = await request(makeApp(), { content: 'hello LUCA' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'MAPLE_REPLY');
  assert.strictEqual(json.model, 'maple:llama3-3-70b');
  assert.strictEqual(json.degraded, null);
  // no health context egressed
  assert.strictEqual(H.mapleCall.context, '', 'context must be empty on the private path');
  assert.strictEqual(H.getExclusionsCalled, false, 'exclusions/buildContext must be skipped');
  assert.strictEqual(H.computeTriggersCalled, false, 'triggers must be skipped');
  // no cross-provider fallback / cloud factory touched
  assert.strictEqual(H.getAIProviderCalled, false, 'getAIProvider must NOT be called on owner path');
});

test('OWNER path failure: truthful degraded, NEVER falls back to cloud/mock', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => ({ id: 'maple:llama3-3-70b', async complete() { throw new Error('maple_timeout'); } });
  const { status, json } = await request(makeApp(), { content: 'hello' });
  assert.strictEqual(status, 200);
  assert.match(json.reply, /temporarily unavailable/i);
  assert.match(json.reply, /not sent to any other AI service/i);
  assert.strictEqual(json.degraded, 'maple_timeout');
  assert.strictEqual(H.getAIProviderCalled, false, 'must NOT fall back to another provider');
  assert.ok(!/MAPLE_REPLY|CLOUD_REPLY/.test(json.reply));
});

test('OWNER path with no key configured: degraded maple_unavailable, no fallback', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = null; // createMapleProvider stub throws maple_no_api_key
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_unavailable');
  assert.match(json.reply, /temporarily unavailable/i);
  assert.strictEqual(H.getAIProviderCalled, false);
});

test('NON-owner is unaffected: uses existing cloud provider', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'someone-else' };
  H.mapleFactory = () => { throw new Error('should not be constructed for non-owner'); };
  const { status, json } = await request(makeApp(), { content: 'hello' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'CLOUD_REPLY');
  assert.strictEqual(H.getAIProviderCalled, true);
  assert.strictEqual(H.getExclusionsCalled, true, 'shared path still builds context');
  assert.strictEqual(H.mapleCall, null);
});

test('TAMPERED identity: body-supplied userId/owner flag is ignored', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'attacker' }; // authenticated identity is NOT the owner
  H.mapleFactory = () => { throw new Error('maple must not run for attacker'); };
  const { status, json } = await request(makeApp(), { content: 'hi', userId: 'u-owner', owner: true, isOwner: true });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'CLOUD_REPLY', 'must fall through to the normal provider, not Maple');
  assert.strictEqual(H.getAIProviderCalled, true);
});

test('EMPTY allowlist: owner-looking id still does NOT get Maple', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = '';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => { throw new Error('maple disabled — must not run'); };
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'CLOUD_REPLY');
});

test('request/history state is per-authenticated-user (isolation)', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  // owner call
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => ({ id: 'maple:llama3-3-70b', async complete() { return JSON.stringify({ reply: 'A', suggestions: [] }); } });
  await request(makeApp(), { content: 'first' });
  const ownerInserts = H.dbCalls.filter((c) => /INSERT INTO luca_messages/i.test(c.sql));
  assert.ok(ownerInserts.every((c) => c.params[0] === 'u-owner'), 'all writes bound to u-owner');
  // second user call
  H.dbCalls = [];
  H.user = { userId: 'other-user' };
  H.mapleFactory = null;
  await request(makeApp(), { content: 'second' });
  const otherInserts = H.dbCalls.filter((c) => /INSERT INTO luca_messages/i.test(c.sql));
  assert.ok(otherInserts.length > 0);
  assert.ok(otherInserts.every((c) => c.params[0] === 'other-user'), 'all writes bound to other-user');
});

test('no secret / prompt / raw-error leakage into logs on the Maple path', async () => {
  reset();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  const MARKER = 'PROMPT_MARKER_DO_NOT_LOG_9931';
  H.mapleFactory = () => ({ id: 'maple:llama3-3-70b', async complete() { const e = new Error('maple_proxy_status_500'); throw e; } });
  const { result, logs } = await captureLogs(() => request(makeApp(), { content: MARKER }));
  assert.strictEqual(result.status, 200);
  const joined = logs.join('\n');
  assert.ok(!joined.includes(MARKER), 'prompt text must not appear in logs');
  assert.ok(!/UPSTREAM|do-not-leak|status_500/i.test(joined), 'raw provider error class/body must not be logged');
});

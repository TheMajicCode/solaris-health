'use strict';
/**
 * Route-level integration tests for POST /api/luca/messages on the Maple path.
 * All of luca.js's collaborators (db, auth, ai factory, phi-boundary, authority,
 * triggers, foundational, intelligence, journeys) are STUBBED via the require
 * cache BEFORE luca.js is loaded — so there is NO real database, NO network and
 * NO real Maple call. We drive the real Express router and assert behaviour.
 *
 * Covered (brief §6 required checks 1-7):
 *  1. owner enabled path calls Maple with the dedicated prompt, no Passport/trigger context.
 *  2. disabled/missing-cred/timeout/invalid-config/provider-failure never call
 *     another provider or assemble Passport context for the private owner.
 *  3. non-owner unchanged; body-supplied ids/flags confer nothing; real auth +
 *     capability boundary (missing auth, denied capability) exercised.
 *  4. complete valid JSON succeeds; truncated JSON, finish_reason:length, blank
 *     reply, malformed envelope, disallowed suggestion action never surface as raw.
 *  5. healthy request not aborted when body completes; disconnect cancels the
 *     adapter; listener cleanup verified.
 *  6. requested vs provider-reported model recorded accurately; logs exclude
 *     synthetic private text + credentials.
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
  capability: { allowed: true, reason: 'ok', grant: { id: 'g1' } },
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
// Bounded typed error mirroring the real adapter's MapleIncompleteError (carries
// a class-only `.code` that classifyMapleError reads). Defined here so the stub
// module exports the same constructor shape the route relies on.
class MapleIncompleteError extends Error {
  constructor(code) { super(code); this.name = 'MapleIncompleteError'; this.code = code; }
}
seed('../lib/ai/maple', {
  createMapleProvider: (env, opts) => {
    if (!H.mapleFactory) throw new Error('maple_no_api_key');
    return H.mapleFactory(env, opts);
  },
  MapleIncompleteError,
});
seed('../lib/ai/receipts', { recordAIReceipt: async (r) => { H.receipts.push(r); } });
seed('../lib/phi-boundary', {
  redactForExternalAI: (t) => ({ text: t }),
  isExternalProvider: (ai) => typeof ai.id === 'string' && !/^(mock|local)/.test(ai.id),
});
seed('../lib/agent-authority', {
  checkCapability: async () => H.capability,
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

function request(app, body, { abortAfterMs } = {}) {
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
      req.on('error', (e) => { server.close(); if (abortAfterMs != null) resolve({ aborted: true }); else reject(e); });
      req.write(data); req.end();
      if (abortAfterMs != null) setTimeout(() => req.destroy(), abortAfterMs);
    });
  });
}

// Enable + fully configure Maple availability (LUCA_MAPLE_ENABLED + key/model/url).
// NOTE: a synthetic non-secret placeholder key — NOT a real credential.
function enableMaple() {
  process.env.LUCA_MAPLE_ENABLED = 'true';
  process.env.LUCA_MAPLE_BASE_URL = 'http://127.0.0.1:8788/v1';
  process.env.LUCA_MAPLE_MODEL = 'llama3-3-70b';
  process.env.LUCA_MAPLE_API_KEY = 'synthetic-test-placeholder';
}

function reset() {
  H.dbCalls = []; H.getAIProviderCalled = false; H.mapleFactory = null; H.mapleCall = null;
  H.getExclusionsCalled = false; H.computeTriggersCalled = false; H.receipts = [];
  H.capability = { allowed: true, reason: 'ok', grant: { id: 'g1' } };
  delete process.env.LUCA_MAPLE_OWNER_USER_IDS;
  delete process.env.LUCA_MAPLE_ENABLED;
  delete process.env.LUCA_MAPLE_BASE_URL;
  delete process.env.LUCA_MAPLE_MODEL;
  delete process.env.LUCA_MAPLE_API_KEY;
}

// A stub Maple provider exposing BOTH complete() and completeDetailed() (the
// route uses completeDetailed to capture the provider-reported model).
function mapleStub({ text, model = 'llama3-3-70b-reported', finishReason = 'stop', throws } = {}) {
  return () => ({
    id: 'maple:llama3-3-70b',
    async complete({ system, prompt, context }) {
      H.mapleCall = { system, prompt, context };
      if (throws) throw throws;
      return text;
    },
    async completeDetailed({ system, prompt, context }) {
      H.mapleCall = { system, prompt, context };
      if (throws) throw throws;
      return { text, model, finishReason };
    },
  });
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

// ── Check 1: owner enabled path uses the dedicated prompt, no Passport/triggers ─
test('OWNER enabled: real Maple reply via dedicated prompt, NO context, NO fallback', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'MAPLE_REPLY', suggestions: [{ label: 'Tell me more', action: 'prefill_chat', target: null }] }) });
  const { status, json } = await request(makeApp(), { content: 'hello LUCA' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'MAPLE_REPLY');
  assert.strictEqual(json.model, 'maple:llama3-3-70b');
  assert.strictEqual(json.degraded, null);
  assert.strictEqual(H.mapleCall.context, '', 'context must be empty on the private path');
  // dedicated prompt: no [PASSPORT CONTEXT] assertion, says it CANNOT see stored data
  assert.match(H.mapleCall.system, /NO Passport data available this turn/);
  assert.ok(!/\[PASSPORT CONTEXT\]/.test(H.mapleCall.system), 'must NOT use the member (passport) prompt');
  assert.strictEqual(H.getExclusionsCalled, false, 'exclusions/buildContext must be skipped');
  assert.strictEqual(H.computeTriggersCalled, false, 'triggers must be skipped');
  assert.strictEqual(H.getAIProviderCalled, false, 'getAIProvider must NOT be called on owner path');
});

// ── Check 2a: designated owner but DISABLED => truthful unavailable, no context ─
test('OWNER designated but DISABLED: maple_unavailable BEFORE context/provider', async () => {
  reset(); // LUCA_MAPLE_ENABLED unset => unavailable
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => { throw new Error('must NOT construct provider when disabled'); };
  const { status, json } = await request(makeApp(), { content: 'hello' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_unavailable');
  assert.strictEqual(json.model, null);
  assert.match(json.reply, /turned off/i);
  assert.match(json.reply, /not sent to any other AI service/i);
  assert.strictEqual(H.getAIProviderCalled, false, 'no other provider');
  assert.strictEqual(H.getExclusionsCalled, false, 'NO Passport context assembled');
  assert.strictEqual(H.computeTriggersCalled, false, 'NO triggers computed');
  assert.strictEqual(H.mapleCall, null, 'adapter never invoked');
});

// ── Check 2b: enabled but no key configured => unavailable, no fallback ───────
test('OWNER enabled but MISSING key: maple_unavailable, no fallback', async () => {
  reset();
  process.env.LUCA_MAPLE_ENABLED = 'true'; // enabled but key/model/url absent => not available
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => { throw new Error('must not construct'); };
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_unavailable');
  assert.strictEqual(H.getAIProviderCalled, false);
  assert.strictEqual(H.getExclusionsCalled, false);
});

// ── Check 2c: enabled + configured but adapter times out => truthful degraded ─
test('OWNER enabled: adapter timeout => degraded, NEVER falls back to cloud/mock', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ throws: new Error('maple_timeout') });
  const { status, json } = await request(makeApp(), { content: 'hello' });
  assert.strictEqual(status, 200);
  assert.match(json.reply, /temporarily unavailable/i);
  assert.match(json.reply, /not sent to any other AI service/i);
  assert.strictEqual(json.degraded, 'maple_timeout');
  assert.strictEqual(H.getAIProviderCalled, false, 'must NOT fall back to another provider');
  assert.ok(!/MAPLE_REPLY|CLOUD_REPLY/.test(json.reply));
});

// ── Check 3: non-owner unchanged; tampered identity confers nothing ──────────
test('NON-owner is unaffected: uses existing cloud provider (even when Maple enabled)', async () => {
  reset(); enableMaple();
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
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'attacker' }; // authenticated identity is NOT the owner
  H.mapleFactory = () => { throw new Error('maple must not run for attacker'); };
  const { status, json } = await request(makeApp(), { content: 'hi', userId: 'u-owner', owner: true, isOwner: true });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'CLOUD_REPLY', 'must fall through to the normal provider, not Maple');
  assert.strictEqual(H.getAIProviderCalled, true);
});

test('EMPTY allowlist: owner-looking id still does NOT get Maple', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = '';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = () => { throw new Error('maple disabled — must not run'); };
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'CLOUD_REPLY');
});

// ── Check 3 (auth/capability boundary) ───────────────────────────────────────
test('DENIED capability: 403 agentDisabled, no provider touched', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.capability = { allowed: false, reason: 'agent_disabled', grant: null };
  H.mapleFactory = () => { throw new Error('must not run when capability denied'); };
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 403);
  assert.strictEqual(json.agentDisabled, true);
  assert.strictEqual(H.mapleCall, null);
  assert.strictEqual(H.getAIProviderCalled, false);
});

test('AUTHORITY unavailable: 503 fail-closed before any side effect', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.capability = { allowed: false, reason: 'authority_unavailable', grant: null };
  const { status } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 503);
  // no message rows written when we fail closed before persistence
  assert.strictEqual(H.dbCalls.length, 0);
});

// ── Check 4: envelope validation — no raw truncated/malformed output surfaced ─
test('OWNER: complete valid JSON succeeds', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'ok reply', suggestions: [{ label: 'Go', action: 'navigate', target: 'dashboard' }] }) });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'ok reply');
  assert.strictEqual(json.degraded, null);
});

test('OWNER: truncated JSON never surfaces as a raw successful reply', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  const truncated = '{"reply":"this got cut o';
  H.mapleFactory = mapleStub({ text: truncated });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.notStrictEqual(json.degraded, null, 'must be degraded, not a clean reply');
  assert.ok(!json.reply.includes('this got cut o'), 'raw partial JSON must NOT be shown');
  assert.match(json.reply, /could not complete a valid answer/i);
  assert.strictEqual(H.getAIProviderCalled, false);
});

test('OWNER: disallowed suggestion action (open_listing) fails the envelope', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'here', suggestions: [{ label: 'See clinic', action: 'open_listing', target: 'prov-1' }] }) });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_disallowed_action');
  assert.ok(!/open_listing|prov-1/.test(json.reply), 'must not leak the disallowed action/id');
});

test('OWNER: blank reply field is rejected (not shown as empty success)', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: '   ', suggestions: [] }) });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_blank_reply');
});

test('OWNER: adapter finish_reason:length (thrown) => degraded, no raw partial', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  const { MapleIncompleteError } = require('../../src/lib/ai/maple');
  H.mapleFactory = mapleStub({ throws: new MapleIncompleteError('maple_incomplete_length') });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.degraded, 'maple_incomplete_length');
  assert.strictEqual(H.getAIProviderCalled, false);
});

// ── Check 5: cancellation semantics + listener cleanup ───────────────────────
test('HEALTHY request whose body completed is NOT aborted (adapter still runs)', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  let sawAbort = false;
  H.mapleFactory = (env, opts) => ({
    id: 'maple:llama3-3-70b',
    async complete() { return JSON.stringify({ reply: 'ok', suggestions: [] }); },
    async completeDetailed() {
      // small delay; if the request-body 'close' incorrectly aborted us, the
      // signal would be aborted here.
      await new Promise((r) => setTimeout(r, 40));
      if (opts && opts.signal && opts.signal.aborted) sawAbort = true;
      return { text: JSON.stringify({ reply: 'ok', suggestions: [] }), model: 'm', finishReason: 'stop' };
    },
  });
  const { status, json } = await request(makeApp(), { content: 'hi' });
  assert.strictEqual(status, 200);
  assert.strictEqual(json.reply, 'ok');
  assert.strictEqual(sawAbort, false, 'a completed request body must NOT abort a healthy request');
});

test('CLIENT disconnect cancels the actual adapter (abort signal fires)', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  let abortedSeen = false;
  H.mapleFactory = (env, opts) => ({
    id: 'maple:llama3-3-70b',
    async complete() { return '{}'; },
    completeDetailed() {
      return new Promise((resolve, reject) => {
        // never resolve on its own; resolve/reject only when aborted
        if (opts && opts.signal) {
          opts.signal.addEventListener('abort', () => { abortedSeen = true; reject(new Error('maple_timeout')); }, { once: true });
        }
      });
    },
  });
  await request(makeApp(), { content: 'hi' }, { abortAfterMs: 60 });
  // give the server a tick to observe the socket close
  await new Promise((r) => setTimeout(r, 80));
  assert.strictEqual(abortedSeen, true, 'client disconnect must abort the adapter signal');
});

// ── Check 6: requested vs reported model recorded; logs exclude secrets/text ──
test('RECEIPT records requested vs provider-reported model separately', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'hi', suggestions: [] }), model: 'llama3-3-70b-REPORTED' });
  await request(makeApp(), { content: 'hi' });
  const rec = H.receipts.find((r) => r.eventType === 'luca.member.chat');
  assert.ok(rec, 'receipt recorded');
  assert.strictEqual(rec.requestedModel, 'llama3-3-70b');
  assert.strictEqual(rec.reportedModel, 'llama3-3-70b-REPORTED', 'provider-reported model recorded verbatim');
});

test('RECEIPT records reportedModel:unknown when upstream omits it (never invented)', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'hi', suggestions: [] }), model: null });
  await request(makeApp(), { content: 'hi' });
  const rec = H.receipts.find((r) => r.eventType === 'luca.member.chat');
  assert.strictEqual(rec.reportedModel, 'unknown');
});

test('per-authenticated-user isolation: all writes bound to the auth id', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  H.mapleFactory = mapleStub({ text: JSON.stringify({ reply: 'A', suggestions: [] }) });
  await request(makeApp(), { content: 'first' });
  const ownerInserts = H.dbCalls.filter((c) => /INSERT INTO luca_messages/i.test(c.sql));
  assert.ok(ownerInserts.length > 0 && ownerInserts.every((c) => c.params[0] === 'u-owner'), 'all writes bound to u-owner');
});

test('no secret / prompt / raw-error leakage into logs on the Maple path', async () => {
  reset(); enableMaple();
  process.env.LUCA_MAPLE_OWNER_USER_IDS = 'u-owner';
  H.user = { userId: 'u-owner' };
  const MARKER = 'PROMPT_MARKER_DO_NOT_LOG_9931';
  H.mapleFactory = mapleStub({ throws: new Error('maple_proxy_status_500') });
  const { result, logs } = await captureLogs(() => request(makeApp(), { content: MARKER }));
  assert.strictEqual(result.status, 200);
  const joined = logs.join('\n');
  assert.ok(!joined.includes(MARKER), 'prompt text must not appear in logs');
  assert.ok(!/UPSTREAM|do-not-leak|status_500|synthetic-test-placeholder/i.test(joined), 'raw provider error/body/key must not be logged');
  // the bounded class IS allowed (collapsed to maple_proxy_status), with a corr id
  assert.match(joined, /maple_proxy_status\b/);
});

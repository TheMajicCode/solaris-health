#!/usr/bin/env node
/**
 * smoke-test.js — headless end-to-end sanity check of the core member loop.
 *
 * Runs against a live backend over HTTP (no browser). Registers a throwaway
 * account, walks the critical path, and prints PASS/FAIL for each step.
 *
 *   Usage:  node scripts/smoke-test.js
 *   Env:    SMOKE_BASE_URL  (default http://localhost:5000)
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const results = [];
let token = null;

function record(step, ok, detail = '') {
  results.push({ step, ok, detail });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  [${tag}] ${step}${detail ? ' — ' + detail : ''}`);
}

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function step(name, fn) {
  try {
    const detail = await fn();
    record(name, true, detail || '');
    return true;
  } catch (err) {
    record(name, false, err.message);
    return false;
  }
}

async function run() {
  console.log(`\nSolaris smoke test -> ${BASE}\n`);
  const email = `test-${Date.now()}@solaris.health`;
  const password = 'SmokeTest123!';

  // 1. Register
  await step('1. Register new account', async () => {
    const { status, json } = await req('POST', '/api/auth/register', {
      email, password, firstName: 'Smoke', lastName: 'Test',
    });
    if (status !== 201) throw new Error(`status ${status}`);
    if (!json?.token) throw new Error('no token returned');
    token = json.token;
    return email;
  });

  // 2. Verify token works (identifies the user)
  await step('2. Token identifies user (GET /api/users/me)', async () => {
    const { status, json } = await req('GET', '/api/users/me');
    if (status !== 200) throw new Error(`status ${status}`);
    if (!json?.user?.email) throw new Error('no user in response');
    return json.user.email;
  });

  // 3. Skip onboarding
  await step('3. Skip onboarding (PATCH /api/auth/skip-onboarding)', async () => {
    const { status } = await req('PATCH', '/api/auth/skip-onboarding');
    if (status !== 200) throw new Error(`status ${status}`);
  });

  // 4. Dashboard recommendations
  await step('4. Load recommendations (GET /api/luca/recommendations)', async () => {
    const { status } = await req('GET', '/api/luca/recommendations');
    if (status !== 200) throw new Error(`status ${status}`);
  });

  // 5. Submit a check-in
  await step('5. Submit check-in (POST /api/journey/checkins)', async () => {
    const { status, json } = await req('POST', '/api/journey/checkins', {
      energyScore: 7, moodScore: 8, sleepHours: 7.5, hydrationGlasses: 6, movementMinutes: 30,
      mindScore: 7, bodyScore: 6, heartScore: 8, spiritScore: 7,
    });
    if (status !== 200 && status !== 201) throw new Error(`status ${status}`);
    const pts = json?.pointsAwarded ?? json?.points ?? json?.loveAwarded;
    return pts != null ? `points: ${pts}` : 'check-in stored';
  });

  // 6. Week strip (7 days)
  await step('6. Week strip has 7 days (GET /api/journey/week-strip)', async () => {
    const { status, json } = await req('GET', '/api/journey/week-strip');
    if (status !== 200) throw new Error(`status ${status}`);
    const days = json?.days || json?.strip || (Array.isArray(json) ? json : null);
    if (!Array.isArray(days) || days.length !== 7) throw new Error(`got ${days ? days.length : 'no'} days`);
    return '7 days';
  });

  // 7. Journal
  await step('7. Journal loads (GET /api/journal)', async () => {
    const { status } = await req('GET', '/api/journal');
    if (status !== 200) throw new Error(`status ${status}`);
  });

  // 8. My audio
  await step('8. My audio loads (GET /api/audio/my)', async () => {
    const { status } = await req('GET', '/api/audio/my');
    if (status !== 200) throw new Error(`status ${status}`);
  });

  // 9. Vault export
  await step('9. Vault export (GET /api/export/me)', async () => {
    const { status, json } = await req('GET', '/api/export/me');
    if (status !== 200) throw new Error(`status ${status}`);
    if (!json?.manifest && !json?.files) throw new Error('no vault manifest/files');
    return 'vault produced';
  });

  // 10. Report (test user is left in place; no self-delete endpoint)
  await step('10. Report test account', async () => `left in place: ${email}`);

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n${passed}/${total} steps passed.\n`);
  process.exit(passed === total ? 0 : 1);
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

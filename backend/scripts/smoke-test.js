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

  // 10. Solaris assessment (submit + read back)
  await step('10. Assessment submit + latest (POST /api/assessment/submit)', async () => {
    const { status } = await req('POST', '/api/assessment/submit', {
      aspects: { mental: 70, emotional: 65, physical: 60, spiritual: 75 },
      systems: { digestive: 60, nervous: 70, immune: 65 },
      answers: [],
    });
    if (status !== 200 && status !== 201) throw new Error(`submit status ${status}`);
    const latest = await req('GET', '/api/assessment/latest');
    if (latest.status !== 200) throw new Error(`latest status ${latest.status}`);
    return 'assessment stored + readable';
  });

  // 11. Passport (completeness + sovereignty status)
  await step('11. Passport loads (completeness + sovereignty-status)', async () => {
    const a = await req('GET', '/api/passport/completeness');
    if (a.status !== 200) throw new Error(`completeness status ${a.status}`);
    const b = await req('GET', '/api/passport/sovereignty-status');
    if (b.status !== 200) throw new Error(`sovereignty status ${b.status}`);
    if (!b.json?.rights?.export?.api) throw new Error('no export right surfaced');
  });

  // 12. LUCA suggestion action → start a journey
  await step('12. Suggestion action starts a journey (POST /api/journeys/start)', async () => {
    const { status, json } = await req('POST', '/api/journeys/start', { journeyType: 'your_path' });
    if (status !== 200) throw new Error(`status ${status}`);
    if (json?.journey?.status !== 'active') throw new Error('journey not active');
  });

  // 13. Explore practitioners (marketplace directory + detail)
  let providerId = null;
  await step('13. Explore practitioners (GET /api/marketplace/providers)', async () => {
    const { status, json } = await req('GET', '/api/marketplace/providers');
    if (status !== 200) throw new Error(`status ${status}`);
    const list = json?.providers || json;
    if (!Array.isArray(list) || !list.length) return 'directory empty (no seed) — skipping detail';
    providerId = list[0].id;
    const detail = await req('GET', `/api/marketplace/providers/${providerId}`);
    if (detail.status !== 200) throw new Error(`detail status ${detail.status}`);
    return `${list.length} providers`;
  });

  // 14. Booking request + cancel (round trip, leaves no active booking)
  await step('14. Booking request + cancel (POST /api/bookings/request)', async () => {
    if (!providerId) return 'skipped — no providers in directory';
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const date = d.toISOString().slice(0, 10);
    const { status, json } = await req('POST', '/api/bookings/request', {
      providerId, date, startTime: '10:00',
    });
    if (status === 409) return 'slot conflict (bookings work; slot taken)';
    if (status !== 200 && status !== 201) throw new Error(`request status ${status}`);
    const bookingId = json?.booking?.id || json?.id;
    if (!bookingId) throw new Error('no booking id returned');
    const cancel = await req('PUT', `/api/bookings/${bookingId}/cancel`, { reason: 'smoke test cleanup' });
    if (cancel.status !== 200) throw new Error(`cancel status ${cancel.status}`);
    return 'requested + cancelled';
  });

  // 15. Intake system (templates + patient inbox)
  await step('15. Intake templates + inbox (GET /api/intake/...)', async () => {
    const t = await req('GET', '/api/intake/templates');
    if (t.status !== 200) throw new Error(`templates status ${t.status}`);
    const i = await req('GET', '/api/intake/inbox');
    if (i.status !== 200) throw new Error(`inbox status ${i.status}`);
  });

  // 16. GPS transparency (public treasury + own value trail)
  await step('16. GPS treasury + my-ledger (GET /api/gps/...)', async () => {
    const t = await req('GET', '/api/gps/treasury');
    if (t.status !== 200) throw new Error(`treasury status ${t.status}`);
    const l = await req('GET', '/api/gps/my-ledger');
    if (l.status !== 200) throw new Error(`ledger status ${l.status}`);
  });

  // 17. Logout revokes the token
  await step('17. Logout revokes token (POST /api/auth/logout)', async () => {
    const { status } = await req('POST', '/api/auth/logout');
    if (status !== 200) throw new Error(`logout status ${status}`);
    const after = await req('GET', '/api/users/me');
    if (after.status !== 401) throw new Error(`token still valid after logout (status ${after.status})`);
    return 'token rejected after logout';
  });

  // 18. Report (test user is left in place; no self-delete endpoint)
  await step('18. Report test account', async () => `left in place: ${email}`);

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n${passed}/${total} steps passed.\n`);
  process.exit(passed === total ? 0 : 1);
}

run().catch((err) => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});

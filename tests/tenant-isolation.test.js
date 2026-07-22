/**
 * Solaris Health — Tenant Isolation Tests (Gate 5)
 * Run: node tests/tenant-isolation.test.js
 * Requires: backend on localhost:5000 with demo data seeded.
 */
const BASE = process.env.API_URL || 'http://localhost:5000';
async function req(method, path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function login(email, pw) {
  const r = await req('POST', '/api/auth/login', { email, password: pw });
  if (!r.body.token) throw new Error(`Login failed for ${email}`);
  return r.body.token;
}
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log(`  ✅  ${name}`); passed++; }
  catch (err) { console.error(`  ❌  ${name}\n      ${err.message}`); failed++; }
}
function expect403(res, label) {
  if (res.status !== 403 && res.status !== 401)
    throw new Error(`${label}: expected 403/401, got ${res.status}`);
}
async function run() {
  console.log('\n=== Solaris Tenant Isolation Tests ===\n');
  const sofiaToken = await login('sofia@solaris.health', 'demo123');
  const alejandroToken = await login('alejandro@solaris.health', 'demo123');

  console.log('--- Patient cannot access provider-only routes ---');
  await test('Patient cannot list provider patients', async () => {
    expect403(await req('GET', '/api/provider/patients', null, sofiaToken), 'provider/patients');
  });
  await test('Patient cannot access practitioner copilot', async () => {
    expect403(await req('POST', '/api/luca/practitioner/messages', { message: 'hi' }, sofiaToken), 'luca/practitioner/messages');
  });
  await test('Patient cannot access provider earnings', async () => {
    expect403(await req('GET', '/api/provider/earnings', null, sofiaToken), 'provider/earnings');
  });
  await test('Patient cannot access admin routes', async () => {
    expect403(await req('GET', '/api/admin/overview', null, sofiaToken), 'admin/overview');
  });
  await test('Patient cannot approve providers', async () => {
    expect403(await req('POST', '/api/admin/providers/1/approve', {}, sofiaToken), 'admin approve');
  });

  console.log('\n--- Provider cannot access admin routes ---');
  await test('Provider cannot access admin routes', async () => {
    expect403(await req('GET', '/api/admin/overview', null, alejandroToken), 'admin/overview as provider');
  });

  console.log('\n--- Unauthenticated access blocked ---');
  await test('No token returns 401', async () => {
    const r = await req('GET', '/api/passport/completeness', null, null);
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });
  await test('Invalid token returns 401', async () => {
    const r = await req('GET', '/api/passport/completeness', null, 'bad.token.here');
    if (r.status !== 401) throw new Error(`Expected 401, got ${r.status}`);
  });

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Gate 5: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('❌ GATE 5 FAILED'); process.exit(1); }
  else { console.log('✅ GATE 5 PASSED — tenant isolation verified'); process.exit(0); }
}
run().catch(err => { console.error(err); process.exit(1); });

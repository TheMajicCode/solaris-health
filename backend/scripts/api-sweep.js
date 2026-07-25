#!/usr/bin/env node
/**
 * api-sweep.js — wide read/write sweep of every primary API surface, run
 * against a LIVE deployment. Complements smoke-test.js (deep member loop)
 * with breadth: member, practitioner and public surfaces.
 *
 *   Usage:  node scripts/api-sweep.js
 *   Env:    SWEEP_BASE_URL (default https://solaris-health.abacusai.cloud)
 *           SWEEP_MEMBER / SWEEP_MEMBER_PW      (default sarah@solaris.health / demo123)
 *           SWEEP_PRACTITIONER / SWEEP_PRACT_PW (default elena@solaris.health / demo123)
 */

const BASE = (process.env.SWEEP_BASE_URL || 'https://solaris-health.abacusai.cloud').replace(/\/$/, '');
const results = [];

async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json (zip, audio...) */ }
  return { status: res.status, json };
}

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function expectStatus(name, method, path, opts, wanted = [200]) {
  try {
    const { status, json } = await req(method, path, opts);
    const ok = wanted.includes(status);
    check(name, ok, ok ? `${status}` : `${status} ${JSON.stringify(json)?.slice(0, 120)}`);
    return json;
  } catch (e) {
    check(name, false, e.message);
    return null;
  }
}

async function login(email, password) {
  const { status, json } = await req('POST', '/api/auth/login', { body: { email, password } });
  if (status !== 200 || !json?.token) throw new Error(`login ${email} -> ${status}`);
  return json.token;
}

async function run() {
  console.log(`\nSolaris API sweep -> ${BASE}\n`);

  const member = await login(process.env.SWEEP_MEMBER || 'sarah@solaris.health', process.env.SWEEP_MEMBER_PW || 'demo123');
  const pract = await login(process.env.SWEEP_PRACTITIONER || 'elena@solaris.health', process.env.SWEEP_PRACT_PW || 'demo123');
  console.log('  [PASS] logins (member + practitioner)\n  -- public --');

  await expectStatus('public: practitioner directory', 'GET', '/api/public/practitioners', {});
  await expectStatus('public: gps policy', 'GET', '/api/gps/policy', {});
  await expectStatus('public: gps treasury', 'GET', '/api/gps/treasury', {});

  console.log('  -- member: home / passport --');
  const m = { token: member };
  await expectStatus('me', 'GET', '/api/users/me', m);
  await expectStatus('luca recommendations', 'GET', '/api/luca/recommendations', m);
  await expectStatus('luca context', 'GET', '/api/luca/context', m);
  await expectStatus('week strip', 'GET', '/api/journey/week-strip', m);
  await expectStatus('checkins list', 'GET', '/api/journey/checkins', m);
  await expectStatus('journeys list', 'GET', '/api/journeys/mine', m);
  await expectStatus('journal', 'GET', '/api/journal', m);
  await expectStatus('audio library', 'GET', '/api/audio/my', m);
  await expectStatus('timeline', 'GET', '/api/timeline/me', m);
  await expectStatus('trends', 'GET', '/api/trends/vitals?range=30d', m);
  await expectStatus('appointments', 'GET', '/api/appointments', m);
  await expectStatus('passport completeness', 'GET', '/api/passport/completeness', m);
  await expectStatus('sovereignty status', 'GET', '/api/passport/sovereignty-status', m);
  await expectStatus('health documents', 'GET', '/api/health-documents', m);
  await expectStatus('consent grants', 'GET', '/api/consent/my-requests', m);
  await expectStatus('credentials', 'GET', '/api/credentials', m);

  console.log('  -- member: LUCA chat + agent --');
  await expectStatus('luca message history', 'GET', '/api/luca/messages', m);
  const reply = await expectStatus('luca send message', 'POST', '/api/luca/messages', { ...m, body: { content: 'Quick hello for the sweep — how is my energy trending?' } });
  if (reply) check('luca reply has assistant content', typeof reply.reply === 'string' && reply.reply.length > 0, '');
  await expectStatus('luca agent state', 'GET', '/api/agents/luca', m);
  await expectStatus('luca agent pause', 'POST', '/api/agents/luca/disable', m, [200, 201]);
  await expectStatus('luca agent re-enable', 'POST', '/api/agents/luca/enable', m, [200, 201]);

  console.log('  -- member: explore / booking --');
  const provs = await expectStatus('marketplace providers', 'GET', '/api/marketplace/providers', m);
  const provList = provs?.providers || provs || [];
  const prov = Array.isArray(provList) ? provList.find((p) => p.id || p.provider_id) : null;
  if (prov) {
    const pid = prov.id || prov.provider_id;
    await expectStatus('provider detail', 'GET', `/api/marketplace/providers/${pid}`, m);
    await expectStatus('provider slots', 'GET', `/api/bookings/slots/${pid}?days=7`, m, [200, 404]);
  } else check('provider detail', false, 'no providers returned');
  await expectStatus('my bookings', 'GET', '/api/bookings/mine', m, [200]);
  await expectStatus('bookings bad id -> clean 404', 'GET', '/api/bookings/not-a-uuid', m, [404]);
  await expectStatus('listings', 'GET', '/api/listings', m);

  console.log('  -- member: messages --');
  const convs = await expectStatus('conversations', 'GET', '/api/messages/conversations', m);
  const conv = (convs?.conversations || convs || [])[0];
  if (conv?.id) await expectStatus('thread messages', 'GET', `/api/messages/${conv.id}`, m, [200]);

  console.log('  -- member: economic passport / GPS --');
  await expectStatus('gps my-ledger', 'GET', '/api/gps/my-ledger', m);
  await expectStatus('gps my-earnings', 'GET', '/api/gps/my-earnings', m);
  await expectStatus('gps referral code', 'GET', '/api/gps/referrals/my-code', m);
  await expectStatus('gps treasury breakdown', 'GET', '/api/gps/treasury/breakdown', m);
  await expectStatus('gps leaderboard', 'GET', '/api/gps/leaderboard', m);
  await expectStatus('wallet chains', 'GET', '/api/wallet/chains', m, [200, 404]);
  await expectStatus('wallet list', 'GET', '/api/wallet', m, [200, 404]);
  await expectStatus('contributions', 'GET', '/api/contributions', m, [200, 404]);
  await expectStatus('contribution events', 'GET', '/api/contribution-events', m, [200, 404]);
  await expectStatus('leaderboard', 'GET', '/api/leaderboard', m, [200, 404]);

  console.log('  -- member: identity / sovereignty / export --');
  const idme = await expectStatus('identity me', 'GET', '/api/identity/me', m);
  if (idme) check('identity has solaris id', /^sol_[0-9a-f]{32}$/.test(idme.solarisId || ''), idme.solarisId || 'missing');
  await expectStatus('gps end-address set', 'PUT', '/api/identity/me/end-address', { ...m, body: { address: 'sweep-test@getalby.com' } });
  await expectStatus('gps end-address reset', 'PUT', '/api/identity/me/end-address', { ...m, body: { address: null } });
  await expectStatus('vault export', 'GET', '/api/export/me', m);
  await expectStatus('agents list', 'GET', '/api/agents', m, [200, 404]);

  console.log('  -- member: notifications --');
  await expectStatus('notifications list', 'GET', '/api/notifications', m);
  await expectStatus('notifications unread count', 'GET', '/api/notifications/unread-count', m);

  console.log('  -- practitioner --');
  const p = { token: pract };
  await expectStatus('pract: me', 'GET', '/api/users/me', p);
  await expectStatus('pract: my bookings', 'GET', '/api/provider/bookings/me', p, [200]);
  await expectStatus('pract: booking stats', 'GET', '/api/provider/bookings/stats', p, [200]);
  await expectStatus('pract: availability', 'GET', '/api/provider/availability/me', p, [200]);
  await expectStatus('pract: patients', 'GET', '/api/provider/patients', p, [200, 404]);
  await expectStatus('pract: earnings', 'GET', '/api/provider/earnings', p, [200, 404]);
  await expectStatus('pract: application status', 'GET', '/api/provider/apply/status', p, [200]);
  await expectStatus('pract: luca practitioner chat', 'GET', '/api/luca/practitioner/messages', p, [200, 404]);
  await expectStatus('pract: intake templates', 'GET', '/api/intake/templates', p, [200, 404]);

  console.log('  -- profile edit roundtrip --');
  const me = await req('GET', '/api/users/me', m);
  const origFirst = me.json?.firstName || me.json?.first_name || 'Sarah';
  await expectStatus('profile PATCH', 'PATCH', '/api/users/me', { ...m, body: { firstName: origFirst } }, [200]);

  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed.`);
  if (fails.length) { console.log('FAILURES:'); fails.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`)); process.exitCode = 1; }
}

run().catch((e) => { console.error('sweep crashed:', e); process.exit(1); });

/**
 * binding-proof-challenges.test.js — Beta V1 merge-blocker security correction
 * (blockers #2, #3, #4, #5, #8).
 *
 * Proves proof-of-control binding, the Postgres-backed single-use challenge
 * store, and server-enforced onboarding ordering — WITHOUT ever creating a real
 * user/wallet/production key. The keypairs below are DETERMINISTIC, TEST-ONLY
 * vectors: fixed private scalars used only inside this test process. They are
 * NOT derived from any person, wallet, mnemonic, or production secret, and are
 * never written anywhere outside the throwaway test rows this file cleans up.
 */
const crypto = require('crypto');
const request = require('supertest');
const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');

const app = require('../src/server');
const db = require('../src/db');
const nostr = require('../src/lib/nostr');
const { subjectIdForUser } = require('../src/lib/identity');
const challengeStore = require('../src/lib/nostr-challenges');

// ── DETERMINISTIC TEST-ONLY key vectors (NOT real keys; test process only) ──
const TEST_SK_A = '0000000000000000000000000000000000000000000000000000000000000003';
const TEST_SK_B = '0000000000000000000000000000000000000000000000000000000000000005';
const skA = Uint8Array.from(Buffer.from(TEST_SK_A, 'hex'));
const skB = Uint8Array.from(Buffer.from(TEST_SK_B, 'hex'));
const pubHexA = Buffer.from(schnorr.getPublicKey(skA)).toString('hex');
const pubHexB = Buffer.from(schnorr.getPublicKey(skB)).toString('hex');
const npubA = nostr.hexToNpub(pubHexA);
const npubB = nostr.hexToNpub(pubHexB);

const sha256hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const hashA = sha256hex(npubA);
const hashB = sha256hex(npubB);

function sign(sk, message) {
  const digest = sha256(new TextEncoder().encode(String(message)));
  return Buffer.from(schnorr.sign(digest, sk)).toString('hex');
}

let userA, tokenA, subjectA;
let userB, tokenB, subjectB;

async function purge() {
  await db.query(
    "DELETE FROM solaris_identity_bindings WHERE binding_type='nostr' AND binding_hash = ANY($1)",
    [[hashA, hashB]]
  ).catch(() => {});
  await db.query('DELETE FROM nostr_handles WHERE npub = ANY($1)', [[npubA, npubB]]).catch(() => {});
  await db.query('DELETE FROM nostr_auth_challenges WHERE npub = ANY($1)', [[npubA, npubB]]).catch(() => {});
  await db.query('UPDATE users SET nostr_npub=NULL WHERE nostr_npub = ANY($1)', [[npubA, npubB]]).catch(() => {});
}

async function cleanupUser(id) {
  if (!id) return;
  const s = await subjectIdForUser(id).catch(() => null);
  if (s) {
    await db.query('DELETE FROM nostr_handles WHERE subject_id=$1', [s]).catch(() => {});
    await db.query('DELETE FROM solaris_identity_bindings WHERE subject_id=$1', [s]).catch(() => {});
    await db.query('DELETE FROM solaris_subjects WHERE subject_id=$1', [s]).catch(() => {});
  }
  await db.query('DELETE FROM reward_events WHERE user_id=$1', [id]).catch(() => {});
  await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [id]).catch(() => {});
  await db.query('DELETE FROM users WHERE id=$1', [id]).catch(() => {});
}

beforeAll(async () => {
  await purge();
  const ra = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  tokenA = ra.body.token; userA = ra.body.user.id; subjectA = await subjectIdForUser(userA);
  const rb = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  tokenB = rb.body.token; userB = rb.body.user.id; subjectB = await subjectIdForUser(userB);
});

afterAll(async () => {
  await purge();
  await cleanupUser(userA);
  await cleanupUser(userB);
  await db.pool.end();
});

// ── Blocker #2: proof-of-control before binding ───────────────────────────
test('unsigned binding is rejected (400)', async () => {
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ npub: npubA });
  expect(res.status).toBe(400);
  // Nothing bound.
  const b = await db.query(
    "SELECT 1 FROM solaris_identity_bindings WHERE subject_id=$1 AND binding_type='nostr' AND status='active'",
    [subjectA]
  );
  expect(b.rows.length).toBe(0);
});

test('invalid binding signature is rejected (401)', async () => {
  const ch = await request(app)
    .post('/api/identity/nostr/bind-challenge')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ npub: npubA });
  expect(ch.status).toBe(200);
  const badSig = sign(skA, 'not-the-challenge-message');
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ npub: npubA, challengeId: ch.body.challengeId, nonce: ch.body.nonce, signature: badSig });
  expect(res.status).toBe(401);
});

test('valid binding proof succeeds (200) and stores only the public key', async () => {
  const ch = await request(app)
    .post('/api/identity/nostr/bind-challenge')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ npub: npubA });
  const sig = sign(skA, ch.body.message);
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({ npub: npubA, challengeId: ch.body.challengeId, nonce: ch.body.nonce, signature: sig });
  expect(res.status).toBe(200);
  expect(res.body.identityKey.npub).toBe(npubA);

  const b = await db.query(
    "SELECT binding_value FROM solaris_identity_bindings WHERE subject_id=$1 AND binding_type='nostr' AND status='active'",
    [subjectA]
  );
  expect(b.rows.length).toBe(1);
  expect(b.rows[0].binding_value).toBe(npubA);
  expect(b.rows[0].binding_value.startsWith('nsec')).toBe(false);
});

// ── Blocker #3: unique + transactional bindings ───────────────────────────
test('one npub cannot be ACTIVE for two subjects (409)', async () => {
  // userB proves control of key A (they hold it), but key A is already the
  // active binding of subjectA → the partial unique index must reject it.
  const ch = await request(app)
    .post('/api/identity/nostr/bind-challenge')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ npub: npubA });
  const sig = sign(skA, ch.body.message);
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({ npub: npubA, challengeId: ch.body.challengeId, nonce: ch.body.nonce, signature: sig });
  expect(res.status).toBe(409);
  // subjectB has no active nostr binding as a result (transaction rolled back).
  const b = await db.query(
    "SELECT 1 FROM solaris_identity_bindings WHERE subject_id=$1 AND binding_type='nostr' AND status='active'",
    [subjectB]
  );
  expect(b.rows.length).toBe(0);
});

// ── Blocker #4: PG-backed challenge store semantics ───────────────────────
test('login and bind challenges are NOT interchangeable', async () => {
  // A LOGIN challenge cannot satisfy a BIND consume.
  const login = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
  const loginSig = sign(skA, login.message);
  await expect(challengeStore.consumeAndVerify({
    challengeId: login.challengeId, purpose: 'bind', npub: npubA, nonce: login.nonce, sig: loginSig,
    expectedSubjectId: subjectA, expectedUserId: userA,
  })).rejects.toMatchObject({ status: 401 });

  // A BIND challenge cannot satisfy a LOGIN consume.
  const bind = await challengeStore.createChallenge({
    npub: npubA, pubkeyHex: pubHexA, purpose: 'bind', subjectId: subjectA, userId: userA,
  });
  const bindSig = sign(skA, bind.message);
  await expect(challengeStore.consumeAndVerify({
    challengeId: bind.challengeId, purpose: 'login', npub: npubA, nonce: bind.nonce, sig: bindSig,
  })).rejects.toMatchObject({ status: 401 });
});

test('challenge replay fails (single-use)', async () => {
  const ch = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
  const sig = sign(skA, ch.message);
  const first = await challengeStore.consumeAndVerify({
    challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig,
  });
  expect(first.npub).toBe(npubA);
  await expect(challengeStore.consumeAndVerify({
    challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig,
  })).rejects.toMatchObject({ status: 401 });
});

test('challenge expiry fails', async () => {
  const ch = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
  const sig = sign(skA, ch.message);
  // Force the row to be expired.
  await db.query("UPDATE nostr_auth_challenges SET expires_at = now() - interval '1 minute' WHERE id=$1", [ch.challengeId]);
  await expect(challengeStore.consumeAndVerify({
    challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig,
  })).rejects.toMatchObject({ status: 401 });
});

test('concurrent consume permits only ONE success', async () => {
  const ch = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
  const sig = sign(skA, ch.message);
  const attempts = await Promise.allSettled([
    challengeStore.consumeAndVerify({ challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig }),
    challengeStore.consumeAndVerify({ challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig }),
    challengeStore.consumeAndVerify({ challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig }),
  ]);
  const ok = attempts.filter((a) => a.status === 'fulfilled');
  expect(ok.length).toBe(1);
});

test('challenge state lives in the DB — works across a fresh module instance', async () => {
  // Instance 1 creates the challenge.
  const ch = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
  const sig = sign(skA, ch.message);
  // A SECOND, independently-loaded copy of the store module (simulating a second
  // backend instance) consumes it — only possible because the state is in Postgres.
  let store2;
  jest.isolateModules(() => { store2 = require('../src/lib/nostr-challenges'); });
  expect(store2).not.toBe(challengeStore);
  const res = await store2.consumeAndVerify({
    challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig,
  });
  expect(res.npub).toBe(npubA);
});

// ── Blocker #8: no secret material in logs or stored records ──────────────
test('no nsec / mnemonic / seed / raw nonce / credential is stored', async () => {
  const ch = await challengeStore.createChallenge({
    npub: npubA, pubkeyHex: pubHexA, purpose: 'bind', subjectId: subjectA, userId: userA,
  });
  const row = await db.query('SELECT * FROM nostr_auth_challenges WHERE id=$1', [ch.challengeId]);
  const r = row.rows[0];
  // The nonce is stored only as a hash — the raw nonce appears in no column.
  expect(r.nonce_hash).toBe(sha256hex(ch.nonce));
  for (const v of Object.values(r)) {
    if (v == null) continue;
    expect(String(v)).not.toContain(ch.nonce);
    expect(String(v)).not.toMatch(/nsec1/);
    expect(String(v)).not.toMatch(/\b(seed|mnemonic)\b/i);
  }
  // No signature column exists / is stored either.
  expect(Object.keys(r)).not.toContain('signature');
  expect(Object.keys(r)).not.toContain('sig');
});

test('no secret material reaches logs during a bind + login flow', async () => {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const ch = await challengeStore.createChallenge({ npub: npubA, pubkeyHex: pubHexA, purpose: 'login' });
    const sig = sign(skA, ch.message);
    await challengeStore.consumeAndVerify({ challengeId: ch.challengeId, purpose: 'login', npub: npubA, nonce: ch.nonce, sig });
    const all = [...logSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls]
      .flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    expect(all).not.toContain(TEST_SK_A);
    expect(all).not.toMatch(/nsec1/);
    expect(all).not.toContain(ch.nonce);
  } finally {
    logSpy.mockRestore(); warnSpy.mockRestore(); errorSpy.mockRestore();
  }
});

// ── Blocker #5: server-enforced onboarding ordering ───────────────────────
describe('onboarding ordering (server-enforced)', () => {
  let uId, uToken;
  beforeAll(async () => {
    const r = await request(app).post('/api/auth/register').send(global.makeUserPayload());
    uToken = r.body.token; uId = r.body.user.id;
  });
  afterAll(async () => { await cleanupUser(uId); });

  const ack = (screen, extra = {}) => request(app)
    .post('/api/onboarding/ack')
    .set('Authorization', `Bearer ${uToken}`)
    .send({ screen, ...extra });

  test('identity ack without an active Nostr binding → 409', async () => {
    const res = await ack('identity');
    expect(res.status).toBe(409);
    expect(res.body.nextStep).toBe('identity');
  });

  test('wealth ack before identity → 409', async () => {
    const res = await ack('wealth', { outcome: 'skipped' });
    expect(res.status).toBe(409);
  });

  test('sovereignty ack before wealth → 409', async () => {
    const res = await ack('sovereignty');
    expect(res.status).toBe(409);
  });

  test('full ordered flow: bind → identity → wealth(completed) → sovereignty, idempotent', async () => {
    // Bind key B (control proven) so the identity precondition is met.
    const bc = await request(app)
      .post('/api/identity/nostr/bind-challenge')
      .set('Authorization', `Bearer ${uToken}`)
      .send({ npub: npubB });
    const sig = sign(skB, bc.body.message);
    const bind = await request(app)
      .post('/api/identity/nostr')
      .set('Authorization', `Bearer ${uToken}`)
      .send({ npub: npubB, challengeId: bc.body.challengeId, nonce: bc.body.nonce, signature: sig });
    expect(bind.status).toBe(200);

    // identity ack now succeeds (control proven for the active binding)
    const id1 = await ack('identity');
    expect(id1.status).toBe(200);
    const idAt1 = id1.body.user.identityBackupAckAt;

    // invalid wealth outcome → 400 (in-order, so this exercises outcome validation)
    const badWealth = await ack('wealth', { outcome: 'bogus' });
    expect(badWealth.status).toBe(400);

    // completed without wallet backup ack → 400
    const noBackup = await ack('wealth', { outcome: 'completed', walletBackup: false });
    expect(noBackup.status).toBe(400);

    // wealth completed + backup succeeds
    const w1 = await ack('wealth', { outcome: 'completed', walletBackup: true });
    expect(w1.status).toBe(200);
    expect(w1.body.user.wealthScreenStatus).toBe('completed');

    // sovereignty completes the experience and advances the version
    const s1 = await ack('sovereignty');
    expect(s1.status).toBe(200);
    expect(s1.body.user.sovereigntyAckAt).toBeTruthy();
    expect(s1.body.user.onboardingExperienceVersion).toBeGreaterThanOrEqual(1);

    // replay identity is idempotent — timestamp unchanged
    const id2 = await ack('identity');
    expect(id2.status).toBe(200);
    expect(id2.body.user.identityBackupAckAt).toBe(idAt1);
  });
});

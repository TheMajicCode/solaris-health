/**
 * nostr-identity.test.js — Identity Key (Nostr) binding + login (M8; spec A2 §3),
 * updated for the Beta V1 proof-of-control flow (merge-blockers #2, #4).
 *
 * Proves the sovereign identity flow end-to-end WITHOUT the server ever seeing a
 * secret key:
 *   • bech32 npub <-> hex round-trips and BIP-340 signatures verify;
 *   • binding is TWO-STEP + authenticated: POST /api/identity/nostr/bind-challenge
 *     issues a signed-message challenge, and POST /api/identity/nostr binds the
 *     PUBLIC key + NIP-05 handle only after the signature verifies;
 *   • GET /.well-known/nostr.json?name=<handle> resolves the hex pubkey;
 *   • the challenge/response login issues a JWT only for a valid signature.
 *
 * The keypair below is a DETERMINISTIC, TEST-ONLY vector: a fixed private scalar
 * used only inside this test process. It is NOT a real key/wallet/mnemonic and is
 * never persisted outside the throwaway rows this file cleans up.
 */
const request = require('supertest');
const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const app = require('../src/server');
const db = require('../src/db');
const nostr = require('../src/lib/nostr');
const { subjectIdForUser } = require('../src/lib/identity');

// DETERMINISTIC TEST-ONLY device key (never leaves this process; not a real key).
const TEST_SK = '0000000000000000000000000000000000000000000000000000000000000007';
const sk = Uint8Array.from(Buffer.from(TEST_SK, 'hex'));
const pubHex = Buffer.from(schnorr.getPublicKey(sk)).toString('hex');
const npub = nostr.hexToNpub(pubHex);
const handle = 'sov' + Date.now().toString().slice(-8);

function sign(message) {
  const digest = sha256(new TextEncoder().encode(String(message)));
  return Buffer.from(schnorr.sign(digest, sk)).toString('hex');
}

let token;
let userId;

async function purgeKey() {
  await db.query('DELETE FROM nostr_handles WHERE npub=$1', [npub]).catch(() => {});
  await db.query('DELETE FROM nostr_auth_challenges WHERE npub=$1', [npub]).catch(() => {});
  await db.query("DELETE FROM solaris_identity_bindings WHERE binding_type='nostr' AND binding_value=$1", [npub]).catch(() => {});
  await db.query('UPDATE users SET nostr_npub=NULL WHERE nostr_npub=$1', [npub]).catch(() => {});
}

beforeAll(async () => {
  await purgeKey();
  const res = await request(app).post('/api/auth/register').send(global.makeUserPayload());
  token = res.body.token;
  userId = res.body.user.id;
});

afterAll(async () => {
  const subj = await subjectIdForUser(userId).catch(() => null);
  if (subj) {
    await db.query('DELETE FROM nostr_handles WHERE subject_id=$1', [subj]).catch(() => {});
    await db.query("DELETE FROM solaris_identity_bindings WHERE subject_id=$1 AND binding_type='nostr'", [subj]).catch(() => {});
  }
  await purgeKey();
  if (userId) {
    await db.query('DELETE FROM reward_events WHERE user_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [userId]).catch(() => {});
    await db.query('DELETE FROM users WHERE id=$1', [userId]).catch(() => {});
  }
  await db.pool.end();
});

test('npub bech32 <-> hex round-trips and Schnorr signatures verify', () => {
  expect(npub.startsWith('npub1')).toBe(true);
  expect(nostr.npubToHex(npub)).toBe(pubHex);
  const sig = sign('solaris:login:v1|test');
  expect(nostr.verifyChallengeSignature({ pubkey: npub, message: 'solaris:login:v1|test', sigHex: sig })).toBe(true);
  expect(nostr.verifyChallengeSignature({ pubkey: npub, message: 'tampered', sigHex: sig })).toBe(false);
});

test('two-step proof-of-control binds the public key + NIP-05 handle (never the secret)', async () => {
  // Step 1 — authenticated challenge (server never receives the nsec).
  const ch = await request(app)
    .post('/api/identity/nostr/bind-challenge')
    .set('Authorization', `Bearer ${token}`)
    .send({ npub });
  expect(ch.status).toBe(200);
  expect(ch.body.challengeId).toBeTruthy();
  expect(ch.body.message).toContain('solaris:bind-identity-key');

  // Step 2 — submit the signature over the challenge message.
  const signature = sign(ch.body.message);
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${token}`)
    .send({ npub, challengeId: ch.body.challengeId, nonce: ch.body.nonce, signature, handle });
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  expect(res.body.identityKey.npub).toBe(npub);
  expect(res.body.identityKey.handle).toBe(handle);
  expect(res.body.identityKey.nip05).toBe(`${handle}@solaris.health`);

  // Only the npub (public) is stored — assert no secret-shaped value anywhere.
  const subj = await subjectIdForUser(userId);
  const b = await db.query(
    "SELECT binding_value FROM solaris_identity_bindings WHERE subject_id=$1 AND binding_type='nostr' AND status='active'",
    [subj]
  );
  expect(b.rows[0].binding_value).toBe(npub);
  expect(b.rows[0].binding_value.startsWith('nsec')).toBe(false);
});

test('an unsigned binding attempt is rejected (proof-of-control required)', async () => {
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${token}`)
    .send({ npub, handle });
  expect(res.status).toBe(400);
});

test('GET /.well-known/nostr.json?name=<handle> resolves the hex pubkey (NIP-05)', async () => {
  const res = await request(app).get(`/.well-known/nostr.json?name=${handle}`);
  expect(res.status).toBe(200);
  expect(res.body.names[handle]).toBe(pubHex);
  // Unknown name -> empty names map, never an error.
  const miss = await request(app).get('/.well-known/nostr.json?name=nobody-here-xyz');
  expect(miss.status).toBe(200);
  expect(miss.body.names['nobody-here-xyz']).toBeUndefined();
});

test('challenge/response login issues a JWT only for a valid signature', async () => {
  // 1) get a login challenge (npub is now linked from the binding test)
  const ch = await request(app).post('/api/auth/nostr/challenge').send({ npub });
  expect(ch.status).toBe(200);
  expect(ch.body.challengeId).toBeTruthy();
  expect(ch.body.nonce).toBeTruthy();
  expect(ch.body.message).toContain('solaris:login:v1');

  // 2) a WRONG signature is rejected
  const badSig = sign('solaris:login:v1|not-the-message');
  const bad = await request(app)
    .post('/api/auth/nostr/login')
    .send({ npub, challengeId: ch.body.challengeId, nonce: ch.body.nonce, sig: badSig });
  expect(bad.status).toBe(401);

  // 3) the correct signature logs in (challenge single-use — get a fresh one)
  const ch2 = await request(app).post('/api/auth/nostr/challenge').send({ npub });
  const goodSig = sign(ch2.body.message);
  const ok = await request(app)
    .post('/api/auth/nostr/login')
    .send({ npub, challengeId: ch2.body.challengeId, nonce: ch2.body.nonce, sig: goodSig });
  expect(ok.status).toBe(200);
  expect(ok.body.token).toBeTruthy();
  expect(ok.body.user.nostrNpub).toBe(npub);

  // 4) replaying the same challenge fails (single-use)
  const replay = await request(app)
    .post('/api/auth/nostr/login')
    .send({ npub, challengeId: ch2.body.challengeId, nonce: ch2.body.nonce, sig: goodSig });
  expect(replay.status).toBe(401);
});

test('a login challenge is NOT issued for an unlinked npub (no account is created)', async () => {
  // A different deterministic key that is never bound.
  const skU = Uint8Array.from(Buffer.from('0000000000000000000000000000000000000000000000000000000000000009', 'hex'));
  const pubU = Buffer.from(schnorr.getPublicKey(skU)).toString('hex');
  const npubU = nostr.hexToNpub(pubU);
  const res = await request(app).post('/api/auth/nostr/challenge').send({ npub: npubU });
  expect(res.status).toBe(404);
  expect(res.body.mustCreateAccount).toBe(true);
  const found = await db.query('SELECT id FROM users WHERE nostr_npub=$1', [npubU]);
  expect(found.rows.length).toBe(0);
});

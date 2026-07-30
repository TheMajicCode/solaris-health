/**
 * nostr-identity.test.js — Identity Key (Nostr) binding + login (M8; spec A2 §3).
 *
 * Proves the sovereign identity flow end-to-end WITHOUT the server ever seeing
 * a secret key:
 *   • bech32 npub <-> hex round-trips and BIP-340 signatures verify;
 *   • POST /api/identity/nostr binds the PUBLIC key + a NIP-05 handle;
 *   • GET /.well-known/nostr.json?name=<handle> resolves the hex pubkey;
 *   • the challenge/response login issues a JWT only for a valid signature.
 */
const request = require('supertest');
const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const app = require('../src/server');
const db = require('../src/db');
const nostr = require('../src/lib/nostr');
const { subjectIdForUser } = require('../src/lib/identity');

// A throwaway device keypair — the "secret key" NEVER leaves this test process,
// exactly as it never leaves a member's device.
const sk = schnorr.utils.randomPrivateKey();
const pubHex = Buffer.from(schnorr.getPublicKey(sk)).toString('hex');
const npub = nostr.hexToNpub(pubHex);
const handle = 'sov' + Date.now().toString().slice(-8);

function sign(message) {
  const digest = sha256(new TextEncoder().encode(message));
  return Buffer.from(schnorr.sign(digest, sk)).toString('hex');
}

let token;
let userId;

beforeAll(async () => {
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
  // The login test may have created a second (npub-only) account — clean it too.
  const extra = await db.query('SELECT id FROM users WHERE nostr_npub=$1', [npub]).catch(() => ({ rows: [] }));
  for (const r of extra.rows) {
    const s = await subjectIdForUser(r.id).catch(() => null);
    if (s) {
      await db.query('DELETE FROM nostr_handles WHERE subject_id=$1', [s]).catch(() => {});
      await db.query('DELETE FROM solaris_identity_bindings WHERE subject_id=$1', [s]).catch(() => {});
      await db.query('DELETE FROM solaris_subjects WHERE subject_id=$1', [s]).catch(() => {});
    }
    await db.query('DELETE FROM reward_events WHERE user_id=$1', [r.id]).catch(() => {});
    await db.query('DELETE FROM audit_logs WHERE actor_id=$1', [r.id]).catch(() => {});
    if (r.id !== userId) await db.query('DELETE FROM users WHERE id=$1', [r.id]).catch(() => {});
  }
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
  const sig = sign('solaris-login:xyz');
  expect(nostr.verifyChallengeSignature({ pubkey: npub, message: 'solaris-login:xyz', sigHex: sig })).toBe(true);
  expect(nostr.verifyChallengeSignature({ pubkey: npub, message: 'tampered', sigHex: sig })).toBe(false);
});

test('POST /api/identity/nostr binds the public key + NIP-05 handle (never the secret)', async () => {
  const res = await request(app)
    .post('/api/identity/nostr')
    .set('Authorization', `Bearer ${token}`)
    .send({ npub, handle });
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
  // 1) get a challenge
  const ch = await request(app).post('/api/auth/nostr/challenge').send({ npub });
  expect(ch.status).toBe(200);
  expect(ch.body.nonce).toBeTruthy();
  expect(ch.body.message).toBe(`solaris-login:${ch.body.nonce}`);

  // 2) a WRONG signature is rejected
  const badSig = sign('solaris-login:not-the-nonce');
  const bad = await request(app).post('/api/auth/nostr/login').send({ npub, nonce: ch.body.nonce, sig: badSig });
  expect(bad.status).toBe(401);

  // 3) the correct signature logs in (challenge was single-use — get a fresh one)
  const ch2 = await request(app).post('/api/auth/nostr/challenge').send({ npub });
  const goodSig = sign(ch2.body.message);
  const ok = await request(app).post('/api/auth/nostr/login').send({ npub, nonce: ch2.body.nonce, sig: goodSig });
  expect(ok.status).toBe(200);
  expect(ok.body.token).toBeTruthy();
  expect(ok.body.user.nostrNpub).toBe(npub);

  // 4) replaying the same nonce fails (single-use)
  const replay = await request(app).post('/api/auth/nostr/login').send({ npub, nonce: ch2.body.nonce, sig: goodSig });
  expect(replay.status).toBe(401);
});

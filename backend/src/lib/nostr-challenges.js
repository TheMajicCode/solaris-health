'use strict';
/**
 * nostr-challenges.js — Postgres-backed proof-of-control challenge store
 * (Beta V1 merge-blocker #4). Replaces the previous in-memory Map so that:
 *   - challenges survive restarts and work across MORE THAN ONE backend
 *     instance (all state lives in the shared `nostr_auth_challenges` table);
 *   - each challenge is SINGLE-USE via an atomic consume;
 *   - login and bind challenges are NOT interchangeable (purpose separation is
 *     enforced both in the signed message and in the consume WHERE clause);
 *   - a BIND challenge is scoped to the authenticated subject/user;
 *   - only a HASH of the nonce is stored — no secret material (no nsec,
 *     mnemonic, seed, signature or raw nonce) is ever persisted.
 *
 * The raw nonce is a PUBLIC challenge value: the client receives it, the device
 * signs a canonical message containing it, and the client sends the nonce back
 * at verify time. The server hash-matches the submitted nonce, atomically
 * consumes the row, reconstructs the canonical message deterministically from
 * stored fields + the nonce, and verifies the BIP-340 signature.
 */

const crypto = require('crypto');
const db = require('../db');
const { npubToHex, verifyChallengeSignature } = require('./nostr');

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // short-lived

// Bounded rate limiting (per npub + purpose, over a rolling 60s window).
const CREATE_WINDOW_SECONDS = 60;
const CREATE_MAX = 8;
const VERIFY_WINDOW_SECONDS = 60;
const VERIFY_MAX = 20;

const sha256hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/**
 * Canonical, domain- + purpose-separated message the device signs. Contains the
 * app name ("solaris"), the operation, the authenticated subject (bind only),
 * an issue time, and a nonce. A LOGIN signature can never satisfy a BIND consume
 * (and vice-versa): the message content differs AND the purpose column gates the
 * atomic consume.
 */
function buildMessage(purpose, { npub, subjectId, issuedMs, nonce }) {
  if (purpose === 'bind') {
    return `solaris:bind-identity-key:v1|subject=${subjectId}|npub=${npub}|iat=${issuedMs}|nonce=${nonce}`;
  }
  return `solaris:login:v1|npub=${npub}|iat=${issuedMs}|nonce=${nonce}`;
}

/** Opportunistic sweep of expired rows (cheap; index-backed). Never throws. */
async function sweepExpired() {
  try {
    await db.query('DELETE FROM nostr_auth_challenges WHERE expires_at < now()');
  } catch (_) { /* non-fatal */ }
}

/**
 * Issue a challenge. Rate-limited per (npub, purpose). Returns the client-facing
 * { challengeId, nonce, message, expiresInMs }. For 'bind', subjectId + userId
 * of the authenticated caller are recorded and the consume is scoped to them.
 */
async function createChallenge({ npub, pubkeyHex, purpose, subjectId = null, userId = null }) {
  if (purpose !== 'login' && purpose !== 'bind') {
    throw Object.assign(new Error('Invalid challenge purpose'), { status: 400 });
  }
  await sweepExpired();

  const rl = await db.query(
    `SELECT COUNT(*)::int AS n FROM nostr_auth_challenges
      WHERE npub = $1 AND purpose = $2 AND issued_at > now() - ($3 || ' seconds')::interval`,
    [npub, purpose, String(CREATE_WINDOW_SECONDS)]
  );
  if (rl.rows[0].n >= CREATE_MAX) {
    throw Object.assign(new Error('Too many challenge requests. Please wait a moment and try again.'), { status: 429 });
  }

  const nonce = crypto.randomBytes(24).toString('hex');
  const issuedMs = Date.now();
  const expiresAt = new Date(issuedMs + CHALLENGE_TTL_MS);

  const ins = await db.query(
    `INSERT INTO nostr_auth_challenges
       (nonce_hash, npub, pubkey_hex, purpose, subject_id, user_id, issued_ms, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id`,
    [sha256hex(nonce), npub, pubkeyHex, purpose, subjectId, userId, issuedMs, expiresAt]
  );
  const challengeId = ins.rows[0].id;
  const message = buildMessage(purpose, { npub, subjectId, issuedMs, nonce });
  return { challengeId, nonce, message, expiresInMs: CHALLENGE_TTL_MS };
}

/**
 * Atomically consume a challenge and verify the signature. Returns
 * { npub, pubkeyHex, subjectId, userId } on success; throws {status} otherwise.
 *
 * The atomic UPDATE marks consumed_at (single-use regardless of signature
 * outcome — a wrong signature burns the challenge, so brute force needs a fresh
 * challenge each time and is bounded by the creation rate limiter). Purpose,
 * npub and nonce hash must all match; the row must be unconsumed and unexpired.
 * For 'bind', the challenge's recorded subject/user must match the authenticated
 * caller (expectedSubjectId / expectedUserId).
 */
async function consumeAndVerify({
  challengeId, purpose, npub, nonce, sig,
  expectedSubjectId = null, expectedUserId = null,
}) {
  if (purpose !== 'login' && purpose !== 'bind') {
    throw Object.assign(new Error('Invalid challenge purpose'), { status: 400 });
  }
  if (!challengeId || !npub || !nonce || !sig) {
    throw Object.assign(new Error('challengeId, nonce and signature are required.'), { status: 400 });
  }

  // Verification rate limit (per npub + purpose).
  const rl = await db.query(
    `SELECT COUNT(*)::int AS n FROM nostr_auth_challenges
      WHERE npub = $1 AND purpose = $2 AND consumed_at IS NOT NULL
        AND consumed_at > now() - ($3 || ' seconds')::interval`,
    [npub, purpose, String(VERIFY_WINDOW_SECONDS)]
  );
  if (rl.rows[0].n >= VERIFY_MAX) {
    throw Object.assign(new Error('Too many verification attempts. Please wait a moment and try again.'), { status: 429 });
  }

  let consumed;
  try {
    consumed = await db.query(
      `UPDATE nostr_auth_challenges
          SET consumed_at = now()
        WHERE id = $1 AND purpose = $2 AND npub = $3 AND nonce_hash = $4
          AND consumed_at IS NULL AND expires_at > now()
      RETURNING id, npub, pubkey_hex, subject_id, user_id, issued_ms`,
      [challengeId, purpose, npub, sha256hex(nonce)]
    );
  } catch (err) {
    // Malformed uuid etc. → treat as invalid challenge, never leak internals.
    throw Object.assign(new Error('Challenge expired or invalid. Please try again.'), { status: 401 });
  }
  if (!consumed.rows.length) {
    throw Object.assign(new Error('Challenge expired or invalid. Please try again.'), { status: 401 });
  }
  const row = consumed.rows[0];

  // Bind challenges are bound to the authenticated caller.
  if (purpose === 'bind') {
    if (String(row.user_id) !== String(expectedUserId) ||
        String(row.subject_id) !== String(expectedSubjectId)) {
      throw Object.assign(new Error('This challenge does not belong to your account.'), { status: 403 });
    }
  }

  const message = buildMessage(purpose, {
    npub: row.npub, subjectId: row.subject_id, issuedMs: Number(row.issued_ms), nonce,
  });
  if (!verifyChallengeSignature({ pubkey: row.pubkey_hex, message, sigHex: sig })) {
    throw Object.assign(new Error('Signature did not verify for this Identity Key.'), { status: 401 });
  }

  return {
    npub: row.npub,
    pubkeyHex: row.pubkey_hex,
    subjectId: row.subject_id,
    userId: row.user_id,
  };
}

module.exports = {
  buildMessage,
  createChallenge,
  consumeAndVerify,
  sweepExpired,
  CHALLENGE_TTL_MS,
};

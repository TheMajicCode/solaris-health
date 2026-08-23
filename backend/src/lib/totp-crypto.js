'use strict';
/**
 * Authenticated encryption (AEAD) for TOTP secrets at rest — NODE E4J-RC1.2.
 *
 * A TOTP secret is a bearer credential: whoever holds it can mint valid codes.
 * We therefore NEVER persist it in plaintext. This module wraps the base32
 * secret with AES-256-GCM under a wrapping key supplied out of band via the
 * ADMIN_MFA_WRAP_KEY environment variable, and stores only the wrapped blob
 * (admin_mfa_secrets.secret_wrapped).
 *
 * The wrapped format is a self-describing JSON string:
 *   {"v":1,"alg":"A256GCM","iv":<b64url>,"ct":<b64url>,"tag":<b64url>}
 * GCM's auth tag makes tampering detectable (unwrap throws on any modification).
 *
 * SECURITY: the plaintext secret and the wrapping key are NEVER logged, echoed,
 * or returned in an error message.
 */
const crypto = require('crypto');

const ALG = 'aes-256-gcm';
const KEY_ENV = 'ADMIN_MFA_WRAP_KEY';

/**
 * Derive a 32-byte key from the configured wrapping-key material. Accepts a
 * base64/base64url/hex string, or falls back to a SHA-256 of the raw string so
 * any sufficiently strong passphrase works. Throws (fail-closed) if unset.
 */
function loadKey() {
  const raw = process.env[KEY_ENV];
  if (!raw || typeof raw !== 'string' || raw.length < 16) {
    const e = new Error('ADMIN_MFA_WRAP_KEY_MISSING');
    e.code = 'ADMIN_MFA_WRAP_KEY_MISSING';
    throw e;
  }
  // Try hex (64 chars) or base64/base64url (44-ish) → exactly 32 bytes; else hash.
  try {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    const b = Buffer.from(raw, 'base64');
    if (b.length === 32) return b;
  } catch (_e) { /* fall through */ }
  return crypto.createHash('sha256').update(raw).digest();
}

/** Wrap a plaintext base32 secret. Returns the JSON envelope string. */
function wrapSecret(plaintextBase32, key = loadKey()) {
  if (typeof plaintextBase32 !== 'string' || !plaintextBase32) {
    throw new Error('nothing_to_wrap');
  }
  const iv = crypto.randomBytes(12); // 96-bit nonce (GCM standard)
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plaintextBase32, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: 'A256GCM',
    iv: iv.toString('base64url'),
    ct: ct.toString('base64url'),
    tag: tag.toString('base64url'),
  });
}

/** Unwrap a JSON envelope back to the plaintext base32 secret. Throws on tamper. */
function unwrapSecret(wrapped, key = loadKey()) {
  let env;
  try {
    env = typeof wrapped === 'string' ? JSON.parse(wrapped) : wrapped;
  } catch (_e) {
    throw new Error('bad_envelope');
  }
  if (!env || env.v !== 1 || env.alg !== 'A256GCM' || !env.iv || !env.ct || !env.tag) {
    throw new Error('bad_envelope');
  }
  const decipher = crypto.createDecipheriv(ALG, key, Buffer.from(env.iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(env.tag, 'base64url'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(env.ct, 'base64url')),
    decipher.final(), // throws if the tag does not verify
  ]);
  return pt.toString('utf8');
}

/** Whether a wrapping key is configured (without revealing it). */
function isConfigured() {
  try { loadKey(); return true; } catch (_e) { return false; }
}

module.exports = { ALG, KEY_ENV, wrapSecret, unwrapSecret, isConfigured, loadKey };

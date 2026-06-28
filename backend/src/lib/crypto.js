/**
 * crypto.js — Phase 5 server-side messaging crypto helpers.
 *
 * IMPORTANT: messages are END-TO-END encrypted in the browser. The server
 * NEVER sees plaintext and holds no private keys. These helpers therefore do
 * NOT decrypt anything — they only provide:
 *   - public-key fingerprinting (for display / verification)
 *   - validation of the opaque encrypted payloads clients submit
 *   - size accounting for base64 blobs (attachment limits)
 *
 * Uses only Node's built-in `crypto`.
 */
const crypto = require('crypto');

const MAX_MESSAGE_BYTES = 64 * 1024;            // 64 KB ciphertext per text message
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;  // 10 MB plaintext file limit
// base64 inflates by ~4/3; allow generous headroom for the encrypted blob
const MAX_ATTACHMENT_B64 = Math.ceil((MAX_ATTACHMENT_BYTES * 4) / 3) + 4096;

/** SHA-256 hex digest of a string. */
function sha256Hex(input) {
  return crypto.createHash('sha256').update(typeof input === 'string' ? input : JSON.stringify(input)).digest('hex');
}

/**
 * Short, stable fingerprint of a public key (first 16 hex chars of its SHA-256).
 * Lets users visually compare keys without exposing anything sensitive.
 */
function fingerprint(publicKey) {
  return sha256Hex(publicKey).slice(0, 16);
}

/** Cryptographically-strong random token (hex). */
function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Loose base64 validation (allows standard + url-safe alphabets, padding). */
function isBase64(str) {
  if (typeof str !== 'string' || str.length === 0) return false;
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(str);
}

/** Approximate decoded byte length of a base64 string without decoding it. */
function base64ByteLength(str) {
  if (typeof str !== 'string') return 0;
  const len = str.length;
  const padding = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Validate the shape of an encrypted text-message payload from a client.
 * Returns { ok: true } or { ok: false, error }.
 */
function validateEncryptedMessage(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Missing encrypted payload' };
  const { encryptedContent, iv, encKeyRecipient } = payload;
  if (!isBase64(encryptedContent)) return { ok: false, error: 'Invalid encrypted content' };
  if (!isBase64(iv)) return { ok: false, error: 'Invalid IV' };
  if (!encKeyRecipient || !isBase64(encKeyRecipient)) return { ok: false, error: 'Missing recipient key envelope' };
  if (base64ByteLength(encryptedContent) > MAX_MESSAGE_BYTES) return { ok: false, error: 'Message too large' };
  return { ok: true };
}

/** Validate an encrypted attachment payload (size-limited). */
function validateEncryptedAttachment(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Missing attachment payload' };
  const { encryptedBlob, iv, encKeyRecipient, size } = payload;
  if (!isBase64(encryptedBlob)) return { ok: false, error: 'Invalid encrypted blob' };
  if (!isBase64(iv)) return { ok: false, error: 'Invalid IV' };
  if (!encKeyRecipient || !isBase64(encKeyRecipient)) return { ok: false, error: 'Missing recipient key envelope' };
  if (encryptedBlob.length > MAX_ATTACHMENT_B64) return { ok: false, error: 'Attachment exceeds 10 MB limit' };
  if (size && Number(size) > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'Attachment exceeds 10 MB limit' };
  return { ok: true };
}

module.exports = {
  sha256Hex,
  fingerprint,
  randomToken,
  isBase64,
  base64ByteLength,
  validateEncryptedMessage,
  validateEncryptedAttachment,
  MAX_MESSAGE_BYTES,
  MAX_ATTACHMENT_BYTES,
};

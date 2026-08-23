'use strict';
/**
 * Secure single-use, time-limited admin activation tokens (Node E4J-RC1 item 2).
 *
 * The admin bootstrap NEVER sets a usable password itself and NEVER prints a
 * credential. Instead it mints a high-entropy activation token that is delivered
 * OUT OF BAND (protected file / reset link). Only the SHA-256 HASH of the token
 * is ever persisted; the raw token is never stored, logged, or returned in any
 * status line. The admin uses the token once, before it expires, to set their
 * own password and enroll MFA/passkey.
 *
 * This module is pure (no DB, no I/O) so it is fully unit-testable.
 */
const crypto = require('crypto');

// Default activation-token lifetime: short window, out-of-band delivery.
const DEFAULT_TTL_MINUTES = 30;

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/** sha256(lower(trim(email))) — an identifier fingerprint, never the address. */
function emailFingerprint(email) {
  return sha256(String(email).trim().toLowerCase());
}

/** Hash an activation token for storage/comparison. */
function hashToken(token) {
  return sha256(token);
}

/**
 * Generate a single-use activation token.
 * Returns { token, tokenHash, expiresAt } — the caller stores ONLY tokenHash +
 * expiresAt and delivers `token` out of band, then discards it from memory.
 */
function generateActivationToken(now = new Date(), ttlMinutes = DEFAULT_TTL_MINUTES) {
  const token = crypto.randomBytes(32).toString('base64url'); // ~256 bits
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  return { token, tokenHash: hashToken(token), expiresAt };
}

/**
 * Validate a presented token against a stored activation row.
 * Fail-closed: any missing/expired/used/revoked/mismatched state -> not valid.
 * Returns { valid: boolean, reason: string }.
 */
function verifyActivation(row, presentedToken, now = new Date()) {
  if (!row) return { valid: false, reason: 'not_found' };
  if (row.revoked_at) return { valid: false, reason: 'revoked' };
  if (row.used_at) return { valid: false, reason: 'already_used' };
  if (!row.expires_at || new Date(row.expires_at).getTime() <= now.getTime()) {
    return { valid: false, reason: 'expired' };
  }
  if (!presentedToken || typeof presentedToken !== 'string') {
    return { valid: false, reason: 'no_token' };
  }
  const a = Buffer.from(hashToken(presentedToken));
  const b = Buffer.from(String(row.token_hash || ''));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: 'mismatch' };
  }
  return { valid: true, reason: 'ok' };
}

module.exports = {
  DEFAULT_TTL_MINUTES,
  sha256,
  emailFingerprint,
  hashToken,
  generateActivationToken,
  verifyActivation,
};

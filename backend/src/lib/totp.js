'use strict';
/**
 * RFC 6238 TOTP (Time-based One-Time Password) — NODE E4J-RC1.2.
 *
 * Pure crypto helper with NO external dependency (uses node:crypto only). Used
 * for real admin second-factor enrollment + login verification. The raw secret
 * is high-entropy (crypto RNG) and is NEVER logged; callers must store it only
 * wrapped (see totp-crypto.js).
 *
 * Defaults follow the interoperable standard used by Google Authenticator, Authy,
 * 1Password, etc: HMAC-SHA1, 6 digits, 30-second step.
 */
const crypto = require('crypto');

const DEFAULT_STEP = 30;   // seconds
const DEFAULT_DIGITS = 6;
const DEFAULT_ALGO = 'sha1';

// RFC 4648 base32 alphabet (no padding needed for our fixed-length secrets).
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Encode a Buffer to base32 (RFC 4648, uppercase, no padding). */
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += B32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Decode a base32 string (RFC 4648, case-insensitive, ignores spaces/padding). */
function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('invalid_base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Generate a new base32 TOTP secret. 20 random bytes = 160 bits (RFC 6238
 * recommended minimum for SHA-1). Returned as a base32 string.
 */
function generateSecret(bytes = 20) {
  return base32Encode(crypto.randomBytes(bytes));
}

/** The time-step counter for a given epoch-ms time. */
function stepFor(timeMs, step = DEFAULT_STEP) {
  return Math.floor(timeMs / 1000 / step);
}

/** Compute the TOTP code for an explicit step counter. */
function codeForStep(secretBase32, counter, { digits = DEFAULT_DIGITS, algo = DEFAULT_ALGO } = {}) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter.
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac(algo, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(bin % mod).padStart(digits, '0');
}

/** Compute the current TOTP code for a secret at a given time. */
function totpCode(secretBase32, timeMs = Date.now(), opts = {}) {
  const step = opts.step || DEFAULT_STEP;
  return codeForStep(secretBase32, stepFor(timeMs, step), opts);
}

/**
 * Verify a presented code against a secret, allowing +/- `window` steps of clock
 * drift. Constant-time compare. Returns { valid, step } where `step` is the
 * matched time-step counter (used by the caller for replay protection — a code
 * is accepted at most once per step). Never throws for a bad code.
 */
function verifyCode(secretBase32, presented, { window = 1, timeMs = Date.now(), step = DEFAULT_STEP, digits = DEFAULT_DIGITS, algo = DEFAULT_ALGO, afterStep = null } = {}) {
  if (typeof presented !== 'string') return { valid: false, step: null };
  const clean = presented.replace(/\s+/g, '');
  if (!/^[0-9]+$/.test(clean) || clean.length !== digits) return { valid: false, step: null };
  const current = stepFor(timeMs, step);
  for (let w = -window; w <= window; w++) {
    const counter = current + w;
    // Replay guard: refuse any step at or before the last accepted one.
    if (afterStep != null && counter <= afterStep) continue;
    const expected = codeForStep(secretBase32, counter, { digits, algo });
    const a = Buffer.from(expected);
    const b = Buffer.from(clean);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { valid: true, step: counter };
    }
  }
  return { valid: false, step: null };
}

/**
 * Build an otpauth:// provisioning URI for QR display in an authenticator app.
 * The secret is embedded (it must reach the enrolling admin over the already-
 * authenticated channel); callers must NEVER log this string.
 */
function otpauthUri({ secret, label, issuer = 'Solaris Health', digits = DEFAULT_DIGITS, step = DEFAULT_STEP, algo = DEFAULT_ALGO }) {
  const enc = encodeURIComponent;
  const lbl = `${enc(issuer)}:${enc(label)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: algo.toUpperCase(),
    digits: String(digits),
    period: String(step),
  });
  return `otpauth://totp/${lbl}?${params.toString()}`;
}

module.exports = {
  DEFAULT_STEP,
  DEFAULT_DIGITS,
  DEFAULT_ALGO,
  base32Encode,
  base32Decode,
  generateSecret,
  stepFor,
  codeForStep,
  totpCode,
  verifyCode,
  otpauthUri,
};

'use strict';
/**
 * NODE E4J-RC1.2 — unit tests for the RFC 6238 TOTP helper and the AEAD secret
 * wrapper. Pure crypto, no DB. Proves: RFC 6238 test-vector correctness, replay
 * rejection, drift window, base32 round-trip, and that a wrapped secret is
 * confidential + tamper-evident.
 */
const totp = require('../src/lib/totp');
const tc = require('../src/lib/totp-crypto');

describe('totp base32', () => {
  test('encode/decode round-trips arbitrary bytes', () => {
    for (const s of ['A', 'hello world', 'x'.repeat(20)]) {
      const buf = Buffer.from(s);
      expect(totp.base32Decode(totp.base32Encode(buf)).equals(buf)).toBe(true);
    }
  });
  test('decode is case-insensitive and ignores spaces', () => {
    const enc = totp.base32Encode(Buffer.from('solaris'));
    const spaced = enc.toLowerCase().replace(/(.{4})/g, '$1 ');
    expect(totp.base32Decode(spaced).toString()).toBe('solaris');
  });
});

describe('totp RFC 6238 correctness', () => {
  // RFC 6238 Appendix B test vector: secret = ASCII "12345678901234567890"
  // (SHA-1), 8-digit codes. We verify the known value at T=59s.
  test('matches the RFC 6238 appendix B vector (T=59, 8 digits, SHA1)', () => {
    const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
    const code = totp.totpCode(secret, 59 * 1000, { digits: 8 });
    expect(code).toBe('94287082');
  });
  test('a generated secret verifies its own current code', () => {
    const s = totp.generateSecret();
    const now = Date.now();
    const { valid, step } = totp.verifyCode(s, totp.totpCode(s, now), { timeMs: now });
    expect(valid).toBe(true);
    expect(typeof step).toBe('number');
  });
});

describe('totp verifyCode security properties', () => {
  const s = totp.generateSecret();
  const now = Date.now();
  test('rejects a wrong code', () => {
    expect(totp.verifyCode(s, '000000', { timeMs: now }).valid).toBe(false);
  });
  test('rejects malformed input (non-numeric / wrong length / non-string)', () => {
    expect(totp.verifyCode(s, 'abcdef', { timeMs: now }).valid).toBe(false);
    expect(totp.verifyCode(s, '123', { timeMs: now }).valid).toBe(false);
    expect(totp.verifyCode(s, 123456, { timeMs: now }).valid).toBe(false);
  });
  test('accepts within the drift window but not outside it', () => {
    const prev = totp.totpCode(s, now - 30 * 1000);
    expect(totp.verifyCode(s, prev, { timeMs: now, window: 1 }).valid).toBe(true);
    const old = totp.totpCode(s, now - 5 * 30 * 1000);
    expect(totp.verifyCode(s, old, { timeMs: now, window: 1 }).valid).toBe(false);
  });
  test('replay guard: a matched step cannot be reused (afterStep)', () => {
    const code = totp.totpCode(s, now);
    const first = totp.verifyCode(s, code, { timeMs: now });
    expect(first.valid).toBe(true);
    const replay = totp.verifyCode(s, code, { timeMs: now, afterStep: first.step });
    expect(replay.valid).toBe(false);
  });
});

describe('totp-crypto AEAD wrapping', () => {
  const KEY = 'unit-test-wrap-key-0123456789abcdefghij';
  const withKey = (fn) => {
    const prev = process.env.ADMIN_MFA_WRAP_KEY;
    process.env.ADMIN_MFA_WRAP_KEY = KEY;
    try { return fn(); } finally {
      if (prev === undefined) delete process.env.ADMIN_MFA_WRAP_KEY;
      else process.env.ADMIN_MFA_WRAP_KEY = prev;
    }
  };
  test('wrap hides plaintext and unwrap restores it', () => withKey(() => {
    const secret = totp.generateSecret();
    const wrapped = tc.wrapSecret(secret);
    expect(wrapped).not.toContain(secret);
    expect(tc.unwrapSecret(wrapped)).toBe(secret);
  }));
  test('tampering with ciphertext is detected (GCM auth tag)', () => withKey(() => {
    const wrapped = tc.wrapSecret(totp.generateSecret());
    const env = JSON.parse(wrapped);
    env.ct = env.ct.slice(0, -2) + (env.ct.endsWith('AA') ? 'BB' : 'AA');
    expect(() => tc.unwrapSecret(JSON.stringify(env))).toThrow();
  }));
  test('isConfigured reflects presence of the wrapping key', () => {
    const prev = process.env.ADMIN_MFA_WRAP_KEY;
    delete process.env.ADMIN_MFA_WRAP_KEY;
    expect(tc.isConfigured()).toBe(false);
    process.env.ADMIN_MFA_WRAP_KEY = KEY;
    expect(tc.isConfigured()).toBe(true);
    if (prev === undefined) delete process.env.ADMIN_MFA_WRAP_KEY;
    else process.env.ADMIN_MFA_WRAP_KEY = prev;
  });
});

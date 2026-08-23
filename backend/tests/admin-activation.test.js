/**
 * Admin secure activation tests (Node E4J-RC1 item 2).
 *
 * Covers the pure activation-token helper (single-use, time-limited, hashed,
 * fail-closed, timing-safe) and the bootstrap script's env-gating. NO database
 * is touched and NO admin is created — the --confirm write path is intentionally
 * NOT exercised (irreversible; deferred to Majd).
 */
const { execFileSync } = require('child_process');
const path = require('path');
const {
  generateActivationToken,
  hashToken,
  verifyActivation,
  emailFingerprint,
  DEFAULT_TTL_MINUTES,
} = require('../src/lib/admin-activation');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'bootstrap-admin.js');

function runScript(env, args = []) {
  try {
    const stdout = execFileSync('node', [SCRIPT, ...args], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

describe('admin-activation helper', () => {
  test('generateActivationToken: high-entropy token, stores only hash + future expiry', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token, tokenHash, expiresAt } = generateActivationToken(now);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThanOrEqual(40); // 32 random bytes base64url
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toHaveLength(64); // sha256 hex
    expect(tokenHash).not.toContain(token); // hash never contains the raw token
    expect(expiresAt.getTime()).toBe(now.getTime() + DEFAULT_TTL_MINUTES * 60 * 1000);
  });

  test('two tokens are distinct', () => {
    const a = generateActivationToken().token;
    const b = generateActivationToken().token;
    expect(a).not.toBe(b);
  });

  test('verifyActivation: valid token within window', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token, tokenHash, expiresAt } = generateActivationToken(now);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: null };
    expect(verifyActivation(row, token, now)).toEqual({ valid: true, reason: 'ok' });
  });

  test('fail-closed: expired', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token, tokenHash, expiresAt } = generateActivationToken(now);
    const later = new Date(expiresAt.getTime() + 1000);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: null };
    expect(verifyActivation(row, token, later)).toEqual({ valid: false, reason: 'expired' });
  });

  test('fail-closed: already used (single-use)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token, tokenHash, expiresAt } = generateActivationToken(now);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: now, revoked_at: null };
    expect(verifyActivation(row, token, now)).toEqual({ valid: false, reason: 'already_used' });
  });

  test('fail-closed: revoked', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { token, tokenHash, expiresAt } = generateActivationToken(now);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: now };
    expect(verifyActivation(row, token, now)).toEqual({ valid: false, reason: 'revoked' });
  });

  test('fail-closed: wrong token', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const { tokenHash, expiresAt } = generateActivationToken(now);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: null };
    expect(verifyActivation(row, 'not-the-token', now)).toEqual({ valid: false, reason: 'mismatch' });
  });

  test('fail-closed: no row / no token', () => {
    expect(verifyActivation(null, 'x').valid).toBe(false);
    const now = new Date();
    const { tokenHash, expiresAt } = generateActivationToken(now);
    const row = { token_hash: tokenHash, expires_at: expiresAt, used_at: null, revoked_at: null };
    expect(verifyActivation(row, '', now).valid).toBe(false);
  });

  test('emailFingerprint is stable, lowercased, and not the address', () => {
    const fp = emailFingerprint('  OPS@Example.ORG ');
    expect(fp).toBe(emailFingerprint('ops@example.org'));
    expect(fp).toHaveLength(64);
    expect(fp).not.toContain('example');
  });
});

describe('bootstrap-admin.js env-gating (no DB, no admin created)', () => {
  test('missing SOLARIS_ADMIN_EMAIL -> ADMIN_EMAIL_REQUIRED, exit 2', () => {
    const r = runScript({ SOLARIS_ADMIN_EMAIL: '' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('ADMIN_EMAIL_REQUIRED');
  });

  test('invalid email -> ADMIN_EMAIL_INVALID, exit 2', () => {
    const r = runScript({ SOLARIS_ADMIN_EMAIL: 'not-an-email' });
    expect(r.code).toBe(2);
    expect(r.out).toContain('ADMIN_EMAIL_INVALID');
  });

  test('script never prints a raw token or password keyword on the gated paths', () => {
    const r = runScript({ SOLARIS_ADMIN_EMAIL: '' });
    expect(r.out.toLowerCase()).not.toMatch(/password=|token=[A-Za-z0-9_-]{20,}/);
  });
});

/**
 * Spark device-vault unit tests (correction §1 account scoping + §2 vault v2).
 *
 * Verifies the CLIENT-ONLY, account-scoped, versioned AES-GCM vault WITHOUT any
 * real wallet:
 *   - save → load round-trips the recovery phrase under the correct passphrase,
 *     scoped to a Solaris user.id;
 *   - two users hold SEPARATE vaults; one account can neither unlock, overwrite,
 *     nor delete another account's vault;
 *   - a wrong passphrase FAILS with a GENERIC error (never returns junk / never
 *     reveals partial correctness);
 *   - v2 envelopes use PBKDF2 600,000 iterations and reject passphrases < 12 chars;
 *   - the persisted envelope contains NO plaintext mnemonic/passphrase/key — only
 *     ciphertext + public KDF params (versioned);
 *   - LEGACY (global v1) migration: a successful migration re-encrypts as v2 and
 *     removes the legacy entry ONLY after read-back; a FAILED migration (wrong
 *     passphrase) leaves the legacy ciphertext intact and writes no v2 entry.
 *
 * jsdom has Web Crypto but no IndexedDB, so a tiny in-memory IndexedDB shim
 * (matching only the surface vault.js uses) is installed for these tests.
 * No production code and no dependencies are added.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

/* --------- minimal in-memory IndexedDB shim (test-only) --------- */
function installMemoryIndexedDB() {
  const stores = new Map(); // storeName -> Map(key->value)
  const db = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n) => { if (!stores.has(n)) stores.set(n, new Map()); return {}; },
    transaction: (name) => ({
      objectStore: () => {
        const map = stores.get(name) || (stores.set(name, new Map()), stores.get(name));
        return {
          get: (k) => { const r = {}; r.result = map.get(k) || null; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; },
          put: (v, k) => { const r = {}; map.set(k, v); queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; },
          delete: (k) => { const r = {}; map.delete(k); queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; },
        };
      },
    }),
    close: () => {},
  };
  globalThis.indexedDB = {
    open: () => {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded();
        if (typeof req.onsuccess === 'function') req.onsuccess();
      });
      return req;
    },
    __reset: () => stores.clear(),
  };
}

/* Raw read/write of the persisted store through the shim (no decryption). */
function rawGet(key) {
  return new Promise((resolve) => {
    const req = globalThis.indexedDB.open('solaris-spark-vault', 1);
    req.onsuccess = () => {
      const r = req.result.transaction('vault').objectStore().get(key);
      r.onsuccess = () => resolve(r.result);
    };
  });
}
function rawPut(key, value) {
  return new Promise((resolve) => {
    const req = globalThis.indexedDB.open('solaris-spark-vault', 1);
    req.onsuccess = () => {
      const r = req.result.transaction('vault').objectStore().put(value, key);
      r.onsuccess = () => resolve(true);
    };
  });
}

/* base64 of an ArrayBuffer/Uint8Array (mirrors vault.js internal helper). */
function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* Seed a LEGACY global v1 envelope (210k PBKDF2) under 'spark-mnemonic-v1'. */
async function makeV1Envelope(phrase, passphrase) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(phrase));
  return {
    v: 1, alg: 'AES-GCM', kdf: 'PBKDF2', hash: 'SHA-256', iterations: 210000,
    salt: ab2b64(salt.buffer), iv: ab2b64(iv.buffer), ct: ab2b64(ct),
  };
}

let vault;
beforeAll(async () => {
  installMemoryIndexedDB();
  vault = await import('../lib/spark/vault.js');
});
beforeEach(() => { globalThis.indexedDB.__reset(); });

const PHRASE = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
const PHRASE_B = 'lima kilo juliet india hotel golf foxtrot echo delta charlie bravo alpha';
const USER_A = 'user-aaaaaaaa-1111';
const USER_B = 'user-bbbbbbbb-2222';
const PASS_A = 'correct horse battery';   // >= 12 chars
const PASS_B = 'another strong pass phrase';

describe('spark vault — crypto + account-scoped persistence', () => {
  it('reports crypto availability and exposes the exact status text + min length', () => {
    expect(vault.vaultCryptoAvailable()).toBe(true);
    expect(vault.VAULT_STATUS_TEXT).toBe(
      'Encrypted on this device. Restore on another device with your recovery words.',
    );
    expect(vault.VAULT_MIN_PASSPHRASE).toBe(12);
  });

  it('round-trips the phrase under the correct passphrase, scoped to a user.id', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    expect(await vault.hasVault(USER_A)).toBe(true);
    expect(await vault.loadVaultMnemonic(USER_A, PASS_A)).toBe(PHRASE);
  });

  it('has NO vault without a signed-in user.id', async () => {
    expect(await vault.hasVault(null)).toBe(false);
    expect(await vault.hasVault(undefined)).toBe(false);
    expect(await vault.hasVault('')).toBe(false);
    await expect(vault.saveVaultMnemonic(null, PHRASE, PASS_A)).rejects.toThrow(/signed-in/i);
  });

  it('rejects a wrong passphrase with a GENERIC error (never returns plaintext)', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    await expect(vault.loadVaultMnemonic(USER_A, 'wrong passphrase!!')).rejects.toThrow(/did not unlock/i);
  });

  it('requires a passphrase of at least 12 characters', async () => {
    await expect(vault.saveVaultMnemonic(USER_A, PHRASE, 'short')).rejects.toThrow(/12 characters/i);
    await expect(vault.saveVaultMnemonic(USER_A, PHRASE, 'eleven chars')).resolves.toBeTruthy(); // 12 exactly
  });

  it('writes a v2 envelope with PBKDF2 600,000 iterations and >=16-byte salt / 12-byte IV', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    const env = await rawGet(vault.vaultKeyForUser(USER_A));
    expect(env.v).toBe(2);
    expect(env.alg).toBe('AES-GCM');
    expect(env.kdf).toBe('PBKDF2');
    expect(env.hash).toBe('SHA-256');
    expect(env.iterations).toBe(600000);
    expect(atob(env.salt).length).toBeGreaterThanOrEqual(16);
    expect(atob(env.iv).length).toBe(12);
  });

  it('persists NO plaintext mnemonic/passphrase/key — only ciphertext + public KDF params', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    const stored = await rawGet(vault.vaultKeyForUser(USER_A));
    const raw = JSON.stringify(stored);
    expect(stored).toBeTruthy();
    expect(typeof stored.ct).toBe('string');
    expect(raw).not.toContain('alpha');
    expect(raw).not.toContain('lima');
    expect(raw).not.toContain('correct horse');
  });

  it('clearVault removes ONLY that account vault (explicit action)', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    expect(await vault.hasVault(USER_A)).toBe(true);
    await vault.clearVault(USER_A);
    expect(await vault.hasVault(USER_A)).toBe(false);
  });
});

describe('spark vault — account isolation (correction §1)', () => {
  it('keeps two users in SEPARATE vaults', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    await vault.saveVaultMnemonic(USER_B, PHRASE_B, PASS_B);
    expect(await vault.hasVault(USER_A)).toBe(true);
    expect(await vault.hasVault(USER_B)).toBe(true);
    expect(vault.vaultKeyForUser(USER_A)).not.toBe(vault.vaultKeyForUser(USER_B));
    expect(await vault.loadVaultMnemonic(USER_A, PASS_A)).toBe(PHRASE);
    expect(await vault.loadVaultMnemonic(USER_B, PASS_B)).toBe(PHRASE_B);
  });

  it('one account cannot unlock another account vault with its own passphrase', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    // B has no vault of its own → loading B is a missing-vault error, never A's phrase.
    await expect(vault.loadVaultMnemonic(USER_B, PASS_A)).rejects.toThrow();
    expect(await vault.hasVault(USER_B)).toBe(false);
  });

  it('saving for one account never overwrites or deletes another account vault', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE, PASS_A);
    await vault.saveVaultMnemonic(USER_B, PHRASE_B, PASS_B);
    // Re-save B; A must be untouched.
    await vault.saveVaultMnemonic(USER_B, PHRASE_B, 'yet another passphrase');
    expect(await vault.loadVaultMnemonic(USER_A, PASS_A)).toBe(PHRASE);
    await vault.clearVault(USER_B);
    expect(await vault.hasVault(USER_A)).toBe(true);
    expect(await vault.hasVault(USER_B)).toBe(false);
  });
});

describe('spark vault — legacy (v1) migration (correction §1)', () => {
  it('detects a legacy vault only until it is migrated', async () => {
    await rawPut('spark-mnemonic-v1', await makeV1Envelope(PHRASE, PASS_A));
    expect(await vault.hasLegacyVault()).toBe(true);
    expect(await vault.hasVault(USER_A)).toBe(false);
  });

  it('SUCCESS: migrates legacy → account-scoped v2, then removes the legacy entry', async () => {
    await rawPut('spark-mnemonic-v1', await makeV1Envelope(PHRASE, PASS_A));
    await vault.migrateLegacyVault(USER_A, PASS_A);
    // v2 present under the scoped key, decrypts to the same phrase.
    const env = await rawGet(vault.vaultKeyForUser(USER_A));
    expect(env.v).toBe(2);
    expect(env.iterations).toBe(600000);
    expect(await vault.loadVaultMnemonic(USER_A, PASS_A)).toBe(PHRASE);
    // legacy is gone ONLY after success.
    expect(await vault.hasLegacyVault()).toBe(false);
    expect(await rawGet('spark-mnemonic-v1')).toBeNull();
  });

  it('FAILURE (wrong passphrase): preserves the legacy ciphertext and writes NO v2', async () => {
    const legacy = await makeV1Envelope(PHRASE, PASS_A);
    await rawPut('spark-mnemonic-v1', legacy);
    await expect(vault.migrateLegacyVault(USER_A, 'wrong passphrase!!')).rejects.toThrow(/did not unlock/i);
    // legacy untouched, no scoped v2 written.
    expect(await vault.hasLegacyVault()).toBe(true);
    const stillThere = await rawGet('spark-mnemonic-v1');
    expect(stillThere.ct).toBe(legacy.ct);
    expect(await rawGet(vault.vaultKeyForUser(USER_A))).toBeNull();
    expect(await vault.hasVault(USER_A)).toBe(false);
  });

  it('refuses to migrate when the account already has a wallet (never overwrite)', async () => {
    await vault.saveVaultMnemonic(USER_A, PHRASE_B, PASS_B);
    await rawPut('spark-mnemonic-v1', await makeV1Envelope(PHRASE, PASS_A));
    await expect(vault.migrateLegacyVault(USER_A, PASS_A)).rejects.toThrow(/already has a wallet/i);
    // existing account vault unchanged; legacy still present.
    expect(await vault.loadVaultMnemonic(USER_A, PASS_B)).toBe(PHRASE_B);
    expect(await vault.hasLegacyVault()).toBe(true);
  });
});

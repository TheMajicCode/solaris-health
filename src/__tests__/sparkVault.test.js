/**
 * Spark device-vault unit tests (spec §2 "Encrypted same-device vault").
 *
 * Verifies the client-only, versioned AES-GCM vault WITHOUT any real wallet:
 *   - save → load round-trips the recovery phrase under the correct passphrase;
 *   - a wrong passphrase FAILS to decrypt (GCM auth failure), never returns junk;
 *   - the persisted envelope contains NO plaintext mnemonic/passphrase/key —
 *     only ciphertext + public KDF params (versioned);
 *   - hasVault()/clearVault() reflect presence; clearVault is explicit-only.
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

let vault;
beforeAll(async () => {
  installMemoryIndexedDB();
  vault = await import('../lib/spark/vault.js');
});
beforeEach(() => { globalThis.indexedDB.__reset(); });

const PHRASE = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';

describe('spark vault — crypto + persistence', () => {
  it('reports crypto availability and exposes the exact status text', () => {
    expect(vault.vaultCryptoAvailable()).toBe(true);
    expect(vault.VAULT_STATUS_TEXT).toBe(
      'Encrypted on this device. Restore on another device with your recovery words.',
    );
  });

  it('round-trips the phrase under the correct passphrase', async () => {
    await vault.saveVaultMnemonic(PHRASE, 'correct horse');
    expect(await vault.hasVault()).toBe(true);
    expect(await vault.loadVaultMnemonic('correct horse')).toBe(PHRASE);
  });

  it('rejects a wrong passphrase (never returns plaintext)', async () => {
    await vault.saveVaultMnemonic(PHRASE, 'correct horse');
    await expect(vault.loadVaultMnemonic('wrong passphrase')).rejects.toThrow(/did not unlock/i);
  });

  it('requires a passphrase of at least 8 characters', async () => {
    await expect(vault.saveVaultMnemonic(PHRASE, 'short')).rejects.toThrow(/8 characters/i);
  });

  it('persists NO plaintext mnemonic/passphrase/key — only ciphertext + public KDF params', async () => {
    await vault.saveVaultMnemonic(PHRASE, 'correct horse');
    // Read the raw persisted envelope back through the shim (no decryption).
    const stored = await new Promise((resolve) => {
      const req = globalThis.indexedDB.open('solaris-spark-vault', 1);
      req.onsuccess = () => {
        const r = req.result.transaction('vault').objectStore().get('spark-mnemonic-v1');
        r.onsuccess = () => resolve(r.result);
      };
    });
    const raw = JSON.stringify(stored);
    expect(stored).toBeTruthy();
    expect(stored.v).toBe(1);
    expect(stored.alg).toBe('AES-GCM');
    expect(stored.kdf).toBe('PBKDF2');
    expect(typeof stored.ct).toBe('string');
    // No plaintext anywhere in the envelope.
    expect(raw).not.toContain('alpha');
    expect(raw).not.toContain('lima');
    expect(raw).not.toContain('correct horse');
  });

  it('clearVault removes the vault (explicit action)', async () => {
    await vault.saveVaultMnemonic(PHRASE, 'correct horse');
    expect(await vault.hasVault()).toBe(true);
    await vault.clearVault();
    expect(await vault.hasVault()).toBe(false);
  });
});

/**
 * spark/vault.js — minimal, versioned, SAME-DEVICE encrypted vault for the Spark
 * wallet recovery phrase (spec §2 "Encrypted same-device vault").
 *
 * Threat model & hard rules:
 *   - The recovery phrase is encrypted client-side with AES-256-GCM. The key is
 *     DERIVED (PBKDF2-SHA256) from a user-entered wallet UNLOCK PASSPHRASE and a
 *     random per-vault salt. The key is NEVER stored anywhere.
 *   - Only the ciphertext + the public KDF parameters (salt, iv, iterations,
 *     algorithm, version) are persisted, in IndexedDB. There is NO plaintext
 *     mnemonic/passphrase/key in IndexedDB / localStorage / sessionStorage /
 *     cookies / service-worker caches.
 *   - Same-device only: without the passphrase the ciphertext is inert. To move
 *     to another device the user restores from their recovery words.
 *   - Logout must clear plaintext secrets from memory but MUST NOT delete this
 *     vault (see provider). clearVault() is an explicit, user-driven action only.
 */

const DB_NAME = 'solaris-spark-vault';
const DB_VERSION = 1;
const STORE = 'vault';
const KEY = 'spark-mnemonic-v1';
const ENVELOPE_VERSION = 1;
const PBKDF2_ITERATIONS = 210000;

const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function vaultCryptoAvailable() {
  return !!subtle && typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    && typeof indexedDB !== 'undefined';
}

/* ----------------------------- base64 helpers ----------------------------- */
function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b642ab(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes; // a Uint8Array BufferSource — accepted by Web Crypto everywhere
}

/* ----------------------------- IndexedDB access ----------------------------- */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
}

function idbGet(key) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(key);
    r.onsuccess = () => { resolve(r.result || null); db.close(); };
    r.onerror = () => { reject(r.error); db.close(); };
  }));
}

function idbPut(key, value) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const r = tx.objectStore(STORE).put(value, key);
    r.onsuccess = () => { resolve(true); db.close(); };
    r.onerror = () => { reject(r.error); db.close(); };
  }));
}

function idbDelete(key) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const r = tx.objectStore(STORE).delete(key);
    r.onsuccess = () => { resolve(true); db.close(); };
    r.onerror = () => { reject(r.error); db.close(); };
  }));
}

/* ----------------------------- key derivation ----------------------------- */
async function deriveKey(passphrase, saltBytes, iterations) {
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ----------------------------- public API ----------------------------- */

/** True if an encrypted vault exists on this device. */
export async function hasVault() {
  if (!vaultCryptoAvailable()) return false;
  try { return !!(await idbGet(KEY)); } catch { return false; }
}

/**
 * Encrypt `mnemonic` under a key derived from `passphrase` and persist ONLY the
 * ciphertext + public KDF params. Returns nothing sensitive.
 */
export async function saveVaultMnemonic(mnemonic, passphrase) {
  if (!vaultCryptoAvailable()) throw new Error('Secure storage is not available in this browser.');
  if (!mnemonic || typeof mnemonic !== 'string') throw new Error('Nothing to encrypt.');
  if (!passphrase || passphrase.length < 8) throw new Error('Use an unlock passphrase of at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic));
  const envelope = {
    v: ENVELOPE_VERSION,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: ab2b64(salt.buffer),
    iv: ab2b64(iv.buffer),
    ct: ab2b64(ct),
  };
  await idbPut(KEY, envelope);
  return true;
}

/**
 * Decrypt the vault with `passphrase`. Throws on a wrong passphrase (GCM auth
 * failure) or a missing/corrupt vault. Returns the recovery phrase string —
 * the caller must keep it in memory only and never persist/log it.
 */
export async function loadVaultMnemonic(passphrase) {
  if (!vaultCryptoAvailable()) throw new Error('Secure storage is not available in this browser.');
  const envelope = await idbGet(KEY);
  if (!envelope) throw new Error('No encrypted wallet is stored on this device.');
  if (envelope.v !== ENVELOPE_VERSION || envelope.alg !== 'AES-GCM' || envelope.kdf !== 'PBKDF2') {
    throw new Error('This device vault is in an unsupported format.');
  }
  const salt = new Uint8Array(b642ab(envelope.salt));
  const iv = new Uint8Array(b642ab(envelope.iv));
  const key = await deriveKey(passphrase, salt, envelope.iterations || PBKDF2_ITERATIONS);
  let pt;
  try {
    pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, b642ab(envelope.ct));
  } catch {
    throw new Error('That passphrase did not unlock this wallet.');
  }
  return dec.decode(pt);
}

/**
 * Delete the encrypted vault. EXPLICIT, user-driven only — NEVER called on
 * logout (logout only clears in-memory secrets).
 */
export async function clearVault() {
  if (!vaultCryptoAvailable()) return false;
  try { return await idbDelete(KEY); } catch { return false; }
}

export const VAULT_STATUS_TEXT = 'Encrypted on this device. Restore on another device with your recovery words.';

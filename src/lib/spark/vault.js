/**
 * spark/vault.js — ACCOUNT-SCOPED, versioned, SAME-DEVICE encrypted vault for the
 * Spark wallet recovery phrase (correction §1/§2).
 *
 * Threat model & hard rules:
 *   - The recovery phrase is encrypted client-side with AES-256-GCM. The key is
 *     DERIVED (PBKDF2-HMAC-SHA256, 600,000 iterations) from a user-entered wallet
 *     UNLOCK PASSPHRASE and a random per-vault salt. The key is NEVER stored.
 *   - Only the ciphertext + the public KDF parameters (salt, iv, iterations,
 *     algorithm, hash, version) are persisted, in IndexedDB. There is NO plaintext
 *     mnemonic/passphrase/derived-key anywhere.
 *   - ACCOUNT SCOPING: every save/load/hasVault/clear/migration op is namespaced
 *     to the authenticated Solaris `user.id` (never email/name/npub). One browser
 *     can hold many accounts' vaults side by side; account A can never see,
 *     unlock, overwrite, or delete account B's vault.
 *   - Same-device only: without the passphrase the ciphertext is inert. To move
 *     to another device the user restores from their recovery words.
 *   - Logout must clear plaintext secrets from memory but MUST NOT delete a vault
 *     (see provider). clearVault() is an explicit, user-driven action only.
 *   - LEGACY: the old GLOBAL v1 key is preserved untouched as legacy data. It is
 *     NEVER auto-attached to whichever account logs in first. It is only ever
 *     moved into an account via the explicit one-time migrateLegacyVault() flow,
 *     which re-encrypts it as v2 and deletes the legacy entry ONLY after a
 *     successful read-back verification.
 */

const DB_NAME = 'solaris-spark-vault';
const DB_VERSION = 1;
const STORE = 'vault';

// Legacy GLOBAL key (envelope v1). Preserved for the explicit migration flow only.
const LEGACY_KEY = 'spark-mnemonic-v1';
// Account-scoped key prefix (envelope v2). Actual key = PREFIX + user.id.
const KEY_PREFIX_V2 = 'spark-vault-v2::';

const ENVELOPE_VERSION = 2;
const PBKDF2_ITERATIONS = 600000;   // v2 strengthened KDF
const LEGACY_ITERATIONS = 210000;   // v1 fallback for decryption during migration
const SALT_BYTES = 16;              // >= 16-byte random salt
const IV_BYTES = 12;                // unique 12-byte GCM IV per encryption
const MIN_PASSPHRASE = 12;          // minimum unlock passphrase length (v2)

const GENERIC_UNLOCK_ERROR = 'That passphrase did not unlock this wallet.';

const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function vaultCryptoAvailable() {
  return !!subtle && typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
    && typeof indexedDB !== 'undefined';
}

/** Build the account-scoped IndexedDB key. Requires a signed-in user.id. */
export function vaultKeyForUser(userId) {
  assertUserId(userId);
  return KEY_PREFIX_V2 + String(userId);
}

function assertUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('A signed-in Solaris account is required for the wallet vault.');
  }
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
async function deriveKey(passphrase, saltBytes, iterations, hash) {
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: hash || 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a phrase into a fresh v2 envelope (random salt + IV, 600k PBKDF2). */
async function encryptToEnvelopeV2(mnemonic, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS, 'SHA-256');
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic));
  return {
    v: ENVELOPE_VERSION,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: PBKDF2_ITERATIONS,
    salt: ab2b64(salt.buffer),
    iv: ab2b64(iv.buffer),
    ct: ab2b64(ct),
  };
}

/**
 * Decrypt any supported envelope (v1 OR v2) with `passphrase`, reading the KDF
 * parameters from the envelope itself. Throws on a wrong passphrase (GCM auth
 * failure) or an unsupported/corrupt envelope. Returns the recovery phrase.
 */
async function decryptEnvelope(envelope, passphrase) {
  if (!envelope || envelope.alg !== 'AES-GCM' || envelope.kdf !== 'PBKDF2') {
    throw new Error('This device vault is in an unsupported format.');
  }
  const salt = b642ab(envelope.salt);
  const iv = b642ab(envelope.iv);
  const iterations = envelope.iterations || LEGACY_ITERATIONS;
  const hash = envelope.hash || 'SHA-256';
  const key = await deriveKey(passphrase, salt, iterations, hash);
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, b642ab(envelope.ct));
  return dec.decode(pt);
}

/* ----------------------------- public API (account-scoped) ----------------------------- */

/** True if an encrypted vault exists on this device FOR THIS ACCOUNT. */
export async function hasVault(userId) {
  if (!vaultCryptoAvailable()) return false;
  if (!userId || typeof userId !== 'string') return false;
  try { return !!(await idbGet(vaultKeyForUser(userId))); } catch { return false; }
}

/**
 * Encrypt `mnemonic` for `userId` under a key derived from `passphrase` and
 * persist ONLY the ciphertext + public KDF params (v2). Account-scoped: never
 * touches another account's vault. Returns nothing sensitive.
 */
export async function saveVaultMnemonic(userId, mnemonic, passphrase) {
  assertUserId(userId);
  if (!vaultCryptoAvailable()) throw new Error('Secure storage is not available in this browser.');
  if (!mnemonic || typeof mnemonic !== 'string') throw new Error('Nothing to encrypt.');
  if (!passphrase || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`Use an unlock passphrase of at least ${MIN_PASSPHRASE} characters.`);
  }
  const envelope = await encryptToEnvelopeV2(mnemonic, passphrase);
  await idbPut(vaultKeyForUser(userId), envelope);
  return true;
}

/**
 * Decrypt THIS ACCOUNT's vault with `passphrase`. Throws a GENERIC error on a
 * wrong passphrase (never reveals whether any part was correct) or a
 * missing/unsupported vault. Returns the recovery phrase — the caller must keep
 * it in memory only and never persist/log it. v2 envelopes only.
 */
export async function loadVaultMnemonic(userId, passphrase) {
  assertUserId(userId);
  if (!vaultCryptoAvailable()) throw new Error('Secure storage is not available in this browser.');
  const envelope = await idbGet(vaultKeyForUser(userId));
  if (!envelope) throw new Error('No encrypted wallet is stored on this device for this account.');
  if (envelope.v !== ENVELOPE_VERSION) throw new Error('This device vault is in an unsupported format.');
  try {
    return await decryptEnvelope(envelope, passphrase);
  } catch {
    throw new Error(GENERIC_UNLOCK_ERROR);
  }
}

/**
 * Delete THIS ACCOUNT's encrypted vault. EXPLICIT, user-driven only — NEVER
 * called on logout (logout only clears in-memory secrets).
 */
export async function clearVault(userId) {
  if (!vaultCryptoAvailable()) return false;
  if (!userId || typeof userId !== 'string') return false;
  try { return await idbDelete(vaultKeyForUser(userId)); } catch { return false; }
}

/* ----------------------------- legacy (v1) migration ----------------------------- */

/** True if a LEGACY global v1 vault exists (not yet moved to any account). */
export async function hasLegacyVault() {
  if (!vaultCryptoAvailable()) return false;
  try {
    const env = await idbGet(LEGACY_KEY);
    return !!env && env.v === 1;
  } catch { return false; }
}

/**
 * One-time explicit migration of the LEGACY global v1 vault into THIS ACCOUNT's
 * account-scoped v2 vault (correction §1). Ordered, all-or-nothing:
 *   1. require the legacy passphrase; refuse if this account already has a vault
 *      (never overwrite a wallet);
 *   2. decrypt the legacy v1 ciphertext (generic error on failure — leaves legacy
 *      UNTOUCHED);
 *   3. re-encrypt into the account-scoped v2 format (600k PBKDF2, fresh salt/IV);
 *   4. read the v2 entry back and verify it decrypts to the same phrase;
 *   5. delete the legacy ciphertext ONLY after every step above succeeds.
 * On any failure after step 2, the partial v2 write is removed and the legacy
 * entry is left intact.
 */
export async function migrateLegacyVault(userId, passphrase) {
  assertUserId(userId);
  if (!vaultCryptoAvailable()) throw new Error('Secure storage is not available in this browser.');
  const legacy = await idbGet(LEGACY_KEY);
  if (!legacy || legacy.v !== 1) throw new Error('There is no legacy wallet to move on this device.');
  // Never overwrite an existing account-scoped wallet.
  if (await idbGet(vaultKeyForUser(userId))) {
    throw new Error('This Solaris account already has a wallet on this device.');
  }

  // 2. Decrypt the legacy vault. A failure leaves the legacy entry untouched.
  let mnemonic;
  try {
    mnemonic = await decryptEnvelope(legacy, passphrase);
  } catch {
    throw new Error(GENERIC_UNLOCK_ERROR);
  }

  const scopedKey = vaultKeyForUser(userId);
  try {
    // 3. Re-encrypt as v2 under the account-scoped key.
    const envelope = await encryptToEnvelopeV2(mnemonic, passphrase);
    await idbPut(scopedKey, envelope);

    // 4. Read back and verify.
    const readBack = await idbGet(scopedKey);
    let verified = '';
    try { verified = await decryptEnvelope(readBack, passphrase); } catch { verified = ''; }
    if (!readBack || readBack.v !== ENVELOPE_VERSION || verified !== mnemonic) {
      try { await idbDelete(scopedKey); } catch { /* best effort */ }
      throw new Error('Could not move this wallet. Your existing wallet is unchanged.');
    }
  } finally {
    mnemonic = '';
  }

  // 5. All steps succeeded — remove the legacy ciphertext.
  await idbDelete(LEGACY_KEY);
  return true;
}

export const VAULT_STATUS_TEXT = 'Encrypted on this device. Restore on another device with your recovery words.';
export const VAULT_MIN_PASSPHRASE = MIN_PASSPHRASE;

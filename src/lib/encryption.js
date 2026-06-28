/**
 * encryption.js — Phase 5 client-side E2E encryption (Web Crypto API)
 *
 * Threat model: the server stores only opaque ciphertext and RSA-wrapped
 * per-message AES keys. It never sees plaintext or private keys.
 *
 * Scheme (hybrid, MVP — not Signal, but real E2E):
 *   • Identity: RSA-OAEP-2048 keypair per user. Public key is uploaded (JWK);
 *     private key never leaves the browser. It is stored in localStorage
 *     wrapped under an AES-GCM key derived (PBKDF2) from a per-user passphrase.
 *   • Per message: a fresh random AES-256-GCM content key + 96-bit IV encrypt
 *     the plaintext (forward secrecy for the content layer — each message has a
 *     unique key). The content key is then wrapped with the recipient's public
 *     key (encKeyRecipient) AND the sender's public key (encKeySender) so both
 *     parties can later decrypt their own copy.
 *   • Files use the same envelope; the blob and filename are encrypted with the
 *     same per-message AES key.
 */

const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;

export function cryptoAvailable() {
  return !!subtle && typeof crypto.getRandomValues === 'function';
}

/* ----------------------------- base64 helpers ----------------------------- */
export function ab2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
export function b642ab(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
const enc = new TextEncoder();
const dec = new TextDecoder();

/* ----------------------------- identity keypair ----------------------------- */
const RSA_PARAMS = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

export async function generateKeyPair() {
  return subtle.generateKey(RSA_PARAMS, true, ['encrypt', 'decrypt']);
}

export async function exportPublicKeyJwk(publicKey) {
  const jwk = await subtle.exportKey('jwk', publicKey);
  return JSON.stringify(jwk);
}

export async function importPublicKey(jwkStr) {
  const jwk = typeof jwkStr === 'string' ? JSON.parse(jwkStr) : jwkStr;
  return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt']);
}
export async function importPrivateKey(jwk) {
  return subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
}

/* ----------------------------- local private-key vault ----------------------------- */
// The private key JWK is wrapped under an AES-GCM key derived from a per-user
// passphrase via PBKDF2. For the MVP the passphrase is deterministic per user
// (keeps the demo zero-friction); a production build would prompt the user.
const STORAGE_PREFIX = 'luca_msg_key_';
const DELETED_PREFIX = 'luca_msg_deleted_';

function passphraseFor(userId) {
  return `${userId}:luca-passport-msg-v1`;
}

async function deriveVaultKey(passphrase, saltB64) {
  const baseKey = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: new Uint8Array(b642ab(saltB64)), iterations: 150000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function wrapPrivateKey(privateKey, userId) {
  const jwk = await subtle.exportKey('jwk', privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const saltB64 = ab2b64(salt.buffer);
  const vaultKey = await deriveVaultKey(passphraseFor(userId), saltB64);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, enc.encode(JSON.stringify(jwk)));
  return { salt: saltB64, iv: ab2b64(iv.buffer), data: ab2b64(ct) };
}

async function unwrapPrivateKey(blob, userId) {
  const vaultKey = await deriveVaultKey(passphraseFor(userId), blob.salt);
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b642ab(blob.iv)) },
    vaultKey,
    b642ab(blob.data)
  );
  const jwk = JSON.parse(dec.decode(pt));
  return importPrivateKey(jwk);
}

/**
 * Load this user's messaging identity from localStorage, or create + persist a
 * fresh one. Returns { privateKey, publicKey, publicJwk, fingerprint, created }.
 * `created` is true when a new key was generated (caller should upload it).
 */
export async function loadOrCreateIdentity(userId) {
  if (!cryptoAvailable()) throw new Error('Web Crypto API not available in this browser');
  const storeKey = STORAGE_PREFIX + userId;
  const raw = localStorage.getItem(storeKey);
  if (raw) {
    try {
      const blob = JSON.parse(raw);
      const privateKey = await unwrapPrivateKey(blob.priv, userId);
      const publicKey = await importPublicKey(blob.pub);
      return { privateKey, publicKey, publicJwk: blob.pub, fingerprint: blob.fingerprint, created: false };
    } catch (e) {
      // corrupt / unreadable vault — regenerate
      console.warn('Messaging key vault unreadable, regenerating', e);
    }
  }
  const pair = await generateKeyPair();
  const publicJwk = await exportPublicKeyJwk(pair.publicKey);
  const priv = await wrapPrivateKey(pair.privateKey, userId);
  const fingerprint = await fingerprintOf(publicJwk);
  localStorage.setItem(storeKey, JSON.stringify({ priv, pub: publicJwk, fingerprint }));
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, publicJwk, fingerprint, created: true };
}

export async function fingerprintOf(jwkStr) {
  const hash = await subtle.digest('SHA-256', enc.encode(jwkStr));
  const bytes = new Uint8Array(hash).slice(0, 8);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ----------------------------- per-message AES ----------------------------- */
async function genContentKey() {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function wrapContentKey(rawKeyBuf, recipientPubKey) {
  const wrapped = await subtle.encrypt({ name: 'RSA-OAEP' }, recipientPubKey, rawKeyBuf);
  return ab2b64(wrapped);
}
async function unwrapContentKey(wrappedB64, privateKey) {
  const rawKey = await subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, b642ab(wrappedB64));
  return subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypt a plaintext string for a recipient. `recipientPubJwk` and
 * `senderPubJwk` are JWK strings (the sender wraps a copy for themselves too).
 * Returns { ciphertext, iv, encKeyRecipient, encKeySender } — all base64.
 */
export async function encryptMessage(plaintext, recipientPubJwk, senderPubJwk) {
  const contentKey = await genContentKey();
  const rawKey = await subtle.exportKey('raw', contentKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, enc.encode(plaintext));

  const recipientPub = await importPublicKey(recipientPubJwk);
  const encKeyRecipient = await wrapContentKey(rawKey, recipientPub);
  let encKeySender = null;
  if (senderPubJwk) {
    const senderPub = await importPublicKey(senderPubJwk);
    encKeySender = await wrapContentKey(rawKey, senderPub);
  }
  return { ciphertext: ab2b64(ct), iv: ab2b64(iv.buffer), encKeyRecipient, encKeySender };
}

/**
 * Decrypt a message envelope with my private key.
 * Accepts { ciphertext|encryptedContent, iv, encKey }.
 */
export async function decryptMessage(envelope, privateKey) {
  const ciphertext = envelope.ciphertext || envelope.encryptedContent;
  if (!ciphertext || !envelope.iv || !envelope.encKey) throw new Error('Incomplete message envelope');
  const contentKey = await unwrapContentKey(envelope.encKey, privateKey);
  const pt = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(b642ab(envelope.iv)) },
    contentKey,
    b642ab(ciphertext)
  );
  return dec.decode(pt);
}

/* ----------------------------- file attachments ----------------------------- */
/**
 * Encrypt a File/Blob + its filename for a recipient (and sender copy).
 * Returns { encryptedBlob, encryptedFilename, iv, encKeyRecipient, encKeySender, size, mimeType }.
 */
export async function encryptFile(file, recipientPubJwk, senderPubJwk) {
  const buf = await file.arrayBuffer();
  const contentKey = await genContentKey();
  const rawKey = await subtle.exportKey('raw', contentKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, buf);
  const ctName = await subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, enc.encode(file.name || 'file'));

  const recipientPub = await importPublicKey(recipientPubJwk);
  const encKeyRecipient = await wrapContentKey(rawKey, recipientPub);
  let encKeySender = null;
  if (senderPubJwk) {
    const senderPub = await importPublicKey(senderPubJwk);
    encKeySender = await wrapContentKey(rawKey, senderPub);
  }
  return {
    encryptedBlob: ab2b64(ct),
    encryptedFilename: ab2b64(ctName),
    iv: ab2b64(iv.buffer),
    encKeyRecipient,
    encKeySender,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Decrypt an attachment payload. Accepts { encryptedBlob, encryptedFilename, iv, encKey }.
 * Returns { blob, filename } where blob is a Blob with the given mimeType.
 */
export async function decryptFile(payload, privateKey, mimeType) {
  const contentKey = await unwrapContentKey(payload.encKey, privateKey);
  const ivArr = new Uint8Array(b642ab(payload.iv));
  const ptBuf = await subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, contentKey, b642ab(payload.encryptedBlob));
  let filename = 'attachment';
  if (payload.encryptedFilename) {
    try {
      const nameBuf = await subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, contentKey, b642ab(payload.encryptedFilename));
      filename = dec.decode(nameBuf);
    } catch { /* keep default */ }
  }
  return { blob: new Blob([ptBuf], { type: mimeType || payload.mimeType || 'application/octet-stream' }), filename };
}

/* ----------------------------- local-only deletion ----------------------------- */
// Messages can be "deleted" locally without touching the server (E2E: server
// blob stays, but the user no longer sees it on this device).
export function getDeletedIds(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(DELETED_PREFIX + userId) || '[]'));
  } catch { return new Set(); }
}
export function deleteLocally(userId, messageId) {
  const set = getDeletedIds(userId);
  set.add(messageId);
  localStorage.setItem(DELETED_PREFIX + userId, JSON.stringify([...set]));
}
export function restoreLocally(userId, messageId) {
  const set = getDeletedIds(userId);
  set.delete(messageId);
  localStorage.setItem(DELETED_PREFIX + userId, JSON.stringify([...set]));
}

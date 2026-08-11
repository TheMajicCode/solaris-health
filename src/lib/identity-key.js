/**
 * identity-key.js — client-side Identity Key (Nostr) crypto (M8; spec A2 §3).
 *
 * SOVEREIGNTY RULE: the secret key is created and used ENTIRELY on the member's
 * device. It is NEVER sent to Solaris and NEVER written to durable storage.
 * A new standalone identity's nsec/skHex live ONLY in an in-memory, module-scoped
 * variable for the lifetime of the tab's JS context (see `rememberKeyForSession`);
 * they are NOT placed in sessionStorage, localStorage, cookies, or any cache. A
 * page refresh intentionally clears the key — the member re-authenticates or
 * restores. Solaris only ever receives the PUBLIC key (npub).
 *
 * TWO INDEPENDENT SECRETS — never combined:
 *   1. The Nostr identity secret (nsec/skHex). For a new Beta V1 identity this is
 *      raw CSPRNG entropy (`createStandaloneIdentity`), NOT a BIP-39 mnemonic.
 *   2. A Spark wallet's BIP-39 recovery words. These are created independently by
 *      the enabled Spark wallet software and are NEVER derived from — nor used to
 *      derive — the Nostr identity secret. The two key systems stay separate.
 *
 * LEGACY ONLY: the 12-word mnemonic path below (`createIdentity` /
 * `deriveFromMnemonic`, NIP-06 m/44'/1237'/0'/0/0) is retained solely for the
 * "Restore legacy 12-word Solaris identity" option. New identities do not use it.
 *
 *   BIP-39 mnemonic ──NIP-06 (m/44'/1237'/0'/0/0)──▶ nsec / npub  (LEGACY identity)
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bech32 } from '@scure/base';

const NIP06_PATH = "m/44'/1237'/0'/0/0"; // Nostr's registered coin type (1237)

const toHex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h) => Uint8Array.from(h.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

/** Generate a fresh 12-word BIP-39 mnemonic (128 bits of entropy). */
export function newMnemonic() {
  return generateMnemonic(wordlist, 128);
}

/** Validate a BIP-39 mnemonic (checksum + wordlist). */
export function isValidMnemonic(m) {
  try { return validateMnemonic((m || '').trim().toLowerCase(), wordlist); } catch { return false; }
}

/** bech32-encode a 32-byte x-only pubkey to npub. */
function encodeNpub(pubBytes) {
  return bech32.encode('npub', bech32.toWords(pubBytes), 1000);
}
/** bech32-encode a 32-byte secret key to nsec. */
function encodeNsec(skBytes) {
  return bech32.encode('nsec', bech32.toWords(skBytes), 1000);
}

/**
 * Derive the Identity Key from a mnemonic via NIP-06.
 * @returns {{ npub, nsec, pubkeyHex, skHex }} — keep nsec/skHex ON DEVICE ONLY.
 */
export function deriveFromMnemonic(mnemonic) {
  const m = (mnemonic || '').trim().toLowerCase();
  if (!validateMnemonic(m, wordlist)) throw new Error('That is not a valid 12-word recovery phrase.');
  const seed = mnemonicToSeedSync(m);
  const child = HDKey.fromMasterSeed(seed).derive(NIP06_PATH);
  const sk = child.privateKey;
  if (!sk) throw new Error('Could not derive a key from that phrase.');
  const pub = schnorr.getPublicKey(sk); // 32-byte x-only
  return {
    npub: encodeNpub(pub),
    nsec: encodeNsec(sk),
    pubkeyHex: toHex(pub),
    skHex: toHex(sk),
  };
}

/** Create a brand-new identity: a fresh mnemonic + its derived keys. */
export function createIdentity() {
  const mnemonic = newMnemonic();
  return { mnemonic, ...deriveFromMnemonic(mnemonic) };
}

/**
 * Create a brand-new STANDALONE identity (Beta V1 §4/§5): a real,
 * client-generated `nsec`/`npub` produced directly from 32 bytes of CSPRNG
 * entropy — NOT derived from a BIP-39 mnemonic. This keeps the new identity
 * key deliberately separate from any wallet mnemonic (the two must never be
 * combined). The 12-word mnemonic path (`createIdentity`/`deriveFromMnemonic`)
 * is retained only as the "Restore legacy 12-word Solaris identity" option.
 *
 * SECRET DISCIPLINE: `nsec`/`skHex` are secrets — keep them in memory only for
 * the session (see `rememberKeyForSession`). Solaris only ever receives `npub`.
 * @returns {{ npub, nsec, pubkeyHex, skHex }}
 */
export function createStandaloneIdentity() {
  const sk = schnorr.utils.randomPrivateKey(); // 32 bytes of secure entropy
  const pub = schnorr.getPublicKey(sk);        // 32-byte x-only public key
  return {
    npub: encodeNpub(pub),
    nsec: encodeNsec(sk),
    pubkeyHex: toHex(pub),
    skHex: toHex(sk),
  };
}

/**
 * Decode an EXISTING nsec (bech32) entered by a returning member and derive its
 * public key — all on-device. Used by the "Use an existing nsec" sign-in path.
 * The nsec/skHex are secrets: keep them in memory only; Solaris receives npub only.
 * @param {string} nsecInput
 * @returns {{ npub, nsec, pubkeyHex, skHex }}
 */
export function identityFromNsec(nsecInput) {
  const raw = String(nsecInput || '').trim();
  let decoded;
  try {
    decoded = bech32.decode(raw, 1000);
  } catch {
    throw new Error('That does not look like a valid nsec key.');
  }
  if (decoded.prefix !== 'nsec') throw new Error('That is not an nsec key. It must start with "nsec1".');
  const sk = bech32.fromWords(decoded.words);
  if (!sk || sk.length !== 32) throw new Error('That nsec key is malformed.');
  const skBytes = Uint8Array.from(sk);
  const pub = schnorr.getPublicKey(skBytes); // 32-byte x-only public key
  return {
    npub: encodeNpub(pub),
    nsec: encodeNsec(skBytes),
    pubkeyHex: toHex(pub),
    skHex: toHex(skBytes),
  };
}

/**
 * Sign a login challenge message with the secret key (BIP-340 Schnorr over the
 * SHA-256 digest of the message) — matches the server's verification.
 * @returns {string} hex signature
 */
export function signChallenge(skHex, message) {
  const digest = sha256(new TextEncoder().encode(String(message)));
  return toHex(schnorr.sign(digest, fromHex(skHex)));
}

/* --------- in-memory-only key custody (Beta V1 §4) ---------
 * SECRET DISCIPLINE: new-identity secrets (nsec/skHex) are held ONLY in a
 * module-scoped in-memory variable for the lifetime of the tab's JS context.
 * They are NEVER written to localStorage, sessionStorage, cookies, logs,
 * analytics, URLs, the server, or the database. A page refresh intentionally
 * clears the key — the member re-authenticates (or restores) as designed. */
let _inMemoryKey = null;
export function rememberKeyForSession({ npub, skHex, pubkeyHex }) {
  _inMemoryKey = { npub, skHex, pubkeyHex };
}
export function getSessionKey() {
  return _inMemoryKey;
}
export function forgetSessionKey() {
  _inMemoryKey = null;
}

/** The exact member-facing explainer copy for the Identity Key (info popover). */
export const IDENTITY_KEY_INFO = {
  title: 'What is an Identity Key?',
  lines: [
    'This is an identity key instead of a traditional account, used to help create your Solaris account. '
      + 'It\u2019s created on your device and represents you whenever you use Solaris.',
    'Your identity belongs to you, not Solaris. There\u2019s no password to reset, and Solaris can\u2019t recover '
      + 'your key if you lose it. Keep a backup somewhere safe. Never share this secret. Anyone who has it can '
      + 'act as you.',
    'If you\u2019re new to Solaris, create a new identity key. If you already have an identity key, use your existing key.',
  ],
};

/**
 * identity-key.js — client-side Identity Key (Nostr) crypto (M8; spec A2 §3).
 *
 * SOVEREIGNTY RULE: the secret key and the BIP-39 mnemonic are created and used
 * ENTIRELY on the member's device. They are NEVER sent to Solaris and NEVER
 * written to durable storage — the nsec lives in `sessionStorage` only (cleared
 * when the tab closes). Solaris only ever receives the PUBLIC key (npub).
 *
 * One seed, two paths (A2 §3.1): the same 12-word mnemonic can later derive a
 * Bitcoin key at BIP-86 — but ONLY when the member opts into a wallet. We do
 * not create a wallet here.
 *
 *   BIP-39 mnemonic ──NIP-06 (m/44'/1237'/0'/0/0)──▶ nsec / npub  (identity)
 */
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bech32 } from '@scure/base';

const NIP06_PATH = "m/44'/1237'/0'/0/0"; // Nostr's registered coin type (1237)
const SS_KEY = 'solaris.identityKey.v1'; // sessionStorage only — never localStorage

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
 * Sign a login challenge message with the secret key (BIP-340 Schnorr over the
 * SHA-256 digest of the message) — matches the server's verification.
 * @returns {string} hex signature
 */
export function signChallenge(skHex, message) {
  const digest = sha256(new TextEncoder().encode(String(message)));
  return toHex(schnorr.sign(digest, fromHex(skHex)));
}

/* --------- session-only key custody (never durable, never sent up) --------- */
export function rememberKeyForSession({ npub, skHex, pubkeyHex }) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ npub, skHex, pubkeyHex }));
  } catch { /* private mode / disabled storage — fine, key just isn't remembered */ }
}
export function getSessionKey() {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function forgetSessionKey() {
  try { sessionStorage.removeItem(SS_KEY); } catch { /* noop */ }
}

/** The exact member-facing explainer copy for the Identity Key (info popover). */
export const IDENTITY_KEY_INFO = {
  title: 'What is an Identity Key?',
  lines: [
    'This is an identity key instead of a traditional account, used to help create your Solaris account. '
      + 'It\u2019s created on your device and represents you whenever you use Solaris.',
    'Your identity belongs to you, not Solaris. There\u2019s no password to reset, and Solaris can\u2019t recover '
      + 'your key if you lose it. Keep a backup somewhere safe and never share it. For best practices, save it '
      + 'with 3\u20135 family or friends. Anyone with your key can act as you or help restore your account.',
    'If you\u2019re new to Solaris, create a new identity key. If you already have an identity key, use your existing key.',
  ],
};

'use strict';
/**
 * nostr.js — server-side Nostr helpers for the Identity Key (M8; spec A2 §3).
 *
 * Solaris NEVER holds a secret key or a mnemonic. The server only ever sees a
 * PUBLIC key (npub), and it VERIFIES signatures the member's device produced.
 * These helpers cover the two things the server must do:
 *
 *   1. decode/encode between bech32 `npub1...` and the 32-byte x-only hex
 *      pubkey that NIP-05 (`.well-known/nostr.json`) and BIP-340 need;
 *   2. verify a BIP-340 Schnorr signature over a login challenge, proving the
 *      member controls the private key WITHOUT the key ever leaving the device.
 */
const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { bech32 } = require('@scure/base');

const HEX64 = /^[0-9a-f]{64}$/i;

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}
function hexToBytes(hex) {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

/** Decode a bech32 `npub1...` to a 32-byte x-only pubkey hex. Throws on bad input. */
function npubToHex(npub) {
  if (typeof npub !== 'string' || !npub.startsWith('npub1')) {
    throw new Error('Not an npub');
  }
  const { prefix, words } = bech32.decode(npub, 1000);
  if (prefix !== 'npub') throw new Error('Wrong bech32 prefix');
  const data = bech32.fromWords(words);
  if (data.length !== 32) throw new Error('npub must decode to 32 bytes');
  return bytesToHex(data);
}

/** Encode a 32-byte x-only pubkey hex to a bech32 `npub1...`. */
function hexToNpub(hex) {
  if (!HEX64.test(hex)) throw new Error('pubkey must be 32-byte hex');
  const words = bech32.toWords(hexToBytes(hex.toLowerCase()));
  return bech32.encode('npub', words, 1000);
}

/** True if the string is a valid npub (decodes to 32 bytes). */
function isValidNpub(npub) {
  try { npubToHex(npub); return true; } catch { return false; }
}

/**
 * Verify a BIP-340 Schnorr signature (hex) over `message` (a UTF-8 string)
 * by the given x-only pubkey (npub or hex). The message is hashed with SHA-256
 * to a 32-byte digest first — the same digest the client signs.
 * @returns {boolean}
 */
function verifyChallengeSignature({ pubkey, message, sigHex }) {
  try {
    const pubHex = pubkey.startsWith('npub1') ? npubToHex(pubkey) : pubkey.toLowerCase();
    if (!HEX64.test(pubHex)) return false;
    if (typeof sigHex !== 'string' || !/^[0-9a-f]{128}$/i.test(sigHex)) return false;
    const digest = sha256(new TextEncoder().encode(String(message)));
    return schnorr.verify(sigHex, digest, pubHex);
  } catch {
    return false;
  }
}

/** The digest a client must sign for a challenge — exported so the client/tests match. */
function challengeDigestHex(message) {
  return bytesToHex(sha256(new TextEncoder().encode(String(message))));
}

module.exports = {
  npubToHex, hexToNpub, isValidNpub, verifyChallengeSignature, challengeDigestHex,
};

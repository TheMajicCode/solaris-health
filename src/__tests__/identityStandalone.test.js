/**
 * createStandaloneIdentity() — the real, client-generated nsec/npub used by the
 * new Beta V1 identity path (spec §4/§5). These assertions check SHAPE and
 * round-trip signing only; they create ephemeral keys that are never persisted,
 * printed, or reused (each run generates fresh entropy).
 */
import { describe, it, expect } from 'vitest';
import { createStandaloneIdentity, signChallenge } from '../lib/identity-key.js';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const hexToBytes = (h) => Uint8Array.from(h.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

describe('createStandaloneIdentity', () => {
  it('produces a well-formed npub/nsec key pair with no mnemonic', () => {
    const id = createStandaloneIdentity();
    expect(id.npub.startsWith('npub1')).toBe(true);
    expect(id.nsec.startsWith('nsec1')).toBe(true);
    expect(id.pubkeyHex).toMatch(/^[0-9a-f]{64}$/);
    expect(id.skHex).toMatch(/^[0-9a-f]{64}$/);
    // It is standalone — no BIP-39 mnemonic is attached.
    expect(id.mnemonic).toBeUndefined();
  });

  it('generates fresh entropy on every call', () => {
    const a = createStandaloneIdentity();
    const b = createStandaloneIdentity();
    expect(a.skHex).not.toBe(b.skHex);
    expect(a.npub).not.toBe(b.npub);
  });

  it('signChallenge yields a signature that verifies against the derived pubkey', () => {
    const id = createStandaloneIdentity();
    const message = 'solaris-login-nonce-fixture';
    const sig = signChallenge(id.skHex, message);
    const digest = sha256(new TextEncoder().encode(message));
    expect(schnorr.verify(hexToBytes(sig), digest, hexToBytes(id.pubkeyHex))).toBe(true);
  });
});

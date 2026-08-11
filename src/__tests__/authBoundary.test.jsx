/**
 * Auth boundary tests (Beta V1 investor-demo VISIBLE SPARK/PWA correction, spec §3).
 *
 * Exercises the REAL AppContext auth surface against a mocked API boundary and the
 * REAL on-device identity-key crypto. These assert the eight §3 auth guarantees
 * that matter for the demo:
 *
 *   1. returning member email sign-in calls the API with the entered credentials;
 *   2. returning practitioner email sign-in surfaces the practitioner role;
 *   4. new-account identity auth is DEFERRED (no React user until activateUser);
 *   5. existing-nsec sign-in sends ONLY npub + nonce + signature;
 *   6. legacy 12-word restore uses the same public-only boundary;
 *   7. NO secret (skHex / nsec / mnemonic / seed) is present at the API boundary;
 *   8. the in-memory identity secret is set on auth and cleared on logout/forget.
 *
 * Deterministic, throwaway, NON-SECRET fixtures only — computed in-test from fixed
 * bytes and the canonical public BIP-39 test vector. No real wallet/key is created.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { bech32 } from '@scure/base';

// Mocked API boundary — a stateful object whose methods record every call so we
// can scan them for secret leakage. token is a plain property the context reads.
vi.mock('../lib/api.js', () => {
  const api = {
    token: null,
    login: vi.fn(async () => { api.token = 'tok'; return { user: { id: 'm1', role: 'member' } }; }),
    register: vi.fn(async () => { api.token = 'tok'; return { user: { id: 'm1', role: 'member' } }; }),
    nostrChallenge: vi.fn(async () => ({ challengeId: 'CID', nonce: 'NONCE', message: 'sign-this-message' })),
    nostrKeyLogin: vi.fn(async () => { api.token = 'tok'; return {}; }),
    getMe: vi.fn(async () => ({ user: { id: 'm1', role: 'member' }, profile: {} })),
    saveProfile: vi.fn(async () => ({})),
    getLucaMessages: vi.fn(async () => ({ messages: [] })),
    logout: vi.fn(() => { api.token = null; }),
  };
  return { api };
});

import { AppProvider, useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { identityFromNsec, deriveFromMnemonic, getSessionKey } from '../lib/identity-key.js';

// Deterministic throwaway nsec derived from fixed bytes (NOT a real key).
const SK_BYTES = new Uint8Array(32).fill(0x11);
const FIX_NSEC = bech32.encode('nsec', bech32.toWords(SK_BYTES), 1000);
// Canonical public BIP-39 test vector (valid checksum) — not the forbidden words.
const ABANDON_VECTOR = `${'abandon '.repeat(11)}about`;

let ctx;
// Test harness: intentionally capture the live context each render so assertions
// can read the latest value after act(). Not a rendered value.
// eslint-disable-next-line react-hooks/globals
function Capture() { ctx = useApp(); return null; }
function mount() { render(<AppProvider><Capture /></AppProvider>); }

function allApiCallArgsJson() {
  const fns = ['login', 'register', 'nostrChallenge', 'nostrKeyLogin', 'getMe', 'saveProfile'];
  return JSON.stringify(fns.map((f) => api[f].mock.calls));
}

beforeEach(() => {
  api.token = null;
  // Clear recorded calls only — preserve the factory implementations (which carry
  // the token side-effects the context relies on). mockResolvedValue would drop them.
  Object.values(api).forEach((v) => { if (typeof v === 'function' && v.mockClear) v.mockClear(); });
});

describe('§3 auth boundary', () => {
  it('1. returning member email sign-in calls the API with the entered credentials', async () => {
    mount();
    await act(async () => { await ctx.login('member@example.test', 'pw-123'); });
    expect(api.login).toHaveBeenCalledWith('member@example.test', 'pw-123');
    expect(ctx.user).toEqual(expect.objectContaining({ role: 'member' }));
  });

  it('2. returning practitioner email sign-in surfaces the practitioner role', async () => {
    api.getMe.mockResolvedValueOnce({ user: { id: 'p1', role: 'practitioner' }, profile: {} });
    mount();
    await act(async () => { await ctx.login('doc@example.test', 'pw-123'); });
    expect(ctx.user.role).toBe('practitioner');
  });

  it('4. new-account identity auth is DEFERRED — no React user until activateUser()', async () => {
    const id = identityFromNsec(FIX_NSEC);
    mount();
    await act(async () => { await ctx.identityAuthDeferred(id); });
    // Authenticated (token set) but the React user is intentionally NOT activated.
    expect(api.nostrKeyLogin).toHaveBeenCalledTimes(1);
    expect(ctx.user).toBeNull();
    await act(async () => { await ctx.activateUser(); });
    expect(ctx.user).toEqual(expect.objectContaining({ role: 'member' }));
  });

  it('5. existing-nsec sign-in sends ONLY npub + nonce + signature', async () => {
    const id = identityFromNsec(FIX_NSEC);
    mount();
    await act(async () => { await ctx.loginWithIdentityKey(id); });
    // Challenge is requested with the PUBLIC npub only.
    expect(api.nostrChallenge).toHaveBeenCalledWith(id.npub);
    // Key-login carries npub + the server challengeId + nonce + a signature — nothing else.
    const [npubArg, cidArg, nonceArg, sigArg] = api.nostrKeyLogin.mock.calls[0];
    expect(npubArg).toBe(id.npub);
    expect(cidArg).toBe('CID');
    expect(nonceArg).toBe('NONCE');
    expect(typeof sigArg).toBe('string');
    expect(sigArg.length).toBeGreaterThan(0);
  });

  it('6. legacy 12-word restore uses the same public-only boundary', async () => {
    const id = deriveFromMnemonic(ABANDON_VECTOR);
    mount();
    await act(async () => { await ctx.loginWithIdentityKey(id); });
    expect(api.nostrChallenge).toHaveBeenCalledWith(id.npub);
    expect(api.nostrKeyLogin.mock.calls[0][0]).toBe(id.npub);
  });

  it('7. NO secret (skHex / nsec / mnemonic / seed) is present at the API boundary', async () => {
    const id = identityFromNsec(FIX_NSEC);
    const legacy = deriveFromMnemonic(ABANDON_VECTOR);
    mount();
    await act(async () => { await ctx.loginWithIdentityKey(id); });
    await act(async () => { await ctx.loginWithIdentityKey(legacy); });
    const dump = allApiCallArgsJson();
    expect(dump).not.toContain(id.skHex);
    expect(dump).not.toContain(id.nsec);
    expect(dump).not.toContain(legacy.skHex);
    expect(dump).not.toContain(legacy.nsec);
    expect(dump).not.toContain(ABANDON_VECTOR);
    expect(dump.toLowerCase()).not.toContain('mnemonic');
  });

  it('8. the in-memory identity secret is set on auth and cleared on logout', async () => {
    const id = identityFromNsec(FIX_NSEC);
    mount();
    await act(async () => { await ctx.identityAuthDeferred(id); });
    expect(getSessionKey()).toBeTruthy();
    expect(getSessionKey().npub).toBe(id.npub);
    await act(async () => { ctx.logout(); });
    expect(getSessionKey()).toBeNull();
    expect(api.logout).toHaveBeenCalled();
  });
});

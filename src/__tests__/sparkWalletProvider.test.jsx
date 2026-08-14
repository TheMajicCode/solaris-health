/**
 * SparkWalletProvider lifecycle tests (correction §1 logout / account switch).
 *
 * Proves, with the adapter + vault fully mocked (no real SDK / IndexedDB):
 *   - on an account SWITCH the provider tears down the previously-active wallet
 *     (cleanupConnections) BEFORE it inspects the next account's vault, and
 *     reflects the NEXT account's state (its own vault, not the previous one's);
 *   - on LOGOUT (user → null) it calls cleanupConnections and clears the public
 *     wallet state, WITHOUT deleting any vault (clearVault is never called);
 *   - vault presence is always queried with the authenticated user.id.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const events = [];

// Mutable auth state for the mocked app context.
const appState = { user: { id: 'user-A', email: 'a@example.com' } };
vi.mock('../state/AppContext.jsx', () => ({ useApp: () => appState }));

vi.mock('../lib/spark/config.js', () => ({
  readSparkConfig: () => ({ enabled: true, network: 'REGTEST', reason: '' }),
}));

// Adapter mock — records teardown ordering, no live SDK.
const cleanupConnections = vi.fn(async () => { events.push('cleanup'); });
let activeWallet = false;
vi.mock('../lib/spark/adapter.js', () => ({
  cleanupConnections: (...a) => cleanupConnections(...a),
  hasActiveWallet: () => activeWallet,
  restoreSparkWallet: vi.fn(async () => { activeWallet = true; }),
  walletGetAddress: vi.fn(async () => 'sparkrt1qexampleaddress'),
  walletGetBalanceSats: vi.fn(async () => 0),
  walletTransfer: vi.fn(async () => ({})),
  walletCreateLightningInvoice: vi.fn(async () => ({})),
  isSparkSending: () => false,
  sparkPrivacySupported: () => true,
  walletGetWalletSettings: vi.fn(async () => ({ privateEnabled: false })),
  walletSetPrivacyEnabled: vi.fn(async () => ({ privateEnabled: true })),
}));

// Vault mock — per-user presence; clearVault must NEVER be called on logout.
const clearVault = vi.fn();
const vaultByUser = { 'user-A': true, 'user-B': false };
vi.mock('../lib/spark/vault.js', () => ({
  hasVault: vi.fn(async (uid) => { events.push(`hasVault:${uid}`); return !!vaultByUser[uid]; }),
  hasLegacyVault: vi.fn(async () => false),
  saveVaultMnemonic: vi.fn(async () => true),
  loadVaultMnemonic: vi.fn(async () => 'alpha bravo charlie'),
  migrateLegacyVault: vi.fn(async () => true),
  clearVault: (...a) => clearVault(...a),
  VAULT_STATUS_TEXT: 'Encrypted on this device. Restore on another device with your recovery words.',
}));

import { SparkWalletProvider, useSparkWallet } from '../state/SparkWalletContext.jsx';

function Probe() {
  const s = useSparkWallet();
  return <div data-testid="status">{s.status}</div>;
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  events.length = 0;
  activeWallet = false;
  cleanupConnections.mockClear();
  clearVault.mockClear();
  appState.user = { id: 'user-A', email: 'a@example.com' };
});

describe('SparkWalletProvider — lifecycle', () => {
  it('reflects the signed-in account vault (locked when a scoped vault exists)', async () => {
    render(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();
    expect(screen.getByTestId('status').textContent).toBe('locked');
    expect(events).toContain('hasVault:user-A');
  });

  it('on account SWITCH: cleans up the prior wallet BEFORE inspecting the next account, then shows the next account state', async () => {
    const { rerender } = render(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();
    events.length = 0;

    // Switch to account B (which has NO vault of its own).
    act(() => { appState.user = { id: 'user-B', email: 'b@example.com' }; });
    rerender(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();

    // Teardown happened, and it happened BEFORE we queried B's vault.
    expect(cleanupConnections).toHaveBeenCalled();
    const cleanupIdx = events.indexOf('cleanup');
    const hasVaultBIdx = events.indexOf('hasVault:user-B');
    expect(cleanupIdx).toBeGreaterThanOrEqual(0);
    expect(hasVaultBIdx).toBeGreaterThan(cleanupIdx);
    // B has no vault → idle (never inherits A's locked vault).
    expect(screen.getByTestId('status').textContent).toBe('idle');
  });

  it('on ONBOARDING activation (null → real user): PRESERVES the just-created wallet (no teardown)', async () => {
    // Simulate onboarding: no React user yet, but a wallet is already active in
    // memory (adapter holds it) after the user generated it on the wallet step.
    appState.user = null;
    activeWallet = true;
    const { rerender } = render(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();
    // Active in-memory wallet with no signed-in user → ready, not torn down.
    expect(screen.getByTestId('status').textContent).toBe('ready');
    expect(cleanupConnections).not.toHaveBeenCalled();

    // finalize() activates the account (null -> real id).
    act(() => { appState.user = { id: 'user-A', email: 'a@example.com' }; });
    rerender(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();

    // Activation must NOT be treated as an account switch: no teardown, wallet stays.
    expect(cleanupConnections).not.toHaveBeenCalled();
    expect(screen.getByTestId('status').textContent).toBe('ready');
  });

  it('on LOGOUT: cleans up + clears public state, and NEVER deletes the vault', async () => {
    const { rerender } = render(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();

    act(() => { appState.user = null; });
    rerender(<SparkWalletProvider><Probe /></SparkWalletProvider>);
    await flush();

    expect(cleanupConnections).toHaveBeenCalled();
    expect(clearVault).not.toHaveBeenCalled();
    // No signed-in user → no scoped vault to reflect → idle.
    expect(screen.getByTestId('status').textContent).toBe('idle');
  });
});

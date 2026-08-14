/**
 * adopt() overwrite guard (correction §1 / req 10) — focused test.
 *
 * The provider must NEVER silently overwrite an existing account-scoped vault on
 * this device. When a vault already exists for the signed-in account, adopt()
 * throws a clear error and does NOT call saveVaultMnemonic (no plaintext re-write,
 * no clobber). When there is no vault, adopt() persists normally.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const hasVault = vi.fn();
const saveVaultMnemonic = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/spark/vault.js', () => ({
  hasVault: (...a) => hasVault(...a),
  hasLegacyVault: vi.fn().mockResolvedValue(false),
  saveVaultMnemonic: (...a) => saveVaultMnemonic(...a),
  loadVaultMnemonic: vi.fn(),
  migrateLegacyVault: vi.fn(),
  VAULT_STATUS_TEXT: 'Encrypted on this device.',
}));
vi.mock('../lib/spark/adapter.js', () => ({
  restoreSparkWallet: vi.fn(), cleanupConnections: vi.fn(),
  hasActiveWallet: () => false,
  walletGetAddress: vi.fn(), walletGetBalanceSats: vi.fn(), walletTransfer: vi.fn(),
  walletCreateLightningInvoice: vi.fn(), isSparkSending: false,
  sparkPrivacySupported: () => false, walletGetWalletSettings: vi.fn(), walletSetPrivacyEnabled: vi.fn(),
}));
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({ user: { id: 'acct-uuid-1' } }),
}));

import { SparkWalletProvider, useSparkWallet } from '../state/SparkWalletContext.jsx';

let ctx;
function Grab() { ctx = useSparkWallet(); return null; }

beforeEach(() => {
  hasVault.mockReset(); saveVaultMnemonic.mockClear();
});

describe('SparkWalletContext.adopt — no silent overwrite', () => {
  it('throws and does NOT write when the account already has a vault on this device', async () => {
    hasVault.mockResolvedValue(true); // account already has a wallet here
    render(<SparkWalletProvider><Grab /></SparkWalletProvider>);
    await act(async () => {}); // let the mount lifecycle settle

    await expect(
      act(async () => { await ctx.adopt({ mnemonic: 'a b c', passphrase: 'a-strong-pass' }); }),
    ).rejects.toThrow(/already has a wallet on this device/i);
    expect(saveVaultMnemonic).not.toHaveBeenCalled();
  });

  it('persists normally when no vault exists yet for the account', async () => {
    hasVault.mockResolvedValue(false);
    render(<SparkWalletProvider><Grab /></SparkWalletProvider>);
    await act(async () => {});

    await act(async () => { await ctx.adopt({ mnemonic: 'a b c', passphrase: 'a-strong-pass' }); });
    expect(saveVaultMnemonic).toHaveBeenCalledWith('acct-uuid-1', 'a b c', 'a-strong-pass');
  });
});

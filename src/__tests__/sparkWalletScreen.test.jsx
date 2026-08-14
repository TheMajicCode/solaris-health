/**
 * SparkWalletScreen (Economic Passport → Wallet tab) focused tests (spec §4).
 *
 * The provider hook is mocked so we can drive each PUBLIC state without any real
 * SDK/wallet. Verifies: persistent REGTEST badge + sats balance + truncated
 * public address on the ready home; Receive renders the real REGTEST address;
 * Send validates whole positive sats BEFORE calling the provider (no double
 * submit path is reached on bad input); locked + disabled states render safely.
 * No secret/mnemonic is ever rendered or requested.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';

// Mutable mock state for the provider hook.
const walletState = {};
vi.mock('../state/SparkWalletContext.jsx', () => ({
  useSparkWallet: () => walletState,
}));

import SparkWalletScreen from '../components/wallet/SparkWalletScreen.jsx';

const REGTEST_ADDR = 'sparkrt1qexampleregtestaddress000000deadbeefcafe';

function readyState(overrides = {}) {
  return {
    enabled: true,
    network: 'REGTEST',
    status: 'ready',
    address: REGTEST_ADDR,
    balanceSats: 4200,
    loading: false,
    error: null,
    vaultPresent: true,
    legacyPresent: false,
    vaultStatusText: 'Encrypted on this device. Restore on another device with your recovery words.',
    privacy: { supported: true, enabled: false, loading: false, error: '' },
    isSending: false,
    refresh: vi.fn(),
    send: vi.fn().mockResolvedValue({}),
    createInvoice: vi.fn().mockResolvedValue({ invoice: { encodedInvoice: 'lnbcrt1invoice' } }),
    unlockFromVault: vi.fn().mockResolvedValue(),
    setPrivacyEnabled: vi.fn().mockResolvedValue(true),
    migrateLegacy: vi.fn().mockResolvedValue(true),
    refreshPrivacy: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  Object.keys(walletState).forEach((k) => delete walletState[k]);
  Object.assign(walletState, readyState());
});

describe('SparkWalletScreen — ready home', () => {
  it('shows the Spark wallet title, a persistent REGTEST badge, sats balance and truncated address', () => {
    render(<SparkWalletScreen />);
    expect(screen.getByText('Spark wallet')).toBeInTheDocument();
    expect(screen.getByText('REGTEST')).toBeInTheDocument();
    expect(screen.getByText('4,200')).toBeInTheDocument();
    expect(screen.getByText('sats')).toBeInTheDocument();
    // Address is truncated by default (not the full string).
    expect(screen.queryByText(REGTEST_ADDR)).not.toBeInTheDocument();
    expect(screen.getByText(/sparkrt1qexa…/)).toBeInTheDocument();
    // Encrypted-vault status is shown verbatim.
    expect(screen.getByText(/Encrypted on this device\. Restore on another device/)).toBeInTheDocument();
  });
});

describe('SparkWalletScreen — Receive', () => {
  it('reveals the full REGTEST address to receive test funds', () => {
    render(<SparkWalletScreen />);
    fireEvent.click(screen.getByText('Receive'));
    expect(screen.getByText('Receive')).toBeInTheDocument();
    expect(screen.getByText(REGTEST_ADDR)).toBeInTheDocument();
    // Framed as test-network only — never fiat/real bitcoin/production.
    expect(screen.getByText(/not fiat, not real bitcoin, and not a production balance/i)).toBeInTheDocument();
  });
});

describe('SparkWalletScreen — Send validation', () => {
  it('rejects a fractional amount and never calls the provider send', () => {
    render(<SparkWalletScreen />);
    fireEvent.click(screen.getByText('Send'));
    fireEvent.change(screen.getByLabelText('Destination Spark address'), { target: { value: REGTEST_ADDR } });
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText(/whole number of sats/i)).toBeInTheDocument();
    expect(walletState.send).not.toHaveBeenCalled();
  });

  it('rejects an amount above the available balance', () => {
    render(<SparkWalletScreen />);
    fireEvent.click(screen.getByText('Send'));
    fireEvent.change(screen.getByLabelText('Destination Spark address'), { target: { value: REGTEST_ADDR } });
    fireEvent.change(screen.getByLabelText('Amount (sats)'), { target: { value: '999999' } });
    fireEvent.click(screen.getByText('Review'));
    expect(screen.getByText(/exceeds your available balance/i)).toBeInTheDocument();
    expect(walletState.send).not.toHaveBeenCalled();
  });
});

describe('SparkWalletScreen — Bitcoin transaction privacy (truthful, correction §4)', () => {
  it('renders the privacy setting with a truthful explanation and no anonymity claim', () => {
    render(<SparkWalletScreen />);
    expect(screen.getByText('Bitcoin transaction privacy')).toBeInTheDocument();
    expect(screen.getByText(/can be seen through the public/i)).toBeInTheDocument();
    expect(screen.getByText(/not anonymity and does not make your wallet invisible/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy mode is OFF/i)).toBeInTheDocument();
  });

  it('explicitly enables privacy through the provider when toggled on', async () => {
    render(<SparkWalletScreen />);
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: /Bitcoin transaction privacy/i }));
    });
    expect(walletState.setPrivacyEnabled).toHaveBeenCalledWith(true);
  });

  it('shows the ON state and a graceful message when the SDK privacy control is unavailable', () => {
    Object.assign(walletState, readyState({ privacy: { supported: true, enabled: true, loading: false, error: '' } }));
    render(<SparkWalletScreen />);
    expect(screen.getByText(/Privacy mode is ON/i)).toBeInTheDocument();

    Object.assign(walletState, readyState({ privacy: { supported: false, enabled: false, loading: false, error: '' } }));
    render(<SparkWalletScreen />);
    expect(screen.getByText(/unavailable in this preview SDK/i)).toBeInTheDocument();
  });
});

describe('SparkWalletScreen — legacy migration offer (correction §1)', () => {
  it('offers the one-time legacy-move card ONLY when a legacy vault is present and no scoped wallet is active', () => {
    Object.assign(walletState, readyState({ status: 'idle', legacyPresent: true }));
    render(<SparkWalletScreen />);
    expect(screen.getByText(/Move an older wallet to this account/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move this legacy wallet to this Solaris account/i })).toBeInTheDocument();
  });

  it('does NOT offer the legacy card when no legacy vault exists', () => {
    Object.assign(walletState, readyState({ status: 'idle', legacyPresent: false }));
    render(<SparkWalletScreen />);
    expect(screen.queryByText(/Move an older wallet to this account/i)).not.toBeInTheDocument();
  });
});

describe('SparkWalletScreen — other states', () => {
  it('disables Send at a zero balance', () => {
    Object.assign(walletState, readyState({ balanceSats: 0 }));
    render(<SparkWalletScreen />);
    expect(screen.getByText('Send').closest('button')).toBeDisabled();
  });

  it('renders the locked card with an unlock passphrase field when a vault exists but no wallet is active', () => {
    Object.assign(walletState, readyState({ status: 'locked' }));
    render(<SparkWalletScreen />);
    expect(screen.getByText(/locked on this device/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Unlock passphrase')).toBeInTheDocument();
  });

  it('shows the fail-closed disabled note when the wallet is off in this build', () => {
    Object.assign(walletState, readyState({ enabled: false, status: 'idle', disabledReason: 'off in this build' }));
    render(<SparkWalletScreen />);
    expect(screen.getByText(/off in this build/i)).toBeInTheDocument();
  });
});

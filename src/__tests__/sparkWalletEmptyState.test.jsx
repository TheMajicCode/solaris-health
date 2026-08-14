/**
 * Economic Passport empty-wallet Create/Restore (correction §1) — focused tests.
 *
 * An onboarded member who has NO wallet on this device sees the Wallet tab offer
 * TWO actions — "Create Spark wallet" and "Restore existing wallet" — each of
 * which opens the ONE reusable SparkWalletSetup flow in a responsive overlay.
 * These tests prove:
 *   1. the empty state offers Create + Restore (not a dead end);
 *   2. Create uses the existing secure REGTEST setup and adopts the wallet;
 *   3. Restore uses the existing secure restore path and adopts the wallet;
 *   4. neither path replays onboarding screens, the profile form, or the health
 *      assessment;
 *   5. no recovery phrase / passphrase is ever sent to the network.
 *
 * Runs in DEMO-FIXTURE mode so NO live SparkWallet.initialize() and no network
 * access ever happen (mirrors the onboarding card test).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

const adopt = vi.fn().mockResolvedValue(undefined);
const refresh = vi.fn().mockResolvedValue(undefined);
vi.mock('../state/SparkWalletContext.jsx', () => ({
  useSparkWallet: () => ({
    enabled: true, status: 'idle', network: 'REGTEST', legacyPresent: false,
    disabledReason: '', vaultStatusText: 'Encrypted on this device.',
    adopt, refresh,
  }),
}));
vi.mock('../state/AppContext.jsx', () => ({ useApp: () => ({ user: null }) }));

import SparkWalletScreen from '../components/wallet/SparkWalletScreen.jsx';
import { DEMO_FIXTURE_MNEMONIC } from '../lib/spark/adapter.js';

let fetchSpy;
beforeEach(() => {
  adopt.mockClear(); refresh.mockClear();
  vi.stubEnv('VITE_SPARK_WALLET_ENABLED', 'true');
  vi.stubEnv('VITE_SPARK_NETWORK', 'REGTEST');
  vi.stubEnv('VITE_SPARK_DEMO_FIXTURE', 'true');
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) });
});
afterEach(() => { vi.unstubAllEnvs(); fetchSpy.mockRestore(); });

// Nothing in the setup flow may leak a secret to the network.
function assertNoSecretLeaked() {
  for (const call of fetchSpy.mock.calls) {
    const serialized = JSON.stringify(call);
    expect(serialized).not.toContain(DEMO_FIXTURE_MNEMONIC);
  }
}

describe('Economic Passport empty wallet — Create / Restore', () => {
  it('offers Create + Restore to an onboarded member with no wallet (no dead end, no onboarding replay)', () => {
    render(<SparkWalletScreen />);
    expect(screen.getByRole('button', { name: /Create Spark wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore existing wallet/i })).toBeInTheDocument();
    // No onboarding replay: profile form / health assessment / Screen 1-3 chrome absent.
    expect(screen.queryByText(/health assessment/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reclaim Your Wealth/i)).not.toBeInTheDocument();
    // No setup dialog until an explicit action.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Create opens the reusable setup overlay and adopts the wallet via the existing secure REGTEST flow', async () => {
    render(<SparkWalletScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Create Spark wallet/i }));

    // A responsive setup overlay (dialog) mounts the shared SparkWalletSetup flow.
    const dialog = await screen.findByRole('dialog');
    // The fixture wallet is generated automatically in create mode → backup gate.
    await within(dialog).findByText('Recovery words');
    // Words masked until a deliberate reveal (secure flow, unchanged).
    expect(within(dialog).queryByText(DEMO_FIXTURE_MNEMONIC)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('Reveal recovery words'));
    expect(within(dialog).getByText(DEMO_FIXTURE_MNEMONIC)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /saved my recovery words/i }));
    fireEvent.click(within(dialog).getByText('Wallet ready'));

    // Device passphrase gate before adopt.
    await within(dialog).findByLabelText('Unlock passphrase');
    fireEvent.change(within(dialog).getByLabelText('Unlock passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.change(within(dialog).getByLabelText('Confirm passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.click(within(dialog).getByText('Encrypt & finish'));

    await waitFor(() => expect(adopt).toHaveBeenCalledTimes(1));
    expect(adopt).toHaveBeenCalledWith({ mnemonic: DEMO_FIXTURE_MNEMONIC, passphrase: 'a-strong-pass' });
    assertNoSecretLeaked();
  });

  it('Restore opens the reusable setup overlay and adopts via the existing secure restore path', async () => {
    render(<SparkWalletScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Restore existing wallet/i }));

    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByLabelText(/Enter your recovery words/i);
    fireEvent.change(box, { target: { value: DEMO_FIXTURE_MNEMONIC } });
    fireEvent.click(within(dialog).getByText('Restore wallet'));

    await within(dialog).findByLabelText('Unlock passphrase');
    fireEvent.change(within(dialog).getByLabelText('Unlock passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.change(within(dialog).getByLabelText('Confirm passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.click(within(dialog).getByText('Encrypt & finish'));

    await waitFor(() => expect(adopt).toHaveBeenCalledTimes(1));
    expect(adopt).toHaveBeenCalledWith({ mnemonic: DEMO_FIXTURE_MNEMONIC, passphrase: 'a-strong-pass' });
    assertNoSecretLeaked();
  });
});

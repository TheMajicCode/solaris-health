/**
 * SparkWalletCard onboarding focused tests (spec §3/§2A).
 *
 * Runs in the deterministic DEMO-FIXTURE mode so NO live SparkWallet.initialize()
 * and no network access ever happen. Verifies:
 *   - the wallet is created only after an EXPLICIT user action (a button press);
 *   - recovery words are masked until a deliberate reveal (never auto-shown);
 *   - the existing acknowledgement checkbox gates progress (NO character quizzes);
 *   - a device unlock passphrase (≥8, confirmed) is required BEFORE the vault is
 *     written, then the wallet is adopted by the app-root provider;
 *   - the optional-wallet framing is preserved and no secret is written to logs.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const adopt = vi.fn().mockResolvedValue(undefined);
vi.mock('../state/SparkWalletContext.jsx', () => ({
  useSparkWallet: () => ({ adopt }),
}));
vi.mock('../lib/api.js', () => ({ api: { connectWallet: vi.fn().mockResolvedValue({}) } }));

import SparkWalletCard from '../components/SparkWalletCard.jsx';
import { DEMO_FIXTURE_MNEMONIC } from '../lib/spark/adapter.js';

beforeEach(() => {
  adopt.mockClear();
  vi.stubEnv('VITE_SPARK_WALLET_ENABLED', 'true');
  vi.stubEnv('VITE_SPARK_NETWORK', 'REGTEST');
  vi.stubEnv('VITE_SPARK_DEMO_FIXTURE', 'true');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('SparkWalletCard — onboarding (demo fixture)', () => {
  it('keeps the wallet optional and does not create anything until an explicit action', () => {
    render(<SparkWalletCard />);
    expect(screen.getByText(/Optional — never required for care or booking/i)).toBeInTheDocument();
    expect(screen.getByText('Generate my Spark wallet')).toBeInTheDocument();
    // Nothing created yet: the backup gate (ack checkbox / reveal control) is absent.
    expect(screen.queryByRole('checkbox', { name: /saved my recovery words/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Wallet ready')).not.toBeInTheDocument();
    expect(adopt).not.toHaveBeenCalled();
  });

  it('reveals words only on demand, gates on the ack checkbox, then requires a device passphrase before adopting', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const onWalletReady = vi.fn();
    render(<SparkWalletCard onWalletReady={onWalletReady} />);

    // Explicit action creates the (fixture) wallet and shows the backup gate.
    fireEvent.click(screen.getByText('Generate my Spark wallet'));
    await screen.findByText('Recovery words');

    // Words are masked until a deliberate reveal.
    expect(screen.queryByText(DEMO_FIXTURE_MNEMONIC)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Reveal recovery words'));
    expect(screen.getByText(DEMO_FIXTURE_MNEMONIC)).toBeInTheDocument();

    // Cannot proceed without ticking the acknowledgement (button disabled).
    expect(screen.getByText('Wallet ready')).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /saved my recovery words/i }));
    fireEvent.click(screen.getByText('Wallet ready'));

    // Passphrase step appears with the exact vault status text.
    await screen.findByLabelText('Unlock passphrase');
    expect(screen.getByText(/Encrypted on this device\. Restore on another device with your recovery words\./))
      .toBeInTheDocument();

    // Too-short passphrase is rejected before any adopt.
    fireEvent.change(screen.getByLabelText('Unlock passphrase'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Encrypt & finish'));
    expect(adopt).not.toHaveBeenCalled();

    // A valid, matching passphrase adopts the wallet into the app-root provider.
    fireEvent.change(screen.getByLabelText('Unlock passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.change(screen.getByLabelText('Confirm passphrase'), { target: { value: 'a-strong-pass' } });
    fireEvent.click(screen.getByText('Encrypt & finish'));

    await waitFor(() => expect(adopt).toHaveBeenCalledTimes(1));
    expect(adopt).toHaveBeenCalledWith({ mnemonic: DEMO_FIXTURE_MNEMONIC, passphrase: 'a-strong-pass' });
    await waitFor(() => expect(onWalletReady).toHaveBeenCalledWith({ backedUp: true }));

    // The recovery words were never written to the console.
    const logged = logSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain(DEMO_FIXTURE_MNEMONIC);
    logSpy.mockRestore();
  });
});

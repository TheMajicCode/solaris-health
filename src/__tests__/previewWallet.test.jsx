/**
 * PreviewWallet (spec §6) — truth-first, Preview-only Economic Passport wallet.
 *
 * Verifies:
 *   • Two asset cards: Bitcoin ("Digital gold") + USDT ("Digital Dollars").
 *   • A persistent "Preview · Test wallet" status is always visible.
 *   • The lead copy keeps the authorization promise ("LUCA cannot move money
 *     without your explicit authorization").
 *   • Designated demo identities (@solaris.health) see a clearly-labelled
 *     "Demo balance"; real members see a truthful zero and NO demo badge.
 *   • Send explains WHY it is disabled instead of silently doing nothing.
 *   • Receive shows an honest placeholder (no fake address behind a QR).
 *   • REGTEST / network details live in a collapsed "Developer details"
 *     disclosure, not in the primary UI.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';

// The app-root Spark wallet is disabled in this Preview build; the component is
// null-safe and treats an absent/!ready wallet as offline (demo/zero balances).
vi.mock('../state/SparkWalletContext.jsx', () => ({
  useSparkWallet: () => undefined,
}));

import PreviewWallet from '../components/economic/PreviewWallet.jsx';

beforeEach(() => cleanup());

describe('PreviewWallet — asset cards, status and authorization copy', () => {
  it('renders Bitcoin (Digital gold) and USDT (Digital Dollars) with the Preview status', () => {
    render(<PreviewWallet user={{ email: 'demo@example.com' }} />);
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    expect(screen.getByText('Digital gold')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
    expect(screen.getByText('Digital Dollars')).toBeInTheDocument();
    expect(screen.getByText(/Preview · Test wallet/)).toBeInTheDocument();
    expect(screen.getByText(/LUCA cannot move money without your explicit authorization/i)).toBeInTheDocument();
  });

  it('shows a labelled "Demo balance" for a designated @solaris.health identity', () => {
    render(<PreviewWallet user={{ email: 'sofia@solaris.health' }} />);
    const badges = screen.getAllByText('Demo balance');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows a truthful zero and NO demo badge for a real member', () => {
    render(<PreviewWallet user={{ email: 'jane@realmember.com' }} />);
    expect(screen.getByText('0.0000 BTC')).toBeInTheDocument();
    expect(screen.getByText('0.00 USDT')).toBeInTheDocument();
    expect(screen.queryByText('Demo balance')).toBeNull();
  });
});

describe('PreviewWallet — Preview-only actions explain themselves', () => {
  it('Send opens a sheet that explains sending is disabled in Preview', () => {
    render(<PreviewWallet user={{ email: 'demo@example.com' }} />);
    // First card's Send button (Bitcoin).
    fireEvent.click(screen.getAllByRole('button', { name: /Send/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Sending is disabled in Preview/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/LUCA cannot move money without your explicit authorization/i)).toBeInTheDocument();
  });

  it('Receive shows an honest placeholder when no real address is connected', () => {
    render(<PreviewWallet user={{ email: 'demo@example.com' }} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Receive/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Preview — address not connected/i)).toBeInTheDocument();
  });
});

describe('PreviewWallet — REGTEST relocated to Developer details', () => {
  it('hides REGTEST until the Developer details disclosure is opened', () => {
    render(<PreviewWallet user={{ email: 'demo@example.com' }} />);
    expect(screen.queryByText(/REGTEST/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Developer details/i }));
    expect(screen.getByText(/REGTEST/)).toBeInTheDocument();
  });
});

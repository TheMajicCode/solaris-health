/** Economic Passport cards must never invent balances or payment capabilities. */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';

const state = vi.hoisted(() => ({ wallet: undefined }));
vi.mock('../state/SparkWalletContext.jsx', () => ({
  useSparkWallet: () => state.wallet,
}));
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }) => <svg data-testid="receive-qr" data-value={value} />,
}));

import PreviewWallet from '../components/economic/PreviewWallet.jsx';

beforeEach(() => { state.wallet = undefined; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function connect(overrides = {}) {
  state.wallet = {
    enabled: true, status: 'ready', network: 'REGTEST',
    balanceSats: 0, address: 'sparkrt1synthetic',
    send: vi.fn(), createInvoice: vi.fn(), adopt: vi.fn(),
    ...overrides,
  };
}

function openAction(name, assetIndex = 0) {
  fireEvent.click(screen.getAllByRole('button', { name, exact: true })[assetIndex]);
  return screen.getByRole('dialog');
}

describe('PreviewWallet — observed balances only', () => {
  it.each(['sofia@solaris.health', 'SOFIA@SOLARIS.HEALTH', 'jane@example.com', undefined])(
    'shows unknown balances without a connected wallet for %s', (email) => {
      render(<PreviewWallet user={{ email }} />);
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
      expect(screen.getByText('Digital gold')).toBeInTheDocument();
      expect(screen.getByText('USDT')).toBeInTheDocument();
      expect(screen.getByText('Digital Dollars')).toBeInTheDocument();
      expect(screen.getByText('Wallet not connected')).toBeInTheDocument();
      expect(screen.getAllByText('Balance unavailable')).toHaveLength(2);
      expect(screen.queryByText('Demo balance')).not.toBeInTheDocument();
      expect(screen.queryByText(/\d+\.\d+ (BTC|USDT)/)).not.toBeInTheDocument();
    },
  );

  it.each([undefined, null, NaN, Infinity, -1, 1.5, '0'])(
    'does not turn a missing or invalid balance (%s) into zero', (balanceSats) => {
      connect({ balanceSats });
      render(<PreviewWallet />);
      expect(screen.getAllByText('Balance unavailable')).toHaveLength(2);
      expect(screen.getByText('The connected wallet has not provided a balance.')).toBeInTheDocument();
    },
  );

  it.each([[0, '0.00000000 BTC'], [1, '0.00000001 BTC'], [123456789, '1.23456789 BTC']])(
    'shows the observed %s sats, including a genuine zero', (balanceSats, expected) => {
      connect({ balanceSats });
      render(<PreviewWallet user={{ email: 'sofia@solaris.health' }} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      expect(screen.getAllByText('Balance unavailable')).toHaveLength(1);
      expect(screen.getByText(/USDT wallet not connected\. Tether WDK integration is planned/)).toBeInTheDocument();
    },
  );

  it.each([{ enabled: false }, { status: 'locked' }, { status: 'idle' }])(
    'ignores leftover public data when the wallet is not ready: %j', (overrides) => {
      connect({ balanceSats: 200000000, ...overrides });
      render(<PreviewWallet />);
      expect(screen.getAllByText('Balance unavailable')).toHaveLength(2);
      const dialog = openAction('Receive');
      expect(within(dialog).queryByTestId('receive-qr')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Receive address unavailable')).toBeInTheDocument();
    },
  );
});

describe('PreviewWallet — safe actions and network disclosure', () => {
  it.each(['REGTEST', 'MAINNET'])(
    'labels the actual %s network and only renders the reported receive address', (network) => {
      connect({ network, address: 'spark1reported-address' });
      render(<PreviewWallet />);
      expect(screen.getByText(`Connected · ${network}`)).toBeInTheDocument();
      const dialog = openAction('Receive');
      expect(within(dialog).getByText(`${network} address`)).toBeInTheDocument();
      expect(within(dialog).getByTestId('receive-qr')).toHaveAttribute('data-value', 'spark1reported-address');
      expect(screen.queryByText(/no real funds|test wallet|test network/i)).not.toBeInTheDocument();
    },
  );

  it('does not make an address scannable when its network is unknown', () => {
    connect({ network: null });
    render(<PreviewWallet />);
    const dialog = openAction('Receive');
    expect(within(dialog).queryByTestId('receive-qr')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Receive address unavailable')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Developer details' }));
    expect(screen.getByText('Not reported')).toBeInTheDocument();
    expect(screen.queryByText(/REGTEST/)).not.toBeInTheDocument();
  });

  it('does not reuse the Bitcoin address for USDT', () => {
    connect();
    render(<PreviewWallet />);
    const dialog = openAction('Receive', 1);
    expect(within(dialog).queryByTestId('receive-qr')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Receive address unavailable')).toBeInTheDocument();
  });

  it('explains unavailable sends and top-ups without mutations or storage writes', () => {
    connect({ network: 'MAINNET', balanceSats: 100000000 });
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    render(<PreviewWallet />);
    for (const assetIndex of [0, 1]) {
      let dialog = openAction('Send', assetIndex);
      expect(within(dialog).getByText('Sending is unavailable from this screen')).toBeInTheDocument();
      expect(within(dialog).getByText(/LUCA cannot move money without your explicit authorization/)).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      dialog = openAction('Top Up', assetIndex);
      expect(within(dialog).getByText('Top Up is not connected')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    }
    expect(state.wallet.send).not.toHaveBeenCalled();
    expect(state.wallet.createInvoice).not.toHaveBeenCalled();
    expect(state.wallet.adopt).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });
});

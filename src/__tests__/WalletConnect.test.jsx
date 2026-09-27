/** ECO-CLEAN-R1: obsolete connector coverage is replaced by product retirement checks. */
import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const calls = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../state/AppContext.jsx', () => ({
  useApp: () => ({
    user: { id: '11111111-1111-4111-8111-111111111111', role: 'patient', email: 'member@example.test', firstName: 'Member' },
    logout: vi.fn(), refreshUser: vi.fn(), setPendingProviderId: vi.fn(), setPendingCurate: vi.fn(),
  }),
  AppProvider: ({ children }) => children,
}));
vi.mock('../lib/api.js', () => ({
  api: new Proxy({}, { get: (_target, name) => (...args) => {
    calls.api(name, ...args);
    return Promise.resolve({});
  } }),
}));
import LucaPassport from '../components/LucaPassport.jsx';

beforeEach(() => {
  calls.api.mockClear();
  localStorage.clear(); sessionStorage.clear();
  vi.stubGlobal('ethereum', { request: vi.fn() });
  vi.stubGlobal('solana', { isPhantom: true, connect: vi.fn(), signTransaction: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('Economic Passport after legacy connector retirement', () => {
  it('keeps GPS contribution views without a nested crypto/NFT hub or provider requests', async () => {
    window.history.replaceState({}, '', '/?area=wallet&sub=gps');
    await act(async () => { render(<LucaPassport />); });
    expect(screen.getByRole('tab', { name: 'GPS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Value trail' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'LOVE & rewards' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ecosystem builder' })); });
    expect(screen.queryByRole('button', { name: 'Crypto wallets' })).not.toBeInTheDocument();
    expect(screen.queryByText('Health NFTs')).not.toBeInTheDocument();
    expect(screen.queryByText(/MetaMask|Phantom|Ethereum|Solana/)).not.toBeInTheDocument();
    expect(window.ethereum.request).not.toHaveBeenCalled();
    expect(window.solana.connect).not.toHaveBeenCalled();
    expect(calls.api.mock.calls.some(([name]) => ['getWallets', 'getWalletChains', 'connectWallet', 'verifyWalletSignature'].includes(name))).toBe(false);
  });

  it('retains Bitcoin, digital dollars, Self Care, GPS and Network navigation', async () => {
    window.history.replaceState({}, '', '/?area=wallet&sub=wallet');
    await act(async () => { render(<LucaPassport />); });
    expect(screen.getByText('Bitcoin')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
    for (const name of ['Wallet', 'Self Care', 'GPS', 'Network']) {
      await act(async () => { fireEvent.click(screen.getByRole('tab', { name })); });
      expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('button', { name: 'Crypto wallets' })).not.toBeInTheDocument();
    }
    expect(window.ethereum.request).not.toHaveBeenCalled();
    expect(window.solana.signTransaction).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const apiCalls = vi.hoisted(() => ({ getMyPayments: vi.fn(), connectWallet: vi.fn() }));
vi.mock('../lib/api.js', () => ({ api: apiCalls }));
import WalletCard from '../components/passport/WalletCard.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('WalletCard — navigation without fabricated financial data', () => {
  it('links to the existing Economic Passport without fabricating sats or a Lightning address', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    render(<WalletCard user={{ displayName: 'Synthetic Member', email: 'member@solaris.health' }} />);
    expect(screen.getByRole('link', { name: /Open Economic Passport/ }))
      .toHaveAttribute('href', '?area=wallet&sub=wallet');
    expect(screen.getByText(/Tether WDK for USDT and top-up integration are planned/)).toBeInTheDocument();
    expect(screen.queryByText(/2,100,000|@solaris.health|simulated|Lightning-native/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(apiCalls.getMyPayments).not.toHaveBeenCalled();
    expect(apiCalls.connectWallet).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});

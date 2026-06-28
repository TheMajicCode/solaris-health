/**
 * Wallet tests — the pure client-side web3 helpers plus a render smoke test of
 * the WalletConnect component (api + browser wallet providers are mocked).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  shortAddr,
  fmtAmount,
  looksLikeAddress,
  explorerAddressUrl,
  explorerTxUrl,
  chainMeta,
} from '../lib/web3-utils.js';

// Mock the API so the component never touches the network.
vi.mock('../lib/api.js', () => ({
  api: {
    connectWallet: vi.fn().mockResolvedValue({ wallet: { id: 1 } }),
    getWalletNonce: vi.fn().mockResolvedValue({ nonce: 'n', message: 'm' }),
    verifyWalletSignature: vi.fn().mockResolvedValue({ verified: true }),
  },
}));

import WalletConnect from '../components/wallet/WalletConnect.jsx';

describe('shortAddr', () => {
  it('truncates a long address with an ellipsis', () => {
    const full = '0x52908400098527886E0F7030069857D2E4169EE7';
    const short = shortAddr(full);
    expect(short.length).toBeLessThan(full.length);
    expect(short).toMatch(/\.\.\.|…/);
    expect(short.startsWith('0x5290')).toBe(true);
    expect(short.endsWith('9EE7')).toBe(true);
  });

  it('returns empty string for falsy input', () => {
    expect(shortAddr('')).toBe('');
    expect(shortAddr(null)).toBe('');
  });

  it('leaves short strings untouched', () => {
    expect(shortAddr('0x1234')).toBe('0x1234');
  });
});

describe('fmtAmount', () => {
  it('renders an em dash for nullish values', () => {
    expect(fmtAmount(null)).toBe('—');
    expect(fmtAmount(undefined)).toBe('—');
    expect(fmtAmount('')).toBe('—');
  });

  it('formats zero and normal numbers', () => {
    expect(fmtAmount(0)).toBe('0');
    expect(fmtAmount(1.23456789)).toMatch(/^1\.23/);
  });

  it('uses exponential notation for very small numbers', () => {
    expect(fmtAmount(0.0000001)).toContain('e');
  });
});

describe('looksLikeAddress', () => {
  it('validates EVM addresses', () => {
    expect(looksLikeAddress('ethereum', '0x52908400098527886E0F7030069857D2E4169EE7')).toBe(true);
    expect(looksLikeAddress('ethereum', '0xbad')).toBe(false);
  });

  it('validates Solana addresses', () => {
    expect(looksLikeAddress('solana', '4Nd1mYsHN7p6Xq2yJ8q4F8s5p1m2N3o4P5q6R7s8T9u')).toBe(true);
    expect(looksLikeAddress('solana', '0x123')).toBe(false);
  });

  it('returns false for empty input or unknown chain', () => {
    expect(looksLikeAddress('ethereum', '')).toBe(false);
    expect(looksLikeAddress('dogecoin', 'x')).toBe(false);
  });
});

describe('explorer URL builders', () => {
  it('builds an address URL for a known chain', () => {
    const url = explorerAddressUrl('ethereum', '0xabc');
    expect(url).toContain('0xabc');
    expect(url).toContain('/address/');
  });

  it('builds a tx URL for a known chain', () => {
    const url = explorerTxUrl('ethereum', '0xhash');
    expect(url).toContain('/tx/');
    expect(url).toContain('0xhash');
  });

  it('returns # for an unknown chain', () => {
    expect(explorerAddressUrl('dogecoin', 'x')).toBe('#');
  });
});

describe('chainMeta', () => {
  it('resolves metadata for supported chains', () => {
    expect(chainMeta('ethereum')).toBeTruthy();
    expect(chainMeta('solana')).toBeTruthy();
  });
});

describe('<WalletConnect /> render smoke test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders provider and chain choices without crashing', () => {
    const { container } = render(
      <div className="luca">
        <WalletConnect chains={[]} onConnected={() => {}} onError={() => {}} />
      </div>
    );
    // The component should render its address input field.
    expect(container.querySelector('.wc-wrap')).toBeTruthy();
    // MetaMask + Phantom providers are listed.
    expect(screen.getByText(/MetaMask/i)).toBeInTheDocument();
  });
});

/**
 * web3-utils — Phase 4 (Cross-chain Wallet Integration)
 *
 * Client-side helpers for interacting with browser wallet extensions.
 *   - EVM (MetaMask / WalletConnect-style injected providers) via ethers.js
 *   - Solana (Phantom) via window.solana
 *
 * IMPORTANT: no private keys ever leave the wallet extension. We only ever
 * request the public address and (optionally) a signature to prove ownership.
 *
 * The sandbox/demo browser usually has no wallet extension installed, so every
 * helper degrades gracefully and the UI offers a manual address-entry fallback.
 */
import { BrowserProvider, formatEther } from 'ethers';

/* ----------------------------- chain metadata ----------------------------- */
export const CHAIN_META = {
  ethereum: {
    id: 'ethereum', name: 'Ethereum', symbol: 'ETH', kind: 'evm',
    chainId: 1, hexChainId: '0x1', explorer: 'https://etherscan.io',
    color: '#627EEA', addPayload: null,
  },
  polygon: {
    id: 'polygon', name: 'Polygon', symbol: 'MATIC', kind: 'evm',
    chainId: 137, hexChainId: '0x89', explorer: 'https://polygonscan.com',
    color: '#8247E5',
    addPayload: {
      chainId: '0x89', chainName: 'Polygon Mainnet',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com'],
    },
  },
  solana: {
    id: 'solana', name: 'Solana', symbol: 'SOL', kind: 'solana',
    explorer: 'https://solscan.io', color: '#14F195', addPayload: null,
  },
  bitcoin: {
    id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', kind: 'bitcoin',
    explorer: 'https://blockstream.info', color: '#F7931A', addPayload: null,
  },
};

export const EVM_CHAINS_BY_HEX = {
  '0x1': 'ethereum',
  '0x89': 'polygon',
};

export function chainMeta(chain) {
  return CHAIN_META[String(chain || '').toLowerCase()] || null;
}

/* ----------------------------- extension detection ----------------------------- */
export function hasMetaMask() {
  return typeof window !== 'undefined' && !!window.ethereum;
}
export function hasPhantom() {
  return typeof window !== 'undefined' && !!(window.solana && window.solana.isPhantom);
}

/* Map UI provider id → availability + which chains it serves */
export const PROVIDERS = {
  metamask: {
    id: 'metamask', name: 'MetaMask', kind: 'evm',
    tagline: 'Ethereum & Polygon', detect: hasMetaMask,
  },
  walletconnect: {
    id: 'walletconnect', name: 'WalletConnect', kind: 'evm',
    tagline: 'Scan with any mobile wallet', detect: hasMetaMask,
  },
  phantom: {
    id: 'phantom', name: 'Phantom', kind: 'solana',
    tagline: 'Solana', detect: hasPhantom,
  },
  manual: {
    id: 'manual', name: 'Enter address manually', kind: 'manual',
    tagline: 'Watch-only — paste any public address', detect: () => true,
  },
};

/* ----------------------------- EVM (MetaMask) ----------------------------- */
/**
 * Request accounts from the injected EVM provider.
 * Returns { address, chainId (hex), chainName }.
 */
export async function connectEvm() {
  if (!hasMetaMask()) throw new Error('No EVM wallet extension found. Install MetaMask or enter an address manually.');
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  if (!accounts || !accounts.length) throw new Error('No account returned by the wallet.');
  const network = await provider.getNetwork();
  const hex = '0x' + network.chainId.toString(16);
  return {
    address: accounts[0],
    chainId: hex,
    chain: EVM_CHAINS_BY_HEX[hex] || 'ethereum',
  };
}

/** Switch (or add) the injected wallet to a target EVM chain. */
export async function switchEvmChain(chainId) {
  const meta = chainMeta(chainId);
  if (!meta || meta.kind !== 'evm') throw new Error('Not an EVM chain');
  if (!hasMetaMask()) throw new Error('No EVM wallet extension found.');
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: meta.hexChainId }],
    });
  } catch (err) {
    // 4902 = chain not added to wallet
    if (err && err.code === 4902 && meta.addPayload) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [meta.addPayload],
      });
    } else {
      throw err;
    }
  }
  return true;
}

/** Sign a SIWE-style message with the injected EVM wallet (personal_sign). */
export async function signEvmMessage(message, address) {
  if (!hasMetaMask()) throw new Error('No EVM wallet extension found.');
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner(address);
  return signer.signMessage(message);
}

/** Read the connected EVM account's native balance directly from the wallet. */
export async function evmNativeBalance(address) {
  if (!hasMetaMask()) return null;
  const provider = new BrowserProvider(window.ethereum);
  const bal = await provider.getBalance(address);
  return formatEther(bal);
}

/* ----------------------------- Solana (Phantom) ----------------------------- */
export async function connectSolana() {
  if (!hasPhantom()) throw new Error('No Phantom wallet found. Install Phantom or enter an address manually.');
  const resp = await window.solana.connect();
  const address = resp.publicKey ? resp.publicKey.toString() : (window.solana.publicKey?.toString());
  if (!address) throw new Error('No public key returned by Phantom.');
  return { address, chain: 'solana' };
}

export async function disconnectSolana() {
  try { if (hasPhantom() && window.solana.disconnect) await window.solana.disconnect(); } catch { /* noop */ }
}

/* ----------------------------- formatting ----------------------------- */
export function shortAddr(addr, lead = 6, tail = 4) {
  if (!addr) return '';
  if (addr.length <= lead + tail + 2) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function explorerAddressUrl(chain, address) {
  const m = chainMeta(chain);
  if (!m) return '#';
  if (m.kind === 'bitcoin') return `${m.explorer}/address/${address}`;
  if (m.kind === 'solana') return `${m.explorer}/account/${address}`;
  return `${m.explorer}/address/${address}`;
}

export function explorerTxUrl(chain, hash) {
  const m = chainMeta(chain);
  if (!m) return '#';
  return `${m.explorer}/tx/${hash}`;
}

export function fmtAmount(n, max = 6) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  if (num === 0) return '0';
  if (num < 0.000001) return num.toExponential(2);
  return num.toLocaleString(undefined, { maximumFractionDigits: max });
}

/** Basic client-side address validation (mirrors backend). */
export function looksLikeAddress(chain, address) {
  const a = (address || '').trim();
  const m = chainMeta(chain);
  if (!m || !a) return false;
  if (m.kind === 'evm') return /^0x[a-fA-F0-9]{40}$/.test(a);
  if (m.kind === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  if (m.kind === 'bitcoin') return /^(bc1[a-z0-9]{25,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  return false;
}

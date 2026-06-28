/**
 * web3.js — Backend Web3 utilities (Phase 4)
 *
 * Read-only blockchain helpers used by the wallet routes:
 *   - chain configuration (RPC + explorer endpoints)
 *   - address validation per chain
 *   - native + token balance queries (EVM via ethers, Solana via JSON-RPC)
 *   - transaction history (explorer APIs with graceful fallback)
 *   - signature verification (Sign-In With Ethereum style)
 *   - a tiny in-memory TTL cache to avoid rate limits
 *
 * No private keys are ever handled here.
 */
const { ethers } = require('ethers');

/* ----------------------------- chain config ----------------------------- */
const CHAINS = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    kind: 'evm',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    rpc: () => process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com',
    explorer: 'https://etherscan.io',
    explorerApi: 'https://api.etherscan.io/api',
    explorerApiKey: () => process.env.ETHERSCAN_API_KEY || '',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    kind: 'evm',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    rpc: () => process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com',
    explorer: 'https://polygonscan.com',
    explorerApi: 'https://api.polygonscan.com/api',
    explorerApiKey: () => process.env.POLYGONSCAN_API_KEY || '',
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    kind: 'solana',
    symbol: 'SOL',
    decimals: 9,
    rpc: () => process.env.SOLANA_RPC_URL || 'https://solana-rpc.publicnode.com',
    explorer: 'https://solscan.io',
  },
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    kind: 'bitcoin',
    symbol: 'BTC',
    decimals: 8,
    // public, key-less REST API
    rpc: () => process.env.BITCOIN_API_URL || 'https://blockstream.info/api',
    explorer: 'https://blockstream.info',
  },
};

const SUPPORTED_CHAINS = Object.keys(CHAINS);

function getChain(chain) {
  const c = CHAINS[(chain || '').toLowerCase()];
  if (!c) throw new Error(`Unsupported chain: ${chain}`);
  return c;
}

/* ----------------------------- tiny TTL cache ----------------------------- */
const _cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  const hit = _cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { _cache.delete(key); return null; }
  return hit.value;
}
function cacheSet(key, value, ttl = DEFAULT_TTL) {
  _cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

/* ----------------------------- validation ----------------------------- */
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BTC_RE = /^(bc1[0-9a-z]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

function validateAddress(chain, address) {
  if (!address || typeof address !== 'string') return false;
  const c = getChain(chain);
  if (c.kind === 'evm') return ethers.isAddress(address);
  if (c.kind === 'solana') return SOLANA_RE.test(address);
  if (c.kind === 'bitcoin') return BTC_RE.test(address);
  return false;
}

/** Normalize an address for storage (EVM → lowercase). */
function normalizeAddress(chain, address) {
  const c = getChain(chain);
  if (c.kind === 'evm') return (address || '').toLowerCase();
  return address;
}

/* ----------------------------- providers ----------------------------- */
const _providers = {};
function evmProvider(chain) {
  const c = getChain(chain);
  if (!_providers[chain]) {
    _providers[chain] = new ethers.JsonRpcProvider(c.rpc(), c.chainId, { staticNetwork: true });
  }
  return _providers[chain];
}

async function solanaRpc(method, params) {
  const c = CHAINS.solana;
  const res = await fetch(c.rpc(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'Solana RPC error');
  return json.result;
}

/* ----------------------------- balances ----------------------------- */
async function getBalance(chain, address) {
  if (!validateAddress(chain, address)) throw new Error('Invalid address for chain');
  const key = `bal:${chain}:${address}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const c = getChain(chain);
  let result;

  if (c.kind === 'evm') {
    const provider = evmProvider(chain);
    const wei = await provider.getBalance(address);
    result = {
      chain: c.id, symbol: c.symbol, address,
      native: ethers.formatEther(wei),
      nativeRaw: wei.toString(),
      tokens: [],
    };
  } else if (c.kind === 'solana') {
    const lamports = await solanaRpc('getBalance', [address]);
    const sol = (lamports?.value ?? 0) / 1e9;
    // SPL token accounts
    let tokens = [];
    try {
      const tk = await solanaRpc('getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]);
      tokens = (tk?.value || []).map((acc) => {
        const info = acc.account?.data?.parsed?.info;
        const amt = info?.tokenAmount;
        return {
          mint: info?.mint,
          amount: amt?.uiAmountString || '0',
          decimals: amt?.decimals,
          symbol: (info?.mint || '').slice(0, 4).toUpperCase(),
        };
      }).filter((t) => Number(t.amount) > 0).slice(0, 25);
    } catch { /* tokens optional */ }
    result = { chain: c.id, symbol: c.symbol, address, native: String(sol), nativeRaw: String(lamports?.value ?? 0), tokens };
  } else if (c.kind === 'bitcoin') {
    const res = await fetch(`${c.rpc()}/address/${address}`);
    if (!res.ok) throw new Error(`Bitcoin API ${res.status}`);
    const data = await res.json();
    const funded = data.chain_stats?.funded_txo_sum || 0;
    const spent = data.chain_stats?.spent_txo_sum || 0;
    const sats = funded - spent;
    result = { chain: c.id, symbol: c.symbol, address, native: String(sats / 1e8), nativeRaw: String(sats), tokens: [] };
  } else {
    throw new Error('Unsupported chain kind');
  }

  return cacheSet(key, result);
}

/* ----------------------------- transactions ----------------------------- */
async function getTransactions(chain, address, limit = 20) {
  if (!validateAddress(chain, address)) throw new Error('Invalid address for chain');
  const key = `tx:${chain}:${address}:${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const c = getChain(chain);
  let txs = [];

  try {
    if (c.kind === 'evm') {
      const url = `${c.explorerApi}?module=account&action=txlist&address=${address}` +
        `&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=${c.explorerApiKey()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data.result)) {
        txs = data.result.slice(0, limit).map((t) => ({
          hash: t.hash,
          type: t.from?.toLowerCase() === address.toLowerCase() ? 'sent' : 'received',
          from: t.from, to: t.to,
          amount: ethers.formatEther(t.value || '0'),
          symbol: c.symbol,
          timestamp: t.timeStamp ? new Date(Number(t.timeStamp) * 1000).toISOString() : null,
          status: t.isError === '0' ? 'success' : 'failed',
          explorerUrl: `${c.explorer}/tx/${t.hash}`,
        }));
      }
    } else if (c.kind === 'solana') {
      const sigs = await solanaRpc('getSignaturesForAddress', [address, { limit }]);
      txs = (sigs || []).map((s) => ({
        hash: s.signature,
        type: 'transfer',
        amount: null,
        symbol: c.symbol,
        timestamp: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        status: s.err ? 'failed' : 'success',
        explorerUrl: `${c.explorer}/tx/${s.signature}`,
      }));
    } else if (c.kind === 'bitcoin') {
      const res = await fetch(`${c.rpc()}/address/${address}/txs`);
      const data = await res.json();
      txs = (Array.isArray(data) ? data : []).slice(0, limit).map((t) => {
        const received = (t.vout || []).some((o) => o.scriptpubkey_address === address);
        return {
          hash: t.txid,
          type: received ? 'received' : 'sent',
          amount: null,
          symbol: c.symbol,
          timestamp: t.status?.block_time ? new Date(t.status.block_time * 1000).toISOString() : null,
          status: t.status?.confirmed ? 'success' : 'pending',
          explorerUrl: `${c.explorer}/tx/${t.txid}`,
        };
      });
    }
  } catch (err) {
    console.error(`getTransactions(${chain}) failed:`, err.message);
    txs = [];
  }

  const result = { chain: c.id, address, count: txs.length, transactions: txs };
  return cacheSet(key, result, 2 * 60 * 1000); // 2 min TTL for tx
}

/* ----------------------------- signature verify ----------------------------- */
/**
 * Verify an EVM personal_sign signature (SIWE-style ownership proof).
 * Returns true if the recovered address matches the claimed address.
 */
function verifyEvmSignature(message, signature, address) {
  try {
    const recovered = ethers.verifyMessage(message, signature);
    return recovered.toLowerCase() === (address || '').toLowerCase();
  } catch (err) {
    console.error('verifyEvmSignature error:', err.message);
    return false;
  }
}

/** Build the canonical SIWE-style message the frontend should ask the user to sign. */
function buildSiweMessage({ address, nonce, domain = 'solaris-health.abacusai.cloud' }) {
  const issuedAt = new Date().toISOString();
  return (
    `${domain} wants you to sign in with your Ethereum account:\n${address}\n\n` +
    `Sign in to verify wallet ownership for your LUCA Passport. This request will not trigger a transaction or cost gas.\n\n` +
    `URI: https://${domain}\nVersion: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`
  );
}

module.exports = {
  CHAINS,
  SUPPORTED_CHAINS,
  getChain,
  validateAddress,
  normalizeAddress,
  getBalance,
  getTransactions,
  verifyEvmSignature,
  buildSiweMessage,
};

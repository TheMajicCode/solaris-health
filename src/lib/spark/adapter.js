/**
 * spark/adapter.js — lazy, CLIENT-ONLY adapter around @buildonspark/spark-sdk (spec §4).
 *
 * HARD RULES enforced here:
 *   - The Spark SDK is imported LAZILY and only in the browser. It is NEVER
 *     imported by Express/backend code.
 *   - Wallet creation is SINGLE-FLIGHT: concurrent presses share one in-flight
 *     promise; the caller must also disable duplicate presses. We NEVER auto-retry.
 *   - The wallet object and its BIP-39 recovery words live in MEMORY ONLY. Nothing
 *     here writes to localStorage/sessionStorage/cookies/SW-cache/API/DB/logs.
 *   - accountNumber is always 0. The network comes from validated config only.
 *   - cleanupConnections() releases the active wallet's connections on error,
 *     replacement, unmount, logout, and forget.
 *   - Agents/automated tests must NOT invoke live initialization. A deterministic,
 *     non-secret demo fixture path (`fixtureMnemonic`) renders the backup gate
 *     without any live SparkWallet.initialize() or network access.
 */

// A deterministic, obviously-fake, NON-SECRET demo mnemonic (NATO alphabet).
// It is NOT a real wallet, is never persisted, and never touches the network.
// Used only to exercise/screenshot the backup-gate UI (spec §7.6).
export const DEMO_FIXTURE_MNEMONIC =
  'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';

let _inflight = null;      // single-flight guard (create OR restore)
let _activeWallet = null;  // in-memory wallet object (never persisted)

function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('The Spark wallet is only available in the browser.');
  }
}

async function loadSdk() {
  assertBrowser();
  // Lazy, client-only dynamic import — keeps the SDK out of the initial bundle
  // and out of any server/SSR path.
  return import('@buildonspark/spark-sdk');
}

/**
 * Validate mnemonic SHAPE only (do not hardcode 12-vs-24). BIP-39 phrases are
 * lowercase words; standard lengths are 12/15/18/21/24. We never log the words.
 */
export function looksLikeMnemonic(input) {
  const tokens = String(input || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (![12, 15, 18, 21, 24].includes(tokens.length)) return false;
  return tokens.every((w) => /^[a-z]+$/.test(w));
}

/** Randomly pick `n` distinct 1-based word positions from a mnemonic. */
export function pickWordPositions(mnemonic, n = 3) {
  const count = String(mnemonic || '').trim().split(/\s+/).filter(Boolean).length;
  if (count < n) return [];
  const chosen = new Set();
  while (chosen.size < n) chosen.add(1 + Math.floor(Math.random() * count));
  return Array.from(chosen).sort((a, b) => a - b);
}

/** Read the nth (1-based) word of a mnemonic. */
export function wordAt(mnemonic, pos) {
  const words = String(mnemonic || '').trim().split(/\s+/).filter(Boolean);
  return words[pos - 1] || '';
}

/**
 * Generate a brand-new Spark wallet (single-flight). When `fixtureMnemonic` is
 * provided (demo/tests) NO live SDK call happens. Otherwise the real SDK creates
 * the wallet and returns its SDK-generated recovery words.
 * @returns {Promise<{mnemonic:string, wallet:object|null, fixture:boolean}>}
 */
export function createSparkWallet({ network, fixtureMnemonic } = {}) {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    if (fixtureMnemonic) {
      return { mnemonic: fixtureMnemonic, wallet: null, fixture: true };
    }
    const { SparkWallet } = await loadSdk();
    // Live key creation is a HUMAN-GATED step — never run by an agent/test.
    const res = await SparkWallet.initialize({ accountNumber: 0, options: { network } });
    await cleanupConnections(); // release any prior wallet before adopting the new one
    _activeWallet = res.wallet;
    return { mnemonic: res.mnemonic, wallet: res.wallet, fixture: false };
  })();
  return _inflight.finally(() => { _inflight = null; });
}

/**
 * Restore an existing Spark wallet from recovery words (single-flight). Shape is
 * validated before any SDK call. Demo/tests pass `fixture:true` to avoid live init.
 * @returns {Promise<{wallet:object|null, fixture:boolean}>}
 */
export function restoreSparkWallet({ network, mnemonic, fixture } = {}) {
  if (_inflight) return _inflight;
  if (!looksLikeMnemonic(mnemonic)) {
    return Promise.reject(new Error('Those recovery words do not look right. Check them and try again.'));
  }
  _inflight = (async () => {
    if (fixture) return { wallet: null, fixture: true };
    const { SparkWallet } = await loadSdk();
    const res = await SparkWallet.initialize({
      mnemonicOrSeed: String(mnemonic).trim().toLowerCase(),
      accountNumber: 0,
      options: { network },
    });
    await cleanupConnections();
    _activeWallet = res.wallet;
    return { wallet: res.wallet, fixture: false };
  })();
  return _inflight.finally(() => { _inflight = null; });
}

/** Release the active wallet's connections and drop the in-memory reference. */
export async function cleanupConnections() {
  const w = _activeWallet;
  _activeWallet = null;
  if (w && typeof w.cleanupConnections === 'function') {
    try { await w.cleanupConnections(); } catch { /* best-effort teardown */ }
  }
}

/** True while a create/restore is in flight (for disabling duplicate presses). */
export function isSparkBusy() { return _inflight !== null; }

/**
 * Classify a PUBLIC Spark address for the optional address-linking consent.
 * spark1… → spark-mainnet ; sparkrt1… → spark-regtest. No secret involved.
 * @returns {{ok:true, chain:string, address:string}|{ok:false, reason:string}}
 */
export function classifySparkAddress(addr) {
  const a = String(addr || '').trim();
  if (/^sparkrt1[0-9a-z]+$/i.test(a)) return { ok: true, chain: 'spark-regtest', address: a };
  if (/^spark1[0-9a-z]+$/i.test(a)) return { ok: true, chain: 'spark-mainnet', address: a };
  return { ok: false, reason: 'That is not a recognised Spark address (expected spark1… or sparkrt1…).' };
}

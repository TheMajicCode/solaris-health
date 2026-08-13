/**
 * SparkWalletContext — the ONE client-side Spark wallet owner (spec §1).
 *
 * This provider mounts once at the app root (inside AppProvider) and owns the
 * single active SDK wallet instance across onboarding AND the authenticated app.
 * The underlying wallet object + recovery words live in the adapter's in-memory
 * singleton; this context is the React mirror of its PUBLIC, safe-to-show state
 * (address, balance, network, status). It NEVER holds or exposes a mnemonic and
 * never sends any secret over the network.
 *
 * Responsibilities:
 *   - init only after an explicit user action (onboarding create/restore, or an
 *     unlock-from-vault in the Economic Passport). This context never auto-inits.
 *   - single active instance; adopt() replaces any prior one via the adapter.
 *   - expose address, balance (sats), network, loading/error, refresh, send,
 *     receive (address + Lightning invoice), and cleanup.
 *   - prevent duplicate sends (adapter single-flight) — send() is also guarded.
 *   - on logout (user → null) clear the active wallet + plaintext state from
 *     memory and cleanupConnections(). The encrypted device vault is preserved.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from './AppContext.jsx';
import { readSparkConfig } from '../lib/spark/config.js';
import {
  restoreSparkWallet, cleanupConnections, hasActiveWallet,
  walletGetAddress, walletGetBalanceSats, walletTransfer,
  walletCreateLightningInvoice, isSparkSending,
} from '../lib/spark/adapter.js';
import {
  hasVault, saveVaultMnemonic, loadVaultMnemonic, VAULT_STATUS_TEXT,
} from '../lib/spark/vault.js';

const SparkWalletContext = createContext(null);
export const useSparkWallet = () => useContext(SparkWalletContext);

export function SparkWalletProvider({ children }) {
  const app = useApp();
  const user = app?.user ?? null;

  const cfg = readSparkConfig();
  const [status, setStatus] = useState('idle');   // idle | ready | locked
  const [address, setAddress] = useState('');
  const [balanceSats, setBalanceSats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vaultPresent, setVaultPresent] = useState(false);

  const prevUserRef = useRef(user);

  // Detect whether a vault exists on this device (drives the "locked" state).
  const refreshVaultPresence = useCallback(async () => {
    try { const present = await hasVault(); setVaultPresent(present); return present; }
    catch { setVaultPresent(false); return false; }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const present = await refreshVaultPresence();
      if (!alive) return;
      // If a wallet is already active in memory (e.g. adopted during onboarding),
      // reflect it; otherwise show locked when a vault exists, else idle.
      if (hasActiveWallet()) setStatus('ready');
      else setStatus(present ? 'locked' : 'idle');
    })();
    return () => { alive = false; };
  }, [refreshVaultPresence]);

  /** Refresh the public balance of the active wallet. */
  const refresh = useCallback(async () => {
    if (!hasActiveWallet()) return;
    setLoading(true); setError('');
    try {
      const [addr, sats] = await Promise.all([walletGetAddress(), walletGetBalanceSats()]);
      setAddress(addr); setBalanceSats(sats); setStatus('ready');
    } catch (e) {
      setError('Could not refresh the wallet right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Adopt the wallet that onboarding just created/restored into memory. The
   * adapter already holds the active instance; here we read its PUBLIC state and,
   * when a passphrase + mnemonic are provided, persist the encrypted vault.
   */
  const adopt = useCallback(async ({ mnemonic, passphrase } = {}) => {
    setError('');
    if (mnemonic && passphrase) {
      try { await saveVaultMnemonic(mnemonic, passphrase); await refreshVaultPresence(); }
      catch (e) { setError(e?.message || 'Could not encrypt the wallet on this device.'); throw e; }
    }
    if (hasActiveWallet()) {
      await refresh();
    } else {
      // Fixture / no live wallet (tests, demo). Nothing to reflect.
      setStatus((s) => (s === 'idle' ? 'idle' : s));
    }
  }, [refresh, refreshVaultPresence]);

  /** Unlock the wallet from the encrypted device vault using the passphrase. */
  const unlockFromVault = useCallback(async (passphrase) => {
    if (!cfg.enabled) throw new Error(cfg.reason || 'The Spark wallet is turned off in this build.');
    setLoading(true); setError('');
    let mnemonic = '';
    try {
      mnemonic = await loadVaultMnemonic(passphrase);          // memory only
      await restoreSparkWallet({ network: cfg.network, mnemonic });
      mnemonic = '';                                            // drop plaintext ASAP
      await refresh();
      return true;
    } catch (e) {
      mnemonic = '';
      await cleanupConnections();
      setError(e?.message || 'Could not unlock the wallet.');
      setLoading(false);
      throw e;
    }
  }, [cfg.enabled, cfg.network, cfg.reason, refresh]);

  /** Lock the wallet — drop the active instance from memory (keep the vault). */
  const lockWallet = useCallback(async () => {
    await cleanupConnections();
    setAddress(''); setBalanceSats(null); setError('');
    const present = await refreshVaultPresence();
    setStatus(present ? 'locked' : 'idle');
  }, [refreshVaultPresence]);

  /** Send sats (single-flight via the adapter). Refreshes balance on success. */
  const send = useCallback(async ({ toAddress, amountSats }) => {
    setError('');
    const transfer = await walletTransfer({ amountSats, receiverSparkAddress: toAddress });
    await refresh();
    return transfer;
  }, [refresh]);

  /** Create a BOLT11 Lightning invoice to receive sats. */
  const createInvoice = useCallback(async ({ amountSats, memo }) => {
    setError('');
    return walletCreateLightningInvoice({ amountSats, memo });
  }, []);

  // Logout / session-end: user goes from set → null. Clear the active wallet and
  // plaintext state from memory; PRESERVE the encrypted vault on disk.
  useEffect(() => {
    const prev = prevUserRef.current;
    if (prev && !user) {
      (async () => {
        await cleanupConnections();
        setAddress(''); setBalanceSats(null); setError(''); setLoading(false);
        const present = await refreshVaultPresence();
        setStatus(present ? 'locked' : 'idle');
      })();
    }
    prevUserRef.current = user;
  }, [user, refreshVaultPresence]);

  // Final disposal on unmount.
  useEffect(() => () => { cleanupConnections(); }, []);

  const value = {
    enabled: cfg.enabled,
    network: cfg.enabled ? cfg.network : null,
    disabledReason: cfg.enabled ? '' : cfg.reason,
    status, address, balanceSats, loading, error, vaultPresent,
    vaultStatusText: VAULT_STATUS_TEXT,
    refresh, adopt, unlockFromVault, lockWallet, send, createInvoice,
    isSending: isSparkSending,
    setError,
  };

  return (
    <SparkWalletContext.Provider value={value}>
      {children}
    </SparkWalletContext.Provider>
  );
}

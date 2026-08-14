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
 * ACCOUNT SCOPING (correction §1):
 *   - Every vault op is namespaced to the authenticated Solaris `user.id`.
 *   - A SINGLE effect keyed on user.id owns the lifecycle. On a real account
 *     change (including logout) it FIRST cleans up the previously-active wallet
 *     (cleanupConnections) and clears plaintext state, THEN inspects the NEXT
 *     account's vault. Account A can never see/unlock/overwrite account B's vault.
 *   - Logout preserves the encrypted vault on disk (only in-memory secrets are
 *     dropped). clearVault() is never called here.
 *   - The legacy GLOBAL v1 vault is NEVER auto-attached; it is only surfaced as a
 *     one-time explicit migration offer (migrateLegacy).
 *
 * PRIVACY (correction §4): reflects the SDK wallet privacy setting (BTC history
 * hidden from public Spark endpoints) and lets the user explicitly toggle it.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useApp } from './AppContext.jsx';
import { api } from '../lib/api.js';
import { readSparkConfig } from '../lib/spark/config.js';
import {
  restoreSparkWallet, cleanupConnections, hasActiveWallet,
  walletGetAddress, walletGetBalanceSats, walletTransfer,
  walletCreateLightningInvoice, isSparkSending,
  sparkPrivacySupported, walletGetWalletSettings, walletSetPrivacyEnabled,
} from '../lib/spark/adapter.js';
import {
  hasVault, hasLegacyVault, saveVaultMnemonic, loadVaultMnemonic,
  migrateLegacyVault, VAULT_STATUS_TEXT,
} from '../lib/spark/vault.js';

const SparkWalletContext = createContext(null);
export const useSparkWallet = () => useContext(SparkWalletContext);

// Sentinel so the first run of the lifecycle effect is distinguishable from a
// real account change (initial mount must NOT tear down an onboarding wallet).
const NO_PREV_USER = Symbol('no-prev-user');

export function SparkWalletProvider({ children }) {
  const app = useApp();
  const user = app?.user ?? null;
  const userId = user?.id ?? null;

  const cfg = readSparkConfig();
  const [status, setStatus] = useState('idle');   // idle | ready | locked
  const [address, setAddress] = useState('');
  const [balanceSats, setBalanceSats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [vaultPresent, setVaultPresent] = useState(false);
  const [legacyPresent, setLegacyPresent] = useState(false);
  const [privacy, setPrivacy] = useState({
    supported: sparkPrivacySupported(), enabled: false, loading: false, error: '',
  });

  const prevUserIdRef = useRef(NO_PREV_USER);

  // Detect whether an account-scoped vault (and/or an unmigrated legacy vault)
  // exists on this device. Legacy is only "present" (offerable) when THIS account
  // has no scoped vault yet.
  const refreshVaultPresence = useCallback(async (uid) => {
    let present = false;
    try { present = await hasVault(uid); } catch { present = false; }
    setVaultPresent(present);
    let legacy = false;
    if (uid && !present) {
      try { legacy = await hasLegacyVault(); } catch { legacy = false; }
    }
    setLegacyPresent(legacy);
    return present;
  }, []);

  /** Refresh the SDK privacy setting for the active wallet. */
  const refreshPrivacy = useCallback(async () => {
    if (!sparkPrivacySupported() || !hasActiveWallet()) {
      setPrivacy((p) => ({ ...p, loading: false }));
      return;
    }
    setPrivacy((p) => ({ ...p, loading: true, error: '' }));
    try {
      const s = await walletGetWalletSettings();
      setPrivacy((p) => ({ ...p, enabled: !!s?.privateEnabled, loading: false, error: '' }));
    } catch {
      setPrivacy((p) => ({ ...p, loading: false, error: 'Could not read the privacy setting right now.' }));
    }
  }, []);

  /** Refresh the public balance + privacy of the active wallet. */
  const refresh = useCallback(async () => {
    if (!hasActiveWallet()) return;
    setLoading(true); setError('');
    try {
      const [addr, sats] = await Promise.all([walletGetAddress(), walletGetBalanceSats()]);
      setAddress(addr); setBalanceSats(sats); setStatus('ready');
      await refreshPrivacy();
    } catch (e) {
      setError('Could not refresh the wallet right now.');
    } finally {
      setLoading(false);
    }
  }, [refreshPrivacy]);

  // SINGLE lifecycle effect keyed on userId. Handles initial mount, login, logout,
  // and account switch. On a real change it cleans up the prior active wallet
  // BEFORE inspecting the next account's vault (correction §1).
  useEffect(() => {
    let alive = true;
    (async () => {
      const prevId = prevUserIdRef.current;
      // A destructive change is ONLY a transition away from a REAL previously-
      // active account: either a logout (realId -> null) or an account switch
      // (realA -> realB). The activation of an account at the END of onboarding
      // is a null -> realId transition and must NOT tear down the wallet that
      // onboarding just created in memory (correction §1).
      const prevWasReal = prevId !== NO_PREV_USER && prevId !== null;
      const isRealChange = prevWasReal && prevId !== userId;

      if (isRealChange) {
        // Tear down the previously-active wallet + plaintext state FIRST.
        await cleanupConnections();
        if (!alive) return;
        setAddress(''); setBalanceSats(null); setError(''); setLoading(false);
        setPrivacy((p) => ({ ...p, enabled: false, loading: false, error: '' }));
      }

      const present = await refreshVaultPresence(userId);
      if (!alive) return;

      // On initial mount an onboarding wallet may already be active in memory.
      if (!isRealChange && hasActiveWallet()) {
        setStatus('ready');
        await refresh();
      } else {
        setStatus(present ? 'locked' : 'idle');
      }
      prevUserIdRef.current = userId;
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /**
   * Resolve the authenticated Solaris user id (the UUID the vault is keyed on).
   * During onboarding the account is registered (API token set) BEFORE the React
   * `user` is activated at finalize, so `userId` can still be null on the wallet
   * step. In that window we fall back to the authenticated `/users/me` id so the
   * vault is persisted under the real account UUID — never the token or email.
   */
  const resolveUserId = useCallback(async () => {
    if (userId) return userId;
    if (api?.token) {
      try { const { user: me } = await api.getMe(); return me?.id ?? null; }
      catch { return null; }
    }
    return null;
  }, [userId]);

  /**
   * Adopt the wallet that onboarding just created/restored into memory. The
   * adapter already holds the active instance; here we read its PUBLIC state and,
   * when a passphrase + mnemonic are provided, persist the account-scoped vault.
   */
  const adopt = useCallback(async ({ mnemonic, passphrase } = {}) => {
    setError('');
    if (mnemonic && passphrase) {
      const uid = await resolveUserId();
      if (!uid) { const err = new Error('Sign in to save this wallet to your account.'); setError(err.message); throw err; }
      try { await saveVaultMnemonic(uid, mnemonic, passphrase); await refreshVaultPresence(uid); }
      catch (e) { setError(e?.message || 'Could not encrypt the wallet on this device.'); throw e; }
    }
    if (hasActiveWallet()) {
      await refresh();
    } else {
      setStatus((s) => (s === 'idle' ? 'idle' : s));
    }
  }, [resolveUserId, refresh, refreshVaultPresence]);

  /** Unlock THIS account's wallet from its encrypted device vault. */
  const unlockFromVault = useCallback(async (passphrase) => {
    if (!cfg.enabled) throw new Error(cfg.reason || 'The Spark wallet is turned off in this build.');
    if (!userId) throw new Error('Sign in to unlock your wallet.');
    setLoading(true); setError('');
    let mnemonic = '';
    try {
      mnemonic = await loadVaultMnemonic(userId, passphrase);   // memory only
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
  }, [cfg.enabled, cfg.network, cfg.reason, userId, refresh]);

  /**
   * One-time explicit migration of the legacy GLOBAL v1 vault into THIS account's
   * scoped v2 vault. On success the wallet becomes lockable (status → locked).
   */
  const migrateLegacy = useCallback(async (passphrase) => {
    if (!userId) throw new Error('Sign in to move the legacy wallet into your account.');
    setLoading(true); setError('');
    try {
      await migrateLegacyVault(userId, passphrase);
      const present = await refreshVaultPresence(userId);
      setStatus(present ? 'locked' : 'idle');
      return true;
    } catch (e) {
      setError(e?.message || 'Could not move the legacy wallet.');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [userId, refreshVaultPresence]);

  /** Lock the wallet — drop the active instance from memory (keep the vault). */
  const lockWallet = useCallback(async () => {
    await cleanupConnections();
    setAddress(''); setBalanceSats(null); setError('');
    setPrivacy((p) => ({ ...p, enabled: false, loading: false, error: '' }));
    const present = await refreshVaultPresence(userId);
    setStatus(present ? 'locked' : 'idle');
  }, [userId, refreshVaultPresence]);

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

  /** Explicitly enable/disable Bitcoin transaction privacy via the SDK. */
  const setPrivacyEnabled = useCallback(async (enabled) => {
    if (!sparkPrivacySupported()) throw new Error('Privacy control is unavailable in this preview SDK.');
    if (!hasActiveWallet()) throw new Error('Unlock your wallet to change its privacy setting.');
    setPrivacy((p) => ({ ...p, loading: true, error: '' }));
    try {
      const s = await walletSetPrivacyEnabled(enabled);
      setPrivacy((p) => ({ ...p, enabled: (s ? !!s.privateEnabled : !!enabled), loading: false, error: '' }));
      return true;
    } catch (e) {
      setPrivacy((p) => ({ ...p, loading: false, error: 'Could not change the privacy setting right now.' }));
      throw e;
    }
  }, []);

  // Final disposal on unmount.
  useEffect(() => () => { cleanupConnections(); }, []);

  const value = {
    enabled: cfg.enabled,
    network: cfg.enabled ? cfg.network : null,
    disabledReason: cfg.enabled ? '' : cfg.reason,
    status, address, balanceSats, loading, error, vaultPresent, legacyPresent,
    vaultStatusText: VAULT_STATUS_TEXT,
    privacy, setPrivacyEnabled, refreshPrivacy,
    refresh, adopt, unlockFromVault, lockWallet, migrateLegacy, send, createInvoice,
    isSending: isSparkSending,
    setError,
  };

  return (
    <SparkWalletContext.Provider value={value}>
      {children}
    </SparkWalletContext.Provider>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wallet, ShieldCheck, Eye, EyeOff, Loader2, Check, Link2, AlertTriangle, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { readSparkConfig, isSparkDemoFixture } from '../lib/spark/config.js';
import {
  createSparkWallet, restoreSparkWallet, cleanupConnections, looksLikeMnemonic,
  classifySparkAddress, DEMO_FIXTURE_MNEMONIC,
} from '../lib/spark/adapter.js';
import { VAULT_STATUS_TEXT } from '../lib/spark/vault.js';
import { useSparkWallet } from '../state/SparkWalletContext.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 * SparkWalletCard — the optional "Reclaim Your Wealth" Spark surface (spec §4/§2A).
 *
 * SAFETY: the wallet object and its recovery words live in COMPONENT MEMORY ONLY.
 * Nothing here writes them to storage, the API, logs, or the DOM beyond the
 * single deliberate reveal. Creation is single-flight (buttons disable while
 * busy) and never auto-retries; cleanupConnections() runs on unmount/replacement/
 * error. Live SparkWallet.initialize() is a human-gated step — when the build sets
 * VITE_SPARK_DEMO_FIXTURE=true the backup gate is exercised with a deterministic,
 * non-secret fixture and no live init or network access.
 *
 * Beta-safe copy (spec §2A) is used verbatim; no over-broad custody/privacy claims.
 * ──────────────────────────────────────────────────────────────────────────── */

const SCREEN2_SAFE_COPY =
  'Spark wallet recovery words are created on this device by the enabled wallet software. '
  + 'Keep them private. Solaris does not store them. Network availability, fees, recovery '
  + 'limits, and service behavior depend on the wallet and network.';

export default function SparkWalletCard({ onWalletReady }) {
  const cfg = useMemo(() => readSparkConfig(), []);
  const demoFixture = useMemo(() => isSparkDemoFixture(), []);
  const spark = useSparkWallet();

  // mode: idle | generating | backup | passphrase | restore | restoring | ready
  const [mode, setMode] = useState('idle');
  const [mnemonic, setMnemonic] = useState('');     // memory only
  const [reveal, setReveal] = useState(false);
  const [ack, setAck] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Device unlock passphrase step — required before the encrypted same-device
  // vault is written (spec §2/§3). The passphrase lives in memory only.
  const [passphrase, setPassphrase] = useState('');
  const [passphrase2, setPassphrase2] = useState('');
  const [backedUpFlag, setBackedUpFlag] = useState(true); // true=generate path, false=restore path
  const secretForVault = useRef('');                       // mnemonic pending encryption (memory only)

  // Optional PUBLIC-address linking — a SEPARATE, unchecked consent (spec §4).
  const [linkConsent, setLinkConsent] = useState(false);
  const [linkAddr, setLinkAddr] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [linked, setLinked] = useState(null); // { chain, address }

  const unmounted = useRef(false);
  const adoptedRef = useRef(false); // true once the app-root provider owns the wallet
  useEffect(() => {
    unmounted.current = false; // reset on (re)mount — StrictMode/dev remounts this instance
    // On unmount only release an ORPHAN wallet (abandoned mid-flow). Once adopted
    // by the app-root SparkWalletProvider, the wallet must stay live into Solaris.
    return () => { unmounted.current = true; if (!adoptedRef.current) cleanupConnections(); };
  }, []);

  const maskedWords = useMemo(
    () => (mnemonic ? mnemonic.split(/\s+/).map((w) => '•'.repeat(Math.max(4, w.length))).join(' ') : ''),
    [mnemonic],
  );

  const resetSecretState = () => {
    setMnemonic(''); setReveal(false); setAck(false);
    setPassphrase(''); setPassphrase2(''); secretForVault.current = '';
  };

  const doGenerate = async () => {
    if (busy) return; // single-flight + disable duplicate presses
    setError(''); setBusy(true); setMode('generating');
    try {
      const res = await createSparkWallet({
        network: cfg.network,
        fixtureMnemonic: demoFixture ? DEMO_FIXTURE_MNEMONIC : undefined,
      });
      if (unmounted.current) { await cleanupConnections(); return; }
      setMnemonic(res.mnemonic);
      setReveal(false); setAck(false);
      setMode('backup');
    } catch (e) {
      await cleanupConnections();
      resetSecretState();
      setMode('idle');
      setError(e?.message ? 'Could not create a Spark wallet right now.' : 'Could not create a Spark wallet right now.');
    } finally {
      if (!unmounted.current) setBusy(false);
    }
  };

  const confirmBackup = () => {
    if (!ack) {
      setError('Please confirm you have saved your recovery words to continue.');
      return;
    }
    setError('');
    // Carry the recovery words into the passphrase step (memory only) so the
    // encrypted same-device vault can be written before we finish.
    secretForVault.current = mnemonic;
    setBackedUpFlag(true);
    setMode('passphrase');
  };

  // Encrypt the recovery words into the same-device vault under a user-entered
  // unlock passphrase, then keep the active wallet available and finish (spec §2/§3).
  const savePassphraseAndFinish = async () => {
    if (busy) return;
    setError('');
    if (passphrase.length < 12) { setError('Use an unlock passphrase of at least 12 characters.'); return; }
    if (passphrase !== passphrase2) { setError('The two passphrases do not match.'); return; }
    setBusy(true);
    try {
      await spark.adopt({ mnemonic: secretForVault.current, passphrase });
      adoptedRef.current = true; // provider now owns the wallet — don't release on unmount
      // Drop every plaintext secret from memory; the active wallet stays live.
      secretForVault.current = '';
      setMnemonic(''); setPassphrase(''); setPassphrase2(''); setReveal(false); setAck(false);
      setMode('ready');
      if (onWalletReady) onWalletReady({ backedUp: backedUpFlag });
    } catch (e) {
      setError(e?.message || 'Could not secure the wallet on this device.');
    } finally {
      if (!unmounted.current) setBusy(false);
    }
  };

  const doRestore = async () => {
    if (busy) return;
    setError('');
    if (!looksLikeMnemonic(restoreInput)) {
      setError('Those recovery words do not look right. Check them and try again.');
      return;
    }
    setBusy(true); setMode('restoring');
    try {
      await restoreSparkWallet({ network: cfg.network, mnemonic: restoreInput, fixture: demoFixture });
      if (unmounted.current) { await cleanupConnections(); return; }
      // Carry the restored words into the passphrase step (memory only), then clear input.
      secretForVault.current = restoreInput.trim().toLowerCase();
      setRestoreInput('');
      setBackedUpFlag(false);
      setMode('passphrase');
    } catch (e) {
      await cleanupConnections();
      setMode('restore');
      setError(e?.message || 'That wallet could not be restored. Check the words and try again.');
    } finally {
      if (!unmounted.current) setBusy(false);
    }
  };

  const linkAddress = async () => {
    setLinkErr(''); setLinkMsg('');
    const c = classifySparkAddress(linkAddr);
    if (!c.ok) { setLinkErr(c.reason); return; }
    try {
      // Reuse the existing wallet_addresses / /api/wallet boundary. No secret is
      // sent; the address stays verified=false server-side. Idempotent on
      // (user_id, chain, address).
      await api.connectWallet({ chain: c.chain, address: c.address });
      setLinked({ chain: c.chain, address: c.address });
      setLinkMsg('Public address linked (unverified).');
    } catch (e) {
      setLinkErr(e?.message || 'Could not link that address right now.');
    }
  };

  const unlinkAddress = async () => {
    // Optimistic local unlink for the demo surface; server unlink uses the same
    // boundary when an id is available. No secret involved either way.
    setLinked(null); setLinkMsg(''); setLinkErr(''); setLinkAddr('');
  };

  return (
    <div className="spk">
      {/* ── Spark card ── */}
      <div className="spk-card">
        <div className="spk-head">
          <span className="spk-title"><Wallet size={16} /> Create your digital gold wallet</span>
          <span className="spk-badge spk-badge-spark">Powered by Spark</span>
        </div>
        <p className="spk-safe">{SCREEN2_SAFE_COPY}</p>

        {cfg.enabled ? (
          <>
            <p className="spk-net">Active network: <b>{cfg.network}</b>{demoFixture ? ' · demo fixture (no live init)' : ''}</p>

            {(mode === 'idle' || mode === 'generating') && (
              <>
                <button className="spk-btn" onClick={doGenerate} disabled={busy} aria-busy={busy}>
                  {mode === 'generating' ? <><Loader2 size={15} className="spk-spin" /> Creating…</> : 'Generate my Spark wallet'}
                </button>
                <button className="spk-btn spk-btn-ghost" onClick={() => { setError(''); setMode('restore'); }} disabled={busy}>
                  Restore an existing Spark wallet
                </button>
              </>
            )}

            {mode === 'restore' && (
              <div className="spk-restore">
                <label className="spk-label" htmlFor="spk-restore-input">Enter your recovery words</label>
                <textarea
                  id="spk-restore-input" className="input" rows={3}
                  value={restoreInput} onChange={(e) => setRestoreInput(e.target.value)}
                  placeholder="word1 word2 word3 …" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <button className="spk-btn" onClick={doRestore} disabled={busy} aria-busy={busy}>
                  {busy ? <><Loader2 size={15} className="spk-spin" /> Restoring…</> : 'Restore wallet'}
                </button>
                <button className="spk-btn spk-btn-ghost" onClick={() => { setError(''); setMode('idle'); }} disabled={busy}>
                  Back
                </button>
              </div>
            )}

            {mode === 'backup' && (
              <div className="spk-backup">
                <div className="spk-warn">
                  <p className="spk-warn-title"><ShieldCheck size={14} /> Before you continue</p>
                  <ol className="spk-warn-list">
                    <li>These recovery words are shown once. Write them down and keep them private.</li>
                    <li>Never share this secret. Anyone who has it can act as you.</li>
                    <li>Solaris does not store them and cannot recover them for you.</li>
                  </ol>
                </div>

                <div className="spk-words-head">
                  <span className="spk-label">Recovery words</span>
                  <button className="spk-reveal" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide recovery words' : 'Reveal recovery words'}>
                    {reveal ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Reveal</>}
                  </button>
                </div>
                <code className="spk-words">{reveal ? mnemonic : maskedWords}</code>

                <label className="spk-ack" htmlFor="spk-ack">
                  <input id="spk-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  I have saved my recovery words securely and understand that Solaris cannot recover them.
                </label>

                <button className="spk-btn" onClick={confirmBackup} disabled={!ack}>
                  Wallet ready
                </button>
              </div>
            )}

            {mode === 'passphrase' && (
              <div className="spk-backup">
                <div className="spk-warn">
                  <p className="spk-warn-title"><Lock size={14} /> Encrypt this wallet on this device</p>
                  <p className="spk-safe" style={{ margin: 0 }}>
                    Choose an unlock passphrase (at least 12 characters). It encrypts your wallet on this
                    device and is required to unlock it later. Solaris never receives it.
                  </p>
                </div>
                <label className="spk-label" htmlFor="spk-pass">Unlock passphrase</label>
                <input
                  id="spk-pass" className="input" type="password" value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password"
                  spellCheck={false} placeholder="At least 12 characters"
                />
                <label className="spk-label" htmlFor="spk-pass2" style={{ marginTop: 8 }}>Confirm passphrase</label>
                <input
                  id="spk-pass2" className="input" type="password" value={passphrase2}
                  onChange={(e) => setPassphrase2(e.target.value)} autoComplete="new-password"
                  spellCheck={false} placeholder="Re-enter passphrase"
                />
                <p className="spk-hint" style={{ marginTop: 8 }}>{VAULT_STATUS_TEXT}</p>
                <button className="spk-btn" onClick={savePassphraseAndFinish} disabled={busy} aria-busy={busy} style={{ marginTop: 10 }}>
                  {busy ? <><Loader2 size={15} className="spk-spin" /> Encrypting…</> : 'Encrypt & finish'}
                </button>
              </div>
            )}

            {mode === 'ready' && (
              <div className="spk-ready">
                <p className="spk-ready-msg"><Check size={16} /> Your Spark wallet is ready for this session.</p>
                <p className="spk-hint"><Lock size={13} /> {VAULT_STATUS_TEXT}</p>
              </div>
            )}

            {/* Optional PUBLIC-address linking — separate, unchecked consent */}
            <div className="spk-link">
              <label className="spk-ack" htmlFor="spk-link-consent">
                <input id="spk-link-consent" type="checkbox" checked={linkConsent} onChange={(e) => setLinkConsent(e.target.checked)} />
                Optionally link a public Spark address to my Solaris profile (no secret is shared).
              </label>
              {linkConsent && !linked && (
                <div className="spk-link-form">
                  <label className="spk-label" htmlFor="spk-link-addr">Public Spark address</label>
                  <input
                    id="spk-link-addr" className="input" value={linkAddr}
                    onChange={(e) => setLinkAddr(e.target.value)} placeholder="spark1… or sparkrt1…"
                    autoComplete="off" spellCheck={false}
                  />
                  <button className="spk-btn spk-btn-ghost" onClick={linkAddress}><Link2 size={14} /> Link address</button>
                  {linkErr && <p className="spk-err">{linkErr}</p>}
                </div>
              )}
              {linked && (
                <div className="spk-linked">
                  <p className="spk-hint"><Check size={13} /> {linkMsg} <b>{linked.chain}</b></p>
                  <button className="spk-btn spk-btn-ghost" onClick={unlinkAddress}>Unlink</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="spk-disabled">
            <p className="spk-safe spk-safe-warn"><AlertTriangle size={14} /> {cfg.reason}</p>
            <button className="spk-btn" disabled aria-disabled="true" title={cfg.reason}>Generate my Spark wallet</button>
            <button className="spk-btn spk-btn-ghost" disabled aria-disabled="true" title={cfg.reason}>Restore an existing Spark wallet</button>
          </div>
        )}

        {error && <p className="spk-err">{error}</p>}
      </div>

      {/* ── UTEXO card — always disabled, zero SDK/network ── */}
      <div className="spk-card spk-card-coming">
        <div className="spk-head">
          <span className="spk-title"><Wallet size={16} /> Create your digital dollar wallet</span>
          <span className="spk-badge spk-badge-coming">Powered by UTEXO · Coming Soon</span>
        </div>
        <p className="spk-safe">A stable digital-dollar wallet is on the roadmap and is not available yet.</p>
        <button className="spk-btn" disabled aria-disabled="true">Generate my digital dollar wallet — Coming Soon</button>
      </div>

      <ul className="spk-shared">
        <li><Check size={13} /> Optional — never required for care or booking</li>
        <li><Check size={13} /> Wallet keys stay separate from your health identity</li>
        <li><Check size={13} /> You remain responsible for securely backing up wallet recovery words</li>
      </ul>

      <style>{`
        /* Screen 2 "Reclaim Your Wealth" — DARK Solaris surfaces with GOLD accents.
           Tokens from index.css: surfaces #151b2b/#191f2f/#232a3a, text #dce2f8/
           #bbcabf/#86948a, gold #ffb95f/#e29100, mint #4edea3 (shared/ready). */
        .spk-card{border:1px solid var(--outline-variant);border-radius:14px;padding:16px;margin-bottom:14px;background:var(--surface-container-low)}
        .spk-card-coming{opacity:0.7}
        .spk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap}
        .spk-title{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:var(--on-surface);font-size:0.96rem}
        .spk-title svg{color:var(--tertiary)}
        .spk-badge{font-size:0.66rem;font-weight:700;padding:3px 9px;border-radius:99px;letter-spacing:.03em}
        .spk-badge-spark{background:rgba(255,185,95,0.14);color:var(--tertiary);border:1px solid rgba(255,185,95,0.3)}
        .spk-badge-coming{background:var(--surface-container-high);color:var(--outline)}
        .spk-safe{color:var(--on-surface-variant);font-size:0.8rem;line-height:1.5;margin:0 0 12px}
        .spk-safe-warn{display:flex;gap:7px;align-items:flex-start;color:#ffcf94}
        .spk-net{font-size:0.78rem;color:var(--on-surface-variant);margin:0 0 10px}
        .spk-net b{color:var(--tertiary)}
        .spk-btn{width:100%;border-radius:11px;padding:12px;font-weight:700;font-size:0.9rem;margin-bottom:8px;
          background:var(--tertiary);border:1px solid var(--tertiary);color:#2b1a00;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}
        .spk-btn:hover{background:#ffc879}
        .spk-btn:disabled{background:var(--surface-container-high);border-color:var(--outline-variant);color:var(--outline);cursor:not-allowed}
        .spk-btn-ghost{background:transparent;border:1px solid rgba(255,185,95,0.4);color:var(--tertiary)}
        .spk-btn-ghost:hover{background:rgba(255,185,95,0.08)}
        .spk-btn-ghost:disabled{background:var(--surface-container);border-color:var(--outline-variant);color:var(--outline)}
        .spk-spin{animation:spkspin 1s linear infinite}
        @keyframes spkspin{to{transform:rotate(360deg)}}
        .spk-label{display:block;font-size:0.74rem;color:var(--on-surface-variant);font-weight:600;margin-bottom:5px}
        .spk-warn{background:rgba(255,185,95,0.09);border:1px solid rgba(255,185,95,0.3);border-radius:10px;padding:10px 12px;margin-bottom:12px}
        .spk-warn-title{display:flex;align-items:center;gap:6px;font-weight:700;color:#ffcf94;font-size:0.8rem;margin:0 0 6px}
        .spk-warn-list{margin:0;padding-left:20px;color:#ffcf94;font-size:0.78rem;line-height:1.5}
        .spk-words-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
        .spk-reveal{display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:var(--tertiary);font-size:0.76rem;font-weight:600;cursor:pointer}
        .spk-words{display:block;font-family:var(--font-mono,ui-monospace,monospace);font-size:0.82rem;line-height:1.7;word-break:break-word;
          background:var(--surface-container-lowest);border:1px solid rgba(255,185,95,0.35);border-radius:10px;padding:10px 12px;color:var(--on-surface);margin-bottom:12px}
        .spk-ack{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:var(--on-surface-variant);cursor:pointer;line-height:1.4;margin-bottom:12px}
        .spk-ack input{margin-top:2px;accent-color:var(--tertiary)}
        .spk-checks{background:var(--surface-container);border:1px solid var(--outline-variant);border-radius:12px;padding:12px;margin-bottom:12px}
        .spk-checks-row{display:flex;gap:10px}
        .spk-check{flex:1;text-align:center}
        .spk-check label{display:block;font-size:0.72rem;color:var(--on-surface-variant);margin-bottom:4px}
        .spk-check .input{text-align:center;font-family:var(--font-mono,ui-monospace,monospace);font-size:0.9rem}
        .spk-ready{background:rgba(78,222,163,0.1);border:1px solid rgba(78,222,163,0.35);border-radius:10px;padding:12px;margin-bottom:6px}
        .spk-ready-msg{display:flex;align-items:center;gap:7px;color:var(--primary);font-weight:700;font-size:0.9rem;margin:0 0 4px}
        .spk-hint{color:var(--outline);font-size:0.76rem;margin:0;display:flex;align-items:center;gap:6px}
        .spk-link{border-top:1px dashed var(--outline-variant);margin-top:10px;padding-top:12px}
        .spk-link-form{margin-top:8px}
        .spk-linked{margin-top:8px}
        .spk-err{color:var(--error);font-size:0.8rem;margin:6px 0 0}
        .spk-shared{list-style:none;padding:0;margin:6px 0 16px;display:flex;flex-direction:column;gap:7px}
        .spk-shared li{display:flex;align-items:flex-start;gap:7px;color:var(--on-surface-variant);font-size:0.8rem;line-height:1.4}
        .spk-shared li svg{color:var(--primary);flex-shrink:0;margin-top:2px}
      `}</style>
    </div>
  );
}

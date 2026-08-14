import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Loader2, Check, Lock, AlertTriangle } from 'lucide-react';
import { readSparkConfig, isSparkDemoFixture } from '../lib/spark/config.js';
import {
  createSparkWallet, restoreSparkWallet, cleanupConnections, looksLikeMnemonic,
  DEMO_FIXTURE_MNEMONIC,
} from '../lib/spark/adapter.js';
import { VAULT_STATUS_TEXT } from '../lib/spark/vault.js';
import { useSparkWallet } from '../state/SparkWalletContext.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 * SparkWalletSetup — the ONE reusable secure wallet-setup flow (§1).
 *
 * This is the single client-side implementation of Spark wallet creation and
 * restoration, composed BOTH by onboarding ("Reclaim Your Wealth", via
 * SparkWalletCard) AND by the Economic Passport empty-wallet state. There is NO
 * second crypto implementation: it reuses createSparkWallet / restoreSparkWallet
 * (adapter) and spark.adopt (app-root provider), which owns vault persistence.
 *
 * SAFETY (unchanged from the original onboarding card):
 *   - The wallet object + recovery words live in COMPONENT MEMORY ONLY. Nothing
 *     here writes them to storage, an API, a URL, logs, analytics, or the DOM
 *     beyond the single deliberate reveal.
 *   - Creation/restore are single-flight (buttons disable while busy) and never
 *     auto-retry; cleanupConnections() runs on unmount/replacement/error while
 *     the wallet is still an orphan (not yet adopted by the provider).
 *   - The existing recovery-word acknowledgement gate and the ≥12-char device
 *     unlock passphrase are preserved. spark.adopt refuses to silently overwrite
 *     an existing account-scoped vault.
 *
 * PROPS:
 *   variant     'onboarding' (dark/gold surface) | 'passport' (light/teal sheet)
 *   initialMode  undefined → chooser; 'create' → begin generation immediately;
 *                'restore' → open the restore form directly
 *   onWalletReady(info) fired after a successful adopt (onboarding compatibility)
 *   onDone()     fired after a successful adopt (passport overlay closes on this)
 * ──────────────────────────────────────────────────────────────────────────── */

export default function SparkWalletSetup({
  variant = 'onboarding', initialMode, onWalletReady, onDone,
}) {
  const cfg = useMemo(() => readSparkConfig(), []);
  const demoFixture = useMemo(() => isSparkDemoFixture(), []);
  const spark = useSparkWallet();
  const passport = variant === 'passport';

  // mode: idle | generating | backup | passphrase | restore | restoring | ready
  const [mode, setMode] = useState('idle');
  const [mnemonic, setMnemonic] = useState('');     // memory only
  const [reveal, setReveal] = useState(false);
  const [ack, setAck] = useState(false);
  const [restoreInput, setRestoreInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [passphrase, setPassphrase] = useState('');
  const [passphrase2, setPassphrase2] = useState('');
  const [backedUpFlag, setBackedUpFlag] = useState(true); // true=generate path, false=restore path
  const secretForVault = useRef('');                       // mnemonic pending encryption (memory only)

  const unmounted = useRef(false);
  const adoptedRef = useRef(false); // true once the app-root provider owns the wallet

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
    } catch {
      await cleanupConnections();
      resetSecretState();
      setMode(passport ? 'idle' : 'idle');
      setError('Could not create a Spark wallet right now.');
    } finally {
      if (!unmounted.current) setBusy(false);
    }
  };

  // Kick off the requested initial mode exactly once.
  useEffect(() => {
    unmounted.current = false;
    if (initialMode === 'restore') setMode('restore');
    else if (initialMode === 'create') { doGenerate(); }
    // On unmount only release an ORPHAN wallet (abandoned mid-flow). Once adopted
    // by the app-root provider, the wallet must stay live into the app.
    return () => { unmounted.current = true; if (!adoptedRef.current) cleanupConnections(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmBackup = () => {
    if (!ack) {
      setError('Please confirm you have saved your recovery words to continue.');
      return;
    }
    setError('');
    secretForVault.current = mnemonic;
    setBackedUpFlag(true);
    setMode('passphrase');
  };

  const savePassphraseAndFinish = async () => {
    if (busy) return;
    setError('');
    if (passphrase.length < 12) { setError('Use an unlock passphrase of at least 12 characters.'); return; }
    if (passphrase !== passphrase2) { setError('The two passphrases do not match.'); return; }
    setBusy(true);
    try {
      await spark.adopt({ mnemonic: secretForVault.current, passphrase });
      adoptedRef.current = true; // provider now owns the wallet — don't release on unmount
      secretForVault.current = '';
      setMnemonic(''); setPassphrase(''); setPassphrase2(''); setReveal(false); setAck(false);
      setMode('ready');
      if (onWalletReady) onWalletReady({ backedUp: backedUpFlag });
      if (onDone) onDone({ backedUp: backedUpFlag });
    } catch (e) {
      // Includes the provider's refusal to overwrite an existing account vault.
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

  // Disabled build — surface the reason and offer nothing live.
  if (!cfg.enabled) {
    return (
      <div className={`sws sws--${variant}`}>
        <p className="sws-safe sws-safe-warn"><AlertTriangle size={14} /> {cfg.reason}</p>
        <button className="sws-btn" disabled aria-disabled="true" title={cfg.reason}>
          {passport ? 'Create Spark wallet' : 'Generate my Spark wallet'}
        </button>
        <button className="sws-btn sws-btn-ghost" disabled aria-disabled="true" title={cfg.reason}>
          {passport ? 'Restore existing wallet' : 'Restore an existing Spark wallet'}
        </button>
        <Style />
      </div>
    );
  }

  return (
    <div className={`sws sws--${variant}`}>
      <p className="sws-net">Active network: <b>{cfg.network}</b>{demoFixture ? ' · demo fixture (no live init)' : ''}</p>

      {(mode === 'idle' || mode === 'generating') && (
        <>
          <button className="sws-btn" onClick={doGenerate} disabled={busy} aria-busy={busy}>
            {mode === 'generating'
              ? <><Loader2 size={15} className="sws-spin" /> Creating…</>
              : (passport ? 'Create Spark wallet' : 'Generate my Spark wallet')}
          </button>
          <button className="sws-btn sws-btn-ghost" onClick={() => { setError(''); setMode('restore'); }} disabled={busy}>
            {passport ? 'Restore existing wallet' : 'Restore an existing Spark wallet'}
          </button>
        </>
      )}

      {mode === 'restore' && (
        <div className="sws-restore">
          <label className="sws-label" htmlFor="sws-restore-input">Enter your recovery words</label>
          <textarea
            id="sws-restore-input" className="input sws-input" rows={3}
            value={restoreInput} onChange={(e) => setRestoreInput(e.target.value)}
            placeholder="word1 word2 word3 …" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            autoComplete="off" spellCheck={false}
          />
          <button className="sws-btn" onClick={doRestore} disabled={busy} aria-busy={busy}>
            {busy ? <><Loader2 size={15} className="sws-spin" /> Restoring…</> : 'Restore wallet'}
          </button>
          <button className="sws-btn sws-btn-ghost" onClick={() => { setError(''); setMode('idle'); }} disabled={busy}>
            Back
          </button>
        </div>
      )}

      {mode === 'backup' && (
        <div className="sws-backup">
          <div className="sws-warn">
            <p className="sws-warn-title"><ShieldCheck size={14} /> Before you continue</p>
            <ol className="sws-warn-list">
              <li>These recovery words are shown once. Write them down and keep them private.</li>
              <li>Never share this secret. Anyone who has it can act as you.</li>
              <li>Solaris does not store them and cannot recover them for you.</li>
            </ol>
          </div>

          <div className="sws-words-head">
            <span className="sws-label">Recovery words</span>
            <button className="sws-reveal" onClick={() => setReveal((v) => !v)} aria-label={reveal ? 'Hide recovery words' : 'Reveal recovery words'}>
              {reveal ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Reveal</>}
            </button>
          </div>
          <code className="sws-words">{reveal ? mnemonic : maskedWords}</code>

          <label className="sws-ack" htmlFor="sws-ack">
            <input id="sws-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            I have saved my recovery words securely and understand that Solaris cannot recover them.
          </label>

          <button className="sws-btn" onClick={confirmBackup} disabled={!ack}>
            Wallet ready
          </button>
        </div>
      )}

      {mode === 'passphrase' && (
        <div className="sws-backup">
          <div className="sws-warn">
            <p className="sws-warn-title"><Lock size={14} /> Encrypt this wallet on this device</p>
            <p className="sws-safe" style={{ margin: 0 }}>
              Choose an unlock passphrase (at least 12 characters). It encrypts your wallet on this
              device and is required to unlock it later. Solaris never receives it.
            </p>
          </div>
          <label className="sws-label" htmlFor="sws-pass">Unlock passphrase</label>
          <input
            id="sws-pass" className="input sws-input" type="password" value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)} autoComplete="new-password"
            spellCheck={false} placeholder="At least 12 characters"
          />
          <label className="sws-label" htmlFor="sws-pass2" style={{ marginTop: 8 }}>Confirm passphrase</label>
          <input
            id="sws-pass2" className="input sws-input" type="password" value={passphrase2}
            onChange={(e) => setPassphrase2(e.target.value)} autoComplete="new-password"
            spellCheck={false} placeholder="Re-enter passphrase"
          />
          <p className="sws-hint" style={{ marginTop: 8 }}>{VAULT_STATUS_TEXT}</p>
          <button className="sws-btn" onClick={savePassphraseAndFinish} disabled={busy} aria-busy={busy} style={{ marginTop: 10 }}>
            {busy ? <><Loader2 size={15} className="sws-spin" /> Encrypting…</> : 'Encrypt & finish'}
          </button>
        </div>
      )}

      {mode === 'ready' && (
        <div className="sws-ready">
          <p className="sws-ready-msg"><Check size={16} /> Your Spark wallet is ready for this session.</p>
          <p className="sws-hint"><Lock size={13} /> {VAULT_STATUS_TEXT}</p>
        </div>
      )}

      {error && <p className="sws-err">{error}</p>}
      <Style />
    </div>
  );
}

/* Two palettes: onboarding mirrors the dark/gold "Reclaim Your Wealth" surface;
   passport mirrors the light/teal Economic Passport wallet surface. */
function Style() {
  return (
    <style>{`
      .sws-net{font-size:0.78rem;margin:0 0 10px}
      .sws-btn{width:100%;border-radius:11px;padding:12px;font-weight:700;font-size:0.9rem;margin-bottom:8px;
        cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent}
      .sws-btn:disabled{cursor:not-allowed;opacity:.75}
      .sws-spin{animation:swsspin 1s linear infinite}
      @keyframes swsspin{to{transform:rotate(360deg)}}
      .sws-label{display:block;font-size:0.74rem;font-weight:600;margin-bottom:5px}
      .sws-input{width:100%;box-sizing:border-box}
      .sws-safe{font-size:0.8rem;line-height:1.5;margin:0 0 12px}
      .sws-safe-warn{display:flex;gap:7px;align-items:flex-start}
      .sws-warn{border-radius:10px;padding:10px 12px;margin-bottom:12px}
      .sws-warn-title{display:flex;align-items:center;gap:6px;font-weight:700;font-size:0.8rem;margin:0 0 6px}
      .sws-warn-list{margin:0;padding-left:20px;font-size:0.78rem;line-height:1.5}
      .sws-words-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
      .sws-reveal{display:inline-flex;align-items:center;gap:5px;background:none;border:none;font-size:0.76rem;font-weight:600;cursor:pointer}
      .sws-words{display:block;font-family:var(--font-mono,ui-monospace,monospace);font-size:0.82rem;line-height:1.7;word-break:break-word;
        border-radius:10px;padding:10px 12px;margin-bottom:12px}
      .sws-ack{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;cursor:pointer;line-height:1.4;margin-bottom:12px}
      .sws-ack input{margin-top:2px}
      .sws-ready{border-radius:10px;padding:12px;margin-bottom:6px}
      .sws-ready-msg{display:flex;align-items:center;gap:7px;font-weight:700;font-size:0.9rem;margin:0 0 4px}
      .sws-hint{font-size:0.76rem;margin:0;display:flex;align-items:center;gap:6px}
      .sws-err{font-size:0.8rem;margin:6px 0 0}

      /* ── onboarding: dark surface, gold accent (matches SparkWalletCard) ── */
      .sws--onboarding .sws-net{color:var(--on-surface-variant)}
      .sws--onboarding .sws-net b{color:var(--tertiary)}
      .sws--onboarding .sws-btn{background:var(--tertiary);border-color:var(--tertiary);color:#2b1a00}
      .sws--onboarding .sws-btn:hover:not(:disabled){background:#ffc879}
      .sws--onboarding .sws-btn:disabled{background:var(--surface-container-high);border-color:var(--outline-variant);color:var(--outline)}
      .sws--onboarding .sws-btn-ghost{background:transparent;border:1px solid rgba(255,185,95,0.4);color:var(--tertiary)}
      .sws--onboarding .sws-btn-ghost:hover:not(:disabled){background:rgba(255,185,95,0.08)}
      .sws--onboarding .sws-label{color:var(--on-surface-variant)}
      .sws--onboarding .sws-safe{color:var(--on-surface-variant)}
      .sws--onboarding .sws-safe-warn{color:#ffcf94}
      .sws--onboarding .sws-warn{background:rgba(255,185,95,0.09);border:1px solid rgba(255,185,95,0.3)}
      .sws--onboarding .sws-warn-title{color:#ffcf94}
      .sws--onboarding .sws-warn-list{color:#ffcf94}
      .sws--onboarding .sws-reveal{color:var(--tertiary)}
      .sws--onboarding .sws-words{background:var(--surface-container-lowest);border:1px solid rgba(255,185,95,0.35);color:var(--on-surface)}
      .sws--onboarding .sws-ack{color:var(--on-surface-variant)}
      .sws--onboarding .sws-ack input{accent-color:var(--tertiary)}
      .sws--onboarding .sws-ready{background:rgba(78,222,163,0.1);border:1px solid rgba(78,222,163,0.35)}
      .sws--onboarding .sws-ready-msg{color:var(--primary)}
      .sws--onboarding .sws-hint{color:var(--outline)}
      .sws--onboarding .sws-err{color:var(--error)}

      /* ── passport: light surface, teal accent (matches SparkWalletScreen) ── */
      .sws--passport .sws-net{color:var(--muted,#5C726B)}
      .sws--passport .sws-net b{color:var(--mint-ink,#0B6A57)}
      .sws--passport .sws-btn{background:var(--teal,#0E5C57);border-color:var(--teal,#0E5C57);color:#fff}
      .sws--passport .sws-btn:hover:not(:disabled){background:var(--teal-d2,#0A524C)}
      .sws--passport .sws-btn:disabled{opacity:.55}
      .sws--passport .sws-btn-ghost{background:transparent;border:1px solid var(--line,#E1ECE8);color:var(--teal,#0E5C57)}
      .sws--passport .sws-btn-ghost:hover:not(:disabled){background:var(--mint-soft,#DAF3EC)}
      .sws--passport .sws-label{color:var(--ink,#0A2B29)}
      .sws--passport .sws-safe{color:var(--muted,#5C726B)}
      .sws--passport .sws-safe-warn{color:var(--terra-ink,#7A4A21)}
      .sws--passport .sws-input{padding:11px 12px;border-radius:10px;border:1px solid var(--line,#E1ECE8);background:var(--surface,#fff);color:var(--ink,#0A2B29);font-size:14px;font-family:inherit;outline:none}
      .sws--passport .sws-input:focus{border-color:var(--mint,#2FBE9F)}
      .sws--passport .sws-warn{background:var(--surface-2,#F6FAF8);border:1px solid var(--line-2,#EBF3F0)}
      .sws--passport .sws-warn-title{color:var(--ink,#0A2B29)}
      .sws--passport .sws-warn-list{color:var(--muted,#5C726B)}
      .sws--passport .sws-reveal{color:var(--teal,#0E5C57)}
      .sws--passport .sws-words{background:var(--surface-2,#F6FAF8);border:1px solid var(--line-2,#EBF3F0);color:var(--ink,#0A2B29)}
      .sws--passport .sws-ack{color:var(--ink,#0A2B29)}
      .sws--passport .sws-ack input{accent-color:var(--teal,#0E5C57)}
      .sws--passport .sws-ready{background:var(--mint-soft,#DAF3EC);border:1px solid var(--mint-line,#BFE8DD)}
      .sws--passport .sws-ready-msg{color:var(--mint-ink,#0B6A57)}
      .sws--passport .sws-hint{color:var(--muted,#5C726B)}
      .sws--passport .sws-err{color:var(--error,#B23B3B)}
    `}</style>
  );
}

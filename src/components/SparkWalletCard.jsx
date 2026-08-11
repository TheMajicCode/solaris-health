import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Wallet, ShieldCheck, Eye, EyeOff, Loader2, Check, Link2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { readSparkConfig, isSparkDemoFixture } from '../lib/spark/config.js';
import {
  createSparkWallet, restoreSparkWallet, cleanupConnections, looksLikeMnemonic,
  pickWordPositions, wordAt, classifySparkAddress, DEMO_FIXTURE_MNEMONIC,
} from '../lib/spark/adapter.js';

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

export default function SparkWalletCard() {
  const cfg = useMemo(() => readSparkConfig(), []);
  const demoFixture = useMemo(() => isSparkDemoFixture(), []);

  // mode: idle | generating | backup | restore | restoring | ready
  const [mode, setMode] = useState('idle');
  const [mnemonic, setMnemonic] = useState('');     // memory only
  const [reveal, setReveal] = useState(false);
  const [ack, setAck] = useState(false);
  const [wordPos, setWordPos] = useState([]);
  const [wordAns, setWordAns] = useState(['', '', '']);
  const [restoreInput, setRestoreInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Optional PUBLIC-address linking — a SEPARATE, unchecked consent (spec §4).
  const [linkConsent, setLinkConsent] = useState(false);
  const [linkAddr, setLinkAddr] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [linked, setLinked] = useState(null); // { chain, address }

  const unmounted = useRef(false);
  useEffect(() => {
    unmounted.current = false; // reset on (re)mount — StrictMode/dev remounts this instance
    return () => { unmounted.current = true; cleanupConnections(); };
  }, []);

  const maskedWords = useMemo(
    () => (mnemonic ? mnemonic.split(/\s+/).map((w) => '•'.repeat(Math.max(4, w.length))).join(' ') : ''),
    [mnemonic],
  );

  const resetSecretState = () => {
    setMnemonic(''); setReveal(false); setAck(false);
    setWordPos([]); setWordAns(['', '', '']);
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
      setWordPos(pickWordPositions(res.mnemonic, 3));
      setWordAns(['', '', '']);
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

  const wordChecksPass = () =>
    wordPos.length === 3
    && wordPos.every((p, i) => (wordAns[i] || '').trim().toLowerCase() === wordAt(mnemonic, p).toLowerCase());

  const confirmBackup = () => {
    if (!ack || !wordChecksPass()) {
      setError('Please confirm your backup and complete the three word checks.');
      return;
    }
    setError('');
    setMode('ready');
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
      setRestoreInput('');
      setMode('ready');
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
                  I have written down my recovery words and stored them safely.
                </label>

                {ack && wordPos.length === 3 && (
                  <div className="spk-checks">
                    <p className="spk-label">Confirm your backup — enter these words:</p>
                    <div className="spk-checks-row">
                      {wordPos.map((pos, i) => (
                        <div key={pos} className="spk-check">
                          <label htmlFor={`spk-word-${pos}`}>Word #{pos}</label>
                          <input
                            id={`spk-word-${pos}`} className="input" value={wordAns[i]}
                            onChange={(e) => setWordAns((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                            autoComplete="off" spellCheck={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button className="spk-btn" onClick={confirmBackup} disabled={!ack || !wordChecksPass()}>
                  Wallet ready
                </button>
              </div>
            )}

            {mode === 'ready' && (
              <div className="spk-ready">
                <p className="spk-ready-msg"><Check size={16} /> Your Spark wallet is ready for this session.</p>
                <p className="spk-hint">Kept in memory only — after a refresh you will restore it locally.</p>
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
        .spk-card{border:1px solid rgba(10,43,41,0.12);border-radius:14px;padding:16px;margin-bottom:14px;background:#fbfdfc}
        .spk-card-coming{opacity:0.85}
        .spk-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap}
        .spk-title{display:inline-flex;align-items:center;gap:7px;font-weight:700;color:#0A2B29;font-size:0.96rem}
        .spk-badge{font-size:0.66rem;font-weight:700;padding:3px 9px;border-radius:99px;letter-spacing:.03em}
        .spk-badge-spark{background:#0A2B29;color:#ffd27a}
        .spk-badge-coming{background:#e7ece9;color:#6b807a}
        .spk-safe{color:#5b706a;font-size:0.8rem;line-height:1.5;margin:0 0 12px}
        .spk-safe-warn{display:flex;gap:7px;align-items:flex-start;color:#8a5a2b}
        .spk-net{font-size:0.78rem;color:#0A2B29;margin:0 0 10px}
        .spk-btn{width:100%;border-radius:11px;padding:12px;font-weight:600;font-size:0.9rem;margin-bottom:8px;
          background:#2DB584;border:1px solid #2DB584;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}
        .spk-btn:disabled{background:#cbd8d3;border-color:#cbd8d3;color:#7d8f89;cursor:not-allowed}
        .spk-btn-ghost{background:#fff;border:1px solid rgba(45,181,132,0.4);color:#2DB584}
        .spk-btn-ghost:disabled{background:#f2f5f4;border-color:#dbe4e0;color:#9aa9a4}
        .spk-spin{animation:spkspin 1s linear infinite}
        @keyframes spkspin{to{transform:rotate(360deg)}}
        .spk-label{display:block;font-size:0.74rem;color:#6b807a;font-weight:600;margin-bottom:5px}
        .spk-warn{background:rgba(197,138,83,0.1);border:1px solid rgba(197,138,83,0.32);border-radius:10px;padding:10px 12px;margin-bottom:12px}
        .spk-warn-title{display:flex;align-items:center;gap:6px;font-weight:700;color:#8a5a2b;font-size:0.8rem;margin:0 0 6px}
        .spk-warn-list{margin:0;padding-left:20px;color:#8a5a2b;font-size:0.78rem;line-height:1.5}
        .spk-words-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px}
        .spk-reveal{display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:#c58a53;font-size:0.76rem;font-weight:600;cursor:pointer}
        .spk-words{display:block;font-family:monospace;font-size:0.82rem;line-height:1.7;word-break:break-word;
          background:#fff6f0;border:1px solid rgba(197,138,83,0.35);border-radius:10px;padding:10px 12px;color:#0A2B29;margin-bottom:12px}
        .spk-ack{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:#5b706a;cursor:pointer;line-height:1.4;margin-bottom:12px}
        .spk-ack input{margin-top:2px}
        .spk-checks{background:#f5f9f7;border-radius:12px;padding:12px;margin-bottom:12px}
        .spk-checks-row{display:flex;gap:10px}
        .spk-check{flex:1;text-align:center}
        .spk-check label{display:block;font-size:0.72rem;color:#6b807a;margin-bottom:4px}
        .spk-check .input{text-align:center;font-family:monospace;font-size:0.9rem}
        .spk-ready{background:#eefaf4;border:1px solid rgba(45,181,132,0.35);border-radius:10px;padding:12px;margin-bottom:6px}
        .spk-ready-msg{display:flex;align-items:center;gap:7px;color:#1c7a56;font-weight:700;font-size:0.9rem;margin:0 0 4px}
        .spk-hint{color:#6b807a;font-size:0.76rem;margin:0;display:flex;align-items:center;gap:6px}
        .spk-link{border-top:1px dashed rgba(10,43,41,0.14);margin-top:10px;padding-top:12px}
        .spk-link-form{margin-top:8px}
        .spk-linked{margin-top:8px}
        .spk-err{color:#c0392b;font-size:0.8rem;margin:6px 0 0}
        .spk-shared{list-style:none;padding:0;margin:6px 0 16px;display:flex;flex-direction:column;gap:7px}
        .spk-shared li{display:flex;align-items:flex-start;gap:7px;color:#5b706a;font-size:0.8rem;line-height:1.4}
        .spk-shared li svg{color:#2DB584;flex-shrink:0;margin-top:2px}
      `}</style>
    </div>
  );
}

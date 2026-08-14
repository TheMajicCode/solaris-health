import React, { useMemo, useState } from 'react';
import { Wallet, Check, Link2, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api.js';
import { readSparkConfig } from '../lib/spark/config.js';
import { classifySparkAddress } from '../lib/spark/adapter.js';
import SparkWalletSetup from './SparkWalletSetup.jsx';

/* ────────────────────────────────────────────────────────────────────────────
 * SparkWalletCard — the optional "Reclaim Your Wealth" Spark surface (spec §4/§2A).
 *
 * The secure wallet-setup flow (create / restore / recovery-word backup gate /
 * device passphrase / adopt) now lives in the SINGLE reusable SparkWalletSetup
 * component, composed here for onboarding and by the Economic Passport empty-wallet
 * state. There is NO second crypto implementation. This card keeps the onboarding
 * chrome (heading, beta-safe copy, optional public-address linking, the UTEXO
 * "coming soon" card and the shared reassurance list).
 *
 * Beta-safe copy (spec §2A) is used verbatim; no over-broad custody/privacy claims.
 * ──────────────────────────────────────────────────────────────────────────── */

const SCREEN2_SAFE_COPY =
  'Spark wallet recovery words are created on this device by the enabled wallet software. '
  + 'Keep them private. Solaris does not store them. Network availability, fees, recovery '
  + 'limits, and service behavior depend on the wallet and network.';

export default function SparkWalletCard({ onWalletReady }) {
  const cfg = useMemo(() => readSparkConfig(), []);

  // Optional PUBLIC-address linking — a SEPARATE, unchecked consent (spec §4).
  const [linkConsent, setLinkConsent] = useState(false);
  const [linkAddr, setLinkAddr] = useState('');
  const [linkMsg, setLinkMsg] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [linked, setLinked] = useState(null); // { chain, address }

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

        {/* The ONE reusable secure setup flow (onboarding palette). */}
        <SparkWalletSetup variant="onboarding" onWalletReady={onWalletReady} />

        {/* Optional PUBLIC-address linking — separate, unchecked consent */}
        {cfg.enabled && (
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
        )}
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
        .spk-btn{width:100%;border-radius:11px;padding:12px;font-weight:700;font-size:0.9rem;margin-bottom:8px;
          background:var(--tertiary);border:1px solid var(--tertiary);color:#2b1a00;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}
        .spk-btn:hover{background:#ffc879}
        .spk-btn:disabled{background:var(--surface-container-high);border-color:var(--outline-variant);color:var(--outline);cursor:not-allowed}
        .spk-btn-ghost{background:transparent;border:1px solid rgba(255,185,95,0.4);color:var(--tertiary)}
        .spk-btn-ghost:hover{background:rgba(255,185,95,0.08)}
        .spk-btn-ghost:disabled{background:var(--surface-container);border-color:var(--outline-variant);color:var(--outline)}
        .spk-label{display:block;font-size:0.74rem;color:var(--on-surface-variant);font-weight:600;margin-bottom:5px}
        .spk-ack{display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;color:var(--on-surface-variant);cursor:pointer;line-height:1.4;margin-bottom:12px}
        .spk-ack input{margin-top:2px;accent-color:var(--tertiary)}
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

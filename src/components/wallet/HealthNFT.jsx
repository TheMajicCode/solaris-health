/**
 * HealthNFT — Phase 4 (placeholder / forward-looking)
 * A preview of tokenized health credentials & achievements as NFTs:
 * a gallery of mintable badges, a (simulated) mint flow and a transfer stub.
 *
 * This is intentionally a front-end placeholder — minting is simulated client
 * side so the experience is demoable. Wiring to a real ERC-721/Metaplex
 * contract is a future milestone (clearly flagged in the UI).
 *
 * Props:
 *   wallets   the user's connected wallets (to pick a destination)
 *   onError   (msg) => void
 */
import React, { useState } from 'react';
import {
  Award, Sparkles, Loader2, Check, Send, ShieldCheck, Image as ImageIcon,
  Lock, Zap, HeartPulse, Footprints, Brain, X,
} from 'lucide-react';
import { chainMeta, shortAddr } from '../../lib/web3-utils.js';

const CSS = `
.luca .nft-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:13px}
.luca .nft-card{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--surface);
  display:flex;flex-direction:column;transition:all .18s ease}
.luca .nft-card:hover{box-shadow:var(--shadow);transform:translateY(-2px)}
.luca .nft-art{aspect-ratio:1;display:grid;place-items:center;position:relative;color:#fff}
.luca .nft-art .nft-emoji{font-size:38px}
.luca .nft-art .nft-lock{position:absolute;top:9px;right:9px;background:rgba(0,0,0,.32);border-radius:8px;
  padding:4px;backdrop-filter:blur(4px)}
.luca .nft-body{padding:11px 12px;display:flex;flex-direction:column;gap:7px;flex:1}
.luca .nft-name{font-weight:700;font-size:13.5px;color:var(--ink)}
.luca .nft-desc{font-size:11.5px;color:var(--muted-2);line-height:1.45;flex:1}
.luca .nft-foot{display:flex;align-items:center;gap:6px;margin-top:2px}
.luca .nft-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px;border-radius:10px;
  border:none;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;transition:filter .15s ease}
.luca .nft-btn.mint{background:linear-gradient(135deg,var(--teal),var(--mint));color:#fff}
.luca .nft-btn.mint:hover{filter:brightness(1.06)}
.luca .nft-btn.owned{background:var(--mint-soft);color:var(--mint-ink);cursor:default}
.luca .nft-btn.transfer{background:var(--surface-2);color:var(--ink);border:1px solid var(--line)}
.luca .nft-status{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:2px 8px;
  border-radius:999px;background:var(--gold-soft);color:var(--gold-ink);position:absolute;top:9px;left:9px}
.luca .nft-banner{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:13px;
  background:linear-gradient(135deg,var(--gold-soft),#FBF1D9);border:1px solid #EBD3A0;color:var(--gold-ink);
  font-size:12.5px;line-height:1.5}
.luca .nft-banner svg{flex-shrink:0;margin-top:1px}
.luca .nft-modal-bg{position:fixed;inset:0;background:rgba(10,43,41,.45);display:grid;place-items:center;z-index:70;padding:18px}
.luca .nft-modal{background:var(--surface);border-radius:18px;max-width:380px;width:100%;padding:20px;box-shadow:var(--shadow)}
.luca .nft-field{display:flex;flex-direction:column;gap:5px;margin:12px 0}
.luca .nft-field label{font-size:12px;font-weight:700;color:var(--muted)}
.luca .nft-field select,.luca .nft-field input{border:1px solid var(--line);border-radius:10px;padding:9px 11px;
  font-size:13px;color:var(--ink);background:var(--surface);font-family:inherit;outline:none}
.luca .spin{animation:nft-spin 1s linear infinite}
@keyframes nft-spin{to{transform:rotate(360deg)}}
`;

const CATALOG = [
  { id: 'vitality-100', name: 'Vitality Centurion', emoji: '🌿', icon: HeartPulse, grad: 'linear-gradient(150deg,#0E5C57,#2FBE9F)', desc: '100 days of logged vitality check-ins.' },
  { id: 'steps-million', name: 'Million Steps', emoji: '👟', icon: Footprints, grad: 'linear-gradient(150deg,#B5713C,#E3AC46)', desc: 'Walked a cumulative 1,000,000 steps.' },
  { id: 'mind-master', name: 'Mindful Master', emoji: '🧠', icon: Brain, grad: 'linear-gradient(150deg,#6D28D9,#A78BFA)', desc: '50 completed mindfulness sessions.' },
  { id: 'first-passport', name: 'Genesis Passport', emoji: '🪪', icon: ShieldCheck, grad: 'linear-gradient(150deg,#0A2B29,#0E5C57)', desc: 'Your founding LUCA Passport credential.' },
  { id: 'data-sovereign', name: 'Data Sovereign', emoji: '🔐', icon: Lock, grad: 'linear-gradient(150deg,#0E5C57,#0A2B29)', desc: 'Exported & self-custodied your full health vault.' },
  { id: 'community-100', name: 'Community Pillar', emoji: '🤝', icon: Award, grad: 'linear-gradient(150deg,#D69B33,#B5713C)', desc: '100 verified community contributions.' },
];

export default function HealthNFT({ wallets = [], onError }) {
  const [owned, setOwned] = useState({});       // id -> { tokenId, chain, address }
  const [minting, setMinting] = useState('');
  const [transferFor, setTransferFor] = useState(null);

  const evmWallets = wallets.filter((w) => chainMeta(w.chain)?.kind === 'evm');
  const destWallets = evmWallets.length ? evmWallets : wallets;

  const mint = async (item) => {
    if (!destWallets.length) { onError && onError('Connect a wallet first to mint a health NFT.'); return; }
    setMinting(item.id);
    // simulated mint — a real impl would call a contract via the connected wallet
    await new Promise((r) => setTimeout(r, 1100));
    const dest = destWallets[0];
    setOwned((o) => ({ ...o, [item.id]: { tokenId: Math.floor(Math.random() * 9000) + 1000, chain: dest.chain, address: dest.address } }));
    setMinting('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{CSS}</style>

      <div className="nft-banner">
        <Sparkles size={17} />
        <div><strong>Preview feature.</strong> Tokenize your health milestones as soulbound NFTs. Minting here is
          simulated for demonstration; on-chain contract integration (ERC-721 / Metaplex) is on the roadmap.</div>
      </div>

      <div className="nft-grid">
        {CATALOG.map((item) => {
          const own = owned[item.id];
          const Icon = item.icon;
          return (
            <div className="nft-card" key={item.id}>
              <div className="nft-art" style={{ background: item.grad }}>
                <span className="nft-emoji">{item.emoji}</span>
                {own ? <span className="nft-status" style={{ background: 'var(--mint-soft)', color: 'var(--mint-ink)' }}>Owned</span>
                  : <span className="nft-lock"><Icon size={14} /></span>}
              </div>
              <div className="nft-body">
                <div className="nft-name">{item.name}</div>
                <div className="nft-desc">{item.desc}</div>
                {own && <div style={{ fontSize: 11, color: 'var(--muted-2)', fontFamily: 'var(--mono,monospace)' }}>
                  #{own.tokenId} · {chainMeta(own.chain)?.symbol}
                </div>}
                <div className="nft-foot">
                  {own ? (
                    <>
                      <button className="nft-btn owned"><Check size={13} /> Minted</button>
                      <button className="nft-btn transfer" onClick={() => setTransferFor(item)} title="Transfer"><Send size={13} /></button>
                    </>
                  ) : (
                    <button className="nft-btn mint" disabled={minting === item.id} onClick={() => mint(item)}>
                      {minting === item.id ? <><Loader2 size={13} className="spin" /> Minting…</> : <><Zap size={13} /> Mint</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {transferFor && (
        <TransferModal item={transferFor} owned={owned[transferFor.id]}
          onClose={() => setTransferFor(null)}
          onDone={(toAddr) => {
            setTransferFor(null);
            // simulate transfer: drop from owned
            setOwned((o) => { const n = { ...o }; delete n[transferFor.id]; return n; });
          }}
          onError={onError} />
      )}
    </div>
  );
}

function TransferModal({ item, owned, onClose, onDone, onError }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!to.trim() || to.trim().length < 10) return setErr('Enter a valid recipient address.');
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900)); // simulated
    setBusy(false);
    onDone(to.trim());
  };

  return (
    <div className="nft-modal-bg" onClick={onClose}>
      <div className="nft-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>Transfer “{item.name}”</div>
          <button className="nft-btn transfer" style={{ flex: 'none', padding: 6 }} onClick={onClose}><X size={15} /></button>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>
          Token #{owned?.tokenId} on {chainMeta(owned?.chain)?.name}. This is a simulated transfer for the demo.
        </div>
        <div className="nft-field">
          <label>Recipient address</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… / address" />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--danger-ink)', marginBottom: 8 }}>{err}</div>}
        <button className="nft-btn mint" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? <><Loader2 size={14} className="spin" /> Transferring…</> : <><Send size={14} /> Confirm transfer</>}
        </button>
      </div>
    </div>
  );
}

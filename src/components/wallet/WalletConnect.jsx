/**
 * WalletConnect — Phase 4
 * Provider selection (MetaMask / WalletConnect / Phantom / manual), chain
 * picker, connect + SIWE ownership verification, and a manual address fallback
 * so the flow is fully demoable without a browser extension.
 *
 * Props:
 *   chains       array of supported chains from the API [{id,name,kind,symbol,explorer}]
 *   onConnected  async (walletRecord) => void   (called after a wallet is saved)
 *   onError      (msg) => void
 */
import React, { useState } from 'react';
import {
  Wallet, ShieldCheck, Check, X, Loader2, Link2, KeyRound, AlertTriangle,
  ChevronRight, Wifi,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import {
  PROVIDERS, CHAIN_META, chainMeta, connectEvm, connectSolana, switchEvmChain,
  signEvmMessage, looksLikeAddress, shortAddr,
} from '../../lib/web3-utils.js';

const CSS = `
.luca .wc-wrap{display:flex;flex-direction:column;gap:14px}
.luca .wc-providers{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.luca .wc-prov{display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--line);
  border-radius:14px;background:var(--surface);cursor:pointer;transition:all .15s ease;text-align:left}
.luca .wc-prov:hover{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .wc-prov.sel{border-color:var(--mint);background:var(--mint-soft)}
.luca .wc-prov .wc-pic{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;
  background:var(--surface-2);color:var(--teal);font-weight:800;font-size:17px}
.luca .wc-prov .wc-pname{font-weight:700;font-size:13.5px;color:var(--ink)}
.luca .wc-prov .wc-ptag{font-size:11.5px;color:var(--muted-2);margin-top:1px}
.luca .wc-prov .wc-pdot{margin-left:auto;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px}
.luca .wc-pdot.on{background:var(--mint-soft);color:var(--mint-ink)}
.luca .wc-pdot.off{background:var(--surface-2);color:var(--muted-2)}
.luca .wc-chains{display:flex;flex-wrap:wrap;gap:8px}
.luca .wc-chain{display:inline-flex;align-items:center;gap:7px;padding:8px 13px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:13px;font-weight:600;
  color:var(--muted-2);transition:all .15s ease}
.luca .wc-chain.on{color:var(--ink);border-color:transparent;box-shadow:0 0 0 2px currentColor inset}
.luca .wc-chain .wc-cdot{width:10px;height:10px;border-radius:50%}
.luca .wc-field{display:flex;flex-direction:column;gap:5px}
.luca .wc-field label{font-size:12px;font-weight:700;color:var(--muted)}
.luca .wc-field input{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;
  color:var(--ink);background:var(--surface);font-family:var(--mono,'IBM Plex Mono',monospace);outline:none}
.luca .wc-field input:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .wc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;
  border-radius:12px;border:none;background:linear-gradient(135deg,var(--teal),var(--mint));color:#fff;
  font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:filter .15s ease}
.luca .wc-btn:hover{filter:brightness(1.05)}
.luca .wc-btn:disabled{opacity:.55;cursor:default;filter:none}
.luca .wc-note{display:flex;gap:9px;align-items:flex-start;padding:11px 13px;border-radius:12px;
  background:var(--surface-2);border:1px solid var(--line);font-size:12.5px;color:var(--muted);line-height:1.5}
.luca .wc-note svg{flex-shrink:0;margin-top:1px;color:var(--teal)}
.luca .wc-err{display:flex;gap:9px;align-items:flex-start;padding:11px 13px;border-radius:12px;
  background:var(--danger-soft);border:1px solid var(--danger-soft);font-size:12.5px;color:var(--danger-ink)}
.luca .wc-step-title{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  color:var(--muted-2);margin-bottom:2px}
.luca .spin{animation:wc-spin 1s linear infinite}
@keyframes wc-spin{to{transform:rotate(360deg)}}
`;

export default function WalletConnect({ chains = [], onConnected, onError }) {
  const [provider, setProvider] = useState('metamask');
  const [chain, setChain] = useState('ethereum');
  const [manualAddr, setManualAddr] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [err, setErr] = useState('');
  const [verifyAfter, setVerifyAfter] = useState(true);

  const list = chains.length ? chains : Object.values(CHAIN_META);
  const prov = PROVIDERS[provider];
  // restrict chain choices to those the provider can serve
  const allowedChains = list.filter((c) => {
    const meta = chainMeta(c.id);
    if (!meta) return false;
    if (prov.kind === 'manual') return true;
    return meta.kind === prov.kind;
  });

  // keep selected chain valid for provider
  React.useEffect(() => {
    if (!allowedChains.find((c) => c.id === chain) && allowedChains[0]) setChain(allowedChains[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fail = (m) => { setErr(m); onError && onError(m); setBusy(false); setStep(''); };

  async function verifyOwnership(address) {
    setStep('Requesting signature…');
    const { message } = await api.getWalletNonce(address);
    const signature = await signEvmMessage(message, address);
    setStep('Verifying signature…');
    await api.verifyWalletSignature({ chain: 'ethereum', address, message, signature });
  }

  async function handleConnect() {
    setErr(''); setBusy(true);
    try {
      let address = '';
      let usedChain = chain;
      let providerTag = provider;

      if (provider === 'manual') {
        address = manualAddr.trim();
        if (!looksLikeAddress(chain, address)) {
          return fail(`That doesn't look like a valid ${chainMeta(chain)?.name || chain} address.`);
        }
      } else if (prov.kind === 'evm') {
        if (!window.ethereum) {
          return fail('No EVM wallet extension detected in this browser. Switch to "Enter address manually" to continue the demo.');
        }
        setStep('Opening wallet…');
        const res = await connectEvm();
        address = res.address;
        // switch network if the chosen chain differs
        const target = chainMeta(chain);
        if (target && target.hexChainId && res.chainId !== target.hexChainId) {
          setStep(`Switching to ${target.name}…`);
          try { await switchEvmChain(chain); } catch { /* user may decline; keep going */ }
        }
        usedChain = chain;
      } else if (prov.kind === 'solana') {
        if (!window.solana) {
          return fail('No Phantom wallet detected in this browser. Switch to "Enter address manually" to continue the demo.');
        }
        setStep('Opening Phantom…');
        const res = await connectSolana();
        address = res.address;
        usedChain = 'solana';
      }

      setStep('Saving wallet…');
      const { wallet } = await api.connectWallet({
        chain: usedChain, address, label: label.trim() || null, provider: providerTag,
      });

      // optional ownership proof for EVM wallets via real extension
      if (verifyAfter && prov.kind === 'evm' && provider !== 'manual' && window.ethereum) {
        try { await verifyOwnership(address); } catch (e) {
          // verification is best-effort; the wallet is still connected
          onError && onError(`Wallet connected, but signature verification was skipped: ${e.message}`);
        }
      }

      setBusy(false); setStep('');
      setManualAddr(''); setLabel('');
      onConnected && (await onConnected(wallet));
    } catch (e) {
      fail(e.message || 'Could not connect wallet.');
    }
  }

  return (
    <div className="wc-wrap">
      <style>{CSS}</style>

      <div>
        <div className="wc-step-title">1 · Choose a wallet</div>
        <div className="wc-providers" style={{ marginTop: 8 }}>
          {Object.values(PROVIDERS).map((p) => {
            const available = p.detect();
            const Icon = p.id === 'manual' ? KeyRound : p.id === 'walletconnect' ? Link2 : Wallet;
            return (
              <button key={p.id}
                className={`wc-prov ${provider === p.id ? 'sel' : ''}`}
                onClick={() => { setProvider(p.id); setErr(''); }}>
                <span className="wc-pic"><Icon size={19} /></span>
                <span style={{ minWidth: 0 }}>
                  <div className="wc-pname">{p.name}</div>
                  <div className="wc-ptag">{p.tagline}</div>
                </span>
                {p.id !== 'manual' && (
                  <span className={`wc-pdot ${available ? 'on' : 'off'}`}>{available ? 'Detected' : 'Not found'}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="wc-step-title">2 · Network</div>
        <div className="wc-chains" style={{ marginTop: 8 }}>
          {allowedChains.map((c) => {
            const meta = chainMeta(c.id);
            return (
              <span key={c.id}
                className={`wc-chain ${chain === c.id ? 'on' : ''}`}
                style={chain === c.id ? { color: meta?.color || 'var(--mint)' } : {}}
                onClick={() => setChain(c.id)}>
                <span className="wc-cdot" style={{ background: meta?.color || 'var(--muted-2)' }} />
                <span style={{ color: chain === c.id ? 'var(--ink)' : 'inherit' }}>{c.name}</span>
              </span>
            );
          })}
        </div>
      </div>

      {provider === 'manual' && (
        <div className="wc-field">
          <label>{chainMeta(chain)?.name} address</label>
          <input value={manualAddr} onChange={(e) => setManualAddr(e.target.value)}
            placeholder={chain === 'solana' ? 'e.g. 9xQeWv…' : chain === 'bitcoin' ? 'bc1q… or 1…' : '0x…'} />
        </div>
      )}

      <div className="wc-field">
        <label>Label <span style={{ fontWeight: 400, color: 'var(--muted-2)' }}>(optional)</span></label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ fontFamily: 'inherit' }}
          placeholder="e.g. Main savings, Cold storage…" />
      </div>

      {prov.kind === 'evm' && provider !== 'manual' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={verifyAfter} onChange={(e) => setVerifyAfter(e.target.checked)} />
          <ShieldCheck size={15} style={{ color: 'var(--mint-ink)' }} />
          Verify ownership with a signature (no gas, no transaction)
        </label>
      )}

      {err && <div className="wc-err"><AlertTriangle size={16} /><div>{err}</div></div>}

      <button className="wc-btn" onClick={handleConnect} disabled={busy || (provider === 'manual' && !manualAddr.trim())}>
        {busy ? <><Loader2 size={16} className="spin" /> {step || 'Working…'}</>
          : <><Wallet size={16} /> Connect wallet <ChevronRight size={15} /></>}
      </button>

      <div className="wc-note">
        <ShieldCheck size={16} />
        <div>
          Your private keys never leave your wallet. LUCA only stores your public address to display balances and verify
          ownership. {!window.ethereum && !window.solana && 'No wallet extension is detected in this browser — use “Enter address manually” for a watch-only demo.'}
        </div>
      </div>
    </div>
  );
}

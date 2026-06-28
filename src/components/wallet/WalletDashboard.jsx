/**
 * WalletDashboard — Phase 4
 * For a single connected wallet: address + copy + QR, native & token balances,
 * a receive (QR) panel, a (demo) send form, and the transaction history.
 *
 * Props:
 *   wallet     the wallet record { id, chain, address, label, provider, verified, isPrimary }
 *   onPrimary  (id) => void
 *   onDisconnect (id) => void
 *   onError    (msg) => void
 */
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, parseEther } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import {
  Copy, Check, Star, Trash2, RefreshCw, QrCode, Send, ArrowDownToLine,
  ShieldCheck, ExternalLink, Coins, Loader2, AlertTriangle, X, Wallet as WalletIcon,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import {
  chainMeta, shortAddr, fmtAmount, explorerAddressUrl, looksLikeAddress,
} from '../../lib/web3-utils.js';
import TransactionHistory from './TransactionHistory.jsx';

const CSS = `
.luca .wd-wrap{display:flex;flex-direction:column;gap:14px}
.luca .wd-head{display:flex;align-items:flex-start;gap:13px;flex-wrap:wrap}
.luca .wd-badge{width:46px;height:46px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;
  color:#fff;font-weight:800;font-size:18px}
.luca .wd-addr{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:13.5px;color:var(--ink);font-weight:600;
  display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.luca .wd-iconbtn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);background:var(--surface);
  border-radius:9px;padding:6px 9px;font-size:12px;font-weight:600;color:var(--ink);cursor:pointer;font-family:inherit}
.luca .wd-iconbtn:hover{border-color:var(--mint)}
.luca .wd-iconbtn.danger:hover{border-color:var(--danger);color:var(--danger-ink)}
.luca .wd-actions{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}
.luca .wd-bal-card{background:linear-gradient(150deg,var(--ink),var(--teal-d));border-radius:16px;padding:18px;color:#EAF6F2}
.luca .wd-bal-lbl{font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;opacity:.7}
.luca .wd-bal-amt{font-size:30px;font-weight:800;font-family:var(--mono,'IBM Plex Mono',monospace);margin-top:3px;
  display:flex;align-items:baseline;gap:8px}
.luca .wd-bal-amt .sym{font-size:15px;font-weight:700;opacity:.85}
.luca .wd-tokens{display:flex;flex-direction:column;gap:8px;margin-top:13px}
.luca .wd-token{display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.08);border-radius:11px;padding:9px 12px}
.luca .wd-token .tk{font-weight:700;font-size:13px}
.luca .wd-token .tv{margin-left:auto;font-family:var(--mono,'IBM Plex Mono',monospace);font-weight:700;font-size:13px}
.luca .wd-tabs{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:4px}
.luca .wd-tab{padding:9px 14px;font-size:13px;font-weight:700;color:var(--muted-2);cursor:pointer;
  border-bottom:2px solid transparent;margin-bottom:-1px;display:inline-flex;align-items:center;gap:6px}
.luca .wd-tab.on{color:var(--ink);border-bottom-color:var(--mint)}
.luca .wd-qr{display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:6px 2px}
.luca .wd-qr-box{background:#fff;padding:13px;border-radius:14px;border:1px solid var(--line)}
.luca .wd-field{display:flex;flex-direction:column;gap:5px;margin-bottom:11px}
.luca .wd-field label{font-size:12px;font-weight:700;color:var(--muted)}
.luca .wd-field input{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;color:var(--ink);
  background:var(--surface);font-family:var(--mono,'IBM Plex Mono',monospace);outline:none}
.luca .wd-field input:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .wd-send-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;
  border:none;background:linear-gradient(135deg,var(--teal),var(--mint));color:#fff;font-weight:700;font-size:14px;
  cursor:pointer;font-family:inherit}
.luca .wd-send-btn:disabled{opacity:.5;cursor:default}
.luca .wd-note{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:11px;background:var(--surface-2);
  border:1px solid var(--line);font-size:12px;color:var(--muted);line-height:1.5}
.luca .wd-note svg{flex-shrink:0;margin-top:1px;color:var(--gold-ink)}
.luca .wd-ver{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;
  background:var(--mint-soft);color:var(--mint-ink)}
.luca .wd-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;
  padding:10px 16px;border-radius:11px;font-size:13px;font-weight:600;z-index:60;box-shadow:var(--shadow)}
.luca .spin{animation:wd-spin 1s linear infinite}
@keyframes wd-spin{to{transform:rotate(360deg)}}
`;

export default function WalletDashboard({ wallet, onPrimary, onDisconnect, onError }) {
  const [balance, setBalance] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loadingBal, setLoadingBal] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [tab, setTab] = useState('activity');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState('');
  const meta = chainMeta(wallet.chain);

  const loadBalance = useCallback(async () => {
    setLoadingBal(true);
    try {
      const r = await api.getWalletBalance(wallet.chain, wallet.address);
      setBalance(r.balance);
    } catch (e) {
      setBalance(null);
      onError && onError(`Balance unavailable: ${e.message}`);
    } finally { setLoadingBal(false); }
  }, [wallet.chain, wallet.address, onError]);

  const loadTxs = useCallback(async () => {
    setLoadingTx(true);
    try {
      const r = await api.getWalletTransactions(wallet.chain, wallet.address, 30);
      setTxs(Array.isArray(r.transactions) ? r.transactions : []);
    } catch {
      setTxs([]);
    } finally { setLoadingTx(false); }
  }, [wallet.chain, wallet.address]);

  useEffect(() => { loadBalance(); loadTxs(); }, [loadBalance, loadTxs]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(wallet.address); setCopied(true); flash('Address copied'); setTimeout(() => setCopied(false), 1500); }
    catch { flash('Copy failed'); }
  };

  return (
    <div className="wd-wrap">
      <style>{CSS}</style>

      {/* header */}
      <div className="wd-head">
        <div className="wd-badge" style={{ background: meta?.color || 'var(--teal)' }}>{(meta?.symbol || '?').slice(0, 1)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>{wallet.label || meta?.name || wallet.chain}</span>
            {wallet.isPrimary && <span className="wd-ver" style={{ background: 'var(--gold-soft)', color: 'var(--gold-ink)' }}><Star size={11} /> Primary</span>}
            {wallet.verified && <span className="wd-ver"><ShieldCheck size={11} /> Verified</span>}
          </div>
          <div className="wd-addr" style={{ marginTop: 5 }}>
            {shortAddr(wallet.address, 10, 8)}
            <button className="wd-iconbtn" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}</button>
            <a className="wd-iconbtn" href={explorerAddressUrl(wallet.chain, wallet.address)} target="_blank" rel="noreferrer">
              <ExternalLink size={13} /> Explorer
            </a>
          </div>
        </div>
        <div className="wd-actions">
          {!wallet.isPrimary && (
            <button className="wd-iconbtn" onClick={() => onPrimary && onPrimary(wallet.id)} title="Set as primary">
              <Star size={13} /> Make primary
            </button>
          )}
          <button className="wd-iconbtn danger" onClick={() => onDisconnect && onDisconnect(wallet.id)} title="Disconnect">
            <Trash2 size={13} /> Disconnect
          </button>
        </div>
      </div>

      {/* balance */}
      <div className="wd-bal-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="wd-bal-lbl">{meta?.name || wallet.chain} balance</span>
          <button className="wd-iconbtn" onClick={loadBalance}
            style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#EAF6F2' }}>
            <RefreshCw size={13} className={loadingBal ? 'spin' : ''} />
          </button>
        </div>
        <div className="wd-bal-amt">
          {loadingBal ? <Loader2 size={26} className="spin" />
            : <>{fmtAmount(balance?.native, 6)} <span className="sym">{balance?.symbol || meta?.symbol}</span></>}
        </div>
        {balance?.tokens?.length > 0 && (
          <div className="wd-tokens">
            {balance.tokens.map((t, i) => (
              <div className="wd-token" key={i}>
                <Coins size={15} />
                <span className="tk">{t.symbol || t.name}</span>
                <span className="tv">{fmtAmount(t.balance)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* tabs */}
      <div className="wd-tabs">
        <span className={`wd-tab ${tab === 'activity' ? 'on' : ''}`} onClick={() => setTab('activity')}><Coins size={14} /> Activity</span>
        <span className={`wd-tab ${tab === 'receive' ? 'on' : ''}`} onClick={() => setTab('receive')}><ArrowDownToLine size={14} /> Receive</span>
        <span className={`wd-tab ${tab === 'send' ? 'on' : ''}`} onClick={() => setTab('send')}><Send size={14} /> Send</span>
      </div>

      {tab === 'activity' && (
        <TransactionHistory transactions={txs} chain={wallet.chain} address={wallet.address}
          loading={loadingTx} onRefresh={loadTxs} />
      )}

      {tab === 'receive' && (
        <div className="wd-qr">
          <div className="wd-qr-box">
            <QRCodeSVG value={wallet.address} size={150} level="M"
              fgColor="#0A2B29" bgColor="#ffffff" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 5 }}>Receive {meta?.symbol}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
              Scan this code or share your address to receive funds on {meta?.name}.
            </div>
            <div className="wd-addr" style={{ wordBreak: 'break-all', fontSize: 12 }}>{wallet.address}</div>
            <button className="wd-iconbtn" style={{ marginTop: 9 }} onClick={copy}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
        </div>
      )}

      {tab === 'send' && <SendForm wallet={wallet} balance={balance} onError={onError} onToast={flash} />}

      {toast && <div className="wd-toast">{toast}</div>}
    </div>
  );
}

/* --------------------------- send form (demo) --------------------------- */
function SendForm({ wallet, balance, onError, onToast }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const meta = chainMeta(wallet.chain);
  const isEvm = meta?.kind === 'evm';
  const hasExt = isEvm ? !!window.ethereum : meta?.kind === 'solana' ? !!window.solana : false;

  const submit = async () => {
    setErr('');
    if (!looksLikeAddress(wallet.chain, to.trim())) return setErr('Enter a valid recipient address.');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setErr('Enter an amount greater than zero.');
    if (balance && Number(balance.native) >= 0 && amt > Number(balance.native)) return setErr('Amount exceeds your available balance.');

    if (!hasExt) {
      setErr('No wallet extension is available to sign and broadcast this transaction in the demo environment. Connecting a real MetaMask/Phantom wallet enables live sends.');
      return;
    }
    // With a real injected provider we would build & send the tx here.
    setBusy(true);
    try {
      if (isEvm) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner(wallet.address);
        const tx = await signer.sendTransaction({ to: to.trim(), value: parseEther(amount) });
        onToast && onToast('Transaction submitted');
        setTo(''); setAmount('');
        await tx.wait?.().catch(() => {});
      } else {
        setErr('Live sending for this chain is not enabled in the demo.');
      }
    } catch (e) {
      setErr(e.message || 'Transaction failed.');
      onError && onError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="wd-field">
        <label>Recipient address</label>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={isEvm ? '0x…' : meta?.kind === 'solana' ? '9xQeWv…' : 'address'} />
      </div>
      <div className="wd-field">
        <label>Amount ({meta?.symbol})</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
      </div>
      {err && <div className="wd-note" style={{ background: 'var(--danger-soft)', color: 'var(--danger-ink)', borderColor: 'var(--danger-soft)' }}>
        <AlertTriangle size={15} /><div>{err}</div></div>}
      <button className="wd-send-btn" onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
        {busy ? <><Loader2 size={16} className="spin" /> Sending…</> : <><Send size={16} /> Send {meta?.symbol}</>}
      </button>
      <div className="wd-note" style={{ marginTop: 11 }}>
        <ShieldCheck size={15} />
        <div>Sends are signed locally by your wallet extension — LUCA never has custody of your funds.
          {!hasExt && ' Connect a real wallet extension to broadcast a live transaction.'}</div>
      </div>
    </div>
  );
}

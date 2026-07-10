/**
 * WalletCard — the member's sovereign value wallet.
 * Shows a simulated sat balance, a mock lightning address, and recent
 * simulated transactions. Every figure is clearly labelled "simulated" —
 * this is a demo of sovereign value, not real money.
 */
import React, { useEffect, useState } from 'react';
import { Wallet, Zap, ArrowDownLeft, ArrowUpRight, Loader2, Copy } from 'lucide-react';
import { api } from '../../lib/api.js';

const fmtSats = (n) => `${(Number(n) || 0).toLocaleString()} sats`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ''; } };

export default function WalletCard({ user }) {
  const [payments, setPayments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await api.getMyPayments(); if (alive) setPayments(r.payments || []); }
      catch { if (alive) setPayments([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const txs = payments || [];
  // simulated balance derived from an opening demo balance minus outflows
  const OPENING = 2_100_000;
  const spent = txs.reduce((s, t) => s + (Number(t.amountSats) || 0), 0);
  const balance = Math.max(0, OPENING - spent);
  const handle = (user?.displayName || user?.firstName || 'member').toString().toLowerCase().replace(/[^a-z0-9]/g, '') || 'member';
  const lnAddress = `${handle}@solaris.health`;

  const copyLn = async () => {
    try { await navigator.clipboard.writeText(lnAddress); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  };

  return (
    <div className="wlt">
      <div className="wlt-head">
        <div className="wlt-head-l">
          <div className="wlt-ico"><Wallet size={16} /></div>
          <div>
            <div className="wlt-title">Value Wallet</div>
            <div className="wlt-sub">Sovereign · Lightning-native</div>
          </div>
        </div>
        <span className="wlt-sim">All values simulated</span>
      </div>

      <div className="wlt-balance">
        <div className="wlt-balance-val">{balance.toLocaleString()}</div>
        <div className="wlt-balance-unit">sats <span className="wlt-sim-inline">(simulated)</span></div>
      </div>

      <button className="wlt-ln" onClick={copyLn} title="Copy lightning address">
        <Zap size={13} />
        <span className="wlt-ln-addr">{lnAddress}</span>
        <span className="wlt-ln-mock">mock</span>
        <Copy size={12} className="wlt-ln-copy" />
        {copied && <span className="wlt-ln-copied">Copied</span>}
      </button>

      <div className="wlt-txns">
        <div className="wlt-txns-h">Recent activity</div>
        {loading ? (
          <div className="wlt-loading"><Loader2 size={16} className="wlt-spin" /> Loading…</div>
        ) : txs.length === 0 ? (
          <div className="wlt-empty">No simulated transactions yet.</div>
        ) : (
          <div className="wlt-txn-list">
            {txs.slice(0, 6).map((t) => (
              <div className="wlt-txn" key={t.id}>
                <div className="wlt-txn-ico out"><ArrowUpRight size={13} /></div>
                <div className="wlt-txn-main">
                  <span className="wlt-txn-name">{t.orgName || t.description || 'Payment'}</span>
                  <span className="wlt-txn-date">{fmtDate(t.createdAt)}</span>
                </div>
                <div className="wlt-txn-amt">-{fmtSats(t.amountSats)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .luca .wlt{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
        .luca .wlt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
        .luca .wlt-head-l{display:flex;align-items:center;gap:10px}
        .luca .wlt-ico{width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;
          background:var(--ink);color:var(--gold)}
        .luca .wlt-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:var(--ink)}
        .luca .wlt-sub{font-size:11px;color:var(--muted)}
        .luca .wlt-sim{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
          background:#FBEFD3;color:#8A5F13;padding:3px 8px;border-radius:99px;flex:none}
        .luca .wlt-balance{margin:16px 0 4px;display:flex;align-items:baseline;gap:8px}
        .luca .wlt-balance-val{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;color:var(--ink);line-height:1}
        .luca .wlt-balance-unit{font-size:13px;color:var(--muted)}
        .luca .wlt-sim-inline{font-size:11px;font-style:italic;opacity:.85}
        .luca .wlt-ln{margin-top:12px;width:100%;display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:var(--r-sm);
          border:1px dashed var(--line);background:var(--surface-2);cursor:pointer;position:relative}
        .luca .wlt-ln:hover{border-color:var(--gold)}
        .luca .wlt-ln svg:first-child{color:var(--gold)}
        .luca .wlt-ln-addr{font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:var(--ink);flex:1;text-align:left}
        .luca .wlt-ln-mock{font-size:9.5px;font-weight:700;text-transform:uppercase;background:#fff;color:#8A5F13;padding:2px 6px;border-radius:99px}
        .luca .wlt-ln-copy{color:var(--muted-2)}
        .luca .wlt-ln-copied{position:absolute;right:10px;font-size:10px;color:var(--teal-d);background:var(--mint-soft);padding:2px 6px;border-radius:99px}
        .luca .wlt-txns{margin-top:16px}
        .luca .wlt-txns-h{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px}
        .luca .wlt-txn-list{display:flex;flex-direction:column;gap:2px}
        .luca .wlt-txn{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px dashed var(--line)}
        .luca .wlt-txn:last-child{border-bottom:none}
        .luca .wlt-txn-ico{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
        .luca .wlt-txn-ico.out{background:#FBE7E7;color:#B23B3B}
        .luca .wlt-txn-ico.in{background:var(--mint-soft);color:var(--teal-d)}
        .luca .wlt-txn-main{flex:1;min-width:0;display:flex;flex-direction:column}
        .luca .wlt-txn-name{font-size:12.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .luca .wlt-txn-date{font-size:10.5px;color:var(--muted)}
        .luca .wlt-txn-amt{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;color:var(--ink);flex:none}
        .luca .wlt-empty,.luca .wlt-loading{font-size:12.5px;color:var(--muted);padding:14px 4px;display:flex;align-items:center;gap:8px}
        .luca .wlt-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

/**
 * TransactionHistory — Phase 4
 * Filterable / searchable transaction list with explorer links, CSV export
 * and pagination. Scoped under `.luca` to match the LUCA design system.
 *
 * Props:
 *   transactions  array of { hash, type, from, to, amount, symbol, timestamp, status, explorerUrl }
 *   chain         chain id (for explorer fallback)
 *   address       the wallet address (to label sent/received)
 *   loading       boolean
 *   onRefresh     optional () => void
 */
import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, Repeat, Search, Download, ExternalLink,
  RefreshCw, Filter, ChevronLeft, ChevronRight, Inbox,
} from 'lucide-react';
import { explorerTxUrl, shortAddr, fmtAmount } from '../../lib/web3-utils.js';

const PAGE_SIZE = 8;

const CSS = `
.luca .txh-wrap{display:flex;flex-direction:column;gap:12px}
.luca .txh-controls{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
.luca .txh-search{position:relative;flex:1;min-width:160px}
.luca .txh-search input{width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 10px 8px 32px;
  font-size:13px;color:var(--ink);background:var(--surface);font-family:inherit;outline:none}
.luca .txh-search input:focus{border-color:var(--mint);box-shadow:0 0 0 3px var(--mint-soft)}
.luca .txh-search svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted-2)}
.luca .txh-filters{display:flex;gap:6px;flex-wrap:wrap}
.luca .txh-fchip{display:inline-flex;align-items:center;gap:5px;padding:6px 11px;border-radius:999px;
  border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:12px;font-weight:600;
  color:var(--muted-2);transition:all .15s ease;user-select:none}
.luca .txh-fchip.on{color:var(--ink);border-color:var(--mint);background:var(--mint-soft)}
.luca .txh-row{display:flex;align-items:center;gap:12px;padding:11px 4px;border-bottom:1px solid var(--line-2)}
.luca .txh-row:last-child{border-bottom:none}
.luca .txh-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
.luca .txh-ic.sent{background:var(--danger-soft);color:var(--danger-ink)}
.luca .txh-ic.received{background:var(--mint-soft);color:var(--mint-ink)}
.luca .txh-ic.transfer{background:var(--gold-soft);color:var(--gold-ink)}
.luca .txh-mid{flex:1;min-width:0}
.luca .txh-hash{font-family:var(--mono,'IBM Plex Mono',monospace);font-size:12.5px;color:var(--ink);font-weight:600;
  display:flex;align-items:center;gap:6px}
.luca .txh-hash a{color:var(--teal);display:inline-flex}
.luca .txh-sub{font-size:11.5px;color:var(--muted-2);margin-top:2px}
.luca .txh-amt{text-align:right;flex-shrink:0}
.luca .txh-amt .v{font-size:13px;font-weight:700;font-family:var(--mono,'IBM Plex Mono',monospace)}
.luca .txh-amt .v.sent{color:var(--danger-ink)}
.luca .txh-amt .v.received{color:var(--mint-ink)}
.luca .txh-badge{display:inline-block;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;
  text-transform:uppercase;letter-spacing:.03em;margin-top:3px}
.luca .txh-badge.success{background:var(--mint-soft);color:var(--mint-ink)}
.luca .txh-badge.failed{background:var(--danger-soft);color:var(--danger-ink)}
.luca .txh-badge.pending{background:var(--gold-soft);color:var(--gold-ink)}
.luca .txh-pager{display:flex;align-items:center;justify-content:space-between;padding-top:6px}
.luca .txh-pager button{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);
  background:var(--surface);border-radius:9px;padding:6px 10px;font-size:12.5px;font-weight:600;color:var(--ink);
  cursor:pointer;font-family:inherit}
.luca .txh-pager button:disabled{opacity:.4;cursor:default}
.luca .txh-empty{text-align:center;padding:30px 14px;color:var(--muted-2)}
.luca .txh-empty svg{margin-bottom:8px}
.luca .txh-iconbtn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);
  background:var(--surface);border-radius:9px;padding:7px 11px;font-size:12.5px;font-weight:600;color:var(--ink);
  cursor:pointer;font-family:inherit}
.luca .txh-iconbtn:hover{border-color:var(--mint)}
`;

const TYPE_ICON = { sent: ArrowUpRight, received: ArrowDownLeft, transfer: Repeat };

function fmtTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return ts; }
}

export default function TransactionHistory({ transactions = [], chain, address, loading, onRefresh }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = Array.isArray(transactions) ? transactions.slice() : [];
    if (filter !== 'all') list = list.filter((t) => t.type === filter);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((t) =>
        (t.hash || '').toLowerCase().includes(s) ||
        (t.from || '').toLowerCase().includes(s) ||
        (t.to || '').toLowerCase().includes(s));
    }
    return list;
  }, [transactions, filter, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const rows = [['hash', 'type', 'from', 'to', 'amount', 'symbol', 'status', 'timestamp']];
    filtered.forEach((t) => rows.push([
      t.hash || '', t.type || '', t.from || '', t.to || '',
      t.amount ?? '', t.symbol || '', t.status || '', t.timestamp || '',
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `transactions-${chain}-${(address || '').slice(0, 8)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'received', label: 'Received' },
    { id: 'sent', label: 'Sent' },
    { id: 'transfer', label: 'Transfers' },
  ];

  return (
    <div className="txh-wrap">
      <style>{CSS}</style>
      <div className="txh-controls">
        <div className="txh-search">
          <Search size={15} />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Search hash or address…"
          />
        </div>
        <button className="txh-iconbtn" onClick={exportCsv} disabled={!filtered.length} title="Export CSV">
          <Download size={14} /> CSV
        </button>
        {onRefresh && (
          <button className="txh-iconbtn" onClick={onRefresh} title="Refresh">
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        )}
      </div>

      <div className="txh-filters">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted-2)', fontSize: 12, fontWeight: 600 }}>
          <Filter size={13} />
        </span>
        {FILTERS.map((f) => (
          <span key={f.id}
            className={`txh-fchip ${filter === f.id ? 'on' : ''}`}
            onClick={() => { setFilter(f.id); setPage(0); }}>
            {f.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="txh-empty"><RefreshCw size={22} className="spin" /><div>Loading transactions…</div></div>
      ) : !pageItems.length ? (
        <div className="txh-empty">
          <Inbox size={26} />
          <div style={{ fontWeight: 600, color: 'var(--muted)' }}>No transactions found</div>
          <div style={{ fontSize: 12.5, marginTop: 3 }}>
            {transactions.length ? 'Try a different filter or search.' : 'On-chain history will appear here once available.'}
          </div>
        </div>
      ) : (
        <div>
          {pageItems.map((t, i) => {
            const Icon = TYPE_ICON[t.type] || Repeat;
            const url = t.explorerUrl || explorerTxUrl(chain, t.hash);
            return (
              <div className="txh-row" key={t.hash || i}>
                <div className={`txh-ic ${t.type || 'transfer'}`}><Icon size={17} /></div>
                <div className="txh-mid">
                  <div className="txh-hash">
                    {shortAddr(t.hash, 10, 8)}
                    {url && url !== '#' && (
                      <a href={url} target="_blank" rel="noreferrer" title="View on explorer"><ExternalLink size={12} /></a>
                    )}
                  </div>
                  <div className="txh-sub">
                    {t.type === 'sent' && t.to ? `To ${shortAddr(t.to)}` :
                      t.type === 'received' && t.from ? `From ${shortAddr(t.from)}` :
                        fmtTime(t.timestamp)}
                    {(t.type === 'sent' || t.type === 'received') && ` · ${fmtTime(t.timestamp)}`}
                  </div>
                </div>
                <div className="txh-amt">
                  <div className={`v ${t.type || ''}`}>
                    {t.amount != null ? `${t.type === 'sent' ? '−' : t.type === 'received' ? '+' : ''}${fmtAmount(t.amount)} ${t.symbol || ''}` : '—'}
                  </div>
                  {t.status && <span className={`txh-badge ${t.status}`}>{t.status}</span>}
                </div>
              </div>
            );
          })}

          {pageCount > 1 && (
            <div className="txh-pager">
              <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted-2)', fontWeight: 600 }}>
                Page {safePage + 1} of {pageCount} · {filtered.length} tx
              </span>
              <button onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

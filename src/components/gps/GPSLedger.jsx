/**
 * GPSLedger — the patient's "Value Trail".
 *
 * Every transaction the member makes is shown with its full six-way GPS split,
 * the LOVE points earned, and its contribution to the regenerative commons.
 * "You own your economic trail."
 */

import React, { useEffect, useState } from 'react';
import {
  Sprout, Heart, Coins, TrendingUp, ChevronDown, Loader2, Leaf, Info,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import ValueFlowViz, { GPS_BUCKETS } from './ValueFlowViz.jsx';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  try { return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return String(d); }
};

const SPLIT_FIELDS = [
  { key: 'provider_share', bucket: 'provider' },
  { key: 'contributor_share', bucket: 'contributor' },
  { key: 'infrastructure_share', bucket: 'infrastructure' },
  { key: 'treasury_share', bucket: 'treasury' },
  { key: 'software_share', bucket: 'software' },
  { key: 'user_reward_share', bucket: 'userReward' },
];

export default function GPSLedger() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getGpsLedger(50, 0);
        if (alive) setData(r);
      } catch { if (alive) setData({ transactions: [], summary: {} }); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const s = data?.summary || {};
  const txs = data?.transactions || [];
  const lovePoints = Math.round(Number(s.total_rewards || 0) * 100);

  return (
    <div className="gpl">
      <div className="gpl-hero">
        <div className="gpl-hero-badge"><Leaf size={13} /> Generative Prosperity System</div>
        <h2 className="gpl-hero-h">Your Value Trail</h2>
        <p className="gpl-hero-sub">Every transaction you make builds the ecosystem — and a share always flows back to you.</p>
        <button className="gpl-how-link" onClick={() => setShowHow((v) => !v)}>
          <Info size={13} /> How GPS works {showHow ? '▲' : '▼'}
        </button>
        {showHow && (
          <div className="gpl-how">
            <ValueFlowViz total={100} compact />
            <p className="gpl-how-note">Value flows to where value was created. Every seed you plant feeds the person, the provider, the local node, and the regenerative commons.</p>
          </div>
        )}
      </div>

      <div className="gpl-cards">
        <SummaryCard icon={Coins} tone="teal" label="Total spent" value={money(s.total_spent)} sub={`${s.tx_count || 0} transactions`} />
        <SummaryCard icon={Heart} tone="gold" label="LOVE earned" value={`${lovePoints}`} sub="Reciprocity credits (2% back)" />
        <SummaryCard icon={Sprout} tone="green" label="Treasury contributed" value={money(s.treasury_contributed)} sub="To the regenerative commons" />
        <SummaryCard icon={TrendingUp} tone="mint" label="Ecosystem impact" value={`${s.impact_score || 0}`} sub="Your regenerative footprint" />
      </div>

      {loading ? (
        <div className="gpl-loading"><Loader2 className="gpl-spin" size={22} /> Loading your value trail…</div>
      ) : txs.length === 0 ? (
        <div className="gpl-empty">
          <Sprout size={30} />
          <h3>No value trail yet</h3>
          <p>Once your appointments are completed, you'll see exactly how every transaction fed the ecosystem — and the LOVE credits you earned.</p>
        </div>
      ) : (
        <div className="gpl-list">
          {txs.map((t) => {
            const isOpen = open === t.id;
            return (
              <div className={`gpl-tx ${isOpen ? 'open' : ''}`} key={t.id}>
                <button className="gpl-tx-head" onClick={() => setOpen(isOpen ? null : t.id)}>
                  <div className="gpl-tx-main">
                    <span className="gpl-tx-title">{t.service_name || 'Service'} · {t.business_name || 'Provider'}</span>
                    <span className="gpl-tx-date">{fmtDate(t.created_at)}</span>
                  </div>
                  <div className="gpl-tx-right">
                    <span className="gpl-tx-amt">{money(t.total_amount)}</span>
                    <span className="gpl-tx-reward"><Heart size={11} /> +{Math.round(Number(t.user_reward_share) * 100)} LOVE</span>
                    <span className={`gpl-tx-status ${t.status}`}>{t.status === 'settled' ? 'Settled' : 'Pending'}</span>
                    <ChevronDown size={16} className="gpl-tx-chev" />
                  </div>
                </button>
                {isOpen && (
                  <div className="gpl-tx-body">
                    <div className="gpl-split-note">Your contribution to the ecosystem, split transparently:</div>
                    {SPLIT_FIELDS.map((f) => {
                      const meta = GPS_BUCKETS.find((b) => b.key === f.bucket);
                      const amt = Number(t[f.key]) || 0;
                      return (
                        <div className="gpl-split-row" key={f.key}>
                          <span className="gpl-split-dot" style={{ background: meta.color }} />
                          <span className="gpl-split-lbl">{meta.label}</span>
                          <span className="gpl-split-pct">{meta.pct}%</span>
                          <span className="gpl-split-amt">{money(amt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .luca .gpl{display:flex;flex-direction:column;gap:18px}
        .luca .gpl-hero{background:linear-gradient(155deg,var(--teal-d) 0%,var(--teal-d2) 100%);color:#fff;
          border-radius:var(--r-lg);padding:22px 24px;box-shadow:var(--shadow);position:relative;overflow:hidden}
        .luca .gpl-hero::after{content:'';position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;
          background:radial-gradient(circle,rgba(159,231,214,.22),transparent 70%)}
        .luca .gpl-hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;
          background:rgba(255,255,255,.14);padding:4px 10px;border-radius:99px;letter-spacing:.04em}
        .luca .gpl-hero-h{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;margin:10px 0 4px}
        .luca .gpl-hero-sub{font-size:13.5px;opacity:.9;max-width:560px;margin:0}
        .luca .gpl-how-link{margin-top:12px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);
          border:none;color:#fff;font-size:12px;padding:6px 12px;border-radius:99px;cursor:pointer;font-weight:600}
        .luca .gpl-how-link:hover{background:rgba(255,255,255,.2)}
        .luca .gpl-how{margin-top:16px;background:rgba(255,255,255,.96);border-radius:var(--r);padding:18px}
        .luca .gpl-how-note{font-size:12px;color:var(--muted);font-style:italic;margin:14px 0 0;text-align:center}
        .luca .gpl-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        @media(max-width:820px){.luca .gpl-cards{grid-template-columns:repeat(2,1fr)}}
        .luca .gpl-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px;
          box-shadow:var(--shadow-sm)}
        .luca .gpl-card-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
        .luca .gpl-card-ico.teal{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-card-ico.gold{background:#FBEFD3;color:#B67D1C}
        .luca .gpl-card-ico.green{background:#E9F3DA;color:#5E7F2C}
        .luca .gpl-card-ico.mint{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-card-val{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:var(--ink)}
        .luca .gpl-card-lbl{font-size:12px;font-weight:600;color:var(--ink);margin-top:2px}
        .luca .gpl-card-sub{font-size:11px;color:var(--muted-2);margin-top:1px}
        .luca .gpl-list{display:flex;flex-direction:column;gap:9px}
        .luca .gpl-tx{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;
          box-shadow:var(--shadow-sm)}
        .luca .gpl-tx.open{border-color:var(--mint-line)}
        .luca .gpl-tx-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;
          background:none;border:none;padding:14px 16px;cursor:pointer;text-align:left}
        .luca .gpl-tx-main{display:flex;flex-direction:column;gap:2px;min-width:0}
        .luca .gpl-tx-title{font-size:14px;font-weight:600;color:var(--ink)}
        .luca .gpl-tx-date{font-size:11.5px;color:var(--muted-2)}
        .luca .gpl-tx-right{display:flex;align-items:center;gap:12px;flex:none}
        .luca .gpl-tx-amt{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--ink)}
        .luca .gpl-tx-reward{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;
          color:#B67D1C;background:#FBEFD3;padding:3px 8px;border-radius:99px}
        .luca .gpl-tx-status{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:99px;text-transform:uppercase;letter-spacing:.04em}
        .luca .gpl-tx-status.settled{background:var(--mint-soft);color:var(--teal-d)}
        .luca .gpl-tx-status.pending{background:var(--surface-2);color:var(--muted)}
        .luca .gpl-tx-chev{color:var(--muted-2);transition:transform .2s}
        .luca .gpl-tx.open .gpl-tx-chev{transform:rotate(180deg)}
        .luca .gpl-tx-body{padding:4px 16px 16px;border-top:1px solid var(--line)}
        .luca .gpl-split-note{font-size:11.5px;color:var(--muted);margin:12px 0 10px;font-style:italic}
        .luca .gpl-split-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px dashed var(--line)}
        .luca .gpl-split-row:last-child{border-bottom:none}
        .luca .gpl-split-dot{width:9px;height:9px;border-radius:50%;flex:none}
        .luca .gpl-split-lbl{flex:1;font-size:13px;color:var(--ink)}
        .luca .gpl-split-pct{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--muted);width:42px;text-align:right}
        .luca .gpl-split-amt{font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:13px;color:var(--ink);width:64px;text-align:right}
        .luca .gpl-empty,.luca .gpl-loading{text-align:center;padding:40px 20px;color:var(--muted);
          background:var(--surface);border:1px dashed var(--line);border-radius:var(--r)}
        .luca .gpl-empty svg{color:var(--teal);margin-bottom:8px}
        .luca .gpl-empty h3{font-family:'Space Grotesk',sans-serif;margin:0 0 6px;color:var(--ink)}
        .luca .gpl-empty p{font-size:13px;max-width:420px;margin:0 auto}
        .luca .gpl-loading{display:flex;align-items:center;justify-content:center;gap:8px}
        .luca .gpl-spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

function SummaryCard({ icon: Icon, tone, label, value, sub }) {
  return (
    <div className="gpl-card">
      <div className={`gpl-card-ico ${tone}`}><Icon size={17} /></div>
      <div className="gpl-card-val">{value}</div>
      <div className="gpl-card-lbl">{label}</div>
      <div className="gpl-card-sub">{sub}</div>
    </div>
  );
}

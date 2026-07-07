/**
 * RegenerativeTreasury — "The Solaris Regenerative Commons".
 *
 * A public view of the community treasury that grows with every booking:
 * total balance, per-fund breakdown, recent (anonymized) contributions,
 * a monthly growth chart, a "how it works" explainer, and governance teaser.
 */

import React, { useEffect, useState } from 'react';
import {
  Sprout, Loader2, TrendingUp, Vote, Info,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../../lib/api.js';
import ValueFlowViz from './ValueFlowViz.jsx';

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtMonth = (m) => {
  try { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
  catch { return m; }
};
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
};

export default function RegenerativeTreasury() {
  const [tre, setTre] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, b] = await Promise.all([
          api.getGpsTreasury().catch(() => null),
          api.getGpsTreasuryBreakdown().catch(() => null),
        ]);
        if (!alive) return;
        setTre(t); setBreakdown(b);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="rgt-loading"><Loader2 className="rgt-spin" size={22} /> Loading the commons…</div>;

  const funds = tre?.funds || [];
  const maxFund = Math.max(1, ...funds.map((f) => f.amount));
  const recent = breakdown?.recent || [];
  const growthData = buildCumulative(tre?.growth || []);

  return (
    <div className="rgt">
      <div className="rgt-hero">
        <div className="rgt-hero-badge"><Sprout size={13} /> The Regenerative Commons</div>
        <h2 className="rgt-hero-h">The Solaris Community Treasury</h2>
        <p className="rgt-hero-sub">A shared fund that grows with every booking. 3% of each transaction is planted here — regenerating health, food, education, and resilience for all.</p>
        <div className="rgt-balance">
          <span className="rgt-balance-lbl">Total commons balance</span>
          <span className="rgt-balance-val">{money(tre?.balance)}</span>
          <span className="rgt-balance-sub">across {tre?.deposits || 0} contributions from the community</span>
        </div>
      </div>

      <div className="rgt-cols">
        <div className="rgt-main">
          <div className="rgt-card">
            <h3 className="rgt-card-h">Fund breakdown</h3>
            <div className="rgt-funds">
              {funds.map((f) => (
                <div className="rgt-fund" key={f.fund_type}>
                  <div className="rgt-fund-top">
                    <span className="rgt-fund-name"><span className="rgt-fund-ico">{f.icon}</span> {f.label}</span>
                    <span className="rgt-fund-amt">{money(f.amount)}</span>
                  </div>
                  <div className="rgt-fund-track"><div className="rgt-fund-bar" style={{ width: `${(f.amount / maxFund) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="rgt-card">
            <h3 className="rgt-card-h"><TrendingUp size={15} /> Treasury growth</h3>
            {growthData.length > 1 ? (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <AreaChart data={growthData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rgtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0E7C66" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#0E7C66" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(v) => money(v)} labelFormatter={fmtMonth}
                      contentStyle={{ background: 'var(--ink)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                    <Area type="monotone" dataKey="cumulative" stroke="#0E7C66" strokeWidth={2} fill="url(#rgtGrad)" name="Commons balance" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <p className="rgt-empty">The growth chart will appear as the commons accumulates.</p>}
          </div>

          <div className="rgt-card">
            <h3 className="rgt-card-h"><Info size={15} /> How it works</h3>
            <ValueFlowViz total={100} compact />
            <p className="rgt-how-note">Every transaction on Solaris Health is split six ways. The Regenerative Treasury (3%) is the community's shared endowment — owned by no one, growing for everyone. <b>Every transaction plants a seed.</b></p>
          </div>
        </div>

        <div className="rgt-side">
          <div className="rgt-card">
            <h3 className="rgt-card-h">Recent contributions</h3>
            {recent.length === 0 ? (
              <p className="rgt-empty">Contributions will appear here as members book care.</p>
            ) : (
              <div className="rgt-recent">
                {recent.map((r, i) => (
                  <div className="rgt-recent-row" key={i}>
                    <span className="rgt-recent-dot" />
                    <div className="rgt-recent-meta">
                      <span className="rgt-recent-desc">{r.description}</span>
                      <span className="rgt-recent-time">{timeAgo(r.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rgt-card rgt-gov">
            <div className="rgt-gov-ico"><Vote size={20} /></div>
            <h3 className="rgt-card-h">Governance</h3>
            <p className="rgt-gov-txt">Soon, the community will vote on how the treasury is deployed — funding clinics, food projects, scholarships, and open-source tools.</p>
            <span className="rgt-gov-pill">Coming soon — community voting</span>
          </div>
        </div>
      </div>

      <style>{`
        .luca .rgt{display:flex;flex-direction:column;gap:16px}
        .luca .rgt-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:40px;color:var(--muted)}
        .luca .rgt-spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .luca .rgt-hero{background:linear-gradient(150deg,#0E7C66 0%,#123f36 100%);color:#fff;border-radius:var(--r-lg);
          padding:28px;box-shadow:var(--shadow);position:relative;overflow:hidden}
        .luca .rgt-hero::after{content:'';position:absolute;left:-40px;top:-60px;width:220px;height:220px;border-radius:50%;
          background:radial-gradient(circle,rgba(127,174,75,.3),transparent 70%)}
        .luca .rgt-hero-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;
          background:rgba(255,255,255,.15);padding:4px 10px;border-radius:99px}
        .luca .rgt-hero-h{font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:700;margin:12px 0 6px}
        .luca .rgt-hero-sub{font-size:14px;opacity:.9;max-width:600px;margin:0}
        .luca .rgt-balance{margin-top:20px;display:flex;flex-direction:column;gap:2px}
        .luca .rgt-balance-lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.8}
        .luca .rgt-balance-val{font-family:'Space Grotesk',sans-serif;font-size:44px;font-weight:700;line-height:1;color:#F6D67A}
        .luca .rgt-balance-sub{font-size:12.5px;opacity:.85}
        .luca .rgt-cols{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;align-items:start}
        @media(max-width:900px){.luca .rgt-cols{grid-template-columns:1fr}}
        .luca .rgt-main,.luca .rgt-side{display:flex;flex-direction:column;gap:14px}
        .luca .rgt-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow-sm)}
        .luca .rgt-card-h{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-size:15px;
          font-weight:600;color:var(--ink);margin:0 0 14px}
        .luca .rgt-funds{display:flex;flex-direction:column;gap:13px}
        .luca .rgt-fund-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}
        .luca .rgt-fund-name{font-size:13px;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:7px}
        .luca .rgt-fund-ico{font-size:15px}
        .luca .rgt-fund-amt{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:var(--teal-d)}
        .luca .rgt-fund-track{height:8px;border-radius:99px;background:var(--surface-2);overflow:hidden}
        .luca .rgt-fund-bar{height:100%;border-radius:99px;background:linear-gradient(90deg,#7FAE4B,#0E7C66);
          transform-origin:left;animation:rgtGrow 1s ease forwards}
        @keyframes rgtGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .luca .rgt-how-note{font-size:12.5px;color:var(--muted);margin:14px 0 0;line-height:1.6}
        .luca .rgt-empty{font-size:13px;color:var(--muted);margin:0}
        .luca .rgt-recent{display:flex;flex-direction:column;gap:11px;max-height:360px;overflow-y:auto}
        .luca .rgt-recent-row{display:flex;gap:9px}
        .luca .rgt-recent-dot{width:8px;height:8px;border-radius:50%;background:var(--teal);margin-top:5px;flex:none}
        .luca .rgt-recent-meta{display:flex;flex-direction:column;gap:1px}
        .luca .rgt-recent-desc{font-size:12.5px;color:var(--ink);line-height:1.4}
        .luca .rgt-recent-time{font-size:10.5px;color:var(--muted-2)}
        .luca .rgt-gov{background:linear-gradient(150deg,var(--mint-soft),var(--surface))}
        .luca .rgt-gov-ico{width:38px;height:38px;border-radius:11px;background:var(--teal-d);color:#fff;
          display:flex;align-items:center;justify-content:center;margin-bottom:10px}
        .luca .rgt-gov-txt{font-size:13px;color:var(--muted);line-height:1.6;margin:0 0 12px}
        .luca .rgt-gov-pill{display:inline-block;font-size:11px;font-weight:600;color:var(--teal-d);
          background:rgba(14,124,102,.1);padding:5px 12px;border-radius:99px}
      `}</style>
    </div>
  );
}

/** Convert per-month deposits into a cumulative running total for the chart. */
function buildCumulative(growth) {
  let run = 0;
  return growth.map((g) => { run += Number(g.amount) || 0; return { month: g.month, amount: Number(g.amount) || 0, cumulative: Math.round(run * 100) / 100 }; });
}

/**
 * ValueFlowViz — an animated diagram of how a transaction's value flows
 * through the Generative Prosperity System (GPS).
 *
 * Center = the transaction amount; six buckets radiate out with their share.
 * Reused in the "How GPS Works" explainer and on the booking confirmation.
 */

import React from 'react';
import { Stethoscope, Users, Server, Sprout, Code2, Heart } from 'lucide-react';

// The canonical six-way split. Fractions sum to 1.
export const GPS_BUCKETS = [
  { key: 'provider', pct: 85, label: 'Service Provider', tag: 'Sovereign income', icon: Stethoscope, color: '#0E7C66' },
  { key: 'contributor', pct: 5, label: 'Contributor', tag: 'Ecosystem builder', icon: Users, color: '#2FA88C' },
  { key: 'infrastructure', pct: 3, label: 'Local Infrastructure', tag: 'Node operators', icon: Server, color: '#5FB89F' },
  { key: 'treasury', pct: 3, label: 'Regenerative Treasury', tag: 'Community commons', icon: Sprout, color: '#7FAE4B' },
  { key: 'software', pct: 2, label: 'Software', tag: 'Platform upkeep', icon: Code2, color: '#8A94A6' },
  { key: 'userReward', pct: 2, label: 'Your Rewards', tag: 'LOVE credits', icon: Heart, color: '#E3AC46' },
];

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

export default function ValueFlowViz({ total = 100, compact = false, showAmounts = true }) {
  const t = Number(total) || 0;
  return (
    <div className={`vfz ${compact ? 'compact' : ''}`}>
      <div className="vfz-center">
        <span className="vfz-center-lbl">Transaction</span>
        <span className="vfz-center-amt">{money(t)}</span>
        <span className="vfz-center-sub">plants a seed</span>
      </div>
      <div className="vfz-rows">
        {GPS_BUCKETS.map((b, i) => {
          const Icon = b.icon;
          const amt = (t * b.pct) / 100;
          return (
            <div className="vfz-row" key={b.key} style={{ animationDelay: `${i * 90}ms` }}>
              <div className="vfz-ico" style={{ background: b.color }}><Icon size={15} /></div>
              <div className="vfz-meta">
                <div className="vfz-line">
                  <span className="vfz-lbl">{b.label}</span>
                  <span className="vfz-pct">{b.pct}%</span>
                </div>
                <div className="vfz-bar-track">
                  <div className="vfz-bar" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <div className="vfz-tag">{b.tag}{showAmounts && t > 0 ? ` · ${money(amt)}` : ''}</div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .luca .vfz{display:grid;grid-template-columns:150px 1fr;gap:20px;align-items:center}
        .luca .vfz.compact{grid-template-columns:120px 1fr;gap:14px}
        .luca .vfz-center{display:flex;flex-direction:column;align-items:center;justify-content:center;
          text-align:center;padding:20px 14px;border-radius:var(--r);
          background:linear-gradient(160deg,var(--teal-d) 0%,var(--teal-d2) 100%);color:#fff;
          box-shadow:var(--shadow-sm);position:relative;overflow:hidden}
        .luca .vfz-center::after{content:'';position:absolute;inset:0;
          background:radial-gradient(circle at 30% 20%,rgba(159,231,214,.25),transparent 60%)}
        .luca .vfz-center-lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;font-family:'IBM Plex Mono',monospace}
        .luca .vfz-center-amt{font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:700;line-height:1.1;margin:4px 0}
        .luca .vfz.compact .vfz-center-amt{font-size:24px}
        .luca .vfz-center-sub{font-size:11px;opacity:.8;font-style:italic}
        .luca .vfz-rows{display:flex;flex-direction:column;gap:9px}
        .luca .vfz-row{display:flex;align-items:center;gap:11px;opacity:0;transform:translateX(10px);
          animation:vfzIn .5s ease forwards}
        @keyframes vfzIn{to{opacity:1;transform:translateX(0)}}
        .luca .vfz-ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;
          justify-content:center;color:#fff;flex:none;box-shadow:var(--shadow-sm)}
        .luca .vfz-meta{flex:1;min-width:0}
        .luca .vfz-line{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
        .luca .vfz-lbl{font-size:13px;font-weight:600;color:var(--ink)}
        .luca .vfz-pct{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--muted)}
        .luca .vfz-bar-track{height:5px;border-radius:99px;background:var(--surface-2);margin:4px 0 3px;overflow:hidden}
        .luca .vfz-bar{height:100%;border-radius:99px;transform-origin:left;animation:vfzGrow .8s ease forwards}
        @keyframes vfzGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        .luca .vfz-tag{font-size:11px;color:var(--muted-2)}
        @media(max-width:640px){.luca .vfz{grid-template-columns:1fr;gap:14px}}
      `}</style>
    </div>
  );
}

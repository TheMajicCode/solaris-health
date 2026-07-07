/**
 * GPSStats — the admin view of the Generative Prosperity System economy.
 *
 * Surfaces platform-wide value flow: gross volume, how it split across the six
 * buckets, the regenerative treasury balance, the top ecosystem builders, and a
 * live feed of recent GPS settlements.
 */

import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, Sprout, Users, Layers } from 'lucide-react';
import { api } from '../../lib/api.js';
import { GPS_BUCKETS } from '../gps/ValueFlowViz.jsx';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return ''; }
};

const STAT_KEYS = [
  { field: 'provider_total', bucket: 'provider' },
  { field: 'contributor_total', bucket: 'contributor' },
  { field: 'infrastructure_total', bucket: 'infrastructure' },
  { field: 'treasury_total', bucket: 'treasury' },
  { field: 'software_total', bucket: 'software' },
  { field: 'reward_total', bucket: 'userReward' },
];

export default function GPSStats() {
  const [data, setData] = useState(null);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, b] = await Promise.all([api.getGpsStats(), api.getGpsLeaderboard()]);
        if (!alive) return;
        setData(d);
        setBoard(b?.leaderboard || []);
      } catch (e) {
        if (alive) setErr(e?.message || 'Could not load GPS statistics');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const stats = data?.stats || {};
  const gross = Number(stats.gross_volume || 0);
  const recent = data?.recent || [];
  const treasuryBalance = Number(data?.treasuryBalance || 0);

  return (
    <div className="luca ags">
      <style>{CSS}</style>

      <header className="ags-hero">
        <div>
          <div className="ags-kicker"><Activity size={14} /> GPS Economy</div>
          <h2>The living economy, at a glance</h2>
          <p>
            Every completed session routes value through the Generative Prosperity System. This is the
            platform-wide picture — value created, value returned to providers, and value seeded back
            into the commons.
          </p>
        </div>
        <div className="ags-hero-metrics">
          <div className="ags-hero-metric">
            <span className="ags-hero-metric-lbl">Gross volume</span>
            <span className="ags-hero-metric-val">{money(gross)}</span>
          </div>
          <div className="ags-hero-metric">
            <span className="ags-hero-metric-lbl">Transactions</span>
            <span className="ags-hero-metric-val">{stats.transactions || 0}</span>
          </div>
          <div className="ags-hero-metric">
            <span className="ags-hero-metric-lbl">Treasury</span>
            <span className="ags-hero-metric-val ags-gold">{money(treasuryBalance)}</span>
          </div>
        </div>
      </header>

      {err && <div className="ags-err">{err}</div>}
      {loading && <div className="ags-loading">Reading the ledger…</div>}

      {!loading && (
        <>
          <section className="ags-sec">
            <h3 className="ags-sec-title"><Layers size={16} /> How value split</h3>
            <div className="ags-splits">
              {STAT_KEYS.map(({ field, bucket }) => {
                const b = GPS_BUCKETS.find((x) => x.key === bucket);
                const amt = Number(stats[field] || 0);
                const pct = gross > 0 ? (amt / gross) * 100 : b?.pct || 0;
                const Icon = b?.icon;
                return (
                  <div className="ags-split" key={field}>
                    <div className="ags-split-top">
                      <div className="ags-split-ico" style={{ background: b?.color }}>
                        {Icon ? <Icon size={14} /> : null}
                      </div>
                      <span className="ags-split-lbl">{b?.label}</span>
                      <span className="ags-split-amt">{money(amt)}</span>
                    </div>
                    <div className="ags-split-bar">
                      <div className="ags-split-fill" style={{ width: `${Math.min(100, pct)}%`, background: b?.color }} />
                    </div>
                    <span className="ags-split-pct">{b?.pct}% target · {pct.toFixed(1)}% actual</span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="ags-grid">
            <section className="ags-sec">
              <h3 className="ags-sec-title"><Users size={16} /> Top ecosystem builders</h3>
              {board.length === 0 ? (
                <div className="ags-empty">No contributor earnings yet. As referrals convert, your top builders will rank here.</div>
              ) : (
                <div className="ags-board">
                  {board.map((row) => (
                    <div className="ags-board-row" key={row.rank}>
                      <span className="ags-board-rank">#{row.rank}</span>
                      <span className="ags-board-badge">{row.initials}</span>
                      <span className="ags-board-refs">{row.referral_count} referral{row.referral_count === 1 ? '' : 's'}</span>
                      <span className="ags-board-amt">{money(row.total_earned)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="ags-sec">
              <h3 className="ags-sec-title"><TrendingUp size={16} /> Recent settlements</h3>
              {recent.length === 0 ? (
                <div className="ags-empty">No GPS settlements yet. Completed bookings will appear here.</div>
              ) : (
                <div className="ags-feed">
                  {recent.map((r) => (
                    <div className="ags-feed-row" key={r.id}>
                      <div className="ags-feed-dot" />
                      <div className="ags-feed-body">
                        <span className="ags-feed-main">
                          {r.patient_name || 'A client'} → {r.business_name || 'a provider'}
                        </span>
                        <span className="ags-feed-sub">
                          {money(r.total_amount)} · provider {money(r.provider_share)} · treasury {money(r.treasury_share)}
                        </span>
                      </div>
                      <span className="ags-feed-date">{fmtDate(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="ags-note">
            <Sprout size={16} />
            <span>
              <strong>{money(Number(stats.treasury_total || 0))}</strong> has been seeded into the
              regenerative treasury from platform activity, and <strong>{money(Number(stats.reward_total || 0))}</strong> returned
              to members as LOVE credits. Value flows to where value was created.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.luca .ags { display:flex; flex-direction:column; gap:18px; }
.luca .ags-hero { display:flex; justify-content:space-between; gap:24px; align-items:stretch; flex-wrap:wrap;
  background:linear-gradient(135deg, var(--teal-d2), var(--teal-d)); color:#fff;
  border-radius:var(--r-lg); padding:26px 28px; box-shadow:var(--shadow); }
.luca .ags-hero > div:first-child { flex:1 1 340px; }
.luca .ags-kicker { display:inline-flex; align-items:center; gap:6px; font-family:'IBM Plex Mono',monospace;
  font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gold);
  background:rgba(255,255,255,.09); padding:5px 11px; border-radius:999px; }
.luca .ags-hero h2 { font-family:'Space Grotesk',sans-serif; font-size:26px; margin:12px 0 8px; }
.luca .ags-hero p { font-size:14px; line-height:1.6; color:rgba(255,255,255,.86); max-width:56ch; }
.luca .ags-hero-metrics { display:flex; flex-direction:column; gap:12px; justify-content:center; min-width:170px; }
.luca .ags-hero-metric { display:flex; flex-direction:column; }
.luca .ags-hero-metric-lbl { font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.7); }
.luca .ags-hero-metric-val { font-family:'Space Grotesk',sans-serif; font-size:26px; font-weight:700; line-height:1.15; }
.luca .ags-gold { color:var(--gold); }

.luca .ags-err { background:#fdeeee; color:var(--danger); border:1px solid #f3c9c9; padding:12px 14px; border-radius:var(--r-sm); font-size:13px; }
.luca .ags-loading { color:var(--muted); font-size:14px; padding:14px 2px; }

.luca .ags-sec { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:20px; box-shadow:var(--shadow-sm); }
.luca .ags-sec-title { display:flex; align-items:center; gap:8px; font-family:'Space Grotesk',sans-serif;
  font-size:16px; color:var(--ink); margin:0 0 16px; }

.luca .ags-splits { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; }
.luca .ags-split-top { display:flex; align-items:center; gap:9px; margin-bottom:8px; }
.luca .ags-split-ico { width:26px; height:26px; border-radius:7px; display:flex; align-items:center; justify-content:center; color:#fff; }
.luca .ags-split-lbl { font-size:13px; font-weight:600; color:var(--ink); flex:1; }
.luca .ags-split-amt { font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; color:var(--ink); }
.luca .ags-split-bar { height:7px; border-radius:999px; background:var(--surface-2); overflow:hidden; }
.luca .ags-split-fill { height:100%; border-radius:999px; transition:width .5s ease; }
.luca .ags-split-pct { display:block; margin-top:5px; font-size:11px; color:var(--muted-2); }

.luca .ags-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:820px){ .luca .ags-grid { grid-template-columns:1fr; } }
.luca .ags-empty { color:var(--muted); font-size:13px; line-height:1.6; background:var(--surface-2);
  border:1px dashed var(--line-2); border-radius:var(--r-sm); padding:16px; }

.luca .ags-board { display:flex; flex-direction:column; gap:8px; }
.luca .ags-board-row { display:flex; align-items:center; gap:12px; padding:9px 10px; border-radius:var(--r-sm); background:var(--surface-2); }
.luca .ags-board-rank { font-family:'IBM Plex Mono',monospace; font-size:13px; color:var(--muted); width:28px; }
.luca .ags-board-badge { width:34px; height:34px; border-radius:50%; background:var(--teal-d);
  color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; }
.luca .ags-board-refs { flex:1; font-size:13px; color:var(--muted); }
.luca .ags-board-amt { font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--teal-d); font-size:14px; }

.luca .ags-feed { display:flex; flex-direction:column; }
.luca .ags-feed-row { display:flex; align-items:center; gap:11px; padding:11px 2px; border-bottom:1px solid var(--line); }
.luca .ags-feed-row:last-child { border-bottom:none; }
.luca .ags-feed-dot { width:8px; height:8px; border-radius:50%; background:var(--mint); flex-shrink:0; }
.luca .ags-feed-body { flex:1; display:flex; flex-direction:column; gap:2px; }
.luca .ags-feed-main { font-size:13px; color:var(--ink); font-weight:500; }
.luca .ags-feed-sub { font-size:11.5px; color:var(--muted); font-family:'IBM Plex Mono',monospace; }
.luca .ags-feed-date { font-size:12px; color:var(--muted-2); }

.luca .ags-note { display:flex; align-items:flex-start; gap:11px; background:var(--mint-soft);
  border:1px solid var(--mint-line); border-radius:var(--r); padding:15px 18px; color:var(--mint-ink); font-size:13.5px; line-height:1.6; }
.luca .ags-note svg { flex-shrink:0; margin-top:2px; color:var(--teal-d); }
`;

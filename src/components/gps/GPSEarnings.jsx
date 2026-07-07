/**
 * GPSEarnings — the provider's "Sovereign Income" dashboard.
 *
 * Shows total value earned through the Generative Prosperity System, the
 * split between settled and pending, a per-booking value trail, and any
 * contributor / referral earnings the provider has accrued.
 */

import React, { useEffect, useState } from 'react';
import { Coins, TrendingUp, Clock, CheckCircle2, Users, Info, Wallet } from 'lucide-react';
import { api } from '../../lib/api.js';
import ValueFlowViz from './ValueFlowViz.jsx';

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
};

export default function GPSEarnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.getGpsEarnings();
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e?.message || 'Could not load your earnings');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const provider = data?.provider || { total_earned: 0, settled: 0, pending: 0, bookings: 0 };
  const perBooking = data?.perBooking || [];
  const contributor = data?.contributor || [];
  const contribTotal = contributor.reduce((s, c) => s + Number(c.total_earned || 0), 0);
  const referralCount = contributor.reduce((s, c) => s + Number(c.referral_count || 0), 0);

  return (
    <div className="luca gpe">
      <style>{CSS}</style>

      <header className="gpe-hero">
        <div className="gpe-hero-txt">
          <div className="gpe-kicker"><Coins size={14} /> Sovereign Income</div>
          <h2>Your value, in full view</h2>
          <p>
            Every completed session flows <strong>85% straight to you</strong> — no opaque platform
            cut. The remaining value is transparently seeded across the people and commons that make
            your practice possible. This is what you've grown so far.
          </p>
        </div>
        <div className="gpe-hero-amt">
          <span className="gpe-hero-amt-lbl">Total earned</span>
          <span className="gpe-hero-amt-val">{money(provider.total_earned)}</span>
          <span className="gpe-hero-amt-sub">{provider.bookings || 0} completed session{Number(provider.bookings) === 1 ? '' : 's'}</span>
        </div>
      </header>

      {err && <div className="gpe-err">{err}</div>}
      {loading && <div className="gpe-loading">Gathering your value trail…</div>}

      {!loading && (
        <>
          <div className="gpe-cards">
            <div className="gpe-card">
              <div className="gpe-card-ico" style={{ background: '#0E7C66' }}><CheckCircle2 size={16} /></div>
              <span className="gpe-card-lbl">Settled</span>
              <span className="gpe-card-val">{money(provider.settled)}</span>
              <span className="gpe-card-sub">Paid & reconciled</span>
            </div>
            <div className="gpe-card">
              <div className="gpe-card-ico" style={{ background: '#E3AC46' }}><Clock size={16} /></div>
              <span className="gpe-card-lbl">Pending</span>
              <span className="gpe-card-val">{money(provider.pending)}</span>
              <span className="gpe-card-sub">Clearing through GPS</span>
            </div>
            <div className="gpe-card">
              <div className="gpe-card-ico" style={{ background: '#2FA88C' }}><Users size={16} /></div>
              <span className="gpe-card-lbl">Contributor earnings</span>
              <span className="gpe-card-val">{money(contribTotal)}</span>
              <span className="gpe-card-sub">{referralCount} builder{referralCount === 1 ? '' : 's'} referred</span>
            </div>
            <div className="gpe-card">
              <div className="gpe-card-ico" style={{ background: '#7FAE4B' }}><TrendingUp size={16} /></div>
              <span className="gpe-card-lbl">Your share</span>
              <span className="gpe-card-val">85%</span>
              <span className="gpe-card-sub">of every transaction</span>
            </div>
          </div>

          <div className="gpe-how">
            <button className="gpe-how-toggle" onClick={() => setShowHow((v) => !v)}>
              <Info size={15} /> How the split works {showHow ? '▲' : '▼'}
            </button>
            {showHow && (
              <div className="gpe-how-body">
                <p className="gpe-how-note">
                  The Generative Prosperity System replaces a hidden platform fee with a transparent,
                  regenerative split. Here's where a sample <strong>$100</strong> session flows:
                </p>
                <ValueFlowViz total={100} />
              </div>
            )}
          </div>

          <section className="gpe-sec">
            <h3 className="gpe-sec-title"><Wallet size={16} /> Value trail — per session</h3>
            {perBooking.length === 0 ? (
              <div className="gpe-empty">
                No completed sessions yet. When you complete a booking, its value split will appear
                here — every dollar accounted for.
              </div>
            ) : (
              <div className="gpe-list">
                <div className="gpe-list-head">
                  <span>Session</span>
                  <span>Client</span>
                  <span>Date</span>
                  <span>Total</span>
                  <span>Your share</span>
                  <span>Status</span>
                </div>
                {perBooking.map((b) => (
                  <div className="gpe-row" key={b.id}>
                    <span className="gpe-row-svc">{b.service_name || 'Session'}</span>
                    <span className="gpe-row-muted">{b.patient_name || '—'}</span>
                    <span className="gpe-row-muted">{fmtDate(b.created_at)}</span>
                    <span className="gpe-row-muted">{money(b.total_amount)}</span>
                    <span className="gpe-row-share">{money(b.provider_share)}</span>
                    <span className={`gpe-badge gpe-badge-${b.status === 'settled' ? 'ok' : 'pending'}`}>
                      {b.status === 'settled' ? 'Settled' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="gpe-payout">
            <div className="gpe-payout-txt">
              <strong>Direct payouts</strong>
              <span>Sovereign wallet withdrawals settle continuously. Scheduled payout requests are arriving soon.</span>
            </div>
            <button className="gpe-payout-btn" disabled>Request payout — soon</button>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
.luca .gpe { display:flex; flex-direction:column; gap:18px; }
.luca .gpe-hero { display:flex; justify-content:space-between; gap:24px; align-items:stretch;
  background:linear-gradient(135deg, var(--teal-d2), var(--teal-d)); color:#fff;
  border-radius:var(--r-lg); padding:26px 28px; box-shadow:var(--shadow); flex-wrap:wrap; }
.luca .gpe-hero-txt { flex:1 1 320px; }
.luca .gpe-kicker { display:inline-flex; align-items:center; gap:6px; font-family:'IBM Plex Mono',monospace;
  font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--gold);
  background:rgba(255,255,255,.09); padding:5px 11px; border-radius:999px; }
.luca .gpe-hero-txt h2 { font-family:'Space Grotesk',sans-serif; font-size:26px; margin:12px 0 8px; }
.luca .gpe-hero-txt p { font-size:14px; line-height:1.6; color:rgba(255,255,255,.86); max-width:52ch; }
.luca .gpe-hero-amt { display:flex; flex-direction:column; justify-content:center; align-items:flex-end;
  min-width:180px; }
.luca .gpe-hero-amt-lbl { font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:rgba(255,255,255,.7); }
.luca .gpe-hero-amt-val { font-family:'Space Grotesk',sans-serif; font-size:40px; font-weight:700; color:var(--gold); line-height:1.1; }
.luca .gpe-hero-amt-sub { font-size:12px; color:rgba(255,255,255,.72); }

.luca .gpe-err { background:#fdeeee; color:var(--danger); border:1px solid #f3c9c9; padding:12px 14px; border-radius:var(--r-sm); font-size:13px; }
.luca .gpe-loading { color:var(--muted); font-size:14px; padding:14px 2px; }

.luca .gpe-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px; }
.luca .gpe-card { background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:16px; display:flex; flex-direction:column; gap:3px; box-shadow:var(--shadow-sm); }
.luca .gpe-card-ico { width:32px; height:32px; border-radius:9px; display:flex; align-items:center;
  justify-content:center; color:#fff; margin-bottom:6px; }
.luca .gpe-card-lbl { font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
.luca .gpe-card-val { font-family:'Space Grotesk',sans-serif; font-size:24px; font-weight:700; color:var(--ink); }
.luca .gpe-card-sub { font-size:12px; color:var(--muted-2); }

.luca .gpe-how { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); overflow:hidden; }
.luca .gpe-how-toggle { width:100%; text-align:left; background:none; border:none; cursor:pointer;
  display:flex; align-items:center; gap:8px; padding:15px 18px; font-size:14px; font-weight:600; color:var(--teal-d); font-family:inherit; }
.luca .gpe-how-body { padding:4px 18px 20px; border-top:1px solid var(--line); }
.luca .gpe-how-note { font-size:13px; color:var(--muted); line-height:1.6; margin:14px 0 16px; }

.luca .gpe-sec { background:var(--surface); border:1px solid var(--line); border-radius:var(--r); padding:20px; box-shadow:var(--shadow-sm); }
.luca .gpe-sec-title { display:flex; align-items:center; gap:8px; font-family:'Space Grotesk',sans-serif;
  font-size:16px; color:var(--ink); margin:0 0 16px; }
.luca .gpe-empty { color:var(--muted); font-size:13px; line-height:1.6; background:var(--surface-2);
  border:1px dashed var(--line-2); border-radius:var(--r-sm); padding:18px; }
.luca .gpe-list { display:flex; flex-direction:column; }
.luca .gpe-list-head, .luca .gpe-row { display:grid; grid-template-columns:1.6fr 1.2fr 1fr .9fr .9fr .8fr;
  gap:10px; align-items:center; padding:11px 6px; }
.luca .gpe-list-head { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted-2); border-bottom:1px solid var(--line); }
.luca .gpe-row { border-bottom:1px solid var(--line); font-size:13px; }
.luca .gpe-row:last-child { border-bottom:none; }
.luca .gpe-row-svc { font-weight:600; color:var(--ink); }
.luca .gpe-row-muted { color:var(--muted); }
.luca .gpe-row-share { font-family:'IBM Plex Mono',monospace; font-weight:600; color:var(--teal-d); }
.luca .gpe-badge { justify-self:start; font-size:11px; padding:3px 9px; border-radius:999px; font-weight:600; }
.luca .gpe-badge-ok { background:var(--mint-soft); color:var(--teal-d2); }
.luca .gpe-badge-pending { background:#fbf1da; color:#9a7420; }

.luca .gpe-payout { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap;
  background:var(--surface-2); border:1px solid var(--line); border-radius:var(--r); padding:16px 20px; }
.luca .gpe-payout-txt { display:flex; flex-direction:column; gap:3px; }
.luca .gpe-payout-txt strong { font-size:14px; color:var(--ink); }
.luca .gpe-payout-txt span { font-size:12.5px; color:var(--muted); }
.luca .gpe-payout-btn { background:var(--teal-d); color:#fff; border:none; border-radius:var(--r-sm);
  padding:10px 18px; font-size:13px; font-weight:600; cursor:not-allowed; opacity:.55; font-family:inherit; }
`;

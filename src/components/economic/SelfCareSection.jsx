/**
 * SelfCareSection — the "Self Care" surface inside the Economic Passport drawer.
 *
 * §8: "Self Care" is a UI/content alias for the internal Contributions record.
 * Route keys, analytics ids, the API field and the DB name all stay
 * `contributions`; only the label and framing change here. We surface ONLY real
 * data returned by the existing contributions API — lifetime value, value this
 * week / this month, completed self-care actions and a value-journey timeline —
 * and never manufacture LOVE totals or trends. When there is no history yet we
 * show an honest empty state.
 *
 * The primary action ("Continue self-care") deep-links to the exact Growth
 * surface where the device-local personalized-journey To-dos live; the secondary
 * ("See ecosystem impact") jumps to the drawer's GPS section.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Heart, TrendingUp, CheckCircle2, Sprout, Globe, ScrollText } from 'lucide-react';
import { api } from '../../lib/api.js';
import ContributionLedger from '../contributions/ContributionLedger.jsx';
import ActionCard from './ActionCard.jsx';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; } };

export default function SelfCareSection({ user, onContinue, onEcosystem }) {
  const [events, setEvents] = useState([]);
  const [lifetime, setLifetime] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getMyContributions();
        if (!alive) return;
        setEvents(Array.isArray(r?.events) ? r.events : []);
        if (r?.attestedPoints != null) setLifetime(Number(r.attestedPoints));
      } catch {
        if (alive) { setEvents([]); setLifetime(null); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // "Now" is read once when the data settles (not during render) so the metric
  // window is stable across re-renders and the derivation stays pure.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => { setNowTs(Date.now()); }, [events]);

  // All metrics are DERIVED from the real events — never invented.
  const metrics = useMemo(() => {
    const monthAgo = new Date(nowTs); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthTs = monthAgo.getTime();
    let week = 0, month = 0;
    for (const ev of events) {
      const t = new Date(ev.createdAt).getTime();
      const pts = Number(ev.points) || 0;
      if (Number.isFinite(t)) {
        if (nowTs - t <= WEEK_MS) week += pts;
        if (t >= monthTs) month += pts;
      }
    }
    const life = lifetime != null ? lifetime : events.reduce((s, e) => s + (Number(e.points) || 0), 0);
    return { life, week, month, count: events.length };
  }, [events, lifetime, nowTs]);

  const recent = useMemo(() => events.slice(0, 5), [events]);

  return (
    <div className="selfcare">
      <header className="sc-head">
        <h2 className="sc-title">Your care creates value</h2>
        <p className="sc-sub">When you care for yourself, you strengthen your capacity and the wider Solaris ecosystem.</p>
      </header>

      {/* Primary next-best-action (§8/§11) — one primary at a time. */}
      <ActionCard
        icon={Sprout}
        title="Continue self-care"
        reason="Pick up your personalized journey where you left off — your device-local To-dos are ready when you are."
        primary={{ label: 'Continue self-care', onClick: onContinue, icon: Sprout }}
        secondary={[{ label: 'See ecosystem impact', onClick: onEcosystem, icon: Globe }]}
        sourceLabel="From your Growth plan"
      />

      {loading ? (
        <div className="sc-loading"><Loader2 size={18} className="sc-spin" /> Loading your self-care record…</div>
      ) : metrics.count === 0 ? (
        <div className="sc-empty">
          <Heart size={20} />
          <div className="sc-empty-t">No self-care value recorded yet</div>
          <div className="sc-empty-s">As you complete self-care actions and contributions, your recognized value will appear here — nothing is estimated or pre-filled.</div>
        </div>
      ) : (
        <>
          <div className="sc-metrics">
            <div className="sc-metric">
              <span className="sc-metric-v">{metrics.life.toLocaleString()}</span>
              <span className="sc-metric-l"><Heart size={12} /> Lifetime value</span>
            </div>
            <div className="sc-metric">
              <span className="sc-metric-v">{metrics.week.toLocaleString()}</span>
              <span className="sc-metric-l"><TrendingUp size={12} /> This week</span>
            </div>
            <div className="sc-metric">
              <span className="sc-metric-v">{metrics.month.toLocaleString()}</span>
              <span className="sc-metric-l"><TrendingUp size={12} /> This month</span>
            </div>
            <div className="sc-metric">
              <span className="sc-metric-v">{metrics.count.toLocaleString()}</span>
              <span className="sc-metric-l"><CheckCircle2 size={12} /> Actions</span>
            </div>
          </div>

          {recent.length > 0 && (
            <div className="sc-timeline">
              <div className="sc-timeline-h"><ScrollText size={14} /> Your value journey</div>
              {recent.map((ev) => (
                <div className="sc-tl-row" key={ev.id}>
                  <span className="sc-tl-dot" />
                  <span className="sc-tl-kind">{String(ev.kind || 'contribution').replace(/_/g, ' ')}</span>
                  <span className="sc-tl-date">{fmtDate(ev.createdAt)}</span>
                  <span className="sc-tl-pts">+{Number(ev.points) || 0}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="sc-explain">
        Personal care compounds into collective strength: each verified self-care action is recognized as
        value you created, and the same recognition helps the Solaris commons grow. You stay in control of
        what you share.
      </p>

      {/* The full, real contribution record (log + ledger + leaderboard) is kept
          intact below — the internal "contributions" surface, unchanged. */}
      <div className="sc-record">
        <div className="sc-record-h">Your contribution record</div>
        <ContributionLedger user={user} />
      </div>

      <style>{`
        .luca .sc-head{margin-bottom:14px}
        .luca .sc-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;color:var(--ink);margin:0;line-height:1.2}
        .luca .sc-sub{font-size:12.5px;color:var(--muted);margin:5px 0 0;line-height:1.5}
        .luca .sc-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
        .luca .sc-metric{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
        .luca .sc-metric-v{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:22px;color:var(--ink);line-height:1}
        .luca .sc-metric-l{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--muted)}
        .luca .sc-metric-l svg{color:var(--teal)}
        .luca .sc-timeline{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:16px}
        .luca .sc-timeline-h{display:flex;align-items:center;gap:7px;font-weight:700;font-size:13px;color:var(--ink);margin-bottom:10px}
        .luca .sc-timeline-h svg{color:var(--teal)}
        .luca .sc-tl-row{display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line)}
        .luca .sc-tl-row:first-of-type{border-top:none}
        .luca .sc-tl-dot{width:8px;height:8px;border-radius:50%;background:var(--teal);flex:none}
        .luca .sc-tl-kind{flex:1;font-size:12.5px;color:var(--ink);text-transform:capitalize}
        .luca .sc-tl-date{font-size:11.5px;color:var(--muted)}
        .luca .sc-tl-pts{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12.5px;color:var(--teal-d);min-width:38px;text-align:right}
        .luca .sc-empty{background:var(--surface);border:1px dashed var(--line);border-radius:12px;padding:24px 18px;text-align:center;margin-bottom:16px;color:var(--muted)}
        .luca .sc-empty svg{color:var(--teal)}
        .luca .sc-empty-t{font-weight:700;font-size:14px;color:var(--ink);margin:8px 0 4px}
        .luca .sc-empty-s{font-size:12px;color:var(--muted);line-height:1.5;max-width:320px;margin:0 auto}
        .luca .sc-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:26px;color:var(--muted);font-size:13px}
        .luca .sc-spin{animation:spin 1s linear infinite}
        .luca .sc-explain{font-size:11.5px;color:var(--muted);line-height:1.55;background:var(--mint-soft,#e8f5f0);border-radius:12px;padding:12px 14px;margin:0 0 18px}
        .luca .sc-record{border-top:1px solid var(--line);padding-top:16px}
        .luca .sc-record-h{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13.5px;color:var(--ink);margin-bottom:12px}
      `}</style>
    </div>
  );
}

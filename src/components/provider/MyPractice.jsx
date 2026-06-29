/**
 * MyPractice — unified provider management workspace shown as a single tab
 * for approved providers (in addition to all their normal patient tabs).
 *
 * Internal sub-tabs: Listings · Bookings · Reviews · Analytics · Settings.
 *
 * Props:
 *   user        current user
 *   onBookings  optional (count)=>void — reports pending booking count for badges
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Store, Star, Calendar, BarChart3, Eye, EyeOff, MapPin, Settings as SettingsIcon,
  CheckCircle2, Clock, TrendingUp, MessageSquare, CalendarClock,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import ProviderBookings from './ProviderBookings.jsx';
import ProviderCalendar from './ProviderCalendar.jsx';

const SUBTABS = [
  { id: 'listings', label: 'Listings', icon: Store },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'availability', label: 'Availability', icon: CalendarClock },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function MyPractice({ user, onBookings }) {
  const [view, setView] = useState('listings');
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getMyProviders();
      setProviders(r.providers || []);
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = providers || [];
  const visible = list.filter((p) => !p.hidden);

  return (
    <div className="mp">
      <div className="mp-tabs">
        {SUBTABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} className={`mp-tab ${view === t.id ? 'on' : ''}`} onClick={() => setView(t.id)}>
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="mp-loading"><Loader2 className="mp-spin" size={24} /> Loading your practice…</div>
      ) : (
        <div className="mp-content">
          {view === 'listings' && <ListingsView providers={list} onRefresh={load} />}
          {view === 'bookings' && <ProviderBookings onBookings={onBookings} />}
          {view === 'availability' && <ProviderCalendar />}
          {view === 'reviews' && <ReviewsView providers={visible} />}
          {view === 'analytics' && <AnalyticsView providers={list} />}
          {view === 'settings' && <SettingsView user={user} />}
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

/* ------------------------------- Listings ------------------------------- */
function ListingsView({ providers, onRefresh }) {
  const [busy, setBusy] = useState('');
  if (!providers.length) {
    return (
      <div className="mp-empty">
        <Store size={30} />
        <h3>No listings yet</h3>
        <p>Once your application is approved, your listing appears here for you to manage.</p>
      </div>
    );
  }
  const toggleHidden = async (p) => {
    setBusy(p.id);
    try { await api.updateProvider(p.id, { hidden: !p.hidden }); onRefresh?.(); }
    catch { /* ignore */ }
    finally { setBusy(''); }
  };
  return (
    <div className="mp-grid">
      {providers.map((p) => (
        <div key={p.id} className="mp-listing">
          <div className="mp-listing-top">
            <div className="mp-listing-ico"><Store size={18} /></div>
            <div className="mp-listing-main">
              <div className="mp-listing-name">{p.business_name}</div>
              <div className="mp-listing-meta"><MapPin size={12} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</div>
            </div>
            <span className={`mp-badge ${p.approval_status === 'approved' ? 'ok' : p.approval_status === 'rejected' ? 'no' : 'pend'}`}>
              {p.approval_status}
            </span>
          </div>
          <div className="mp-listing-stats">
            <div><Star size={13} /> {Number(p.rating || 0).toFixed(1)} <em>({p.review_count || 0})</em></div>
            <div>{p.hidden ? <EyeOff size={13} /> : <Eye size={13} />} {p.hidden ? 'Hidden' : 'Live'}</div>
            <div className="mp-cap">{p.price_range || '—'}</div>
          </div>
          {p.approval_status === 'approved' && (
            <button className="mp-listing-btn" onClick={() => toggleHidden(p)} disabled={busy === p.id}>
              {busy === p.id ? <Loader2 size={14} className="mp-spin" /> : p.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {p.hidden ? 'Make visible' : 'Hide listing'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Reviews -------------------------------- */
function ReviewsView({ providers }) {
  const [reviews, setReviews] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = [];
        for (const p of providers) {
          const r = await api.getProvider(p.id).catch(() => null);
          (r?.reviews || []).forEach((rv) => all.push({ ...rv, business: p.business_name }));
        }
        if (alive) setReviews(all);
      } catch { if (alive) setReviews([]); }
    })();
    return () => { alive = false; };
  }, [providers]);
  if (reviews === null) return <div className="mp-loading"><Loader2 className="mp-spin" size={22} /> Loading reviews…</div>;
  if (!reviews.length) return <div className="mp-empty"><Star size={30} /><h3>No reviews yet</h3><p>Patient reviews of your services will show up here.</p></div>;
  return (
    <div className="mp-rows">
      {reviews.map((r, i) => (
        <div key={i} className="mp-review">
          <div className="mp-review-head">
            <div className="mp-stars">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={13} fill={k < (r.rating || 0) ? 'var(--gold)' : 'none'} color="var(--gold)" />)}</div>
            <span className="mp-review-biz">{r.business}</span>
          </div>
          {r.comment && <p className="mp-review-text">{r.comment}</p>}
          <div className="mp-review-by">{r.author_name || 'Anonymous'} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Analytics ------------------------------- */
function AnalyticsView({ providers }) {
  const totalReviews = providers.reduce((s, p) => s + (p.review_count || 0), 0);
  const avgRating = providers.length
    ? (providers.reduce((s, p) => s + Number(p.rating || 0), 0) / providers.length).toFixed(1) : '0.0';
  const live = providers.filter((p) => !p.hidden && p.approval_status === 'approved').length;
  const cards = [
    { icon: Store, label: 'Listings', value: providers.length, cls: 'teal' },
    { icon: Eye, label: 'Live', value: live, cls: 'teal' },
    { icon: Star, label: 'Avg rating', value: avgRating, cls: 'gold' },
    { icon: MessageSquare, label: 'Reviews', value: totalReviews, cls: 'ink' },
  ];
  return (
    <>
      <div className="mp-stats">
        {cards.map((c) => (
          <div key={c.label} className={`mp-stat ${c.cls}`}>
            <div className="mp-stat-ico"><c.icon size={18} /></div>
            <div><div className="mp-stat-val">{c.value}</div><div className="mp-stat-lbl">{c.label}</div></div>
          </div>
        ))}
      </div>
      <div className="mp-note"><TrendingUp size={15} /> Detailed performance trends (views, conversion, revenue) will grow here as you receive bookings. Remember, Solaris Health applies a 10% commission on completed bookings.</div>
    </>
  );
}

/* ------------------------------ Settings -------------------------------- */
function SettingsView({ user }) {
  return (
    <div className="mp-settings">
      <div className="mp-card">
        <div className="mp-card-h"><SettingsIcon size={15} /> Provider account</div>
        <div className="mp-set-row"><span>Account</span><b>{user?.fullName || user?.email}</b></div>
        <div className="mp-set-row"><span>Provider status</span><b className="mp-ok"><CheckCircle2 size={14} /> Approved</b></div>
        <div className="mp-set-row"><span>Approved on</span><b>{user?.providerApprovedAt ? new Date(user.providerApprovedAt).toLocaleDateString() : '—'}</b></div>
        <div className="mp-set-row"><span>Commission</span><b>10% per booking</b></div>
      </div>
      <div className="mp-note"><Clock size={15} /> To edit listing details, open a listing from <b>Listings</b>. Need to add another practice? Apply again from “Become a Provider”.</div>
    </div>
  );
}

const CSS = `
.luca .mp{display:flex;flex-direction:column;gap:18px}
.luca .mp-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:2px}
.luca .mp-tab{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--muted);
  background:none;border:none;border-bottom:2px solid transparent;padding:9px 12px;cursor:pointer;margin-bottom:-1px}
.luca .mp-tab:hover{color:var(--ink)}
.luca .mp-tab.on{color:var(--teal-d);border-bottom-color:var(--teal-d)}
.luca .mp-loading,.luca .mp-empty{padding:48px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:10px}
.luca .mp-empty h3{font-family:'Space Grotesk',sans-serif;font-size:18px;color:var(--ink);margin:6px 0 0}
.luca .mp-empty p{font-size:13px;color:var(--muted);margin:0;max-width:380px}
.luca .mp-spin{animation:mpspin 1s linear infinite}@keyframes mpspin{to{transform:rotate(360deg)}}
.luca .mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.luca .mp-listing{border:1px solid var(--line);border-radius:var(--r);padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:12px}
.luca .mp-listing-top{display:flex;align-items:flex-start;gap:12px}
.luca .mp-listing-ico{width:40px;height:40px;border-radius:11px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .mp-listing-main{flex:1;min-width:0}
.luca .mp-listing-name{font-size:15px;font-weight:700;color:var(--ink)}
.luca .mp-listing-meta{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px}
.luca .mp-badge{font-size:10.5px;font-weight:700;text-transform:capitalize;padding:3px 9px;border-radius:999px}
.luca .mp-badge.ok{color:var(--teal-d);background:var(--mint-soft)}
.luca .mp-badge.pend{color:var(--gold-ink);background:var(--gold-soft)}
.luca .mp-badge.no{color:var(--danger-ink);background:var(--danger-soft)}
.luca .mp-listing-stats{display:flex;gap:14px;font-size:12.5px;color:var(--muted-2)}
.luca .mp-listing-stats>div{display:flex;align-items:center;gap:5px}
.luca .mp-listing-stats em{font-style:normal;color:var(--muted)}
.luca .mp-cap{margin-left:auto;font-weight:700;color:var(--teal-d)}
.luca .mp-listing-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:8px;cursor:pointer}
.luca .mp-rows{display:flex;flex-direction:column;gap:8px}
.luca .mp-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}
.luca .mp-row-ico{width:38px;height:38px;border-radius:10px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .mp-row-main{flex:1;min-width:0}
.luca .mp-row-title{font-size:14px;font-weight:600;color:var(--ink)}
.luca .mp-row-sub{font-size:12px;color:var(--muted);margin-top:2px}
.luca .mp-review{border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;background:var(--surface)}
.luca .mp-review-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.luca .mp-stars{display:flex;gap:2px}
.luca .mp-review-biz{font-size:12px;color:var(--muted);font-weight:600}
.luca .mp-review-text{font-size:13px;color:var(--muted-2);line-height:1.6;margin:8px 0 6px}
.luca .mp-review-by{font-size:11.5px;color:var(--muted)}
.luca .mp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.luca .mp-stat{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.luca .mp-stat-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}
.luca .mp-stat.gold .mp-stat-ico{background:var(--gold-soft);color:var(--gold-ink)}
.luca .mp-stat.teal .mp-stat-ico{background:var(--mint-soft);color:var(--teal-d)}
.luca .mp-stat.ink .mp-stat-ico{background:var(--surface-2);color:var(--ink)}
.luca .mp-stat-val{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--ink);line-height:1}
.luca .mp-stat-lbl{font-size:12px;color:var(--muted);margin-top:3px}
.luca .mp-note{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--muted-2);background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px}
.luca .mp-settings{display:flex;flex-direction:column;gap:14px;max-width:520px}
.luca .mp-card{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:16px}
.luca .mp-card-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);margin-bottom:12px}
.luca .mp-set-row{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;padding:9px 0;border-bottom:1px dashed var(--line)}
.luca .mp-set-row:last-child{border-bottom:none}
.luca .mp-set-row span{color:var(--muted)}.luca .mp-set-row b{color:var(--ink);display:flex;align-items:center;gap:5px}
.luca .mp-ok{color:var(--teal-d) !important}
`;

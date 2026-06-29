/**
 * ProviderWorkspace — the provider-mode workspace. Renders one of several
 * views (listings, bookings, reviews, analytics, settings) for an approved
 * provider managing their presence on Solaris Health.
 *
 * Props:
 *   user   current user
 *   view   one of 'listings'|'bookings'|'reviews'|'analytics'|'settings'
 *   go     (tabId)=>void   — navigate between provider tabs
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Store, Star, Calendar, BarChart3, Eye, EyeOff, MapPin, Settings as SettingsIcon,
  CheckCircle2, Clock, DollarSign, TrendingUp, MessageSquare, ExternalLink,
} from 'lucide-react';
import { api } from '../../lib/api.js';

export default function ProviderWorkspace({ user, view = 'listings', go }) {
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

  if (loading) {
    return <div className="pw-loading"><Loader2 className="pw-spin" size={26} /> Loading your provider workspace…</div>;
  }

  const list = providers || [];
  const visible = list.filter((p) => !p.hidden);
  const inner = (() => {
    switch (view) {
      case 'bookings': return <BookingsView />;
      case 'reviews': return <ReviewsView providers={visible} />;
      case 'analytics': return <AnalyticsView providers={list} />;
      case 'settings': return <SettingsView user={user} />;
      default: return <ListingsView providers={list} onRefresh={load} />;
    }
  })();

  return <div className="pw">{inner}<style>{CSS}</style></div>;
}

/* ------------------------------- Listings ------------------------------- */
function ListingsView({ providers, onRefresh }) {
  const [busy, setBusy] = useState('');
  if (!providers.length) {
    return (
      <div className="pw-empty">
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
    <div className="pw-grid">
      {providers.map((p) => (
        <div key={p.id} className="pw-listing">
          <div className="pw-listing-top">
            <div className="pw-listing-ico"><Store size={18} /></div>
            <div className="pw-listing-main">
              <div className="pw-listing-name">{p.business_name}</div>
              <div className="pw-listing-meta"><MapPin size={12} /> {[p.city, p.country].filter(Boolean).join(', ') || '—'}</div>
            </div>
            <span className={`pw-badge ${p.approval_status === 'approved' ? 'ok' : p.approval_status === 'rejected' ? 'no' : 'pend'}`}>
              {p.approval_status}
            </span>
          </div>
          <div className="pw-listing-stats">
            <div><Star size={13} /> {Number(p.rating || 0).toFixed(1)} <em>({p.review_count || 0})</em></div>
            <div>{p.hidden ? <EyeOff size={13} /> : <Eye size={13} />} {p.hidden ? 'Hidden' : 'Live'}</div>
            <div className="pw-cap">{p.price_range || '—'}</div>
          </div>
          {p.approval_status === 'approved' && (
            <button className="pw-listing-btn" onClick={() => toggleHidden(p)} disabled={busy === p.id}>
              {busy === p.id ? <Loader2 size={14} className="pw-spin" /> : p.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {p.hidden ? 'Make visible' : 'Hide listing'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Bookings ------------------------------- */
function BookingsView() {
  const [bookings, setBookings] = useState(null);
  useEffect(() => {
    api.getPractitionerBookings().then((r) => setBookings(r.bookings || [])).catch(() => setBookings([]));
  }, []);
  if (bookings === null) return <div className="pw-loading"><Loader2 className="pw-spin" size={22} /> Loading bookings…</div>;
  if (!bookings.length) {
    return <div className="pw-empty"><Calendar size={30} /><h3>No bookings yet</h3><p>Patient bookings for your services will appear here.</p></div>;
  }
  return (
    <div className="pw-rows">
      {bookings.map((b) => (
        <div key={b.id} className="pw-row">
          <div className="pw-row-ico"><Calendar size={16} /></div>
          <div className="pw-row-main">
            <div className="pw-row-title">{b.service_name || b.listing_title || 'Appointment'}</div>
            <div className="pw-row-sub">{b.patient_name || b.user_name || 'Patient'} · {b.scheduled_at ? new Date(b.scheduled_at).toLocaleString() : 'TBD'}</div>
          </div>
          <span className={`pw-badge ${b.status === 'confirmed' ? 'ok' : b.status === 'cancelled' ? 'no' : 'pend'}`}>{b.status || 'pending'}</span>
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
  if (reviews === null) return <div className="pw-loading"><Loader2 className="pw-spin" size={22} /> Loading reviews…</div>;
  if (!reviews.length) return <div className="pw-empty"><Star size={30} /><h3>No reviews yet</h3><p>Patient reviews of your services will show up here.</p></div>;
  return (
    <div className="pw-rows">
      {reviews.map((r, i) => (
        <div key={i} className="pw-review">
          <div className="pw-review-head">
            <div className="pw-stars">{Array.from({ length: 5 }).map((_, k) => <Star key={k} size={13} fill={k < (r.rating || 0) ? 'var(--gold)' : 'none'} color="var(--gold)" />)}</div>
            <span className="pw-review-biz">{r.business}</span>
          </div>
          {r.comment && <p className="pw-review-text">{r.comment}</p>}
          <div className="pw-review-by">{r.author_name || 'Anonymous'} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
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
      <div className="pw-stats">
        {cards.map((c) => (
          <div key={c.label} className={`pw-stat ${c.cls}`}>
            <div className="pw-stat-ico"><c.icon size={18} /></div>
            <div><div className="pw-stat-val">{c.value}</div><div className="pw-stat-lbl">{c.label}</div></div>
          </div>
        ))}
      </div>
      <div className="pw-note"><TrendingUp size={15} /> Detailed performance trends (views, conversion, revenue) will grow here as you receive bookings. Remember, Solaris Health applies a 10% commission on completed bookings.</div>
    </>
  );
}

/* ------------------------------ Settings -------------------------------- */
function SettingsView({ user }) {
  return (
    <div className="pw-settings">
      <div className="pw-card">
        <div className="pw-card-h"><SettingsIcon size={15} /> Provider account</div>
        <div className="pw-set-row"><span>Account</span><b>{user?.fullName || user?.email}</b></div>
        <div className="pw-set-row"><span>Provider status</span><b className="pw-ok"><CheckCircle2 size={14} /> Approved</b></div>
        <div className="pw-set-row"><span>Approved on</span><b>{user?.providerApprovedAt ? new Date(user.providerApprovedAt).toLocaleDateString() : '—'}</b></div>
        <div className="pw-set-row"><span>Commission</span><b>10% per booking</b></div>
      </div>
      <div className="pw-note"><Clock size={15} /> To edit listing details, open a listing from <b>My Listings</b>. Need to add another practice? Switch to Patient mode and apply again from “Become a Provider”.</div>
    </div>
  );
}

const CSS = `
.luca .pw{display:flex;flex-direction:column;gap:16px}
.luca .pw-loading,.luca .pw-empty{padding:48px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:10px}
.luca .pw-empty h3{font-family:'Space Grotesk',sans-serif;font-size:18px;color:var(--ink);margin:6px 0 0}
.luca .pw-empty p{font-size:13px;color:var(--muted);margin:0;max-width:380px}
.luca .pw-spin{animation:pwspin 1s linear infinite}@keyframes pwspin{to{transform:rotate(360deg)}}
.luca .pw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.luca .pw-listing{border:1px solid var(--line);border-radius:var(--r);padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:12px}
.luca .pw-listing-top{display:flex;align-items:flex-start;gap:12px}
.luca .pw-listing-ico{width:40px;height:40px;border-radius:11px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .pw-listing-main{flex:1;min-width:0}
.luca .pw-listing-name{font-size:15px;font-weight:700;color:var(--ink)}
.luca .pw-listing-meta{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);margin-top:2px}
.luca .pw-badge{font-size:10.5px;font-weight:700;text-transform:capitalize;padding:3px 9px;border-radius:999px}
.luca .pw-badge.ok{color:var(--teal-d);background:var(--mint-soft)}
.luca .pw-badge.pend{color:var(--gold-ink);background:var(--gold-soft)}
.luca .pw-badge.no{color:var(--danger-ink);background:var(--danger-soft)}
.luca .pw-listing-stats{display:flex;gap:14px;font-size:12.5px;color:var(--muted-2)}
.luca .pw-listing-stats>div{display:flex;align-items:center;gap:5px}
.luca .pw-listing-stats em{font-style:normal;color:var(--muted)}
.luca .pw-cap{margin-left:auto;font-weight:700;color:var(--teal-d)}
.luca .pw-listing-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:8px;cursor:pointer}
.luca .pw-rows{display:flex;flex-direction:column;gap:8px}
.luca .pw-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface)}
.luca .pw-row-ico{width:38px;height:38px;border-radius:10px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .pw-row-main{flex:1;min-width:0}
.luca .pw-row-title{font-size:14px;font-weight:600;color:var(--ink)}
.luca .pw-row-sub{font-size:12px;color:var(--muted);margin-top:2px}
.luca .pw-review{border:1px solid var(--line);border-radius:var(--r-sm);padding:14px;background:var(--surface)}
.luca .pw-review-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.luca .pw-stars{display:flex;gap:2px}
.luca .pw-review-biz{font-size:12px;color:var(--muted);font-weight:600}
.luca .pw-review-text{font-size:13px;color:var(--muted-2);line-height:1.6;margin:8px 0 6px}
.luca .pw-review-by{font-size:11.5px;color:var(--muted)}
.luca .pw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.luca .pw-stat{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.luca .pw-stat-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}
.luca .pw-stat.gold .pw-stat-ico{background:var(--gold-soft);color:var(--gold-ink)}
.luca .pw-stat.teal .pw-stat-ico{background:var(--mint-soft);color:var(--teal-d)}
.luca .pw-stat.ink .pw-stat-ico{background:var(--surface-2);color:var(--ink)}
.luca .pw-stat-val{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--ink);line-height:1}
.luca .pw-stat-lbl{font-size:12px;color:var(--muted);margin-top:3px}
.luca .pw-note{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--muted-2);background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:12px 14px}
.luca .pw-settings{display:flex;flex-direction:column;gap:14px;max-width:520px}
.luca .pw-card{border:1px solid var(--line);border-radius:var(--r);background:var(--surface);padding:16px}
.luca .pw-card-h{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);margin-bottom:12px}
.luca .pw-set-row{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;padding:9px 0;border-bottom:1px dashed var(--line)}
.luca .pw-set-row:last-child{border-bottom:none}
.luca .pw-set-row span{color:var(--muted)}.luca .pw-set-row b{color:var(--ink);display:flex;align-items:center;gap:5px}
.luca .pw-ok{color:var(--teal-d) !important}
`;

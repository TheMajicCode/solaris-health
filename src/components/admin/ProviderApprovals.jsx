/**
 * ProviderApprovals — admin dashboard for reviewing provider applications.
 * Shows summary stats, a filterable/searchable list, and opens the review modal.
 *
 * Props:
 *   onStatsChange  (stats)=>void   — optional, lets the parent update a badge
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2, Search, Clock, CheckCircle2, XCircle, Users, Stethoscope, Store, RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import ApplicationReviewModal from './ApplicationReviewModal.jsx';

const MEDICAL_TYPES = ['doctor', 'dentist', 'therapist', 'nutritionist'];
const STATUS_TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];
const CAT_TABS = [
  { id: '', label: 'All types' },
  { id: 'medical', label: 'Medical' },
  { id: 'non-medical', label: 'Non-medical' },
];

export default function ProviderApprovals({ onStatsChange }) {
  const [stats, setStats] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('pending');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('newest');
  const [reviewId, setReviewId] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await api.getProviderStats();
      setStats(s); onStatsChange?.(s);
    } catch { /* ignore */ }
  }, [onStatsChange]);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPendingApplications({ status, category, q, sort });
      setApps(res.applications || []);
    } catch {
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [status, category, q, sort]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    const t = setTimeout(loadApps, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadApps, q]);

  const refresh = () => { loadStats(); loadApps(); };

  const STAT_CARDS = stats ? [
    { icon: Clock, label: 'Pending', value: stats.pending, cls: 'gold' },
    { icon: CheckCircle2, label: 'Approved today', value: stats.approvedToday, cls: 'teal' },
    { icon: XCircle, label: 'Rejected', value: stats.rejected, cls: 'danger' },
    { icon: Users, label: 'Active providers', value: stats.totalProviders, cls: 'ink' },
  ] : [];

  return (
    <div className="pva">
      <div className="pva-head">
        <button className="pva-refresh" onClick={refresh}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="pva-stats">
        {STAT_CARDS.map((c) => (
          <div key={c.label} className={`pva-stat ${c.cls}`}>
            <div className="pva-stat-ico"><c.icon size={18} /></div>
            <div><div className="pva-stat-val">{c.value}</div><div className="pva-stat-lbl">{c.label}</div></div>
          </div>
        ))}
        {!stats && <div className="pva-stat-skel">Loading stats…</div>}
      </div>

      <div className="pva-controls">
        <div className="pva-tabs">
          {STATUS_TABS.map((t) => (
            <button key={t.id} className={`pva-tab ${status === t.id ? 'on' : ''}`} onClick={() => setStatus(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="pva-tabs alt">
          {CAT_TABS.map((t) => (
            <button key={t.id} className={`pva-tab ${category === t.id ? 'on' : ''}`} onClick={() => setCategory(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="pva-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business or email…" />
        </div>
        <select className="pva-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {loading ? (
        <div className="pva-loading"><Loader2 className="pva-spin" size={26} /> Loading applications…</div>
      ) : apps.length === 0 ? (
        <div className="pva-empty">No applications match these filters.</div>
      ) : (
        <div className="pva-list">
          {apps.map((a) => {
            const med = MEDICAL_TYPES.includes(a.provider_type);
            return (
              <button key={a.id} className="pva-row" onClick={() => setReviewId(a.id)}>
                <div className="pva-row-ico">{med ? <Stethoscope size={18} /> : <Store size={18} />}</div>
                <div className="pva-row-main">
                  <div className="pva-row-biz">{a.business_name}
                    <span className={`pva-tag ${med ? 'med' : ''}`}>{med ? 'Medical' : 'Non-medical'}</span>
                  </div>
                  <div className="pva-row-meta">{a.first_name} {a.last_name} · {a.email}</div>
                </div>
                <div className="pva-row-side">
                  <span className="pva-docs">{a.document_count} docs</span>
                  <span className={`pva-status pva-${a.status}`}>{a.status}</span>
                  <span className="pva-date">{new Date(a.submitted_at).toLocaleDateString()}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {reviewId && (
        <ApplicationReviewModal
          applicationId={reviewId}
          onClose={() => setReviewId(null)}
          onReviewed={refresh}
        />
      )}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .pva{display:flex;flex-direction:column;gap:18px}
.luca .pva-head{display:flex;align-items:center;justify-content:flex-end;gap:16px;margin-bottom:4px}
.luca .pva-title{font-family:'Space Grotesk',sans-serif;font-size:22px;margin:0;color:var(--ink)}
.luca .pva-sub{font-size:13px;color:var(--muted);margin:4px 0 0}
.luca .pva-refresh{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:var(--teal-d);background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:8px 14px;cursor:pointer}
.luca .pva-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
.luca .pva-stat{display:flex;align-items:center;gap:12px;padding:16px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.luca .pva-stat-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}
.luca .pva-stat.gold .pva-stat-ico{background:var(--gold-soft);color:var(--gold-ink)}
.luca .pva-stat.teal .pva-stat-ico{background:var(--mint-soft);color:var(--teal-d)}
.luca .pva-stat.danger .pva-stat-ico{background:var(--danger-soft);color:var(--danger-ink)}
.luca .pva-stat.ink .pva-stat-ico{background:var(--surface-2);color:var(--ink)}
.luca .pva-stat-val{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--ink);line-height:1}
.luca .pva-stat-lbl{font-size:12px;color:var(--muted);margin-top:3px}
.luca .pva-stat-skel{color:var(--muted);font-size:13px;padding:16px}
.luca .pva-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.luca .pva-tabs{display:inline-flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;padding:3px}
.luca .pva-tab{border:none;background:none;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:600;color:var(--muted-2);padding:6px 13px;border-radius:999px}
.luca .pva-tab.on{background:var(--teal-d);color:#fff}
.luca .pva-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line-2);border-radius:999px;padding:8px 14px;color:var(--muted)}
.luca .pva-search input{flex:1;border:none;background:none;outline:none;font-family:inherit;font-size:13px;color:var(--ink)}
.luca .pva-sort{border:1px solid var(--line-2);border-radius:999px;padding:8px 12px;font-family:inherit;font-size:12.5px;color:var(--ink);background:var(--surface);cursor:pointer}
.luca .pva-loading,.luca .pva-empty{padding:48px;text-align:center;color:var(--muted);display:flex;flex-direction:column;align-items:center;gap:10px}
.luca .pva-list{display:flex;flex-direction:column;gap:8px}
.luca .pva-row{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--surface);cursor:pointer;transition:all .15s}
.luca .pva-row:hover{border-color:var(--teal);box-shadow:var(--shadow-sm)}
.luca .pva-row-ico{width:42px;height:42px;border-radius:12px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex-shrink:0}
.luca .pva-row-main{flex:1;min-width:0}
.luca .pva-row-biz{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700;color:var(--ink)}
.luca .pva-tag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--teal-d);background:var(--mint-soft);padding:2px 7px;border-radius:6px}
.luca .pva-tag.med{color:var(--gold-ink);background:var(--gold-soft)}
.luca .pva-row-meta{font-size:12.5px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .pva-row-side{display:flex;align-items:center;gap:12px;flex-shrink:0}
.luca .pva-docs{font-size:11.5px;color:var(--muted-2);background:var(--surface-2);padding:3px 9px;border-radius:7px}
.luca .pva-status{font-size:11px;font-weight:700;text-transform:capitalize;padding:4px 10px;border-radius:999px}
.luca .pva-pending{color:var(--gold-ink);background:var(--gold-soft)}
.luca .pva-approved{color:var(--teal-d);background:var(--mint-soft)}
.luca .pva-rejected{color:var(--danger-ink);background:var(--danger-soft)}
.luca .pva-date{font-size:11.5px;color:var(--muted)}
.luca .pva-spin{animation:pvaspin 1s linear infinite}
@keyframes pvaspin{to{transform:rotate(360deg)}}
@media(max-width:640px){.luca .pva-row-side{flex-direction:column;align-items:flex-end;gap:5px}.luca .pva-date{display:none}}
`;

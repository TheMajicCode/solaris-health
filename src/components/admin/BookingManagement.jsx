/**
 * BookingManagement — admin oversight of all platform appointments.
 *   • Platform stats (volume, revenue, completion / cancellation rates)
 *   • Filterable table (status, date range, provider/patient search)
 *   • Resolve a booking to any status (dispute resolution)
 *
 * Props: none required (admin-gated route).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Search, RotateCw, DollarSign, CalendarCheck, TrendingUp,
  XCircle, Filter, ShieldAlert, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { fmtDate, fmtTime } from '../../lib/calendar-utils.js';

const STATUSES = ['', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
const STATUS_LABEL = {
  '': 'All statuses', pending: 'Pending', confirmed: 'Confirmed',
  completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
};

export default function BookingManagement() {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [resolve, setResolve] = useState(null);

  const loadStats = useCallback(async () => {
    try { const d = await api.getAdminBookingStats(); setStats(d.stats); } catch { /* */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (from) params.from = from;
      if (to) params.to = to;
      const d = await api.getAdminBookingList(params);
      setBookings(d.bookings || []);
    } catch {
      toast.error('Could not load bookings');
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="abk">
      {stats && (
        <div className="abk-stats">
          <Stat icon={<CalendarCheck size={16} />} label="Total bookings" value={stats.total} />
          <Stat icon={<TrendingUp size={16} />} label="Completion" value={`${stats.completionRate}%`} />
          <Stat icon={<XCircle size={16} />} label="Cancellation" value={`${stats.cancellationRate}%`} />
          <Stat icon={<DollarSign size={16} />} label="Gross volume" value={`$${Number(stats.gross_volume || 0).toFixed(0)}`} />
          <Stat icon={<DollarSign size={16} />} label="Platform revenue" value={`$${Number(stats.platform_revenue || 0).toFixed(0)}`} accent />
        </div>
      )}

      <div className="abk-filters">
        <div className="abk-filter">
          <Filter size={14} />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </div>
        <label className="abk-date">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="abk-date">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button className="abk-refresh" onClick={() => { load(); loadStats(); }}>
          <RotateCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="abk-loading"><Loader2 className="abk-spin" size={26} /> Loading…</div>
      ) : bookings.length === 0 ? (
        <div className="abk-empty">No bookings match these filters.</div>
      ) : (
        <div className="abk-table-wrap">
          <table className="abk-table">
            <thead>
              <tr>
                <th>Date / Time</th><th>Patient</th><th>Provider</th><th>Service</th>
                <th>Status</th><th>Total</th><th></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="abk-dt">{fmtDate(b.booking_date)}</div>
                    <div className="abk-dt-sub">{fmtTime(b.start_time)}</div>
                  </td>
                  <td>
                    <div>{b.patient_name || '—'}</div>
                    <div className="abk-sub">{b.patient_email}</div>
                  </td>
                  <td>{b.business_name || '—'}</td>
                  <td>{b.service_name || '—'}</td>
                  <td><span className={`abk-badge ${b.status}`}>{STATUS_LABEL[b.status] || b.status}</span></td>
                  <td className="abk-mono">{b.total_price != null ? `$${Number(b.total_price).toFixed(2)}` : '—'}</td>
                  <td>
                    <button className="abk-resolve" onClick={() => setResolve(b)} title="Resolve / override status">
                      <ShieldAlert size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolve && (
        <ResolveModal booking={resolve} onClose={() => setResolve(null)}
          onDone={async () => { setResolve(null); await Promise.all([load(), loadStats()]); }} />
      )}
      <style>{CSS}</style>
    </div>
  );
}

function Stat({ icon, label, value, accent }) {
  return (
    <div className={`abk-stat ${accent ? 'accent' : ''}`}>
      <span className="abk-stat-ico">{icon}</span>
      <div><div className="abk-stat-v">{value}</div><div className="abk-stat-l">{label}</div></div>
    </div>
  );
}

function ResolveModal({ booking: b, onClose, onDone }) {
  const [status, setStatus] = useState(b.status);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    setSaving(true);
    try {
      await api.resolveBooking(b.id, { status, reason: reason || undefined });
      toast.success('Booking updated');
      await onDone();
    } catch (e) {
      toast.error(e?.message || 'Could not resolve');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="abk-scrim" onClick={onClose}>
      <div className="abk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="abk-x" onClick={onClose}><X size={18} /></button>
        <h2 className="abk-m-title"><ShieldAlert size={18} /> Resolve booking</h2>
        <p className="abk-m-sub">{b.patient_name} · {b.business_name} · {fmtDate(b.booking_date)}</p>
        <label className="abk-label">Override status</label>
        <select className="abk-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.filter(Boolean).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <label className="abk-label">Reason / note</label>
        <textarea className="abk-textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for this change (shared with patient)…" />
        <div className="abk-m-actions">
          <button className="abk-btn ghost" onClick={onClose}>Cancel</button>
          <button className="abk-btn primary" disabled={saving} onClick={submit}>
            {saving ? <><Loader2 className="abk-spin" size={15} /> Saving…</> : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.luca .abk{max-width:980px}
.luca .abk-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
@media(max-width:760px){.luca .abk-stats{grid-template-columns:repeat(2,1fr)}}
.luca .abk-stat{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px 13px}
.luca .abk-stat.accent{border-color:var(--gold);background:#fffdf5}
.luca .abk-stat-ico{width:34px;height:34px;border-radius:9px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex:none}
.luca .abk-stat.accent .abk-stat-ico{background:#fef3d7;color:#9a6b00}
.luca .abk-stat-v{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;color:var(--ink);line-height:1.1}
.luca .abk-stat-l{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:2px}
.luca .abk-filters{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.luca .abk-filter{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:10px;padding:6px 10px;background:var(--surface);color:var(--muted)}
.luca .abk-filter select{border:none;background:none;font-family:inherit;font-size:13px;color:var(--ink);cursor:pointer;outline:none}
.luca .abk-date{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);font-weight:600}
.luca .abk-date input{border:1px solid var(--line);border-radius:9px;padding:6px 9px;font-family:inherit;font-size:13px;color:var(--ink);background:var(--surface)}
.luca .abk-refresh{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 13px;font-family:inherit;font-weight:700;font-size:13px;color:var(--ink);cursor:pointer}
.luca .abk-refresh:hover{background:var(--surface-2)}
.luca .abk-loading{display:flex;align-items:center;gap:10px;justify-content:center;padding:50px;color:var(--muted)}
.luca .abk-spin{animation:spin 1s linear infinite}
.luca .abk-empty{text-align:center;padding:40px;color:var(--muted);font-size:14px}
.luca .abk-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.luca .abk-table{width:100%;border-collapse:collapse;font-size:13px;min-width:720px}
.luca .abk-table th{text-align:left;padding:11px 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted-2);border-bottom:1px solid var(--line);background:var(--canvas)}
.luca .abk-table td{padding:11px 14px;border-bottom:1px solid var(--line);color:var(--ink);vertical-align:top}
.luca .abk-table tr:last-child td{border-bottom:none}
.luca .abk-dt{font-weight:700}
.luca .abk-dt-sub,.luca .abk-sub{font-size:11.5px;color:var(--muted);margin-top:1px}
.luca .abk-mono{font-family:'IBM Plex Mono',monospace;font-weight:700}
.luca .abk-badge{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
.luca .abk-badge.pending{background:#fef3d7;color:#9a6b00}
.luca .abk-badge.confirmed{background:var(--mint-soft);color:var(--teal-d)}
.luca .abk-badge.completed{background:#e3f3ec;color:var(--mint-ink)}
.luca .abk-badge.cancelled{background:var(--surface-2);color:var(--muted)}
.luca .abk-badge.no_show{background:#fde8e8;color:var(--danger)}
.luca .abk-resolve{border:1px solid var(--line);background:var(--surface);border-radius:8px;width:30px;height:30px;display:grid;place-items:center;cursor:pointer;color:var(--gold)}
.luca .abk-resolve:hover{background:#fffdf5;border-color:var(--gold)}
.luca .abk-scrim{position:fixed;inset:0;background:rgba(6,30,28,.55);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:bkfIn .15s ease}
.luca .abk-modal{position:relative;background:var(--canvas);border-radius:20px;width:100%;max-width:440px;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.luca .abk-x{position:absolute;top:14px;right:14px;border:none;background:var(--surface-2);border-radius:9px;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .abk-m-title{display:flex;align-items:center;gap:8px;font-family:'Space Grotesk',sans-serif;font-size:18px;color:var(--ink);margin:0 0 6px}
.luca .abk-m-title svg{color:var(--gold)}
.luca .abk-m-sub{font-size:12.5px;color:var(--muted);margin:0 0 16px}
.luca .abk-label{display:block;font-size:12.5px;font-weight:700;color:var(--ink);margin:12px 0 6px}
.luca .abk-select,.luca .abk-textarea{width:100%;border:1px solid var(--line);border-radius:11px;padding:10px 12px;font-family:inherit;font-size:14px;color:var(--ink);background:var(--surface);outline:none;resize:vertical}
.luca .abk-select:focus,.luca .abk-textarea:focus{border-color:var(--teal-d)}
.luca .abk-m-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:18px}
.luca .abk-btn{display:inline-flex;align-items:center;gap:6px;border-radius:11px;padding:10px 16px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .abk-btn:disabled{opacity:.5;cursor:not-allowed}
.luca .abk-btn.primary{background:var(--teal-d);color:#fff}
.luca .abk-btn.primary:hover:not(:disabled){background:var(--teal-d2)}
.luca .abk-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .abk-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
`;

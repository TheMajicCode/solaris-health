/**
 * ProviderBookings — provider appointment dashboard.
 *   Views: Today · Pending · Upcoming · Past   + summary stats.
 *   Uses api.getProviderBookings(view) / getProviderBookingStats().
 *   Actions: confirm, decline, complete (with clinical notes), no-show.
 *
 * Props:
 *   providerId   optional explicit provider profile id
 *   onBookings   (pendingCount)=>void  — report pending count to parent badge
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, CalendarClock, X, Check, CheckCircle2, Calendar, Clock, Tag,
  User, Mail, FileText, TrendingUp, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import BookingCard from '../booking/BookingCard.jsx';
import { fmtDateLong, fmtTime, tzLabel } from '../../lib/calendar-utils.js';

const VIEWS = [
  { key: 'today',    label: 'Today' },
  { key: 'pending',  label: 'Pending' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past',     label: 'Past' },
];

export default function ProviderBookings({ providerId, onBookings }) {
  const [view, setView] = useState('today');
  const [bookings, setBookings] = useState([]);
  const [pending, setPending] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [complete, setComplete] = useState(null); // booking being completed
  const tz = tzLabel();

  const loadStats = useCallback(async () => {
    try {
      const d = await api.getProviderBookingStats();
      setStats(d.stats);
      if (d.stats && onBookings) onBookings(d.stats.pending || 0);
    } catch { /* non-fatal */ }
  }, [onBookings]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getProviderBookings(view, providerId);
      setBookings(d.bookings || []);
      if (typeof d.pending === 'number') setPending(d.pending);
    } catch {
      toast.error('Could not load appointments');
    } finally {
      setLoading(false);
    }
  }, [view, providerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  async function act(fn, b, okMsg) {
    setBusy(b.id);
    try {
      await fn();
      toast.success(okMsg);
      await Promise.all([load(), loadStats()]);
    } catch (e) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const confirm = (b) => act(() => api.confirmBooking(b.id), b, 'Appointment confirmed');
  const decline = (b) => {
    const reason = window.prompt('Reason for declining (optional, shared with patient):', '') ?? null;
    return act(() => api.declineBooking(b.id, reason || undefined), b, 'Appointment declined');
  };
  const noShow = (b) => act(() => api.noShowBooking(b.id), b, 'Marked as no-show');

  async function submitComplete(notes) {
    const b = complete;
    setComplete(null);
    return act(() => api.completeBooking(b.id, notes || undefined), b, 'Appointment completed');
  }

  return (
    <div className="pbk">
      {stats && (
        <div className="pbk-stats">
          <Stat icon={<CalendarClock size={16} />} label="Upcoming" value={stats.upcoming} />
          <Stat icon={<Clock size={16} />} label="Pending" value={stats.pending} accent={stats.pending > 0} />
          <Stat icon={<CheckCircle2 size={16} />} label="Completed" value={stats.completed} />
          <Stat icon={<TrendingUp size={16} />} label="Completion" value={`${stats.completionRate}%`} />
          <Stat icon={<DollarSign size={16} />} label="Earned" value={`$${Number(stats.earned || 0).toFixed(0)}`} />
        </div>
      )}

      <div className="pbk-tabs">
        {VIEWS.map((v) => (
          <button key={v.key} className={`pbk-tab ${view === v.key ? 'on' : ''}`} onClick={() => setView(v.key)}>
            {v.label}
            {v.key === 'pending' && pending > 0 && <span className="pbk-dot">{pending}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="pbk-loading"><Loader2 className="pbk-spin" size={26} /> Loading…</div>
      ) : bookings.length === 0 ? (
        <div className="pbk-empty">
          <div className="pbk-empty-ico"><CalendarClock size={28} /></div>
          <h3>No {view} appointments</h3>
          <p>{view === 'pending' ? 'New booking requests will appear here for your approval.'
            : view === 'today' ? 'You have no appointments scheduled for today.'
            : 'Appointments will show up here.'}</p>
        </div>
      ) : (
        <div className="pbk-list">
          {bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              perspective="provider"
              busy={busy}
              onConfirm={confirm}
              onDecline={decline}
              onComplete={(bk) => setComplete(bk)}
              onNoShow={noShow}
            />
          ))}
        </div>
      )}

      {complete && (
        <CompleteModal booking={complete} tz={tz} onClose={() => setComplete(null)} onSubmit={submitComplete} />
      )}
      <style>{CSS}</style>
    </div>
  );
}

function Stat({ icon, label, value, accent }) {
  return (
    <div className={`pbk-stat ${accent ? 'accent' : ''}`}>
      <span className="pbk-stat-ico">{icon}</span>
      <div>
        <div className="pbk-stat-v">{value}</div>
        <div className="pbk-stat-l">{label}</div>
      </div>
    </div>
  );
}

function CompleteModal({ booking: b, tz, onClose, onSubmit }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  return (
    <div className="pbk-scrim" onClick={onClose}>
      <div className="pbk-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pbk-x" onClick={onClose}><X size={18} /></button>
        <h2 className="pbk-m-title">Complete appointment</h2>
        <div className="pbk-m-rows">
          <div><User size={14} /> {b.patient_name || 'Patient'}</div>
          <div><Tag size={14} /> {b.service_name || 'Appointment'}</div>
          <div><Calendar size={14} /> {fmtDateLong(b.booking_date)}</div>
          <div><Clock size={14} /> {fmtTime(b.start_time)} – {fmtTime(b.end_time)} ({tz})</div>
        </div>
        <label className="pbk-label">Clinical / visit notes <span>(optional, visible to patient)</span></label>
        <textarea className="pbk-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Summary, follow-up recommendations…" />
        <div className="pbk-m-actions">
          <button className="pbk-btn ghost" onClick={onClose}>Cancel</button>
          <button className="pbk-btn primary" disabled={saving} onClick={async () => { setSaving(true); await onSubmit(notes); }}>
            {saving ? <><Loader2 className="pbk-spin" size={15} /> Saving…</> : <><CheckCircle2 size={15} /> Mark complete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.luca .pbk{max-width:780px}
.luca .pbk-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
@media(max-width:640px){.luca .pbk-stats{grid-template-columns:repeat(2,1fr)}}
.luca .pbk-stat{display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:12px 13px}
.luca .pbk-stat.accent{border-color:var(--gold);background:#fffdf5}
.luca .pbk-stat-ico{width:34px;height:34px;border-radius:9px;background:var(--mint-soft);color:var(--teal-d);display:grid;place-items:center;flex:none}
.luca .pbk-stat.accent .pbk-stat-ico{background:#fef3d7;color:#9a6b00}
.luca .pbk-stat-v{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;color:var(--ink);line-height:1.1}
.luca .pbk-stat-l{font-size:11.5px;color:var(--muted);font-weight:600;margin-top:2px}
.luca .pbk-tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.luca .pbk-tab{display:flex;align-items:center;gap:7px;background:none;border:none;padding:10px 14px;font-family:inherit;
  font-weight:700;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.luca .pbk-tab.on{color:var(--teal-d);border-bottom-color:var(--teal-d)}
.luca .pbk-dot{background:var(--gold);color:#3a2c00;font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px}
.luca .pbk-loading{display:flex;align-items:center;gap:10px;justify-content:center;padding:60px;color:var(--muted)}
.luca .pbk-spin{animation:spin 1s linear infinite}
.luca .pbk-list{display:flex;flex-direction:column;gap:12px}
.luca .pbk-empty{text-align:center;padding:46px 20px;color:var(--muted)}
.luca .pbk-empty-ico{width:60px;height:60px;border-radius:50%;background:var(--surface-2);color:var(--muted-2);display:grid;place-items:center;margin:0 auto 12px}
.luca .pbk-empty h3{font-family:'Space Grotesk',sans-serif;font-size:16px;color:var(--ink);margin:0 0 6px}
.luca .pbk-empty p{font-size:13px;max-width:330px;margin:0 auto;line-height:1.5}
.luca .pbk-scrim{position:fixed;inset:0;background:rgba(6,30,28,.55);backdrop-filter:blur(4px);z-index:1000;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:bkfIn .15s ease}
.luca .pbk-modal{position:relative;background:var(--canvas);border-radius:20px;width:100%;max-width:460px;max-height:92vh;
  overflow:auto;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.luca .pbk-x{position:absolute;top:14px;right:14px;border:none;background:var(--surface-2);border-radius:9px;
  width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .pbk-x:hover{background:var(--mint-line)}
.luca .pbk-m-title{font-family:'Space Grotesk',sans-serif;font-size:19px;color:var(--ink);margin:0 0 14px;padding-right:30px}
.luca .pbk-m-rows{display:flex;flex-direction:column;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:16px}
.luca .pbk-m-rows div{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink);font-weight:600}
.luca .pbk-m-rows svg{color:var(--teal-d);flex:none}
.luca .pbk-label{display:block;font-size:12.5px;font-weight:700;color:var(--ink);margin:0 0 6px}
.luca .pbk-label span{font-weight:500;color:var(--muted-2)}
.luca .pbk-textarea{width:100%;border:1px solid var(--line);border-radius:11px;padding:11px 13px;font-family:inherit;
  font-size:14px;color:var(--ink);background:var(--surface);outline:none;resize:vertical}
.luca .pbk-textarea:focus{border-color:var(--teal-d)}
.luca .pbk-m-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:16px}
.luca .pbk-btn{display:inline-flex;align-items:center;gap:6px;border-radius:11px;padding:10px 16px;font-weight:700;font-size:13.5px;
  cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .pbk-btn:disabled{opacity:.5;cursor:not-allowed}
.luca .pbk-btn.primary{background:var(--teal-d);color:#fff}
.luca .pbk-btn.primary:hover:not(:disabled){background:var(--teal-d2)}
.luca .pbk-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .pbk-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
`;

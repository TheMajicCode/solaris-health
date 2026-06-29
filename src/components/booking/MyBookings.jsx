/**
 * MyBookings — patient appointment dashboard.
 *   Tabs: Upcoming · Pending · Past
 *   Uses api.getMyBookings(); supports cancel + reschedule with toasts.
 *
 * Props:
 *   user        current user
 *   onExplore   ()=>void   — CTA to the marketplace (empty state)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, CalendarX2, Compass, X, Calendar, Clock, Tag, MapPin, Phone,
  FileText, ShieldCheck, ChevronLeft, Check, CalendarPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import BookingCard from './BookingCard.jsx';
import TimeSlotPicker from './TimeSlotPicker.jsx';
import {
  fmtDateLong, fmtTime, downloadICS, tzLabel, countdown,
} from '../../lib/calendar-utils.js';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending',  label: 'Pending' },
  { key: 'past',     label: 'Past' },
];

function isUpcoming(b) {
  return (b.status === 'confirmed') && countdown(b.booking_date, b.start_time) !== 'Past';
}
function isPending(b) {
  return b.status === 'pending' && countdown(b.booking_date, b.start_time) !== 'Past';
}
function isPast(b) {
  return ['completed', 'cancelled', 'no_show'].includes(b.status) ||
    countdown(b.booking_date, b.start_time) === 'Past';
}

export default function MyBookings({ user, onExplore }) {
  const [tab, setTab] = useState('upcoming');
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [detail, setDetail] = useState(null);     // booking being viewed
  const [reschedule, setReschedule] = useState(null); // booking being rescheduled
  const tz = tzLabel();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getMyBookings();
      setAll(d.bookings || []);
    } catch {
      toast.error('Could not load your appointments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => ({
    upcoming: all.filter(isUpcoming),
    pending: all.filter(isPending),
    past: all.filter(isPast),
  }), [all]);

  const list = groups[tab] || [];

  async function doCancel(b) {
    const reason = window.prompt('Optionally tell the provider why you are cancelling:', '') ?? null;
    setBusy(b.id);
    try {
      await api.cancelBooking(b.id, reason || undefined);
      toast.success('Appointment cancelled');
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(e?.message || 'Could not cancel');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="myb">
      <div className="myb-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`myb-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {groups[t.key].length > 0 && <span className="myb-count">{groups[t.key].length}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="myb-loading"><Loader2 className="myb-spin" size={26} /> Loading your appointments…</div>
      ) : list.length === 0 ? (
        <div className="myb-empty">
          <div className="myb-empty-ico"><CalendarX2 size={30} /></div>
          <h3>No {tab} appointments</h3>
          <p>
            {tab === 'past'
              ? 'Your completed and cancelled appointments will appear here.'
              : 'Book an appointment with a provider to get started.'}
          </p>
          {tab !== 'past' && onExplore && (
            <button className="myb-cta" onClick={onExplore}><Compass size={16} /> Explore providers</button>
          )}
        </div>
      ) : (
        <div className="myb-list">
          {list.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              perspective="patient"
              busy={busy}
              onView={setDetail}
              onCancel={doCancel}
              onReschedule={(bk) => { setDetail(null); setReschedule(bk); }}
            />
          ))}
        </div>
      )}

      {detail && (
        <DetailModal
          booking={detail}
          tz={tz}
          busy={busy}
          onClose={() => setDetail(null)}
          onCancel={() => doCancel(detail)}
          onReschedule={() => { setReschedule(detail); setDetail(null); }}
        />
      )}

      {reschedule && (
        <RescheduleModal
          booking={reschedule}
          tz={tz}
          onClose={() => setReschedule(null)}
          onDone={async () => { setReschedule(null); await load(); }}
        />
      )}
      <style>{CSS}</style>
    </div>
  );
}

/* --------------------------- Detail modal --------------------------- */
function DetailModal({ booking: b, tz, busy, onClose, onCancel, onReschedule }) {
  const future = countdown(b.booking_date, b.start_time) !== 'Past';
  const canModify = (b.status === 'pending' || b.status === 'confirmed') && future;
  return (
    <div className="myb-scrim" onClick={onClose}>
      <div className="myb-modal" onClick={(e) => e.stopPropagation()}>
        <button className="myb-x" onClick={onClose}><X size={18} /></button>
        <h2 className="myb-m-title">{b.business_name || 'Appointment'}</h2>
        <span className={`myb-m-status ${b.status}`}>{b.status}</span>

        <div className="myb-m-rows">
          <Row icon={<Tag size={15} />} label="Service" value={b.service_name || '—'} />
          <Row icon={<Calendar size={15} />} label="Date" value={fmtDateLong(b.booking_date)} />
          <Row icon={<Clock size={15} />} label="Time" value={`${fmtTime(b.start_time)} – ${fmtTime(b.end_time)} (${tz})`} />
          {(b.address || b.city) && (
            <Row icon={<MapPin size={15} />} label="Location" value={[b.address, b.city].filter(Boolean).join(', ')} />
          )}
          {b.provider_phone && <Row icon={<Phone size={15} />} label="Provider phone" value={b.provider_phone} />}
          {b.total_price != null && Number(b.total_price) > 0 && (
            <Row icon={<Tag size={15} />} label="Price" value={`$${Number(b.total_price).toFixed(2)}`} />
          )}
          {b.patient_notes && <Row icon={<FileText size={15} />} label="Your notes" value={b.patient_notes} />}
          {b.cancellation_reason && (
            <Row icon={<FileText size={15} />} label="Cancellation reason" value={b.cancellation_reason} />
          )}
          {b.clinical_notes && (
            <Row icon={<FileText size={15} />} label="Provider notes" value={b.clinical_notes} />
          )}
        </div>

        <p className="myb-m-policy"><ShieldCheck size={13} /> Cancellations within 24 hours may be subject to provider policy.</p>

        <div className="myb-m-actions">
          {(b.status === 'confirmed' || b.status === 'completed') && (
            <button className="myb-btn ghost" onClick={() => downloadICS(b)}>
              <CalendarPlus size={15} /> Add to Calendar
            </button>
          )}
          {canModify && (
            <>
              <button className="myb-btn ghost" disabled={busy === b.id} onClick={onReschedule}>Reschedule</button>
              <button className="myb-btn danger" disabled={busy === b.id} onClick={onCancel}>Cancel appointment</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="myb-row">
      <span className="myb-row-ico">{icon}</span>
      <span className="myb-row-l">{label}</span>
      <span className="myb-row-v">{value}</span>
    </div>
  );
}

/* ------------------------- Reschedule modal ------------------------- */
function RescheduleModal({ booking: b, tz, onClose, onDone }) {
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const d = await api.getAvailableSlots(b.provider_id, b.service_id || b.serviceId, 60);
        if (on) setDates(d.dates || []);
      } catch {
        if (on) toast.error('Could not load availability');
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [b]);

  async function save() {
    if (!slot) return;
    setSaving(true);
    try {
      await api.rescheduleBooking(b.id, { date: slot.date, startTime: slot.start, endTime: slot.end });
      toast.success('Appointment rescheduled — pending provider confirmation');
      await onDone();
    } catch (e) {
      toast.error(e?.message || 'Could not reschedule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="myb-scrim" onClick={onClose}>
      <div className="myb-modal wide" onClick={(e) => e.stopPropagation()}>
        <button className="myb-x" onClick={onClose}><X size={18} /></button>
        <button className="myb-back" onClick={onClose}><ChevronLeft size={15} /> Back</button>
        <h2 className="myb-m-title">Reschedule appointment</h2>
        <p className="myb-m-sub">{b.business_name} · {b.service_name}</p>
        <p className="myb-m-cur">Currently: {fmtDateLong(b.booking_date)} at {fmtTime(b.start_time)}</p>

        <TimeSlotPicker dates={dates} loading={loading} value={slot} onChange={setSlot} tz={tz} />

        <div className="myb-m-actions end">
          <button className="myb-btn ghost" onClick={onClose}>Cancel</button>
          <button className="myb-btn primary" disabled={!slot || saving} onClick={save}>
            {saving ? <><Loader2 className="myb-spin" size={15} /> Saving…</> : <><Check size={15} /> Confirm new time</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.luca .myb{max-width:760px}
.luca .myb-tabs{display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid var(--line)}
.luca .myb-tab{display:flex;align-items:center;gap:7px;background:none;border:none;padding:10px 14px;font-family:inherit;
  font-weight:700;font-size:14px;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.luca .myb-tab.on{color:var(--teal-d);border-bottom-color:var(--teal-d)}
.luca .myb-count{background:var(--surface-2);color:var(--muted);font-size:11px;font-weight:800;padding:1px 7px;border-radius:999px}
.luca .myb-tab.on .myb-count{background:var(--mint-soft);color:var(--teal-d)}
.luca .myb-loading{display:flex;align-items:center;gap:10px;justify-content:center;padding:60px;color:var(--muted)}
.luca .myb-spin{animation:spin 1s linear infinite}
.luca .myb-list{display:flex;flex-direction:column;gap:12px}
.luca .myb-empty{text-align:center;padding:50px 20px;color:var(--muted)}
.luca .myb-empty-ico{width:64px;height:64px;border-radius:50%;background:var(--surface-2);color:var(--muted-2);
  display:grid;place-items:center;margin:0 auto 14px}
.luca .myb-empty h3{font-family:'Space Grotesk',sans-serif;font-size:17px;color:var(--ink);margin:0 0 6px}
.luca .myb-empty p{font-size:13.5px;max-width:340px;margin:0 auto 16px;line-height:1.5}
.luca .myb-cta{display:inline-flex;align-items:center;gap:7px;background:var(--teal-d);color:#fff;border:none;border-radius:11px;
  padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
.luca .myb-cta:hover{background:var(--teal-d2)}
.luca .myb-scrim{position:fixed;inset:0;background:rgba(6,30,28,.55);backdrop-filter:blur(4px);z-index:1000;
  display:flex;align-items:center;justify-content:center;padding:20px;animation:bkfIn .15s ease}
.luca .myb-modal{position:relative;background:var(--canvas);border-radius:20px;width:100%;max-width:480px;max-height:92vh;
  overflow:auto;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.luca .myb-modal.wide{max-width:620px}
.luca .myb-x{position:absolute;top:14px;right:14px;border:none;background:var(--surface-2);border-radius:9px;
  width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .myb-x:hover{background:var(--mint-line)}
.luca .myb-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--muted);
  font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:0;margin-bottom:10px}
.luca .myb-m-title{font-family:'Space Grotesk',sans-serif;font-size:20px;color:var(--ink);margin:0 0 8px;padding-right:30px}
.luca .myb-m-sub{font-size:13.5px;color:var(--muted);margin:0 0 4px}
.luca .myb-m-cur{font-size:12.5px;color:var(--muted-2);margin:0 0 14px}
.luca .myb-m-status{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;
  padding:3px 10px;border-radius:999px;margin-bottom:16px;background:var(--surface-2);color:var(--muted)}
.luca .myb-m-status.pending{background:#fef3d7;color:#9a6b00}
.luca .myb-m-status.confirmed{background:var(--mint-soft);color:var(--teal-d)}
.luca .myb-m-status.completed{background:#e3f3ec;color:var(--mint-ink)}
.luca .myb-m-status.cancelled,.luca .myb-m-status.no_show{background:#fde8e8;color:var(--danger)}
.luca .myb-m-rows{display:flex;flex-direction:column;gap:2px;margin-bottom:14px}
.luca .myb-row{display:grid;grid-template-columns:24px 110px 1fr;align-items:start;gap:8px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.luca .myb-row:last-child{border-bottom:none}
.luca .myb-row-ico{color:var(--muted-2)}
.luca .myb-row-l{color:var(--muted);font-weight:600}
.luca .myb-row-v{color:var(--ink);font-weight:600;word-break:break-word}
.luca .myb-m-policy{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--muted);margin:0 0 16px;line-height:1.5}
.luca .myb-m-actions{display:flex;gap:9px;flex-wrap:wrap}
.luca .myb-m-actions.end{justify-content:flex-end;margin-top:16px}
.luca .myb-btn{display:inline-flex;align-items:center;gap:6px;border-radius:11px;padding:10px 16px;font-weight:700;font-size:13.5px;
  cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .myb-btn:disabled{opacity:.5;cursor:not-allowed}
.luca .myb-btn.primary{background:var(--teal-d);color:#fff}
.luca .myb-btn.primary:hover:not(:disabled){background:var(--teal-d2)}
.luca .myb-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .myb-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
.luca .myb-btn.danger{background:var(--surface);border-color:var(--line);color:var(--danger)}
.luca .myb-btn.danger:hover:not(:disabled){background:#fde8e8;border-color:var(--danger)}
`;

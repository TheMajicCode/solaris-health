/**
 * BookingCard — reusable appointment card used in both the patient
 * dashboard (MyBookings) and the provider dashboard (ProviderBookings).
 *
 * Props:
 *   booking      booking record (from /api/bookings/me or /api/provider/bookings/me)
 *   perspective  'patient' | 'provider'  (default 'patient')
 *   busy         id currently performing an action (disables buttons)
 *   onView       (booking)=>void          — open details
 *   onCancel     (booking)=>void          — patient cancel
 *   onReschedule (booking)=>void          — patient reschedule
 *   onConfirm    (booking)=>void          — provider confirm
 *   onDecline    (booking)=>void          — provider decline
 *   onComplete   (booking)=>void          — provider mark complete
 *   onNoShow     (booking)=>void          — provider mark no-show
 */
import React from 'react';
import {
  Calendar, Clock, Tag, User, MapPin, CalendarPlus, Check, X,
  CheckCircle2, UserX, RotateCcw, ChevronRight, DollarSign,
} from 'lucide-react';
import { fmtDate, fmtTime, countdown, downloadICS } from '../../lib/calendar-utils.js';

const STATUS = {
  pending:   { label: 'Pending',    cls: 'pending' },
  confirmed: { label: 'Confirmed',  cls: 'confirmed' },
  cancelled: { label: 'Cancelled',  cls: 'cancelled' },
  completed: { label: 'Completed',  cls: 'completed' },
  no_show:   { label: 'No-show',    cls: 'noshow' },
};

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

export default function BookingCard({
  booking: b, perspective = 'patient', busy,
  onView, onCancel, onReschedule, onConfirm, onDecline, onComplete, onNoShow,
}) {
  const st = STATUS[b.status] || { label: b.status, cls: 'pending' };
  const isPatient = perspective === 'patient';
  const isBusy = busy === b.id;

  // Who/what to display in the card header.
  const title = isPatient ? (b.business_name || 'Provider') : (b.patient_name || 'Patient');
  const photo = isPatient ? b.profile_photo_url : null;
  const cd = countdown(b.booking_date, b.start_time);
  const isFuture = cd !== 'Past';

  // Action availability.
  const canCancel = isPatient && (b.status === 'pending' || b.status === 'confirmed') && isFuture;
  const canReschedule = isPatient && (b.status === 'pending' || b.status === 'confirmed') && isFuture;
  const canConfirmDecline = !isPatient && b.status === 'pending';
  const canComplete = !isPatient && b.status === 'confirmed';
  const canNoShow = !isPatient && b.status === 'confirmed';

  const addToCal = () => downloadICS({
    ...b,
    service_name: b.service_name,
    business_name: b.business_name,
    address: b.address,
    city: b.city,
  });

  return (
    <div className={`bkc bkc-${st.cls}`}>
      <div className="bkc-main" onClick={() => onView && onView(b)} role="button" tabIndex={0}
           onKeyDown={(e) => { if (e.key === 'Enter' && onView) onView(b); }}>
        <div className="bkc-ava">
          {photo ? <img src={photo} alt="" /> : <span>{initials(title)}</span>}
        </div>
        <div className="bkc-info">
          <div className="bkc-top">
            <span className="bkc-title">{title}</span>
            <span className={`bkc-badge ${st.cls}`}>{st.label}</span>
          </div>
          <div className="bkc-svc"><Tag size={12} /> {b.service_name || 'Appointment'}</div>
          <div className="bkc-meta">
            <span><Calendar size={12} /> {fmtDate(b.booking_date)}</span>
            <span><Clock size={12} /> {fmtTime(b.start_time)}{b.end_time ? ` – ${fmtTime(b.end_time)}` : ''}</span>
            {isFuture && (b.status === 'pending' || b.status === 'confirmed') && (
              <span className="bkc-cd">{cd}</span>
            )}
          </div>
          {!isPatient && b.patient_email && (
            <div className="bkc-sub"><User size={11} /> {b.patient_email}</div>
          )}
          {isPatient && b.address && (
            <div className="bkc-sub"><MapPin size={11} /> {[b.address, b.city].filter(Boolean).join(', ')}</div>
          )}
        </div>
        <ChevronRight className="bkc-chev" size={18} />
      </div>

      <div className="bkc-foot">
        <div className="bkc-price">
          {b.total_price != null && Number(b.total_price) > 0 && (
            <span><DollarSign size={12} />{Number(b.total_price).toFixed(2)}
              {!isPatient && b.provider_payout != null && (
                <em> · you earn ${Number(b.provider_payout).toFixed(2)}</em>
              )}
            </span>
          )}
        </div>
        <div className="bkc-actions">
          {(b.status === 'confirmed' || b.status === 'completed') && (
            <button className="bkc-btn ghost" onClick={addToCal} title="Add to calendar">
              <CalendarPlus size={14} /> Calendar
            </button>
          )}
          {canReschedule && (
            <button className="bkc-btn ghost" disabled={isBusy} onClick={() => onReschedule && onReschedule(b)}>
              <RotateCcw size={14} /> Reschedule
            </button>
          )}
          {canCancel && (
            <button className="bkc-btn danger" disabled={isBusy} onClick={() => onCancel && onCancel(b)}>
              <X size={14} /> Cancel
            </button>
          )}
          {canConfirmDecline && (
            <>
              <button className="bkc-btn danger" disabled={isBusy} onClick={() => onDecline && onDecline(b)}>
                <X size={14} /> Decline
              </button>
              <button className="bkc-btn primary" disabled={isBusy} onClick={() => onConfirm && onConfirm(b)}>
                <Check size={14} /> Confirm
              </button>
            </>
          )}
          {canComplete && (
            <>
              {canNoShow && (
                <button className="bkc-btn ghost" disabled={isBusy} onClick={() => onNoShow && onNoShow(b)}>
                  <UserX size={14} /> No-show
                </button>
              )}
              <button className="bkc-btn primary" disabled={isBusy} onClick={() => onComplete && onComplete(b)}>
                <CheckCircle2 size={14} /> Complete
              </button>
            </>
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .bkc{background:var(--surface);border:1px solid var(--line);border-radius:15px;overflow:hidden;transition:box-shadow .12s,border-color .12s}
.luca .bkc:hover{box-shadow:var(--shadow-sm)}
.luca .bkc-pending{border-left:3px solid var(--gold)}
.luca .bkc-confirmed{border-left:3px solid var(--teal-d)}
.luca .bkc-completed{border-left:3px solid var(--mint-ink)}
.luca .bkc-cancelled{border-left:3px solid var(--line-2);opacity:.78}
.luca .bkc-noshow{border-left:3px solid var(--danger);opacity:.8}
.luca .bkc-main{display:flex;align-items:flex-start;gap:13px;padding:14px 15px;cursor:pointer}
.luca .bkc-ava{width:46px;height:46px;border-radius:12px;flex:none;overflow:hidden;background:var(--mint-soft);
  display:grid;place-items:center;color:var(--teal-d);font-weight:800;font-size:15px;font-family:'Space Grotesk',sans-serif}
.luca .bkc-ava img{width:100%;height:100%;object-fit:cover}
.luca .bkc-info{flex:1;min-width:0}
.luca .bkc-top{display:flex;align-items:center;gap:8px;justify-content:space-between}
.luca .bkc-title{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;color:var(--ink);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .bkc-badge{font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em;flex:none}
.luca .bkc-badge.pending{background:#fef3d7;color:#9a6b00}
.luca .bkc-badge.confirmed{background:var(--mint-soft);color:var(--teal-d)}
.luca .bkc-badge.completed{background:#e3f3ec;color:var(--mint-ink)}
.luca .bkc-badge.cancelled{background:var(--surface-2);color:var(--muted)}
.luca .bkc-badge.noshow{background:#fde8e8;color:var(--danger)}
.luca .bkc-svc{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--ink);font-weight:600;margin-top:4px}
.luca .bkc-svc svg{color:var(--muted-2);flex:none}
.luca .bkc-meta{display:flex;flex-wrap:wrap;gap:5px 13px;margin-top:5px;font-size:12px;color:var(--muted)}
.luca .bkc-meta span{display:flex;align-items:center;gap:4px}
.luca .bkc-meta svg{color:var(--muted-2)}
.luca .bkc-cd{background:var(--mint-soft);color:var(--teal-d);font-weight:700;padding:1px 8px;border-radius:999px}
.luca .bkc-sub{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted-2);margin-top:5px}
.luca .bkc-chev{color:var(--muted-2);flex:none;align-self:center}
.luca .bkc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 15px;
  border-top:1px solid var(--line);background:var(--canvas);flex-wrap:wrap}
.luca .bkc-price{font-size:12.5px;color:var(--ink);font-weight:700;font-family:'IBM Plex Mono',monospace}
.luca .bkc-price span{display:flex;align-items:center;gap:2px}
.luca .bkc-price em{font-style:normal;color:var(--muted);font-weight:500;font-family:'IBM Plex Sans',sans-serif}
.luca .bkc-actions{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto}
.luca .bkc-btn{display:inline-flex;align-items:center;gap:5px;border-radius:9px;padding:7px 12px;font-weight:700;font-size:12.5px;
  cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .bkc-btn:disabled{opacity:.5;cursor:not-allowed}
.luca .bkc-btn.primary{background:var(--teal-d);color:#fff}
.luca .bkc-btn.primary:hover:not(:disabled){background:var(--teal-d2)}
.luca .bkc-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .bkc-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
.luca .bkc-btn.danger{background:var(--surface);border-color:var(--line);color:var(--danger)}
.luca .bkc-btn.danger:hover:not(:disabled){background:#fde8e8;border-color:var(--danger)}
`;

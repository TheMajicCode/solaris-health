/**
 * ProviderCalendar — availability + schedule manager for providers.
 *   • Weekly availability editor (per-day enable + time range)
 *   • Booking settings (auto-confirm, buffer minutes)
 *   • "Generate bookable slots" for the next N days
 *   • Month calendar view (color-coded: available days, bookings, blocked days)
 *     with click-to-block / unblock any day.
 *
 * Props:
 *   providerId   optional explicit provider profile id
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Save, Clock, Zap, CalendarPlus, ChevronLeft, ChevronRight,
  Ban, CheckCircle2, RotateCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { fmtTime } from '../../lib/calendar-utils.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Build default 7-day model from availability rows.
function buildWeek(rows) {
  const week = DAY_NAMES.map((_, i) => ({ day: i, enabled: false, start: '09:00', end: '17:00' }));
  rows.forEach((r) => {
    const d = Number(r.day_of_week);
    if (week[d]) {
      week[d] = {
        day: d,
        enabled: r.is_available !== false,
        start: String(r.start_time).slice(0, 5),
        end: String(r.end_time).slice(0, 5),
      };
    }
  });
  return week;
}

export default function ProviderCalendar({ providerId }) {
  const [week, setWeek] = useState(buildWeek([]));
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [buffer, setBuffer] = useState(15);
  const [pid, setPid] = useState(providerId || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Calendar view state.
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [cal, setCal] = useState({ bookings: [], blockedDates: [], availableDays: [] });
  const [calLoading, setCalLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getMyAvailability(providerId);
      setWeek(buildWeek(d.availability || []));
      setAutoConfirm(d.autoConfirm === true);
      setBuffer(d.bufferMinutes != null ? d.bufferMinutes : 15);
      setPid(d.providerId);
    } catch {
      toast.error('Could not load availability');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  const loadCalendar = useCallback(async () => {
    setCalLoading(true);
    try {
      const from = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      const to = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
      const d = await api.getProviderCalendar({ from, to, providerId });
      setCal({ bookings: d.bookings || [], blockedDates: d.blockedDates || [], availableDays: d.availableDays || [] });
    } catch { /* non-fatal */ } finally {
      setCalLoading(false);
    }
  }, [cursor, providerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  function setDay(i, patch) {
    setWeek((w) => w.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function save() {
    setSaving(true);
    try {
      const availability = week.filter((d) => d.enabled).map((d) => ({
        day_of_week: d.day, start_time: d.start, end_time: d.end, is_available: true,
      }));
      await api.updateMyAvailability({ availability, autoConfirm, bufferMinutes: buffer, providerId });
      toast.success('Availability saved');
      await loadCalendar();
    } catch (e) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const d = await api.generateTimeSlots({ days: 30, providerId });
      toast.success(`Generated ${d.created} bookable slots for the next 30 days`);
      await loadCalendar();
    } catch (e) {
      toast.error(e?.message || 'Could not generate slots');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleBlock(dateStr, currentlyBlocked) {
    try {
      await api.blockDate(dateStr, !currentlyBlocked, providerId);
      toast.success(currentlyBlocked ? 'Day unblocked' : 'Day blocked');
      await loadCalendar();
    } catch (e) {
      toast.error(e?.message || 'Could not update day');
    }
  }

  if (loading) {
    return <div className="pcal-loading"><Loader2 className="pcal-spin" size={26} /> Loading…</div>;
  }

  // Build calendar grid.
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(new Date());
  const bookingsByDate = {};
  cal.bookings.forEach((b) => {
    const k = String(b.booking_date).slice(0, 10);
    (bookingsByDate[k] = bookingsByDate[k] || []).push(b);
  });
  const blockedSet = new Set(cal.blockedDates);
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <div className="pcal">
      {/* Weekly availability */}
      <section className="pcal-card">
        <div className="pcal-head"><Clock size={17} /><h3>Weekly availability</h3></div>
        <p className="pcal-hint">Set the hours you accept appointments each day. Times are in your local timezone.</p>
        <div className="pcal-week">
          {week.map((d, i) => (
            <div key={i} className={`pcal-day ${d.enabled ? 'on' : ''}`}>
              <label className="pcal-day-toggle">
                <input type="checkbox" checked={d.enabled} onChange={(e) => setDay(i, { enabled: e.target.checked })} />
                <span className="pcal-day-name">{DAY_NAMES[i]}</span>
              </label>
              {d.enabled ? (
                <div className="pcal-times">
                  <input type="time" value={d.start} onChange={(e) => setDay(i, { start: e.target.value })} />
                  <span>to</span>
                  <input type="time" value={d.end} onChange={(e) => setDay(i, { end: e.target.value })} />
                </div>
              ) : <span className="pcal-off">Unavailable</span>}
            </div>
          ))}
        </div>

        <div className="pcal-settings">
          <label className="pcal-set">
            <input type="checkbox" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} />
            <span><b>Auto-confirm bookings</b><em>Approve requests automatically without manual review.</em></span>
          </label>
          <label className="pcal-set inline">
            <span><b>Buffer between appointments</b></span>
            <select value={buffer} onChange={(e) => setBuffer(parseInt(e.target.value, 10))}>
              {[0, 5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
        </div>

        <div className="pcal-actions">
          <button className="pcal-btn ghost" disabled={generating} onClick={generate}>
            {generating ? <Loader2 className="pcal-spin" size={15} /> : <CalendarPlus size={15} />} Generate slots (30 days)
          </button>
          <button className="pcal-btn primary" disabled={saving} onClick={save}>
            {saving ? <><Loader2 className="pcal-spin" size={15} /> Saving…</> : <><Save size={15} /> Save availability</>}
          </button>
        </div>
      </section>

      {/* Month calendar */}
      <section className="pcal-card">
        <div className="pcal-cal-head">
          <button className="pcal-nav" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={18} /></button>
          <h3>{MONTHS[month]} {year}</h3>
          <button className="pcal-nav" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={18} /></button>
          <button className="pcal-refresh" disabled={calLoading} onClick={loadCalendar} title="Refresh">
            <RotateCw className={calLoading ? 'pcal-spin' : ''} size={15} />
          </button>
        </div>
        <div className="pcal-legend">
          <span><i className="lg-avail" /> Available day</span>
          <span><i className="lg-book" /> Has bookings</span>
          <span><i className="lg-block" /> Blocked</span>
        </div>
        <div className="pcal-grid">
          {DAY_SHORT.map((d) => <div key={d} className="pcal-dow">{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} className="pcal-cell empty" />;
            const ds = ymd(date);
            const dayBookings = bookingsByDate[ds] || [];
            const blocked = blockedSet.has(ds);
            const isAvail = cal.availableDays.includes(date.getDay());
            const isPast = ds < todayStr;
            const isToday = ds === todayStr;
            return (
              <div key={ds}
                   className={`pcal-cell ${isAvail ? 'avail' : ''} ${blocked ? 'blocked' : ''} ${isPast ? 'past' : ''} ${isToday ? 'today' : ''}`}
                   onClick={() => !isPast && toggleBlock(ds, blocked)}
                   title={isPast ? '' : blocked ? 'Click to unblock' : 'Click to block this day'}>
                <span className="pcal-cell-n">{date.getDate()}</span>
                {dayBookings.length > 0 && (
                  <span className="pcal-cell-b">{dayBookings.length} appt{dayBookings.length > 1 ? 's' : ''}</span>
                )}
                {blocked && <Ban size={12} className="pcal-cell-block" />}
              </div>
            );
          })}
        </div>
        <p className="pcal-hint">Tap any future day to block or unblock it for new bookings.</p>
      </section>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .pcal{max-width:780px;display:flex;flex-direction:column;gap:18px}
.luca .pcal-loading{display:flex;align-items:center;gap:10px;justify-content:center;padding:60px;color:var(--muted)}
.luca .pcal-spin{animation:spin 1s linear infinite}
.luca .pcal-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px}
.luca .pcal-head{display:flex;align-items:center;gap:9px;margin-bottom:4px}
.luca .pcal-head svg{color:var(--teal-d)}
.luca .pcal-head h3{font-family:'Space Grotesk',sans-serif;font-size:16px;color:var(--ink);margin:0}
.luca .pcal-hint{font-size:12.5px;color:var(--muted);margin:0 0 14px;line-height:1.5}
.luca .pcal-week{display:flex;flex-direction:column;gap:8px}
.luca .pcal-day{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--line);
  border-radius:11px;background:var(--canvas)}
.luca .pcal-day.on{border-color:var(--mint-line);background:var(--mint-soft)}
.luca .pcal-day-toggle{display:flex;align-items:center;gap:9px;cursor:pointer;font-weight:700;font-size:13.5px;color:var(--ink)}
.luca .pcal-day-toggle input{width:17px;height:17px;accent-color:var(--teal-d);cursor:pointer}
.luca .pcal-day-name{min-width:80px}
.luca .pcal-times{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)}
.luca .pcal-times input{border:1px solid var(--line);border-radius:8px;padding:6px 9px;font-family:inherit;font-size:13px;color:var(--ink);background:var(--surface)}
.luca .pcal-off{font-size:12.5px;color:var(--muted-2);font-style:italic}
.luca .pcal-settings{display:flex;flex-direction:column;gap:12px;margin:16px 0;padding:14px;background:var(--canvas);border:1px solid var(--line);border-radius:12px}
.luca .pcal-set{display:flex;align-items:flex-start;gap:10px;cursor:pointer}
.luca .pcal-set input[type=checkbox]{width:17px;height:17px;accent-color:var(--teal-d);cursor:pointer;margin-top:1px}
.luca .pcal-set span{display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:var(--ink)}
.luca .pcal-set b{font-weight:700}
.luca .pcal-set em{font-style:normal;font-size:12px;color:var(--muted)}
.luca .pcal-set.inline{flex-direction:row;align-items:center;justify-content:space-between}
.luca .pcal-set select{border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-family:inherit;font-size:13px;color:var(--ink);background:var(--surface);cursor:pointer}
.luca .pcal-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.luca .pcal-btn{display:inline-flex;align-items:center;gap:7px;border-radius:11px;padding:10px 16px;font-weight:700;font-size:13.5px;
  cursor:pointer;font-family:inherit;border:1px solid transparent;transition:all .12s}
.luca .pcal-btn:disabled{opacity:.55;cursor:not-allowed}
.luca .pcal-btn.primary{background:var(--teal-d);color:#fff}
.luca .pcal-btn.primary:hover:not(:disabled){background:var(--teal-d2)}
.luca .pcal-btn.ghost{background:var(--surface);border-color:var(--line);color:var(--ink)}
.luca .pcal-btn.ghost:hover:not(:disabled){background:var(--surface-2)}
.luca .pcal-cal-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.luca .pcal-cal-head h3{font-family:'Space Grotesk',sans-serif;font-size:16px;color:var(--ink);margin:0;flex:1;text-align:center}
.luca .pcal-nav{border:1px solid var(--line);background:var(--surface);border-radius:9px;width:32px;height:32px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .pcal-nav:hover{background:var(--surface-2)}
.luca .pcal-refresh{border:none;background:none;color:var(--muted);cursor:pointer;padding:6px}
.luca .pcal-legend{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:11.5px;color:var(--muted)}
.luca .pcal-legend span{display:flex;align-items:center;gap:5px}
.luca .pcal-legend i{width:11px;height:11px;border-radius:3px;display:inline-block}
.luca .pcal-legend .lg-avail{background:var(--mint-soft);border:1px solid var(--mint-line)}
.luca .pcal-legend .lg-book{background:var(--teal-d)}
.luca .pcal-legend .lg-block{background:#fde8e8;border:1px solid var(--danger)}
.luca .pcal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.luca .pcal-dow{text-align:center;font-size:11px;font-weight:700;color:var(--muted-2);padding:4px 0}
.luca .pcal-cell{position:relative;min-height:56px;border:1px solid var(--line);border-radius:9px;padding:5px;background:var(--canvas);cursor:pointer;transition:all .1s}
.luca .pcal-cell.empty{border:none;background:none;cursor:default}
.luca .pcal-cell.avail{background:var(--mint-soft);border-color:var(--mint-line)}
.luca .pcal-cell.blocked{background:#fde8e8;border-color:var(--danger)}
.luca .pcal-cell.past{opacity:.4;cursor:default}
.luca .pcal-cell.today{outline:2px solid var(--teal-d);outline-offset:-1px}
.luca .pcal-cell:hover:not(.past):not(.empty){box-shadow:var(--shadow-sm)}
.luca .pcal-cell-n{font-size:12.5px;font-weight:700;color:var(--ink)}
.luca .pcal-cell-b{display:block;margin-top:3px;font-size:9.5px;font-weight:800;color:#fff;background:var(--teal-d);border-radius:5px;padding:1px 4px;text-align:center}
.luca .pcal-cell-block{position:absolute;bottom:5px;right:5px;color:var(--danger)}
`;

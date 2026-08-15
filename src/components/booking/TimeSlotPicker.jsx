/**
 * TimeSlotPicker — date + time selection for the booking flow.
 *
 * Props:
 *   dates       [{date:"YYYY-MM-DD", slots:[{start,end}]}]  (available only)
 *   loading     bool
 *   value       { date, start, end } | null
 *   onChange    (slot:{date,start,end}) => void
 *   tz          timezone label string
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { fmtTime, fmtDateLong } from '../../lib/calendar-utils.js';

const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
const NARROW_SLOT_LIMIT = 6; // ≤6 initial demo slots on phones (rest behind "+N more")

export default function TimeSlotPicker({ dates = [], loading, value, onChange, tz }) {
  const available = useMemo(() => {
    const map = {};
    for (const d of dates) map[d.date] = d.slots || [];
    return map;
  }, [dates]);

  const firstDate = dates[0]?.date;
  const [cursor, setCursor] = useState(() => (firstDate ? new Date(`${firstDate}T00:00:00`) : new Date()));
  const [selDate, setSelDate] = useState(value?.date || firstDate || null);
  // Compact phone layout: a 7-day date strip instead of a full month grid.
  const [narrow, setNarrow] = useState(() => (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(max-width:480px)').matches : false));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstDate ? new Date(`${firstDate}T00:00:00`) : new Date()));
  const [showFullCal, setShowFullCal] = useState(false);     // "More dates" → month grid on phone
  const [slotsExpanded, setSlotsExpanded] = useState(false); // "+N more times"

  // Track the phone breakpoint (a media-query listener, resize-safe).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width:480px)');
    const on = () => setNarrow(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on); };
  }, []);

  useEffect(() => {
    if (!selDate && firstDate) {
      setSelDate(firstDate);
      setCursor(new Date(`${firstDate}T00:00:00`));
      setWeekStart(startOfWeek(new Date(`${firstDate}T00:00:00`)));
    }
  }, [firstDate, selDate]);

  // Collapse the "+N more" expansion whenever the day changes.
  useEffect(() => { setSlotsExpanded(false); }, [selDate]);

  // Build the month grid for the cursor month.
  const grid = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(y, m, d));
    return cells;
  }, [cursor]);

  // The 7-day window for the phone date strip.
  const weekDays = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); out.push(d); }
    return out;
  }, [weekStart]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const slots = selDate ? (available[selDate] || []) : [];
  const visibleSlots = (narrow && !slotsExpanded) ? slots.slice(0, NARROW_SLOT_LIMIT) : slots;
  const hiddenCount = slots.length - visibleSlots.length;

  // Selecting a date always keeps the strip anchored to that week and, on phone,
  // collapses the full calendar back to the compact strip.
  const pickDate = (ds) => {
    setSelDate(ds);
    setWeekStart(startOfWeek(new Date(`${ds}T00:00:00`)));
    if (narrow) setShowFullCal(false);
  };

  if (loading) {
    return <div className="tsp-loading"><Loader2 className="tsp-spin" size={22} /> Loading available times…<style>{CSS}</style></div>;
  }
  if (!dates.length) {
    return (
      <div className="tsp-empty">
        <Calendar size={26} />
        <p>No available times in the next few weeks.</p>
        <span>This provider hasn't opened any bookable slots yet. Try another provider or check back soon.</span>
        <style>{CSS}</style>
      </div>
    );
  }

  const monthCal = (
    <div className="tsp-cal">
      <div className="tsp-cal-head">
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
        <span>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
      </div>
      <div className="tsp-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="tsp-grid">
        {grid.map((d, i) => {
          if (!d) return <span key={`e${i}`} className="tsp-cell empty" />;
          const ds = ymd(d);
          const has = (available[ds] || []).length > 0;
          const isSel = ds === selDate;
          const isPast = d < today;
          return (
            <button
              key={ds}
              type="button"
              className={`tsp-cell ${has ? 'has' : ''} ${isSel ? 'sel' : ''} ${isPast ? 'past' : ''}`}
              disabled={!has}
              onClick={() => pickDate(ds)}
            >
              {d.getDate()}
              {has && <i className="tsp-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Compact 7-day date strip (phone). All 7 day cells share the card width
  // (repeat(7,1fr) + min-width:0) so none is clipped, even at 360px.
  const dateStrip = (
    <div className="tsp-strip-wrap">
      <div className="tsp-strip-head">
        <button type="button" className="tsp-strip-nav" onClick={() => setWeekStart((p) => { const x = new Date(p); x.setDate(p.getDate() - 7); return x; })} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <span className="tsp-strip-title">
          {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
        <button type="button" className="tsp-strip-nav" onClick={() => setWeekStart((p) => { const x = new Date(p); x.setDate(p.getDate() + 7); return x; })} aria-label="Next week"><ChevronRight size={16} /></button>
      </div>
      <div className="tsp-strip" role="group" aria-label="Choose a day">
        {weekDays.map((d) => {
          const ds = ymd(d);
          const has = (available[ds] || []).length > 0;
          const isSel = ds === selDate;
          const isPast = d < today;
          return (
            <button
              key={ds}
              type="button"
              className={`tsp-day ${has ? 'has' : ''} ${isSel ? 'sel' : ''} ${isPast ? 'past' : ''}`}
              disabled={!has}
              aria-pressed={isSel}
              onClick={() => pickDate(ds)}
            >
              <span className="tsp-day-wd">{WD[d.getDay()]}</span>
              <span className="tsp-day-n">{d.getDate()}</span>
              <span className={`tsp-day-av ${has ? 'on' : ''}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <button type="button" className="tsp-more" onClick={() => setShowFullCal(true)}><Calendar size={14} /> More dates</button>
    </div>
  );

  const slotsPane = (
    <div className="tsp-slots">
      <div className="tsp-slots-head">
        <Clock size={15} />
        <span>{selDate ? fmtDateLong(selDate) : 'Pick a date'}</span>
        {tz && <em className="tsp-tz">{tz}</em>}
      </div>
      {slots.length === 0 ? (
        <p className="tsp-noslots">No times available on this day. Pick another highlighted date.</p>
      ) : (
        <>
          <div className={`tsp-slot-grid ${narrow ? 'narrow' : ''}`}>
            {visibleSlots.map((s) => {
              const active = value?.date === selDate && value?.start === s.start;
              return (
                <button
                  key={s.start}
                  type="button"
                  className={`tsp-slot ${active ? 'on' : ''}`}
                  onClick={() => onChange?.({ date: selDate, start: s.start, end: s.end })}
                >
                  {fmtTime(s.start)}
                </button>
              );
            })}
          </div>
          {narrow && hiddenCount > 0 && (
            <button type="button" className="tsp-slot-more" onClick={() => setSlotsExpanded(true)}>+{hiddenCount} more times</button>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`tsp ${narrow ? 'tsp-narrow' : ''}`}>
      {narrow
        ? (showFullCal
          ? (
            <div className="tsp-cal-wrap">
              <button type="button" className="tsp-cal-back" onClick={() => setShowFullCal(false)}><ChevronLeft size={14} /> Back to week</button>
              {monthCal}
            </div>
          )
          : dateStrip)
        : monthCal}
      {slotsPane}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .tsp{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:640px){.luca .tsp{grid-template-columns:1fr}}
.luca .tsp-loading,.luca .tsp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  padding:40px 20px;color:var(--muted);text-align:center}
.luca .tsp-empty svg{color:var(--teal-d);opacity:.6}
.luca .tsp-empty p{font-weight:700;color:var(--ink);margin:0}
.luca .tsp-empty span{font-size:13px;max-width:320px}
.luca .tsp-spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.luca .tsp-cal{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px}
.luca .tsp-cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;font-weight:700;color:var(--ink);font-family:'Space Grotesk',sans-serif}
.luca .tsp-cal-head button{border:1px solid var(--line);background:var(--surface-2);border-radius:8px;width:28px;height:28px;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .tsp-cal-head button:hover{background:var(--mint-soft)}
.luca .tsp-wd{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px}
.luca .tsp-wd span{text-align:center;font-size:11px;font-weight:700;color:var(--muted-2)}
.luca .tsp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.luca .tsp-cell{position:relative;aspect-ratio:1;border:none;background:transparent;border-radius:9px;font-size:13px;
  color:var(--muted-2);cursor:default;font-family:inherit;display:flex;align-items:center;justify-content:center}
.luca .tsp-cell.empty{visibility:hidden}
.luca .tsp-cell.has{background:var(--mint-soft);color:var(--teal-d);font-weight:700;cursor:pointer}
.luca .tsp-cell.has:hover{background:var(--mint-line)}
.luca .tsp-cell.sel{background:var(--teal-d);color:#fff}
.luca .tsp-cell.past{opacity:.35}
.luca .tsp-dot{position:absolute;bottom:5px;width:4px;height:4px;border-radius:50%;background:currentColor}
.luca .tsp-cell.sel .tsp-dot{background:#fff}
.luca .tsp-slots-head{display:flex;align-items:center;gap:7px;font-weight:700;color:var(--ink);margin-bottom:12px;font-size:14px}
.luca .tsp-tz{margin-left:auto;font-style:normal;font-size:11px;font-weight:700;color:var(--muted);background:var(--surface-2);padding:2px 8px;border-radius:6px}
.luca .tsp-noslots{color:var(--muted);font-size:13px}
.luca .tsp-slot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px;max-height:280px;overflow:auto}
.luca .tsp-slot{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:10px 6px;font-size:13px;font-weight:700;
  color:var(--ink);cursor:pointer;font-family:'IBM Plex Mono',monospace;transition:all .12s}
.luca .tsp-slot:hover{border-color:var(--teal-d);background:var(--mint-soft)}
.luca .tsp-slot.on{background:var(--teal-d);color:#fff;border-color:var(--teal-d)}
/* ── Phone (<480px): compact 7-day date strip + 2-col times ──
   The strip replaces the month grid so the day picker + first time choices +
   the sticky Continue all fit one phone viewport without page scroll. */
.luca .tsp-narrow{display:block}
.luca .tsp-strip-wrap{margin-bottom:14px}
.luca .tsp-strip-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.luca .tsp-strip-title{font-size:13px;font-weight:700;color:var(--ink);font-family:'Space Grotesk',sans-serif;text-align:center;min-width:0}
.luca .tsp-strip-nav{flex:none;border:1px solid var(--line);background:var(--surface-2);border-radius:9px;width:36px;height:36px;
  display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.luca .tsp-strip-nav:hover{background:var(--mint-soft)}
.luca .tsp-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.luca .tsp-day{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;border:1px solid var(--line);
  background:var(--surface);border-radius:11px;padding:7px 0 6px;cursor:default;font-family:inherit;color:var(--muted-2)}
.luca .tsp-day-wd{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.02em}
.luca .tsp-day-n{font-size:15px;font-weight:800;color:var(--ink);line-height:1.1}
.luca .tsp-day-av{width:5px;height:5px;border-radius:50%;background:transparent}
.luca .tsp-day.has{cursor:pointer;border-color:var(--mint-line);background:var(--mint-soft)}
.luca .tsp-day.has .tsp-day-av.on{background:var(--teal-d)}
.luca .tsp-day.has:hover{border-color:var(--teal-d)}
.luca .tsp-day.sel{background:var(--teal-d);border-color:var(--teal-d)}
.luca .tsp-day.sel .tsp-day-wd,.luca .tsp-day.sel .tsp-day-n{color:#fff}
.luca .tsp-day.sel .tsp-day-av.on{background:#fff}
.luca .tsp-day.past{opacity:.4}
.luca .tsp-day:disabled{opacity:.4;cursor:default}
.luca .tsp-more{margin-top:9px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px;
  border:1px dashed var(--line);background:var(--surface);color:var(--teal-d);border-radius:10px;padding:9px;
  font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;min-height:44px}
.luca .tsp-more:hover{background:var(--mint-soft);border-color:var(--teal-d)}
.luca .tsp-cal-back{display:inline-flex;align-items:center;gap:5px;margin-bottom:10px;border:none;background:none;
  color:var(--teal-d);font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;padding:4px 2px}
.luca .tsp-slot-grid.narrow{grid-template-columns:1fr 1fr;max-height:none;overflow:visible}
.luca .tsp-slot-more{margin-top:8px;width:100%;border:1px solid var(--line);background:var(--surface);color:var(--teal-d);
  border-radius:10px;padding:9px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;min-height:44px}
.luca .tsp-slot-more:hover{background:var(--mint-soft);border-color:var(--teal-d)}
`;

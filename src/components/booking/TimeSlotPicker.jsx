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

export default function TimeSlotPicker({ dates = [], loading, value, onChange, tz }) {
  const available = useMemo(() => {
    const map = {};
    for (const d of dates) map[d.date] = d.slots || [];
    return map;
  }, [dates]);

  const firstDate = dates[0]?.date;
  const [cursor, setCursor] = useState(() => (firstDate ? new Date(`${firstDate}T00:00:00`) : new Date()));
  const [selDate, setSelDate] = useState(value?.date || firstDate || null);

  useEffect(() => {
    if (!selDate && firstDate) {
      setSelDate(firstDate);
      setCursor(new Date(`${firstDate}T00:00:00`));
    }
  }, [firstDate, selDate]);

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

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const slots = selDate ? (available[selDate] || []) : [];

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

  return (
    <div className="tsp">
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
                onClick={() => setSelDate(ds)}
              >
                {d.getDate()}
                {has && <i className="tsp-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tsp-slots">
        <div className="tsp-slots-head">
          <Clock size={15} />
          <span>{selDate ? fmtDateLong(selDate) : 'Pick a date'}</span>
          {tz && <em className="tsp-tz">{tz}</em>}
        </div>
        {slots.length === 0 ? (
          <p className="tsp-noslots">No times available on this day. Pick another highlighted date.</p>
        ) : (
          <div className="tsp-slot-grid">
            {slots.map((s) => {
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
        )}
      </div>
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
`;

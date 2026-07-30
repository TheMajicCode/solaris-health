/**
 * AvailabilityManager.jsx — practitioner self-service weekly availability editor.
 *
 * Renders a weekly grid (Mon–Sun × 08:00–18:00 one-hour blocks). The practitioner
 * toggles blocks on/off; hours that already have an upcoming booking are locked
 * (shown indigo with a lock) so a booked visit can never be removed. On save the
 * contiguous "on" hours for each weekday are coalesced into {start_time,end_time}
 * ranges and persisted via PUT /api/provider/availability/me (authz: the caller
 * may only edit a profile they own — enforced server-side).
 *
 * Availability in Solaris is a WEEKLY RECURRING TEMPLATE; the booking engine
 * projects it into concrete slots on the fly, so editing the template instantly
 * changes what members can book.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Lock, CalendarCheck, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

const DAYS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];
const START_HOUR = 8;
const END_HOUR = 18; // exclusive upper edge — last block is 17:00–18:00
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const hhmm = (h) => `${String(h).padStart(2, '0')}:00`;
const hourFromTime = (t) => parseInt(String(t).slice(0, 2), 10);

// Build a { dow: Set(hour) } map of available hours from availability rows.
function rowsToGrid(rows) {
  const grid = {};
  DAYS.forEach((d) => { grid[d.dow] = new Set(); });
  for (const r of rows || []) {
    if (r.is_available === false) continue;
    const dow = Number(r.day_of_week);
    if (!(dow in grid)) continue;
    const s = hourFromTime(r.start_time);
    const e = hourFromTime(r.end_time);
    for (let h = s; h < e; h += 1) if (h >= START_HOUR && h < END_HOUR) grid[dow].add(h);
  }
  return grid;
}

// Coalesce a { dow: Set(hour) } map into availability rows (contiguous ranges).
function gridToRows(grid) {
  const rows = [];
  for (const d of DAYS) {
    const hours = [...grid[d.dow]].sort((a, b) => a - b);
    let i = 0;
    while (i < hours.length) {
      const start = hours[i];
      let end = start + 1;
      while (i + 1 < hours.length && hours[i + 1] === end) { end += 1; i += 1; }
      rows.push({ day_of_week: d.dow, start_time: hhmm(start), end_time: hhmm(end), is_available: true });
      i += 1;
    }
  }
  return rows;
}

const COLORS = {
  head: '#0A2B29', body: '#6b807a', green: '#2DB584', line: '#E3EDEA',
  greenSoft: '#E6F6F0', indigo: '#6B7FD7',
};

export default function AvailabilityManager() {
  const [grid, setGrid] = useState(null);
  const [booked, setBooked] = useState({}); // { dow: Set(hour) } — locked
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [avail, bk] = await Promise.all([
        api.getMyAvailability(),
        api.getProviderBookings('upcoming').catch(() => ({ bookings: [] })),
      ]);
      setGrid(rowsToGrid(avail?.availability || []));
      const bmap = {};
      DAYS.forEach((d) => { bmap[d.dow] = new Set(); });
      for (const b of bk?.bookings || []) {
        if (!b.booking_date || !b.start_time) continue;
        const dow = new Date(`${b.booking_date}T00:00:00`).getDay();
        const sh = hourFromTime(b.start_time);
        const eh = b.end_time ? hourFromTime(b.end_time) : sh + 1;
        if (bmap[dow]) for (let h = sh; h < Math.max(eh, sh + 1); h += 1) bmap[dow].add(h);
      }
      setBooked(bmap);
      setDirty(false);
    } catch (e) {
      setErr('Could not load your availability. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (dow, hour) => {
    if (booked[dow]?.has(hour)) return; // locked — has a booking
    setGrid((prev) => {
      const next = { ...prev, [dow]: new Set(prev[dow]) };
      if (next[dow].has(hour)) next[dow].delete(hour); else next[dow].add(hour);
      return next;
    });
    setDirty(true);
  };

  const setDay = (dow, on) => {
    setGrid((prev) => {
      const next = { ...prev, [dow]: new Set(prev[dow]) };
      HOURS.forEach((h) => {
        if (booked[dow]?.has(h)) { next[dow].add(h); return; } // keep booked hours on
        if (on) next[dow].add(h); else next[dow].delete(h);
      });
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const rows = gridToRows(grid);
      await api.updateMyAvailability({ availability: rows });
      toast.success('Availability updated');
      setDirty(false);
    } catch (e) {
      setErr('Could not save. Please try again.');
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.body, padding: 40 }}>
        <style>{'@keyframes avmspin{to{transform:rotate(360deg)}} .avmspin{animation:avmspin 1s linear infinite}'}</style>
        <Loader2 size={18} className="avmspin" /> Loading your weekly availability…
      </div>
    );
  }

  const totalHours = grid ? DAYS.reduce((s, d) => s + grid[d.dow].size, 0) : 0;

  return (
    <div style={{ maxWidth: 760 }}>
      <style>{'@keyframes avmspin{to{transform:rotate(360deg)}} .avmspin{animation:avmspin 1s linear infinite}'}</style>
      <div style={{
        background: '#fff', border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.head, fontWeight: 700, fontSize: 16 }}>
              <CalendarCheck size={18} color={COLORS.green} /> Weekly availability
            </div>
            <div style={{ color: COLORS.body, fontSize: 13, marginTop: 3 }}>
              Tap blocks to open or close them. Members can book any open block. Booked hours are locked.
            </div>
          </div>
          <button
            onClick={save}
            disabled={saving || !dirty}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10,
              border: 'none', cursor: saving || !dirty ? 'default' : 'pointer',
              background: dirty ? COLORS.green : '#CBD8D3', color: '#fff', fontWeight: 600, fontSize: 13.5,
              opacity: saving ? 0.7 : 1, fontFamily: 'inherit',
            }}
          >
            {saving ? <Loader2 size={15} className="avmspin" /> : <Save size={15} />}
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>

        {err && (
          <div style={{ background: '#FDECEC', color: '#B23B3B', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{err}</div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, color: COLORS.body, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: COLORS.greenSoft, border: `1.5px solid ${COLORS.green}` }} /> Open</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: '#fff', border: `1.5px solid ${COLORS.line}` }} /> Closed</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Lock size={12} color={COLORS.indigo} /> Booked (locked)</span>
        </div>

        {/* Grid */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 52 }} />
                {HOURS.map((h) => (
                  <th key={h} style={{ fontSize: 10.5, color: COLORS.body, fontWeight: 600, padding: '2px 0' }}>{hhmm(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => {
                const allOn = HOURS.every((h) => grid[d.dow].has(h));
                return (
                  <tr key={d.dow}>
                    <td style={{ padding: '0 4px' }}>
                      <button
                        onClick={() => setDay(d.dow, !allOn)}
                        title={allOn ? 'Close whole day' : 'Open whole day'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.head, fontWeight: 700, fontSize: 12.5, fontFamily: 'inherit', width: '100%', textAlign: 'left' }}
                      >
                        {d.label}
                      </button>
                    </td>
                    {HOURS.map((h) => {
                      const isBooked = booked[d.dow]?.has(h);
                      const on = grid[d.dow].has(h);
                      return (
                        <td key={h} style={{ padding: 0 }}>
                          <button
                            onClick={() => toggle(d.dow, h)}
                            disabled={isBooked}
                            title={isBooked ? 'Booked — locked' : on ? 'Open — click to close' : 'Closed — click to open'}
                            style={{
                              width: '100%', height: 30, minWidth: 30, borderRadius: 6, cursor: isBooked ? 'not-allowed' : 'pointer',
                              border: `1.5px solid ${isBooked ? COLORS.indigo : on ? COLORS.green : COLORS.line}`,
                              background: isBooked ? '#EEF1FB' : on ? COLORS.greenSoft : '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                            }}
                          >
                            {isBooked ? <Lock size={12} color={COLORS.indigo} /> : on ? <Check size={13} color={COLORS.green} /> : null}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, fontSize: 12.5, color: COLORS.body }}>
          {totalHours} open hour block{totalHours === 1 ? '' : 's'} across the week.
        </div>
      </div>
    </div>
  );
}

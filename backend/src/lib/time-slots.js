/**
 * time-slots.js — pure helpers for the booking system.
 *
 * All times are handled as "HH:MM" (24h) strings and minutes-since-midnight
 * integers. Dates are "YYYY-MM-DD" strings. We deliberately avoid timezone
 * math on the server: a provider's availability is expressed in their own
 * local clock, slots are generated in that same wall-clock, and the frontend
 * shows the provider's timezone label. This keeps slot generation
 * deterministic and free of DST surprises.
 */

/** "HH:MM[:SS]" -> minutes since midnight. */
function timeToMinutes(t) {
  if (t == null) return 0;
  const [h, m] = String(t).split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:MM" (24h, zero padded). */
function minutesToTime(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Generate non-overlapping slots inside one [startTime, endTime] window.
 *
 * @param {string} startTime  "HH:MM"
 * @param {string} endTime    "HH:MM"
 * @param {number} duration   service length in minutes
 * @param {number} buffer     gap between appointments in minutes
 * @returns {{start:string,end:string}[]}
 */
function generateSlots(startTime, endTime, duration, buffer = 0) {
  const dur = Math.max(5, parseInt(duration, 10) || 30);
  const buf = Math.max(0, parseInt(buffer, 10) || 0);
  const startM = timeToMinutes(startTime);
  const endM = timeToMinutes(endTime);
  const slots = [];
  let cur = startM;
  // Guard against pathological inputs producing an infinite loop.
  let guard = 0;
  while (cur + dur <= endM && guard < 1000) {
    slots.push({ start: minutesToTime(cur), end: minutesToTime(cur + dur) });
    cur += dur + buf;
    guard += 1;
  }
  return slots;
}

/** JS Date -> "YYYY-MM-DD" (uses local date parts of the Date object). */
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "YYYY-MM-DD" -> day_of_week with 0=Sunday (matches schema + JS getDay). */
function dayOfWeek(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay();
}

/**
 * Build the list of (date, slot) pairs to create for a date range, based on a
 * provider's weekly availability windows and a service duration.
 *
 * @param {Object}  opts
 * @param {string}  opts.startDate  inclusive "YYYY-MM-DD"
 * @param {number}  opts.days       number of days to project forward
 * @param {Array}   opts.availability rows: {day_of_week,start_time,end_time,is_available}
 * @param {number}  opts.duration   minutes
 * @param {number}  opts.buffer     minutes
 * @returns {{date:string,start:string,end:string}[]}
 */
function projectSlots({ startDate, days = 30, availability = [], duration = 30, buffer = 15 }) {
  const out = [];
  const byDay = {};
  for (const a of availability) {
    if (a.is_available === false) continue;
    const k = Number(a.day_of_week);
    (byDay[k] = byDay[k] || []).push(a);
  }
  const base = new Date(`${startDate}T00:00:00`);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const dow = d.getDay();
    const windows = byDay[dow];
    if (!windows || !windows.length) continue;
    const dateStr = ymd(d);
    for (const w of windows) {
      for (const s of generateSlots(w.start_time, w.end_time, duration, buffer)) {
        out.push({ date: dateStr, start: s.start, end: s.end });
      }
    }
  }
  return out;
}

/** Compute platform fee (10%) and provider payout (90%) for a price. */
function priceSplit(total) {
  const t = Math.round((Number(total) || 0) * 100) / 100;
  const fee = Math.round(t * 10) / 100; // 10%
  const payout = Math.round((t - fee) * 100) / 100;
  return { total: t, platformFee: fee, providerPayout: payout };
}

/**
 * Is a given date+time at least `minHours` in the future and at most
 * `maxDays` ahead? Used to enforce booking windows.
 */
function withinBookingWindow(dateStr, startTime, { minHours = 2, maxDays = 90 } = {}) {
  const when = new Date(`${dateStr}T${(startTime || '00:00').slice(0, 5)}:00`);
  const now = new Date();
  const diffMs = when.getTime() - now.getTime();
  if (Number.isNaN(diffMs)) return false;
  const minMs = minHours * 3600 * 1000;
  const maxMs = maxDays * 24 * 3600 * 1000;
  return diffMs >= minMs && diffMs <= maxMs;
}

/** Hours from now until a date+time (negative if in the past). */
function hoursUntil(dateStr, startTime) {
  const when = new Date(`${dateStr}T${(startTime || '00:00').slice(0, 5)}:00`);
  return (when.getTime() - Date.now()) / (3600 * 1000);
}

module.exports = {
  timeToMinutes,
  minutesToTime,
  generateSlots,
  projectSlots,
  priceSplit,
  withinBookingWindow,
  hoursUntil,
  ymd,
  dayOfWeek,
};

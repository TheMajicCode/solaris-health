/**
 * calendar-utils.js — client-side iCalendar (.ics) generation + helpers.
 *
 * Self-contained (no external deps) so the booking flow can offer an
 * "Add to Calendar" download that works with Google / Apple / Outlook.
 */

function pad(n) { return String(n).padStart(2, '0'); }

/** Build a UTC timestamp string "YYYYMMDDTHHMMSSZ" from a Date. */
function toICSDate(date) {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Combine "YYYY-MM-DD" + "HH:MM[:SS]" into a local Date object. */
export function combineDateTime(dateStr, timeStr) {
  const d = String(dateStr).slice(0, 10);
  const t = (timeStr || '00:00').slice(0, 8);
  return new Date(`${d}T${t.length === 5 ? t + ':00' : t}`);
}

function escapeICS(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate an iCalendar string for a single booking/event.
 * @param {Object} opts {title, description, location, start(Date), end(Date), uid, url}
 */
export function buildICS({ title, description, location, start, end, uid, url }) {
  const now = new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Solaris Health//LUCA Passport//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || `${Date.now()}@solaris-health`}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(start)}`,
    `DTEND:${toICSDate(end || new Date(start.getTime() + 30 * 60000))}`,
    `SUMMARY:${escapeICS(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
  if (location) lines.push(`LOCATION:${escapeICS(location)}`);
  if (url) lines.push(`URL:${escapeICS(url)}`);
  lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Build ICS from a booking record (as returned by the API). */
export function bookingToICS(b) {
  const start = combineDateTime(b.booking_date, b.start_time);
  const end = combineDateTime(b.booking_date, b.end_time || b.start_time);
  const title = `${b.service_name || 'Appointment'}${b.business_name ? ' — ' + b.business_name : ''}`;
  const loc = [b.address, b.city].filter(Boolean).join(', ');
  return buildICS({
    title,
    description: `Appointment booked via Solaris Health.${b.patient_notes ? ' Notes: ' + b.patient_notes : ''}`,
    location: loc,
    start,
    end,
    uid: `${b.id}@solaris-health`,
  });
}

/** Trigger a browser download of an .ics file for a booking. */
export function downloadICS(booking, filename) {
  const ics = bookingToICS(booking);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `appointment-${(booking.id || 'event').slice(0, 8)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ----------------------- display + time helpers ----------------------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "HH:MM" -> "9:00 AM". */
export function fmtTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${m} ${ampm}`;
}

/** "YYYY-MM-DD" -> "Mon, Jun 29". */
export function fmtDate(d) {
  const dt = combineDateTime(d, '00:00');
  if (Number.isNaN(dt.getTime())) return String(d);
  return `${DAYS[dt.getDay()]}, ${MONTHS[dt.getMonth()]} ${dt.getDate()}`;
}

/** "YYYY-MM-DD" -> "Monday, June 29, 2026". */
export function fmtDateLong(d) {
  const dt = combineDateTime(d, '00:00');
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/** Friendly countdown: "in 2 days", "in 3 hours", "Today", "Past". */
export function countdown(dateStr, timeStr) {
  const when = combineDateTime(dateStr, timeStr || '00:00');
  const diffMs = when.getTime() - Date.now();
  if (Number.isNaN(diffMs)) return '';
  if (diffMs < 0) return 'Past';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `in ${days} days`;
  const weeks = Math.round(days / 7);
  return `in ${weeks} week${weeks === 1 ? '' : 's'}`;
}

/** Local timezone label, e.g. "EST" or fallback to offset. */
export function tzLabel() {
  try {
    const m = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).match(/[A-Z]{2,5}$/);
    if (m) return m[0];
  } catch { /* ignore */ }
  const off = -new Date().getTimezoneOffset() / 60;
  return `UTC${off >= 0 ? '+' : ''}${off}`;
}

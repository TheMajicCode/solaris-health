/*
 * sharingPrefs.js — Beta Privacy & Sharing preferences (NODE K1.3 §Phase 8).
 *
 * Sharing what a member reveals to a practitioner is OPT-IN, itemized, and
 * revocable — never implied by the act of booking. For the Beta there is no
 * server column for these choices and this node adds NO migration, so the
 * defaults and per-booking overrides are persisted DEVICE-LOCAL, namespaced by
 * the authenticated subject, and surfaced in the UI as "Saved on this device".
 *
 * NOTHING here transmits PHI. These flags only record the member's INTENT about
 * what they are willing to share in-thread; the actual sharing still happens
 * through the existing encrypted message/attachment path, which the member
 * performs explicitly. No health content, message text, or record data is ever
 * written to storage by this module — only booleans and a booking id.
 */

// Itemized, human-readable sharing categories. Every category defaults to OFF
// (opt-in). Labels are resolved through i18n at the call site where a t() is
// available; the English text here is the reviewed fallback.
export const SHARING_CATEGORIES = [
  { id: 'checkins', label: 'Daily check-ins', hint: 'Mood, energy and symptom check-ins you log in Solaris.' },
  { id: 'journalSummaries', label: 'Journal reflections', hint: 'Summaries of the private reflections you choose to surface.' },
  { id: 'assessments', label: 'Assessment results', hint: 'Results of assessments you have completed.' },
  { id: 'passport', label: 'Health Passport basics', hint: 'Non-clinical passport basics you decide to share.' },
  { id: 'contact', label: 'Contact details', hint: 'A phone number or email for appointment coordination.' },
];

export const SHARING_CATEGORY_IDS = SHARING_CATEGORIES.map((c) => c.id);

const NS = 'solaris:sharing';

function safeSubject(subjectId) {
  return subjectId == null ? 'anon' : String(subjectId);
}

function readStore(subjectId) {
  if (typeof localStorage === 'undefined') return { defaults: {}, perBooking: {} };
  try {
    const raw = localStorage.getItem(`${NS}:${safeSubject(subjectId)}`);
    if (!raw) return { defaults: {}, perBooking: {} };
    const parsed = JSON.parse(raw);
    return {
      defaults: (parsed && typeof parsed.defaults === 'object' && parsed.defaults) || {},
      perBooking: (parsed && typeof parsed.perBooking === 'object' && parsed.perBooking) || {},
    };
  } catch { return { defaults: {}, perBooking: {} }; }
}

function writeStore(subjectId, store) {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(`${NS}:${safeSubject(subjectId)}`, JSON.stringify(store)); } catch { /* quota / private mode — ignore */ }
}

// Normalize an arbitrary object to a full {catId: boolean} map, defaulting
// every unknown/missing category to false (opt-in).
export function normalizeSharing(obj) {
  const out = {};
  for (const id of SHARING_CATEGORY_IDS) out[id] = !!(obj && obj[id] === true);
  return out;
}

// Account-wide defaults for this subject.
export function loadSharingDefaults(subjectId) {
  return normalizeSharing(readStore(subjectId).defaults);
}

export function saveSharingDefaults(subjectId, prefs) {
  const store = readStore(subjectId);
  store.defaults = normalizeSharing(prefs);
  writeStore(subjectId, store);
  return store.defaults;
}

// Returns the raw per-booking override object, or null if none has been set
// (meaning the account defaults apply).
export function loadBookingOverride(subjectId, bookingId) {
  if (bookingId == null) return null;
  const store = readStore(subjectId);
  const raw = store.perBooking[String(bookingId)];
  return raw ? normalizeSharing(raw) : null;
}

export function saveBookingOverride(subjectId, bookingId, prefs) {
  if (bookingId == null) return null;
  const store = readStore(subjectId);
  store.perBooking[String(bookingId)] = normalizeSharing(prefs);
  writeStore(subjectId, store);
  return store.perBooking[String(bookingId)];
}

// Remove a per-booking override so the booking falls back to account defaults.
export function clearBookingOverride(subjectId, bookingId) {
  if (bookingId == null) return;
  const store = readStore(subjectId);
  if (String(bookingId) in store.perBooking) {
    delete store.perBooking[String(bookingId)];
    writeStore(subjectId, store);
  }
}

// The effective sharing for a booking: its override if present, otherwise the
// account defaults. Always a full normalized map.
export function effectiveBookingSharing(subjectId, bookingId) {
  const override = loadBookingOverride(subjectId, bookingId);
  return override || loadSharingDefaults(subjectId);
}

// Count of enabled categories — handy for compact summaries ("2 of 5 shared").
export function sharingCount(prefs) {
  const norm = normalizeSharing(prefs);
  return SHARING_CATEGORY_IDS.reduce((n, id) => n + (norm[id] ? 1 : 0), 0);
}

export default {
  SHARING_CATEGORIES,
  SHARING_CATEGORY_IDS,
  normalizeSharing,
  loadSharingDefaults,
  saveSharingDefaults,
  loadBookingOverride,
  saveBookingOverride,
  clearBookingOverride,
  effectiveBookingSharing,
  sharingCount,
};

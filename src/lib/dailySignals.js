// dailySignals.js — Preview Correction §10–§12
//
// A local-first, EXPLICITLY VERSIONED observation store for manually-entered
// daily health signals (sleep, steps, resting HR, hydration, blood pressure,
// SpO2, temperature, weight, respiratory rate, energy/mood/stress …).
//
// WHY local-first: the shared synthetic backend exposes only a SUBJECTIVE
// check-in payload (mind/body/heart/spirit scores + sleep hours / hydration
// glasses / nutrition). It has NO granular observation columns and this pass may
// NOT run a DB migration. So observed signals are stored device-local, scoped by
// user id, and rendered truthfully — never presented as server-synced or as
// wearable data. This limitation is reported in the Node completion notes.
//
// Sovereignty / safety (standing instructions): entries are member-entered
// numbers and units only. NO PHI free-text is required; an optional note is
// stored verbatim on-device only and is NEVER auto-sent to any AI provider.
// Nothing here is transmitted to a server or model by this module.

export const SIGNALS_SCHEMA_VERSION = 1;

export const dailySignalsKey = (uid) => `solaris.dailySignals.${uid}`;

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

// Local calendar day key (YYYY-MM-DD) — matches nextAction.dayKey semantics so
// "today's" signals line up with "today's" check-in.
function dayKeyLocal(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The canonical, versioned observation shape. Every stored signal carries its
// own provenance so imported (future device) observations and manual ones are
// always distinguishable and auditable.
//
// { v, id, metric, value, unit, observedAt, tz, source, provenance, createdBy,
//   note, consentScope }
export function makeObservation(input = {}, uid = null, now = new Date()) {
  const observedAt = input.observedAt || now.toISOString();
  let tz = input.tz;
  if (!tz) {
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { tz = null; }
  }
  return {
    v: SIGNALS_SCHEMA_VERSION,
    id:
      input.id ||
      `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    metric: String(input.metric || '').trim(),
    value: input.value === undefined ? null : input.value,
    unit: input.unit || null,
    observedAt,
    tz: tz || null,
    // 'manual' for member-entered; a device/provider adapter would set e.g.
    // 'device' with provenance.provider = 'oura' (see §12 — none active yet).
    source: input.source || 'manual',
    provenance: input.provenance || { entry: 'manual' },
    createdBy: uid != null ? String(uid) : null,
    note: input.note ? String(input.note) : null,
    consentScope: input.consentScope || 'device-local',
  };
}

// Load a user's stored observations. Defense-in-depth: only return rows whose
// recorded creator matches the current user id (drop any that don't), mirroring
// deviceTodos.js.
export function loadSignals(uid, storage = safeStorage()) {
  if (!uid || !storage) return [];
  try {
    const raw = storage.getItem(dailySignalsKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o) => o && (o.createdBy == null || String(o.createdBy) === String(uid)),
    );
  } catch {
    return [];
  }
}

function writeSignals(uid, list, storage) {
  try {
    storage.setItem(dailySignalsKey(uid), JSON.stringify(list));
  } catch {
    /* storage unavailable — degrade to in-memory only */
  }
  return list;
}

// Save one or several observations (partial entry is allowed — callers pass only
// the fields the member filled in). Returns the full updated list.
export function saveSignals(uid, inputs = [], storage = safeStorage(), now = new Date()) {
  if (!uid || !storage) return [];
  const arr = Array.isArray(inputs) ? inputs : [inputs];
  const observations = arr
    .filter((i) => i && String(i.metric || '').trim() && i.value !== undefined && i.value !== null && i.value !== '')
    .map((i) => makeObservation(i, uid, now));
  if (!observations.length) return loadSignals(uid, storage);
  const next = [...loadSignals(uid, storage), ...observations];
  return writeSignals(uid, next, storage);
}

export function saveSignal(uid, input, storage = safeStorage(), now = new Date()) {
  return saveSignals(uid, [input], storage, now);
}

// The most recent observation per metric (by observedAt). Used to render the
// Daily Signals card from OBSERVED data, kept distinct from subjective scores.
export function latestByMetric(uid, storage = safeStorage()) {
  const list = loadSignals(uid, storage);
  const out = {};
  for (const o of list) {
    if (!o || !o.metric) continue;
    const prev = out[o.metric];
    if (!prev || new Date(o.observedAt) >= new Date(prev.observedAt)) out[o.metric] = o;
  }
  return out;
}

// Only the observations recorded on the given local day (default: today).
export function signalsForDay(uid, day = new Date(), storage = safeStorage()) {
  const key = dayKeyLocal(day);
  return loadSignals(uid, storage).filter((o) => dayKeyLocal(o.observedAt) === key);
}

// Delete one observation by id (member correcting their own entry).
export function deleteSignal(uid, id, storage = safeStorage()) {
  if (!uid || !storage) return [];
  const next = loadSignals(uid, storage).filter((o) => o.id !== id);
  return writeSignals(uid, next, storage);
}

// ── Safe display formatting (contract §11) ─────────────────────────────────
// NEVER render raw null / undefined / NaN / "nullm" / malformed units. Missing
// values become an em dash; zero is shown ONLY when it was genuinely recorded.

export const EMPTY_VALUE = '—';
export const NOT_LOGGED = 'Not logged';

// Is this a real, recorded number (so 0 is legitimate) vs missing/garbage?
export function isRecorded(value) {
  if (value === null || value === undefined || value === '') return false;
  const n = typeof value === 'number' ? value : Number(value);
  return !Number.isNaN(n);
}

/**
 * formatSignal(value, { unit, digits, empty }) -> string
 * - missing/NaN  -> empty placeholder ("—")
 * - recorded 0   -> "0" (+unit) — zero is a real reading
 * - unit joined only when present (never "nullm")
 */
export function formatSignal(value, opts = {}) {
  const { unit = '', digits = null, empty = EMPTY_VALUE } = opts;
  if (!isRecorded(value)) return empty;
  const n = typeof value === 'number' ? value : Number(value);
  const num = digits === null ? String(n) : n.toFixed(digits);
  const u = unit ? String(unit).trim() : '';
  return u ? `${num}${/^[a-zA-Z%°]/.test(u) && u.length <= 3 ? '' : ' '}${u}` : num;
}

// Convenience: value + unit, or the "Not logged" label when missing.
export function formatSignalOrNotLogged(value, unit = '', digits = null) {
  if (!isRecorded(value)) return NOT_LOGGED;
  return formatSignal(value, { unit, digits });
}

export default {
  SIGNALS_SCHEMA_VERSION,
  dailySignalsKey,
  makeObservation,
  loadSignals,
  saveSignals,
  saveSignal,
  latestByMetric,
  signalsForDay,
  deleteSignal,
  isRecorded,
  formatSignal,
  formatSignalOrNotLogged,
  EMPTY_VALUE,
  NOT_LOGGED,
};

'use strict';
/**
 * Intelligence section (spec A3) — server-side helpers.
 *
 * The Intelligence tab shows a member three honest views of the mind that
 * works on their behalf:
 *   • Natural    — what the member knows / is (their own facts, on shelves).
 *   • Artificial — what LUCA can actually see *right now* (real context sources
 *                  + counts, the never-list, the model/compute target of the
 *                  last real AI call, firing rules, recent actions), plus the
 *                  member's source-exclusion toggles.
 *   • Enhanced   — hedged, sourced insight cards (timeline, patterns, open
 *                  questions, suggestions).
 *
 * This module owns the *exclusions*: a member may switch off any context
 * source LUCA is allowed to read. Exclusions are keyed by the permanent
 * Solaris subject id (ADR 001) so they follow the member, never an email or
 * vendor id. Absence of a row = the source is included.
 */
const { subjectIdForUser } = require('./identity');

/**
 * Sources a member may switch off. Keys MUST match the `emit(key,...)` keys in
 * buildContext (backend/src/routes/luca.js). User basics and the practitioner
 * directory are intentionally NOT excludable: the first is not PHI and is
 * needed to address the member at all; the second is public marketplace data.
 */
const EXCLUDABLE_SOURCES = [
  { key: 'foundational', label: 'Foundational health profile' },
  { key: 'assessment', label: 'Vitality assessment' },
  { key: 'checkins', label: 'Daily check-ins' },
  { key: 'bookings', label: 'Recent bookings' },
  { key: 'rewards', label: 'LOVE rewards' },
  { key: 'journal', label: 'Journal entries' },
  { key: 'habits', label: 'Habits & streak' },
  { key: 'journeys', label: 'Active journeys' },
];

/**
 * The never-list is honest and static: these are categories of data LUCA is
 * structurally unable to read, regardless of any toggle. It is NOT derived
 * from the member's data (so it never leaks anything) — it documents the
 * boundary of the system.
 */
const NEVER_LIST = [
  'Any other member\u2019s data — LUCA only ever sees the signed-in member\u2019s Passport.',
  'Anything outside the member\u2019s active consent scope.',
  'The member\u2019s private keys, passwords, or auth tokens.',
  'The open internet / arbitrary web pages during a coaching turn.',
  'Raw payment card, bank, or government-id numbers (redacted at the PHI boundary).',
];

/** Resolve the member's excluded sources as a Set of source keys. */
async function getExclusions(db, userId) {
  const subjectId = await subjectIdForUser(userId).catch(() => null);
  if (!subjectId) return new Set();
  const r = await db
    .query('SELECT excluded_source FROM intelligence_exclusions WHERE subject_id=$1', [subjectId])
    .catch(() => ({ rows: [] }));
  return new Set(r.rows.map((row) => row.excluded_source));
}

/**
 * Toggle a source on/off for a member. excluded=true inserts a row (source is
 * switched OFF); excluded=false removes it (source is switched back ON).
 * Idempotent via the unique (subject_id, excluded_source) index.
 * Returns { subjectId, source, excluded } or null if no subject id.
 */
async function setExclusion(db, userId, source, excluded) {
  const subjectId = await subjectIdForUser(userId).catch(() => null);
  if (!subjectId) return null;
  if (excluded) {
    await db.query(
      `INSERT INTO intelligence_exclusions (subject_id, excluded_source)
       VALUES ($1,$2)
       ON CONFLICT (subject_id, excluded_source) DO NOTHING`,
      [subjectId, source]
    );
  } else {
    await db.query(
      'DELETE FROM intelligence_exclusions WHERE subject_id=$1 AND excluded_source=$2',
      [subjectId, source]
    );
  }
  return { subjectId, source, excluded: Boolean(excluded) };
}

module.exports = {
  EXCLUDABLE_SOURCES,
  NEVER_LIST,
  getExclusions,
  setExclusion,
};

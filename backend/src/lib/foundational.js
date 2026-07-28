/**
 * foundational.js — A5 Part A "Foundational Health Data" ↔ Digital Sovereign Passport.
 *
 * When a member submits an intake, the foundational fields (A5 §1: keys in
 * FOUNDATIONAL_KEYS) are extracted and written to `foundational_health_data`,
 * one row per Solaris subject, at provenance level L2 (peer-attested via the
 * clinic intake) with source + observed_at + consent_scope. Never overwrites
 * silently — the previous snapshot's observed_at/updated_at record supersession.
 *
 * Pure-ish: all DB access via the injected `db`. Non-fatal by design — a
 * foundational write must never block the intake submission itself.
 */

const { FOUNDATIONAL_KEYS } = require('../db/intake-templates');
const { subjectIdForUser } = require('./identity');

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/** Pull just the foundational keys out of a full responses object. */
function extractFoundational(responses) {
  const out = {};
  if (!responses || typeof responses !== 'object') return out;
  for (const k of FOUNDATIONAL_KEYS) {
    if (responses[k] !== undefined && responses[k] !== null && responses[k] !== '') out[k] = responses[k];
  }
  return out;
}

/**
 * Upsert the member's foundational snapshot (merge new answers over prior).
 * @returns {object|null} the saved row, or null if nothing foundational present.
 */
async function saveFoundational(db, { userId, responses, source = 'self', level = 2, consentScope = 'care_team' }) {
  const incoming = extractFoundational(responses);
  if (Object.keys(incoming).length === 0) return null;

  const subjectId = await subjectIdForUser(userId);
  if (!subjectId) return null; // spine invariant: no subject → no fact row

  // Merge over any existing snapshot so a partial later intake never erases prior facts.
  const prior = await db.query('SELECT data FROM foundational_health_data WHERE subject_id=$1', [subjectId]);
  const merged = Object.assign({}, (prior.rows[0] && prior.rows[0].data) || {}, incoming);

  const r = await db.query(
    `INSERT INTO foundational_health_data (subject_id, user_id, data, level, source, observed_at, consent_scope, updated_at)
     VALUES ($1,$2,$3,$4,$5,now(),$6,now())
     ON CONFLICT (subject_id) DO UPDATE SET
       data=$3, level=$4, source=$5, observed_at=now(), consent_scope=$6, updated_at=now()
     RETURNING *`,
    [subjectId, userId, JSON.stringify(merged), level, source, consentScope]
  );
  return r.rows[0];
}

/**
 * Read the member's foundational snapshot + a prefill flag.
 * A5 §2: if updated < 12 months ago the intake collapses to a single confirm step.
 */
async function getFoundational(db, userId) {
  const subjectId = await subjectIdForUser(userId);
  if (!subjectId) return { data: null, updatedAt: null, updatedWithin12Months: false, level: null, source: null };
  const r = await db.query(
    'SELECT data, level, source, observed_at, consent_scope, updated_at FROM foundational_health_data WHERE subject_id=$1',
    [subjectId]
  );
  const row = r.rows[0];
  if (!row) return { data: null, updatedAt: null, updatedWithin12Months: false, level: null, source: null };
  const updatedWithin12Months = row.updated_at
    ? (Date.now() - new Date(row.updated_at).getTime()) < TWELVE_MONTHS_MS
    : false;
  return {
    data: row.data || {},
    level: row.level,
    source: row.source,
    observedAt: row.observed_at,
    consentScope: row.consent_scope,
    updatedAt: row.updated_at,
    updatedWithin12Months,
  };
}

module.exports = { extractFoundational, saveFoundational, getFoundational, FOUNDATIONAL_KEYS, TWELVE_MONTHS_MS };

'use strict';
/**
 * Solaris identity module (hexagonal seam) — ADR 001.
 *
 * The Solaris Subject ID ('sol_' + 32 hex, random, non-PII) is the permanent
 * portable identity above replaceable endpoints (GPS Constitution §6:
 * "Identity is stable above replaceable payment endpoints"). The users table
 * remains the authentication record; the subject id is the canonical join
 * key for protocol-facing records (GPS receipts, AI receipts, agent grants,
 * vault export).
 *
 * Email / DID / nostr / wallet / clinic are BINDINGS on the subject — never
 * the identity itself. Email bindings are stored hash-only (no PII duplicated
 * outside users).
 *
 * LUCA (the agent) never holds root identity keys: nothing in this module is
 * callable under an agent capability grant — subjects and bindings are only
 * created/changed by the authenticated owner or by migrations.
 */

const crypto = require('crypto');
const db = require('../../db');
const { IDENTITY } = require('../gps/protocol-config');

const SUBJECT_ID_RE = /^sol_[0-9a-f]{32}$/;
// Lightning-address shape: name@domain.tld (same shape as email — simulated only).
const LIGHTNING_ADDR_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

const sha256hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/** Generate a new permanent subject id — random, never derived from PII. */
function newSubjectId() {
  return 'sol_' + crypto.randomBytes(16).toString('hex');
}

/** Shortened display form, e.g. sol_1a2b…5c6d (never shown as the whole id). */
function shortSubjectId(subjectId) {
  if (!subjectId || subjectId.length < 12) return subjectId || null;
  return `${subjectId.slice(0, 8)}…${subjectId.slice(-4)}`;
}

/**
 * Ensure the user has exactly one subject (lazy, idempotent — covers users
 * created after migration 023). Also backfills the email binding hash-only.
 * Returns the subject row or null if the user does not exist.
 */
async function ensureSubjectForUser(userId) {
  if (!userId) return null;
  const existing = await db.query('SELECT * FROM solaris_subjects WHERE user_id=$1', [userId]);
  if (existing.rows.length) return existing.rows[0];

  await db.query(
    `INSERT INTO solaris_subjects (subject_id, user_id)
     SELECT $1, id FROM users WHERE id=$2
     ON CONFLICT (user_id) DO NOTHING`,
    [newSubjectId(), userId]
  );
  const created = await db.query('SELECT * FROM solaris_subjects WHERE user_id=$1', [userId]);
  const subject = created.rows[0] || null;

  if (subject) {
    // Best-effort email binding (hash-only; binding_value stays NULL — no PII).
    try {
      await db.query(
        `INSERT INTO solaris_identity_bindings
           (subject_id, binding_type, binding_value, binding_hash, status, verified_at)
         SELECT $1, 'email', NULL, encode(sha256(lower(u.email)::bytea), 'hex'), 'active', u.created_at
         FROM users u WHERE u.id=$2 AND u.email IS NOT NULL AND u.email <> ''
         ON CONFLICT (subject_id, binding_type, binding_hash) DO NOTHING`,
        [subject.subject_id, userId]
      );
    } catch (err) {
      console.warn('[identity] email binding backfill failed (non-fatal):', err.code || err.name);
    }
  }
  return subject;
}

/** Look up the subject for a user (creating it lazily if missing). */
async function getSubjectByUser(userId) {
  return ensureSubjectForUser(userId);
}

/**
 * Best-effort subject id lookup for receipt stamping. Never throws; returns
 * the subject_id string or null. A stamping failure must never break the
 * underlying flow.
 */
async function subjectIdForUser(userId) {
  try {
    const s = await ensureSubjectForUser(userId);
    return s ? s.subject_id : null;
  } catch (err) {
    console.warn('[identity] subject lookup failed (non-fatal):', err.code || err.name || 'error');
    return null;
  }
}

/** All bindings for a subject, newest last. Email rows carry no value (hash only). */
async function listBindings(subjectId) {
  const r = await db.query(
    `SELECT binding_type, binding_value, binding_hash, status, verified_at, created_at, revoked_at
     FROM solaris_identity_bindings WHERE subject_id=$1
     ORDER BY created_at ASC, binding_type ASC`,
    [subjectId]
  );
  return r.rows;
}

/**
 * Set (or reset) the user's GPS end address on their subject.
 * Accepts a lightning-address-shaped string (name@domain) or null/'' /
 * 'solaris_default' to return to the Solaris-managed default.
 * Configuration only — this app is a simulation; no real payments are made.
 */
async function setGpsEndAddress(userId, address) {
  const subject = await ensureSubjectForUser(userId);
  if (!subject) throw Object.assign(new Error('User not found'), { status: 404 });

  const raw = (address || '').trim();
  let value = 'solaris_default';
  let type = 'solaris_default';
  if (raw && raw !== 'solaris_default') {
    if (!LIGHTNING_ADDR_RE.test(raw) || raw.length > 255) {
      throw Object.assign(
        new Error('End address must look like a Lightning address: name@domain'),
        { status: 400 }
      );
    }
    value = raw.toLowerCase();
    type = 'lightning_address';
  }
  const r = await db.query(
    `UPDATE solaris_subjects
     SET gps_end_address=$1, gps_end_address_type=$2, updated_at=CURRENT_TIMESTAMP
     WHERE user_id=$3 RETURNING *`,
    [value, type, userId]
  );
  return r.rows[0];
}

/** Plain-language binding descriptor for the UI (no PII for email). */
function describeBinding(b) {
  const labels = {
    email: 'Login email',
    did: 'Decentralized ID (DID)',
    nostr: 'Nostr public key',
    wallet: 'Wallet address',
    clinic: 'Clinic ID',
  };
  return {
    type: b.binding_type,
    label: labels[b.binding_type] || b.binding_type,
    value: b.binding_type === 'email' ? null : b.binding_value,
    valueNote: b.binding_type === 'email' ? 'Stored privately — only a hash lives on your identity record.' : null,
    status: b.status,
    verifiedAt: b.verified_at,
    createdAt: b.created_at,
  };
}

/**
 * Plain-language identity summary for GET /api/identity/me.
 * Solaris ID + bindings + GPS end-address config + agent authority state.
 */
async function getIdentitySummary(userId) {
  const subject = await ensureSubjectForUser(userId);
  if (!subject) return null;
  const bindings = await listBindings(subject.subject_id);

  // Agent authority state (best-effort; table is optional in minimal envs).
  let agentAuthority = { active: false, activeGrants: 0 };
  try {
    const g = await db.query(
      `SELECT count(*)::int AS n FROM agent_capability_grants
       WHERE owner_id=$1 AND status='active'`,
      [userId]
    );
    agentAuthority = { active: g.rows[0].n > 0, activeGrants: g.rows[0].n };
  } catch { /* non-fatal */ }

  const usingDefault = subject.gps_end_address_type === 'solaris_default';
  const presentTypes = new Set(bindings.filter((b) => b.status !== 'revoked').map((b) => b.binding_type));
  const comingSoon = ['did', 'nostr', 'wallet', 'clinic'].filter((t) => !presentTypes.has(t));

  return {
    solarisId: subject.subject_id,
    solarisIdShort: shortSubjectId(subject.subject_id),
    since: subject.created_at,
    status: subject.status,
    headline: 'Your Solaris ID is your permanent identity. Emails, keys and wallets are replaceable pointers attached to it.',
    bindings: bindings.map(describeBinding),
    comingSoon, // binding types with honest "coming soon" chips (no dead buttons)
    gps: {
      endAddress: subject.gps_end_address,
      endAddressType: subject.gps_end_address_type,
      usingSolarisDefault: usingDefault,
      label: usingDefault
        ? (IDENTITY.endAddress.label || 'Solaris default')
        : `Your Lightning address (simulated — no real payments): ${subject.gps_end_address}`,
      railsToday: IDENTITY.endAddress.railsToday,
      railsLater: IDENTITY.endAddress.railsLater,
      simulated: true,
    },
    agentAuthority: {
      ...agentAuthority,
      note: 'LUCA acts only under revocable grants. It never holds your identity keys.',
    },
  };
}

/** PHI-safe identity block for the vault export (subject + bindings). */
async function exportIdentity(userId) {
  const subject = await ensureSubjectForUser(userId);
  if (!subject) return null;
  const bindings = await listBindings(subject.subject_id);
  return {
    solarisId: subject.subject_id,
    status: subject.status,
    createdAt: subject.created_at,
    gpsEndAddress: subject.gps_end_address,
    gpsEndAddressType: subject.gps_end_address_type,
    bindings: bindings.map((b) => ({
      type: b.binding_type,
      value: b.binding_type === 'email' ? null : b.binding_value,
      hash: b.binding_hash,
      status: b.status,
      verifiedAt: b.verified_at,
      createdAt: b.created_at,
      revokedAt: b.revoked_at,
    })),
  };
}

module.exports = {
  SUBJECT_ID_RE,
  newSubjectId,
  shortSubjectId,
  ensureSubjectForUser,
  getSubjectByUser,
  subjectIdForUser,
  listBindings,
  setGpsEndAddress,
  getIdentitySummary,
  exportIdentity,
  sha256hex,
};

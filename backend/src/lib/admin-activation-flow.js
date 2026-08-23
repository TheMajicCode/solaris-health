'use strict';
/**
 * Complete admin single-use-token ACTIVATION flow + second-factor / recovery /
 * revocation / rate-limit / audit boundaries (Node E4J-RC1.1, item 3).
 *
 * DESIGN / SECURITY CONTRACT
 * --------------------------
 * - The bootstrap NEVER sets a usable password. It mints a high-entropy
 *   activation token (see admin-activation.js), stores ONLY its sha256 hash
 *   (admin_activation_tokens.token_hash) and delivers the raw token out of band.
 * - Activation is a single, ATOMIC transaction that:
 *     1. looks up the token by its hash (constant-time compare via verifyActivation),
 *     2. fails closed on missing / expired / used / revoked / mismatched tokens,
 *     3. enforces the admin password policy,
 *     4. sets password_hash + must_change_password=false,
 *     5. marks THIS token used_at (single-use),
 *     6. REVOKES every other outstanding token for the same admin
 *        (competing-token invalidation),
 *     7. writes an audit row (identifiers + outcome only),
 *   committing all-or-nothing.
 * - Activation does NOT grant a full-privilege admin session. `adminSessionAllowed`
 *   returns true only after a second factor (TOTP MFA or WebAuthn passkey) is
 *   enrolled AND confirmed. Until then the account is password-set but "pending 2FA".
 * - Recovery / revocation invalidates all outstanding activation tokens.
 * - Rate limiting reuses the durable rate_limit_hits store (migration 033).
 * - Audit stores ONLY: admin_user_id, email fingerprint, event, outcome,
 *   actor fingerprint, short non-sensitive reason. NEVER a token, password, or secret.
 *
 * This module takes an injectable `db` (a pg pool/client-like object exposing
 * `.query`) and an injectable clock, so it is fully unit-testable without any
 * real database and WITHOUT ever creating an admin. It does not create an admin.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  sha256,
  emailFingerprint,
  hashToken,
  verifyActivation,
} = require('./admin-activation');

const BCRYPT_COST = 10;

// Activation-attempt rate limit: max failed attempts per key within the window.
const ACTIVATION_MAX_ATTEMPTS = 5;
const ACTIVATION_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Admin password policy. Deliberately stricter than the member policy.
 * Returns { ok, reason }.
 */
function adminPasswordPolicy(pw) {
  if (typeof pw !== 'string') return { ok: false, reason: 'password_required' };
  if (pw.length < 14) return { ok: false, reason: 'too_short' };
  if (pw.length > 200) return { ok: false, reason: 'too_long' };
  if (!/[a-z]/.test(pw)) return { ok: false, reason: 'need_lowercase' };
  if (!/[A-Z]/.test(pw)) return { ok: false, reason: 'need_uppercase' };
  if (!/[0-9]/.test(pw)) return { ok: false, reason: 'need_digit' };
  if (!/[^A-Za-z0-9]/.test(pw)) return { ok: false, reason: 'need_symbol' };
  return { ok: true, reason: 'ok' };
}

/** sha256 fingerprint of an actor identifier (ip/agent). Never stores the raw value. */
function actorFingerprint(actor) {
  if (!actor) return null;
  return sha256(String(actor));
}

/**
 * Write a single audit row. Best-effort inside the caller's transaction.
 * Stores identifiers + outcome only — never a token, password, or secret.
 */
async function recordAudit(db, { adminUserId = null, email = null, event, outcome, actor = null, detail = null }) {
  const efp = email ? emailFingerprint(email) : null;
  const afp = actorFingerprint(actor);
  const safeDetail = detail == null ? null : String(detail).slice(0, 120);
  await db.query(
    `INSERT INTO admin_activation_audit
       (admin_user_id, email_fingerprint, event, outcome, actor_fingerprint, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [adminUserId, efp, event, outcome, afp, safeDetail]
  );
}

/**
 * Durable, atomic activation-attempt rate limiter over rate_limit_hits (mig 033).
 * Increments the bucket for `key`; returns { limited, hits }. Fail-closed callers
 * treat limited=true as a hard stop. Only failed attempts should be counted
 * (the caller decrements/rolls off on success by using a per-token key that is
 * revoked on success).
 */
async function checkActivationRateLimit(db, key, now = new Date()) {
  const k = `admin_activation|${key}`;
  const { rows } = await db.query(
    `INSERT INTO rate_limit_hits (key, hits, reset_at)
       VALUES ($1, 1, $2::timestamptz + ($3::bigint * interval '1 millisecond'))
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN rate_limit_hits.reset_at <= $2::timestamptz THEN 1
                   ELSE rate_limit_hits.hits + 1 END,
       reset_at = CASE WHEN rate_limit_hits.reset_at <= $2::timestamptz
                       THEN $2::timestamptz + ($3::bigint * interval '1 millisecond')
                       ELSE rate_limit_hits.reset_at END
     RETURNING hits`,
    [k, now.toISOString(), ACTIVATION_WINDOW_MS]
  );
  const hits = rows[0].hits;
  return { limited: hits > ACTIVATION_MAX_ATTEMPTS, hits };
}

/**
 * Consume an activation token and set the admin password — atomically.
 *
 * @param {object}  opts
 * @param {object}  opts.db              pg pool/client with .query (transaction run here)
 * @param {string}  opts.presentedToken  raw token from the admin (never logged)
 * @param {string}  opts.newPassword     admin-chosen password (never logged)
 * @param {string} [opts.actor]          ip/agent identifier (fingerprinted only)
 * @param {Date}   [opts.now]
 * @returns {Promise<{ok, reason, adminUserId?, mustEnrollSecondFactor?, sessionGranted}>}
 *
 * Never throws for expected auth failures — returns {ok:false, reason}. Session
 * is NEVER granted here (sessionGranted is always false); a second factor must be
 * enrolled first (see adminSessionAllowed).
 */
async function activateAdmin({ db, presentedToken, newPassword, actor = null, now = new Date() }) {
  // 1. Cheap structural checks BEFORE touching the DB.
  if (!presentedToken || typeof presentedToken !== 'string') {
    return { ok: false, reason: 'no_token', sessionGranted: false };
  }
  const policy = adminPasswordPolicy(newPassword);
  if (!policy.ok) {
    return { ok: false, reason: `password_${policy.reason}`, sessionGranted: false };
  }

  // 2. Layered rate limit: per-actor + per-token + global ceiling (item 4).
  const rl = await checkLayeredActivationRateLimit(db, { actor, tokenHash: hashToken(presentedToken), now });
  if (rl.limited) {
    await recordAudit(db, { event: 'activate_attempt', outcome: 'rate_limited', actor });
    return { ok: false, reason: 'rate_limited', sessionGranted: false };
  }

  // 3. Atomic transaction.
  await db.query('BEGIN');
  try {
    // Lock the token row so concurrent activations cannot both consume it.
    const { rows } = await db.query(
      `SELECT id, admin_user_id, token_hash, purpose, expires_at, used_at, revoked_at
         FROM admin_activation_tokens
        WHERE token_hash = $1
        FOR UPDATE`,
      [hashToken(presentedToken)]
    );
    const row = rows[0];

    const check = verifyActivation(row, presentedToken, now);
    if (!check.valid) {
      await recordAudit(db, {
        adminUserId: row ? row.admin_user_id : null,
        event: 'activate_attempt',
        outcome: check.reason,
        actor,
      });
      await db.query('COMMIT'); // persist the audit row; nothing else changed
      return { ok: false, reason: check.reason, sessionGranted: false };
    }
    if (row.purpose && row.purpose !== 'admin_activation') {
      await recordAudit(db, { adminUserId: row.admin_user_id, event: 'activate_attempt', outcome: 'wrong_purpose', actor });
      await db.query('COMMIT');
      return { ok: false, reason: 'wrong_purpose', sessionGranted: false };
    }

    // The account MUST be role=admin AND have a canonical verified email before
    // a password may be set. This binds activation to a real, verified admin
    // record server-side (item 2) — there is no public admin signup.
    const uRes = await db.query(
      `SELECT role, email_verified_at, deleted_at FROM users WHERE id = $1`,
      [row.admin_user_id]
    );
    const u = uRes.rows[0];
    if (!u || u.deleted_at || u.role !== 'admin') {
      await recordAudit(db, { adminUserId: row.admin_user_id, event: 'activate_attempt', outcome: 'not_admin', actor });
      await db.query('COMMIT');
      return { ok: false, reason: 'not_admin', sessionGranted: false };
    }
    if (!u.email_verified_at) {
      await recordAudit(db, { adminUserId: row.admin_user_id, event: 'activate_attempt', outcome: 'email_unverified', actor });
      await db.query('COMMIT');
      return { ok: false, reason: 'email_unverified', sessionGranted: false };
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    // Set password; require an explicit admin role and email verification upstream.
    await db.query(
      `UPDATE users
          SET password_hash = $1,
              must_change_password = false,
              admin_activated_at = $2
        WHERE id = $3`,
      [passwordHash, now, row.admin_user_id]
    );
    // Single-use: mark THIS token consumed.
    await db.query(
      `UPDATE admin_activation_tokens SET used_at = $1 WHERE id = $2`,
      [now, row.id]
    );
    // Competing-token invalidation: revoke all OTHER outstanding tokens for this admin.
    await db.query(
      `UPDATE admin_activation_tokens
          SET revoked_at = $1
        WHERE admin_user_id = $2 AND id <> $3
          AND used_at IS NULL AND revoked_at IS NULL`,
      [now, row.admin_user_id, row.id]
    );
    await recordAudit(db, {
      adminUserId: row.admin_user_id,
      event: 'activate_success',
      outcome: 'ok',
      actor,
      detail: 'password_set;pending_second_factor',
    });
    await db.query('COMMIT');

    return {
      ok: true,
      reason: 'ok',
      adminUserId: row.admin_user_id,
      mustEnrollSecondFactor: true,
      // Full-privilege session is WITHHELD until a second factor is enrolled.
      sessionGranted: false,
    };
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

/**
 * Revoke all outstanding (unused, un-revoked) activation tokens for an admin.
 * Recovery / lost-token path. Returns the count revoked.
 */
async function revokeOutstandingTokens({ db, adminUserId, actor = null, now = new Date() }) {
  const { rowCount } = await db.query(
    `UPDATE admin_activation_tokens
        SET revoked_at = $1
      WHERE admin_user_id = $2 AND used_at IS NULL AND revoked_at IS NULL`,
    [now, adminUserId]
  );
  await recordAudit(db, { adminUserId, event: 'tokens_revoked', outcome: 'ok', actor, detail: `count=${rowCount}` });
  return rowCount;
}

/**
 * Whether a fully-privileged admin session may be issued for this user.
 * Fail-closed: requires role=admin, an activated password, no pending change,
 * and at least one confirmed second factor (MFA or passkey).
 */
function adminSessionAllowed(user) {
  if (!user || user.role !== 'admin') return { allowed: false, reason: 'not_admin' };
  if (!user.admin_activated_at) return { allowed: false, reason: 'not_activated' };
  if (user.must_change_password) return { allowed: false, reason: 'must_change_password' };
  const hasMfa = !!user.admin_mfa_enrolled_at;
  const hasPasskey = !!user.admin_passkey_enrolled_at;
  if (!hasMfa && !hasPasskey) return { allowed: false, reason: 'second_factor_required' };
  return { allowed: true, reason: 'ok' };
}

// Conservative global ceiling across ALL activation attempts (defence in depth
// against a distributed guessing campaign). Deliberately generous so it never
// trips a single legitimate operator, but caps a botnet.
const ACTIVATION_GLOBAL_MAX = 100;
const ACTIVATION_GLOBAL_WINDOW_MS = 15 * 60 * 1000;

/**
 * Layered activation rate limit (item 4). Checks THREE independent buckets and
 * returns limited=true if ANY trips, with a NEUTRAL reason ('rate_limited') so
 * a caller cannot learn which layer fired (no token/account enumeration):
 *   1. per actor/IP fingerprint  — throttles one source hammering many tokens,
 *   2. per activation record/token hash — throttles guesses at one token,
 *   3. a conservative GLOBAL ceiling — caps a distributed campaign.
 *
 * NOTE: the previous single limiter keyed only on the token-hash slice, so an
 * attacker guessing DIFFERENT tokens got a fresh bucket every time (defect).
 * The actor + global layers close that hole.
 */
async function checkLayeredActivationRateLimit(db, { actor = null, tokenHash = null, now = new Date() }) {
  // 1. per actor/IP
  if (actor) {
    const rl = await checkActivationRateLimit(db, `actor:${actorFingerprint(actor)}`, now);
    if (rl.limited) return { limited: true, reason: 'rate_limited' };
  }
  // 2. per token/record
  if (tokenHash) {
    const rl = await checkActivationRateLimit(db, `token:${String(tokenHash).slice(0, 32)}`, now);
    if (rl.limited) return { limited: true, reason: 'rate_limited' };
  }
  // 3. global ceiling
  const k = 'admin_activation|global';
  const { rows } = await db.query(
    `INSERT INTO rate_limit_hits (key, hits, reset_at)
       VALUES ($1, 1, $2::timestamptz + ($3::bigint * interval '1 millisecond'))
     ON CONFLICT (key) DO UPDATE SET
       hits = CASE WHEN rate_limit_hits.reset_at <= $2::timestamptz THEN 1
                   ELSE rate_limit_hits.hits + 1 END,
       reset_at = CASE WHEN rate_limit_hits.reset_at <= $2::timestamptz
                       THEN $2::timestamptz + ($3::bigint * interval '1 millisecond')
                       ELSE rate_limit_hits.reset_at END
     RETURNING hits`,
    [k, now.toISOString(), ACTIVATION_GLOBAL_WINDOW_MS]
  );
  if (rows[0].hits > ACTIVATION_GLOBAL_MAX) return { limited: true, reason: 'rate_limited' };
  return { limited: false, reason: 'ok' };
}

// NOTE: the RC1.1 `confirmSecondFactor()` placeholder (which set an enrollment
// timestamp WITHOUT verifying a code) has been REMOVED. Real second-factor
// enrollment/verification now lives in ./admin-mfa.js and only marks enrollment
// after a cryptographic TOTP check.

module.exports = {
  ACTIVATION_MAX_ATTEMPTS,
  ACTIVATION_WINDOW_MS,
  ACTIVATION_GLOBAL_MAX,
  ACTIVATION_GLOBAL_WINDOW_MS,
  BCRYPT_COST,
  adminPasswordPolicy,
  actorFingerprint,
  recordAudit,
  checkActivationRateLimit,
  checkLayeredActivationRateLimit,
  activateAdmin,
  revokeOutstandingTokens,
  adminSessionAllowed,
};

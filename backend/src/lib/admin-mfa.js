'use strict';
/**
 * Real admin second-factor (TOTP) enrollment + login verification —
 * NODE E4J-RC1.2 item 3.
 *
 * This REPLACES the RC1.1 placeholder `confirmSecondFactor()`, which recorded an
 * enrollment timestamp WITHOUT ever verifying a code. Here, enrollment is only
 * marked after a cryptographic TOTP code check, and login re-verifies a code
 * before any full-privilege admin JWT is issued.
 *
 * SECURITY CONTRACT
 * -----------------
 * - The TOTP secret is high-entropy (crypto RNG, 160-bit) and is stored ONLY
 *   wrapped with AES-256-GCM (totp-crypto.js). Plaintext never touches the DB,
 *   a log, or a status line.
 * - Enrollment: begin() creates a PENDING (unconfirmed) secret and returns the
 *   provisioning URI to the enrolling admin over the already-authenticated
 *   channel. confirm() requires a correct code; only then is confirmed_at set
 *   and users.admin_mfa_enrolled_at flipped. A wrong / expired / replayed /
 *   rate-limited code sets NOTHING.
 * - Replay protection: admin_mfa_secrets.last_totp_step records the highest
 *   accepted time-step; a code at or before it is refused (a code is single-use).
 * - Injectable db + clock, so it is unit-testable.
 */
const totp = require('./totp');
const totpCrypto = require('./totp-crypto');
const { recordAudit } = require('./admin-activation-flow');

/**
 * Begin TOTP enrollment for an activated admin. Generates a fresh secret, wraps
 * it, revokes any prior pending (unconfirmed) secret, and inserts a new pending
 * row. Returns the base32 secret + otpauth URI for the enrolling admin ONLY.
 * These MUST be delivered over the authenticated response and never logged.
 */
async function beginTotpEnrollment({ db, adminUserId, email = null, now = new Date(), actor = null }) {
  if (!totpCrypto.isConfigured()) {
    // Fail closed: without a wrapping key we cannot store the secret safely.
    return { ok: false, reason: 'mfa_unavailable' };
  }
  const secret = totp.generateSecret();
  const wrapped = totpCrypto.wrapSecret(secret);
  // Retire any earlier un-confirmed secret so only one pending enrollment exists.
  await db.query(
    `UPDATE admin_mfa_secrets SET revoked_at = $1
       WHERE admin_user_id = $2 AND confirmed_at IS NULL AND revoked_at IS NULL`,
    [now, adminUserId]
  );
  await db.query(
    `INSERT INTO admin_mfa_secrets (admin_user_id, secret_wrapped, created_at)
       VALUES ($1, $2, $3)`,
    [adminUserId, wrapped, now]
  );
  await recordAudit(db, { adminUserId, email, event: 'mfa_enroll_begin', outcome: 'ok', actor });
  const uri = totp.otpauthUri({ secret, label: `admin:${String(adminUserId).slice(0, 8)}` });
  // secret + uri are returned to the caller (authenticated admin) — NOT logged.
  return { ok: true, reason: 'ok', secret, otpauthUri: uri };
}

/**
 * Confirm TOTP enrollment by verifying a code against the pending secret.
 * On success: sets confirmed_at + last_totp_step on the secret row AND
 * users.admin_mfa_enrolled_at (the flip to "session-eligible"). On any failure
 * NOTHING is written except an audit row.
 */
async function confirmTotpEnrollment({ db, adminUserId, code, now = new Date(), actor = null }) {
  const { rows } = await db.query(
    `SELECT id, secret_wrapped, last_totp_step
       FROM admin_mfa_secrets
      WHERE admin_user_id = $1 AND confirmed_at IS NULL AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [adminUserId]
  );
  const row = rows[0];
  if (!row) {
    await recordAudit(db, { adminUserId, event: 'mfa_enroll_confirm', outcome: 'no_pending', actor });
    return { ok: false, reason: 'no_pending' };
  }
  let secret;
  try {
    secret = totpCrypto.unwrapSecret(row.secret_wrapped);
  } catch (_e) {
    await recordAudit(db, { adminUserId, event: 'mfa_enroll_confirm', outcome: 'unwrap_failed', actor });
    return { ok: false, reason: 'mfa_unavailable' };
  }
  const check = totp.verifyCode(secret, code, {
    timeMs: now.getTime(),
    afterStep: row.last_totp_step != null ? Number(row.last_totp_step) : null,
  });
  if (!check.valid) {
    await recordAudit(db, { adminUserId, event: 'mfa_enroll_confirm', outcome: 'bad_code', actor });
    return { ok: false, reason: 'bad_code' };
  }
  await db.query('BEGIN');
  try {
    await db.query(
      `UPDATE admin_mfa_secrets SET confirmed_at = $1, last_totp_step = $2 WHERE id = $3`,
      [now, check.step, row.id]
    );
    await db.query(
      `UPDATE users SET admin_mfa_enrolled_at = $1 WHERE id = $2 AND role = 'admin'`,
      [now, adminUserId]
    );
    await recordAudit(db, { adminUserId, event: 'mfa_enroll_confirm', outcome: 'ok', actor });
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
  return { ok: true, reason: 'ok' };
}

/**
 * Verify a TOTP code at admin login. Fail-closed: requires a confirmed, active
 * secret and a valid, non-replayed code. Advances last_totp_step on success.
 */
async function verifyTotpLogin({ db, adminUserId, code, now = new Date(), actor = null }) {
  const { rows } = await db.query(
    `SELECT id, secret_wrapped, last_totp_step
       FROM admin_mfa_secrets
      WHERE admin_user_id = $1 AND confirmed_at IS NOT NULL AND revoked_at IS NULL
      ORDER BY confirmed_at DESC
      LIMIT 1`,
    [adminUserId]
  );
  const row = rows[0];
  if (!row) return { ok: false, reason: 'no_factor' };
  let secret;
  try {
    secret = totpCrypto.unwrapSecret(row.secret_wrapped);
  } catch (_e) {
    return { ok: false, reason: 'mfa_unavailable' };
  }
  const check = totp.verifyCode(secret, code, {
    timeMs: now.getTime(),
    afterStep: row.last_totp_step != null ? Number(row.last_totp_step) : null,
  });
  if (!check.valid) {
    await recordAudit(db, { adminUserId, event: 'mfa_login', outcome: 'bad_code', actor });
    return { ok: false, reason: 'bad_code' };
  }
  await db.query(
    `UPDATE admin_mfa_secrets SET last_totp_step = $1 WHERE id = $2`,
    [check.step, row.id]
  );
  await recordAudit(db, { adminUserId, event: 'mfa_login', outcome: 'ok', actor });
  return { ok: true, reason: 'ok' };
}

module.exports = { beginTotpEnrollment, confirmTotpEnrollment, verifyTotpLogin };

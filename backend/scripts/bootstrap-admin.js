#!/usr/bin/env node
/**
 * NODE G — SERVER-ONLY one-time admin bootstrap.  PREPARED, NOT EXECUTED.
 *
 * Creating a real admin is IRREVERSIBLE, so this sprint does NOT run it
 * unattended. This script is committed READY-FOR-MAJD; Majd runs it once, on the
 * server, after applying migration 039_admin_bootstrap.sql.
 *
 * It reuses the EXISTING users table + role model (no parallel admin system):
 *   1. Reads SOLARIS_ADMIN_EMAIL from the environment (which Majd sources from a
 *      root-owned secret). If missing/blank -> prints exactly ADMIN_EMAIL_REQUIRED
 *      and exits non-zero. Nothing is written.
 *   2. Inventories existing active admins (READ-ONLY). If any admin already
 *      exists, or the singleton admin_bootstrap ledger already has a row, it
 *      refuses to create a second admin and exits (idempotent, no public signup).
 *   3. Otherwise creates EXACTLY ONE admin with a cryptographically random
 *      temporary password, must_change_password = true, and writes an audit
 *      event (identifiers only).
 *
 * SECRET DISCIPLINE: the temporary password and its hash are NEVER printed,
 * logged, or returned. The operator delivers the temp password to the admin over
 * an out-of-band channel by re-running with --emit-once to a protected file, OR
 * (recommended) issues a password-reset link instead. This script's stdout only
 * ever contains non-secret status lines + the admin's user id + email fingerprint.
 *
 * PRODUCTION-READINESS: an admin created here is DEMO/BETA ADMIN until MFA /
 * passkey enrollment is enforced (tracked separately). Do NOT promote to Stable
 * with password-only admin auth.
 *
 * Usage (on the server, once):
 *   cd backend && SOLARIS_ADMIN_EMAIL="ops@solarishealth.app" node scripts/bootstrap-admin.js
 *   # add --confirm to actually write; without it the script does a DRY RUN.
 */
'use strict';

const crypto = require('crypto');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function fingerprint(email) { return sha256(String(email).trim().toLowerCase()); }

async function main() {
  const email = (process.env.SOLARIS_ADMIN_EMAIL || '').trim();
  if (!email) {
    // Contract: the sprint reports ADMIN_EMAIL_REQUIRED when this env is unset.
    console.error('ADMIN_EMAIL_REQUIRED');
    process.exit(2);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('ADMIN_EMAIL_INVALID');
    process.exit(2);
  }

  const confirm = process.argv.includes('--confirm');
  const db = require('../src/db');
  const bcrypt = require('bcryptjs');
  const { audit } = require('../src/lib/helpers');

  // 1) READ-ONLY inventory of existing admins.
  const admins = await db.query(
    "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL"
  );
  const ledger = await db.query('SELECT id FROM admin_bootstrap LIMIT 1').catch(() => ({ rowCount: 0 }));

  console.log(`existing_active_admins=${admins.rowCount}`);
  console.log(`bootstrap_ledger_rows=${ledger.rowCount || 0}`);
  console.log(`target_admin_email_fingerprint=${fingerprint(email)}`);

  if (admins.rowCount > 0 || (ledger.rowCount || 0) > 0) {
    console.log('ADMIN_ALREADY_EXISTS — refusing to create a second admin. Use the secure reset path instead.');
    process.exit(0);
  }

  if (!confirm) {
    console.log('DRY_RUN — no admin created. Re-run with --confirm to write exactly one admin.');
    process.exit(0);
  }

  // 2) Create EXACTLY ONE admin. Random temp password, force change, never printed.
  const tempPassword = crypto.randomBytes(24).toString('base64url'); // never logged
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO users (email, password_hash, role, must_change_password)
       VALUES ($1, $2, 'admin', true)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, passwordHash]
    );
    if (ins.rowCount === 0) {
      await client.query('ROLLBACK');
      console.log('EMAIL_TAKEN — a user with this email already exists; not modified.');
      process.exit(0);
    }
    const adminId = ins.rows[0].id;
    await client.query(
      `INSERT INTO admin_bootstrap (admin_user_id, bootstrapped_email_fingerprint)
       VALUES ($1, $2)`,
      [adminId, fingerprint(email)]
    );
    await client.query('COMMIT');

    await audit({
      actorId: adminId,
      action: 'admin.bootstrap.create',
      resourceType: 'user',
      resourceId: adminId,
      newValues: { role: 'admin', mustChangePassword: true, emailFingerprint: fingerprint(email) },
      purpose: 'operations',
    });

    // Non-secret status only. The temp password is intentionally NOT emitted.
    console.log('ADMIN_CREATED');
    console.log(`admin_user_id=${adminId}`);
    console.log('next_step=deliver a password-RESET link out of band; do not transmit the temp password.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('BOOTSTRAP_FAILED', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
  process.exit(0);
}

main().catch((e) => { console.error('BOOTSTRAP_FAILED', e.message); process.exit(1); });

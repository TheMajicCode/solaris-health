#!/usr/bin/env node
/**
 * NODE G / RC1 item 2 — SERVER-ONLY one-time admin bootstrap. PREPARED, NOT EXECUTED.
 *
 * Creating a real admin is IRREVERSIBLE, so this sprint does NOT run it. The
 * default invocation is a DRY RUN. Majd runs it once, on the server, with
 * --confirm, AFTER applying migration 039_admin_bootstrap.sql.
 *
 * SECURE ACTIVATION (RC1):
 *   The bootstrap NEVER sets a usable password and NEVER prints a credential.
 *   It creates exactly one admin whose password is an unusable random hash
 *   (login disabled) with must_change_password = true, then mints a SINGLE-USE,
 *   TIME-LIMITED activation token. Only sha256(token) + expiry are persisted in
 *   admin_activation_tokens. The RAW token is written ONCE to a protected,
 *   operator-only file (mode 0600) at the path given by
 *   SOLARIS_ADMIN_ACTIVATION_OUT — NEVER to stdout/stderr/logs. The admin uses
 *   the token out of band to set a password and enroll MFA/passkey.
 *
 * REQUIRED ENV (Majd provides later; never paste into public logs):
 *   SOLARIS_ADMIN_EMAIL            — the admin's verified email address.
 *   SOLARIS_ADMIN_ACTIVATION_OUT   — path to a protected file for the one-time
 *                                    activation token (required only with --confirm).
 *
 * IDENTIFIER-ONLY OUTPUT: stdout contains only non-secret status lines, the new
 * admin's user id, and an email FINGERPRINT (sha256), never the address/password/token.
 *
 * Least privilege + recovery: single admin role (no parallel admin system);
 * tokens are revocable (revoked_at) and expire; MFA/passkey enrollment is
 * required before Stable (admin_mfa_enrolled_at). Password-only admin auth must
 * NOT be promoted to Stable.
 *
 * Usage (on the server, once):
 *   cd backend && SOLARIS_ADMIN_EMAIL="ops@example.org" node scripts/bootstrap-admin.js          # DRY RUN
 *   cd backend && SOLARIS_ADMIN_EMAIL="ops@example.org" \
 *       SOLARIS_ADMIN_ACTIVATION_OUT=/root/solaris-admin-activation.token \
 *       node scripts/bootstrap-admin.js --confirm                                                 # writes once
 */
'use strict';

const fs = require('fs');
const {
  emailFingerprint,
  generateActivationToken,
} = require('../src/lib/admin-activation');

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
  const crypto = require('crypto');
  const { audit } = require('../src/lib/helpers');

  // 1) READ-ONLY inventory of existing admins.
  const admins = await db.query(
    "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL"
  );
  const ledger = await db
    .query('SELECT id FROM admin_bootstrap LIMIT 1')
    .catch(() => ({ rowCount: 0 }));

  console.log(`existing_active_admins=${admins.rowCount}`);
  console.log(`bootstrap_ledger_rows=${ledger.rowCount || 0}`);
  console.log(`target_admin_email_fingerprint=${emailFingerprint(email)}`);

  if (admins.rowCount > 0 || (ledger.rowCount || 0) > 0) {
    console.log('ADMIN_ALREADY_EXISTS — refusing to create a second admin. Use the secure reset/activation path instead.');
    process.exit(0);
  }

  if (!confirm) {
    console.log('DRY_RUN — no admin created, no token minted. Re-run with --confirm (and SOLARIS_ADMIN_ACTIVATION_OUT) to write exactly one admin.');
    process.exit(0);
  }

  // --confirm path (NOT executed this sprint). Requires a protected out-file.
  const outPath = (process.env.SOLARIS_ADMIN_ACTIVATION_OUT || '').trim();
  if (!outPath) {
    console.error('ACTIVATION_OUT_REQUIRED — set SOLARIS_ADMIN_ACTIVATION_OUT to a protected (root-only) file path.');
    process.exit(2);
  }

  // 2) Create EXACTLY ONE admin with an UNUSABLE password (login disabled until
  //    activation). No credential is ever chosen or printed here.
  const unusableSecret = crypto.randomBytes(32).toString('base64url'); // discarded
  const passwordHash = await bcrypt.hash(unusableSecret, 12);
  const { token, tokenHash, expiresAt } = generateActivationToken();

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
      [adminId, emailFingerprint(email)]
    );
    await client.query(
      `INSERT INTO admin_activation_tokens (admin_user_id, token_hash, purpose, expires_at)
       VALUES ($1, $2, 'admin_activation', $3)`,
      [adminId, tokenHash, expiresAt]
    );
    await client.query('COMMIT');

    // Deliver the RAW token OUT OF BAND to a protected file (0600). Never stdout.
    fs.writeFileSync(outPath, token, { mode: 0o600 });
    fs.chmodSync(outPath, 0o600);

    await audit({
      actorId: adminId,
      action: 'admin.bootstrap.create',
      resourceType: 'user',
      resourceId: adminId,
      newValues: {
        role: 'admin',
        mustChangePassword: true,
        emailFingerprint: emailFingerprint(email),
        activation: 'single_use_token_minted',
        activationExpiresAt: expiresAt.toISOString(),
      },
      purpose: 'operations',
    });

    // Non-secret status only.
    console.log('ADMIN_CREATED');
    console.log(`admin_user_id=${adminId}`);
    console.log('activation_token=WRITTEN_TO_PROTECTED_FILE (single-use, time-limited; not printed)');
    console.log('next_step=deliver the activation file out of band; admin sets password + enrolls MFA/passkey, then revoke/rotate.');
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

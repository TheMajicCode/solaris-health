#!/usr/bin/env node
'use strict';
/**
 * NODE E4J-RC1.2 — OPERATOR credential-rotation + SCOPED session-revocation tool.
 *
 * PURPOSE
 *   Rotate the password of one or more *named* synthetic/exposed accounts AND
 *   revoke their outstanding sessions using the RC1.2 per-account cut-off
 *   (`users.tokens_valid_after`) instead of the RC1.1 blunt instrument of
 *   rotating the global JWT_SECRET. Advancing tokens_valid_after to NOW() makes
 *   authMiddleware reject every JWT for THAT account whose `iat` predates the
 *   cut-off, while leaving every other user's session untouched.
 *
 * SAFETY — this script is COMMITTED but UNEXECUTED. It refuses to do anything
 * unless BOTH hold:
 *   1. the exact authorization phrase is present in the environment, and
 *   2. an explicit, non-empty target account list is supplied.
 *   Without the phrase it performs NO database work and exits non-zero.
 *
 *   It NEVER prints, logs, or returns a password or token. Generated
 *   replacements are written exactly once to a root-owned 0600 file under
 *   /home/ubuntu; the console/report shows only role, an account-id suffix, a
 *   truncated sha256 fingerprint of the new secret, and PASS/FAIL.
 *
 * USAGE (operator, only after authorization is granted):
 *   ROTATION_AUTHORIZATION="AUTHORIZE RC1.2 ADMIN CREDENTIAL ROTATION AND SESSION REVOCATION" \
 *   ROTATION_TARGETS="demo-member@example.test,demo-practitioner@example.test" \
 *   DATABASE_URL="<operator-scoped url>" \
 *   node backend/scripts/rotate-exposed-synthetic-accounts.js --confirm
 *
 * This program is intentionally NOT wired into any npm script or route.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');

const AUTH_PHRASE = 'AUTHORIZE RC1.2 ADMIN CREDENTIAL ROTATION AND SESSION REVOCATION';

// --- helpers ---------------------------------------------------------------

function securePassword() {
  // 30 bytes of CSPRNG entropy, url-safe, no ambiguous chars stripped (kept raw).
  return crypto.randomBytes(30).toString('base64').replace(/[+/=]/g, '').slice(0, 32);
}

function fingerprint(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

function idSuffix(id) {
  return String(id).slice(-6);
}

function parseTargets() {
  const raw = process.env.ROTATION_TARGETS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// --- gate ------------------------------------------------------------------

function authorized() {
  return process.env.ROTATION_AUTHORIZATION === AUTH_PHRASE
    && process.argv.includes('--confirm');
}

// --- main ------------------------------------------------------------------

async function main() {
  if (!authorized()) {
    console.error('[rotate] REFUSED: exact authorization phrase and --confirm required.');
    console.error('[rotate] No database connection opened. No rows changed. UNEXECUTED.');
    process.exit(2);
    return;
  }

  const targets = parseTargets();
  if (targets.length === 0) {
    console.error('[rotate] REFUSED: ROTATION_TARGETS is empty — refusing a blanket rotation.');
    process.exit(2);
    return;
  }

  // Only require db (opening a pool) AFTER the gate passes.
  const db = require('../src/db');
  const outPath = path.join(
    process.env.ROTATION_OUT_DIR || os.homedir(),
    `rc12-rotated-credentials-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  );

  const report = [];
  const secretLines = [];
  const client = await db.pool.connect();
  try {
    for (const email of targets) {
      const newSecret = securePassword();
      const hash = await bcrypt.hash(newSecret, 12);
      // Atomic: set the new hash AND advance the per-account session cut-off in
      // a single statement. No global JWT_SECRET rotation — scoped to this row.
      const { rows } = await client.query(
        `UPDATE users
            SET password_hash = $1,
                tokens_valid_after = NOW(),
                must_change_password = false
          WHERE email = $2
          RETURNING id, role`,
        [hash, email]
      );
      if (rows.length === 0) {
        report.push({ email_suffix: idSuffix(email), status: 'NOT_FOUND' });
        continue;
      }
      const { id, role } = rows[0];
      secretLines.push(`${email}\t${newSecret}`);
      report.push({
        role,
        id_suffix: idSuffix(id),
        secret_fp: fingerprint(newSecret),
        status: 'ROTATED+REVOKED',
      });
    }

    // Write the plaintext replacements exactly once, 0600, owner-only.
    fs.writeFileSync(outPath, secretLines.join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(outPath, 0o600);
  } finally {
    client.release();
  }

  // Console/report: fingerprints + PASS/FAIL only — never the secret itself.
  console.log('[rotate] RESULT (secrets written 0600 to operator file; not shown):');
  for (const r of report) console.log('  ' + JSON.stringify(r));
  console.log(`[rotate] operator file: ${outPath}`);
  console.log('[rotate] Old JWTs for these accounts now fail (iat < tokens_valid_after).');
  console.log('[rotate] Other users are UNAFFECTED (no global secret rotation).');

  await db.pool.end().catch(() => {});
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[rotate] FAILED:', err && err.message ? err.message : 'error');
    process.exit(1);
  });
}

module.exports = { securePassword, fingerprint, AUTH_PHRASE };

// Onboarding-experience gate (Beta V1).
// Records, per ACCOUNT (server-side — the source of truth, never localStorage),
// completion of the one-time Screens 1-3 (Identity / Wealth / Sovereignty) plus
// the checkbox backup ACKNOWLEDGEMENTS. No secrets are ever accepted or stored here:
// the only payloads are a screen name and (for the wealth screen) an outcome.
//
// All writes are authenticated (authMiddleware), scoped to req.user.userId, and
// idempotent — replaying an ack is a no-op that returns current state.
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { shapeUser } = require('../lib/helpers');

const router = express.Router();

// Current onboarding-experience version. Bumped only when the Screens 1-3
// sequence itself changes; a completed account stores this so it is never
// re-shown the flow it already finished.
const EXPERIENCE_VERSION = 1;

// Compute the next required onboarding step for an account from its server state.
// Order: identity (S1) -> wealth (S2) -> sovereignty (S3) -> profile -> assessment -> null(done).
function computeNextStep(u) {
  if (u.onboarding_status === 'complete') return null;
  if (!u.identity_backup_ack_at) return 'identity';
  if (!u.wealth_screen_status) return 'wealth';
  if (!u.sovereignty_ack_at) return 'sovereignty';
  if (u.onboarding_status === 'profile') return 'profile';
  if (u.onboarding_status === 'assessment') return 'assessment';
  return null;
}

async function loadRow(userId) {
  const r = await db.query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);
  return r.rows[0] || null;
}

// GET /api/onboarding/status — where should this account resume?
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const u = await loadRow(req.user.userId);
    if (!u) return res.status(404).json({ error: 'Account not found' });
    res.json({
      nextStep: computeNextStep(u),
      experienceVersion: u.onboarding_experience_version || 0,
      onboardingStatus: u.onboarding_status,
      identityBackupAckAt: u.identity_backup_ack_at || null,
      wealthScreenStatus: u.wealth_screen_status || null,
      walletBackupAckAt: u.wallet_backup_ack_at || null,
      sovereigntyAckAt: u.sovereignty_ack_at || null,
    });
  } catch (err) {
    console.error('onboarding status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Does the account have an ACTIVE, signature-verified Nostr binding on its
// subject? (Blocker #5.) Since a binding is now only created after proof of
// control (POST /identity/nostr requires a signed bind challenge), an ACTIVE
// nostr binding is by construction signature-verified.
async function hasActiveNostrBinding(client, userId) {
  const r = await client.query(
    `SELECT 1
       FROM solaris_identity_bindings b
       JOIN solaris_subjects s ON s.subject_id = b.subject_id
      WHERE s.user_id = $1 AND b.binding_type = 'nostr' AND b.status = 'active'
      LIMIT 1`,
    [userId]
  );
  return r.rows.length > 0;
}

// POST /api/onboarding/ack  { screen, outcome?, walletBackup? }
//   screen: 'identity' | 'wealth' | 'sovereignty'
//   outcome (wealth only): 'completed' | 'skipped'  (+ walletBackup:true when generated)
//
// Server-enforced ordering (blocker #5). Runs in ONE transaction with the user
// row locked (SELECT … FOR UPDATE) so parallel requests cannot bypass the gate:
//   - identity ack requires an ACTIVE signature-verified Nostr binding;
//   - wealth ack requires identity ack; wealth outcome must be exactly
//     'completed'|'skipped' (else 400); 'completed' requires walletBackup===true;
//     'skipped' must NOT create a wallet-backup ack;
//   - sovereignty ack requires a valid wealth outcome;
//   - the experience version advances ONLY once identity+wealth+sovereignty are
//     all satisfied;
//   - an out-of-order ack returns 409 with the expected nextStep;
//   - replaying the current valid ack is idempotent (COALESCE keeps the first
//     timestamp / outcome).
// Never accepts a key, nsec, mnemonic, seed, or address.
router.post('/ack', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const screen = String(req.body?.screen || '').trim();

  if (!['identity', 'wealth', 'sovereignty'].includes(screen)) {
    return res.status(400).json({ error: 'Unknown onboarding screen.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const locked = await client.query(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [userId]
    );
    if (!locked.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    const u = locked.rows[0];

    if (screen === 'identity') {
      // Precondition: an active signature-verified Identity Key binding must exist.
      if (!(await hasActiveNostrBinding(client, userId))) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'Link and verify your Identity Key before acknowledging this step.',
          nextStep: 'identity',
        });
      }
      await client.query(
        'UPDATE users SET identity_backup_ack_at = COALESCE(identity_backup_ack_at, NOW()), updated_at = NOW() WHERE id = $1',
        [userId]
      );
    } else if (screen === 'wealth') {
      // Ordering: identity must be acked first.
      if (!u.identity_backup_ack_at) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Complete the identity step first.', nextStep: computeNextStep(u) });
      }
      // Outcome must be exactly one of the two allowed values.
      const outcome = req.body?.outcome;
      if (outcome !== 'completed' && outcome !== 'skipped') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: "Wealth outcome must be 'completed' or 'skipped'." });
      }
      const walletBackup = req.body?.walletBackup === true;
      // 'completed' requires the wallet backup acknowledgement; 'skipped' must
      // never create one.
      if (outcome === 'completed' && !walletBackup) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Confirm you have backed up your recovery words to complete this step.' });
      }
      const setWalletAck = outcome === 'completed' && walletBackup;
      await client.query(
        `UPDATE users
           SET wealth_screen_status = COALESCE(wealth_screen_status, $2),
               wallet_backup_ack_at = CASE WHEN $3 THEN COALESCE(wallet_backup_ack_at, NOW()) ELSE wallet_backup_ack_at END,
               updated_at = NOW()
         WHERE id = $1`,
        [userId, outcome, setWalletAck]
      );
    } else if (screen === 'sovereignty') {
      // Ordering: identity + a valid wealth outcome must precede sovereignty.
      if (!u.identity_backup_ack_at || !u.wealth_screen_status) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Complete the earlier steps first.', nextStep: computeNextStep(u) });
      }
      // All three steps are now satisfied → finish the one-time experience and
      // advance the experience version.
      await client.query(
        `UPDATE users
           SET sovereignty_ack_at = COALESCE(sovereignty_ack_at, NOW()),
               onboarding_experience_version = GREATEST(COALESCE(onboarding_experience_version,0), $2),
               updated_at = NOW()
         WHERE id = $1`,
        [userId, EXPERIENCE_VERSION]
      );
    }

    const updated = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    const row = updated.rows[0];
    res.json({ ok: true, nextStep: computeNextStep(row), user: shapeUser(row) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('onboarding ack error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

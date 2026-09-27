/**
 * Retired cross-chain wallet API.
 * GET /api/wallet/me retains owner-only access to historical address metadata.
 * Every other path/method is retired before wallet SQL or external RPC runs.
 * These records do not represent active wallet access, balances or payments.
 * The local Bitcoin adapter and its encrypted vault are separate and unchanged.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Preserve the real JWT and revocation checks, including their fail-closed 503.
router.use(authMiddleware);

function retired(_req, res) {
  res.status(410).json({
    error: 'LEGACY_WALLET_RETIRED',
    message: 'Legacy wallet connections and operations are no longer available.',
  });
}

// Express otherwise treats HEAD as GET; only the explicit read is retained.
router.head('/me', retired);
router.get('/me', async (req, res) => {
  const userId = req.user.userId;
  if (typeof userId !== 'string' || !USER_ID.test(userId) || userId.length !== 36) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await db.query(
      `SELECT id, chain, address, label, provider, verified, is_primary, verified_at, created_at
         FROM wallet_addresses WHERE user_id=$1 ORDER BY is_primary DESC, created_at ASC`,
      [userId]
    );
    res.json({
      legacy: true,
      status: 'retired',
      wallets: result.rows.map((row) => ({
        id: row.id,
        chain: row.chain,
        address: row.address,
        label: row.label,
        provider: row.provider,
        verified: row.verified,
        isPrimary: row.is_primary,
        verifiedAt: row.verified_at,
        createdAt: row.created_at,
        legacy: true,
        active: false,
      })),
    });
  } catch (_err) {
    console.error('[wallet] historical metadata unavailable');
    res.status(500).json({ error: 'Server error' });
  }
});

router.use(retired);

module.exports = router;

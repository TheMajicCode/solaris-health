/**
 * Wallet routes — Phase 4 (Cross-chain Wallet Integration)
 *
 *   POST   /api/wallet/connect                       Save / upsert a wallet address
 *   GET    /api/wallet/me                            List the user's connected wallets
 *   PUT    /api/wallet/disconnect                    Remove a wallet connection
 *   PUT    /api/wallet/primary                       Set a wallet as primary
 *   GET    /api/wallet/nonce                         Get a signing nonce + SIWE message
 *   POST   /api/wallet/verify-signature             Verify ownership (SIWE)
 *   GET    /api/wallet/balance/:chain/:address       Proxy native+token balance
 *   GET    /api/wallet/transactions/:chain/:address  Proxy recent transactions
 *   GET    /api/wallet/chains                         Supported chain metadata
 *
 * Only patients (and admins) may connect wallets. No private keys are ever stored.
 */
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { audit } = require('../lib/helpers');
const web3 = require('../lib/web3');

const router = express.Router();

/**
 * SIWE nonce store — replay protection.
 * Nonces are single-use and expire after NONCE_TTL_MS. Keyed by
 * `${userId}:${address}` so a nonce issued to one member/address cannot be
 * replayed by another. In-memory is fine for a single instance; swap in a
 * Redis adapter behind this same interface when horizontally scaling.
 */
const nonceStore = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function nonceKey(userId, address) {
  return `${userId}:${String(address).toLowerCase()}`;
}

// Opportunistically evict expired nonces so the map can't grow unbounded.
function sweepNonces() {
  const now = Date.now();
  for (const [k, v] of nonceStore) {
    if (now > v.expiresAt) nonceStore.delete(k);
  }
}

function requirePatient(req, res, next) {
  if (req.user.role !== 'patient' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Only patients can connect wallets' });
  next();
}

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;

function shapeWallet(w) {
  return {
    id: w.id,
    chain: w.chain,
    address: w.address,
    label: w.label,
    provider: w.provider,
    verified: w.verified,
    isPrimary: w.is_primary,
    verifiedAt: w.verified_at,
    createdAt: w.created_at,
  };
}

/* ----------------------------- metadata ----------------------------- */
router.get('/chains', authMiddleware, (req, res) => {
  const chains = web3.SUPPORTED_CHAINS.map((id) => {
    const c = web3.CHAINS[id];
    return { id: c.id, name: c.name, kind: c.kind, symbol: c.symbol, explorer: c.explorer };
  });
  res.json({ chains });
});

/* ----------------------------- connect ----------------------------- */
router.post('/connect', authMiddleware, requirePatient, async (req, res) => {
  try {
    const { chain, address, label, provider, makePrimary } = req.body || {};
    if (!chain || !address) return res.status(400).json({ error: 'chain and address are required' });
    if (!web3.SUPPORTED_CHAINS.includes(String(chain).toLowerCase()))
      return res.status(400).json({ error: 'Unsupported chain' });
    if (!web3.validateAddress(chain, address))
      return res.status(400).json({ error: 'Invalid address for the selected chain' });

    const norm = web3.normalizeAddress(chain, address);

    // first wallet for a user becomes primary automatically
    const countRes = await db.query('SELECT COUNT(*)::int AS c FROM wallet_addresses WHERE user_id=$1', [req.user.userId]);
    const isFirst = countRes.rows[0].c === 0;
    const wantPrimary = makePrimary === true || isFirst;

    if (wantPrimary) {
      await db.query('UPDATE wallet_addresses SET is_primary=FALSE WHERE user_id=$1', [req.user.userId]);
    }

    const ins = await db.query(
      `INSERT INTO wallet_addresses (user_id, chain, address, label, provider, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, chain, address)
       DO UPDATE SET label=EXCLUDED.label, provider=EXCLUDED.provider,
                     is_primary = wallet_addresses.is_primary OR EXCLUDED.is_primary,
                     updated_at=now()
       RETURNING *`,
      [req.user.userId, String(chain).toLowerCase(), norm, label || null, provider || 'manual', wantPrimary]
    );

    await audit({
      actorId: req.user.userId, action: 'wallet.connect', resourceType: 'wallet_address',
      resourceId: ins.rows[0].id, newValues: { chain, address: norm, provider }, ip: clientIp(req),
    });

    res.status(201).json({ wallet: shapeWallet(ins.rows[0]) });
  } catch (err) { console.error('wallet/connect', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- list ----------------------------- */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      'SELECT * FROM wallet_addresses WHERE user_id=$1 ORDER BY is_primary DESC, created_at ASC',
      [req.user.userId]
    );
    res.json({ wallets: r.rows.map(shapeWallet) });
  } catch (err) { console.error('wallet/me', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- disconnect ----------------------------- */
router.put('/disconnect', authMiddleware, requirePatient, async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'wallet id is required' });
    const existing = await db.query('SELECT * FROM wallet_addresses WHERE id=$1 AND user_id=$2', [id, req.user.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Wallet not found' });

    await db.query('DELETE FROM wallet_addresses WHERE id=$1 AND user_id=$2', [id, req.user.userId]);

    // if we removed the primary, promote the oldest remaining wallet
    if (existing.rows[0].is_primary) {
      await db.query(
        `UPDATE wallet_addresses SET is_primary=TRUE
          WHERE id = (SELECT id FROM wallet_addresses WHERE user_id=$1 ORDER BY created_at ASC LIMIT 1)`,
        [req.user.userId]
      );
    }

    await audit({
      actorId: req.user.userId, action: 'wallet.disconnect', resourceType: 'wallet_address',
      resourceId: id, oldValues: { chain: existing.rows[0].chain, address: existing.rows[0].address }, ip: clientIp(req),
    });

    res.json({ ok: true });
  } catch (err) { console.error('wallet/disconnect', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- set primary ----------------------------- */
router.put('/primary', authMiddleware, requirePatient, async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'wallet id is required' });
    const existing = await db.query('SELECT id FROM wallet_addresses WHERE id=$1 AND user_id=$2', [id, req.user.userId]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Wallet not found' });
    await db.query('UPDATE wallet_addresses SET is_primary=FALSE WHERE user_id=$1', [req.user.userId]);
    const upd = await db.query('UPDATE wallet_addresses SET is_primary=TRUE, updated_at=now() WHERE id=$1 RETURNING *', [id]);
    res.json({ wallet: shapeWallet(upd.rows[0]) });
  } catch (err) { console.error('wallet/primary', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- SIWE nonce ----------------------------- */
router.get('/nonce', authMiddleware, requirePatient, async (req, res) => {
  try {
    const address = req.query.address ? String(req.query.address).toLowerCase() : null;
    if (!address) return res.status(400).json({ error: 'address is required' });
    sweepNonces();
    const nonce = crypto.randomBytes(16).toString('hex');
    nonceStore.set(nonceKey(req.user.userId, address), { nonce, expiresAt: Date.now() + NONCE_TTL_MS });
    const message = web3.buildSiweMessage({ address, nonce });
    res.json({ nonce, message });
  } catch (err) { console.error('wallet/nonce', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- verify signature ----------------------------- */
router.post('/verify-signature', authMiddleware, requirePatient, async (req, res) => {
  try {
    const { chain = 'ethereum', address, message, signature, walletId } = req.body || {};
    if (!address || !message || !signature)
      return res.status(400).json({ error: 'address, message and signature are required' });

    const c = web3.getChain(chain);
    if (c.kind !== 'evm') return res.status(400).json({ error: 'Signature verification is supported for EVM chains only' });

    // Replay protection: the nonce must be one we issued to this user+address,
    // still valid, present in the signed message, and consumed exactly once.
    const key = nonceKey(req.user.userId, address);
    const stored = nonceStore.get(key);
    if (!stored || Date.now() > stored.expiresAt) {
      nonceStore.delete(key);
      return res.status(401).json({ verified: false, error: 'Nonce expired or not found. Request a new one.' });
    }
    if (!String(message).includes(stored.nonce)) {
      return res.status(401).json({ verified: false, error: 'Invalid nonce in signed message.' });
    }
    // Consume the nonce (single use) regardless of signature outcome below.
    nonceStore.delete(key);

    const ok = web3.verifyEvmSignature(message, signature, address);
    if (!ok) {
      await audit({
        actorId: req.user.userId, action: 'wallet.verify', resourceType: 'wallet_address',
        resourceId: walletId || null, result: 'failure', reason: 'signature mismatch', ip: clientIp(req),
      });
      return res.status(401).json({ verified: false, error: 'Signature does not match address' });
    }

    const norm = web3.normalizeAddress(chain, address);
    const upd = await db.query(
      `UPDATE wallet_addresses SET verified=TRUE, verified_at=now(), updated_at=now()
        WHERE user_id=$1 AND chain=$2 AND address=$3 RETURNING *`,
      [req.user.userId, String(chain).toLowerCase(), norm]
    );

    await audit({
      actorId: req.user.userId, action: 'wallet.verify', resourceType: 'wallet_address',
      resourceId: upd.rows[0]?.id || walletId || null, newValues: { chain, address: norm }, ip: clientIp(req),
    });

    res.json({ verified: true, wallet: upd.rows[0] ? shapeWallet(upd.rows[0]) : null });
  } catch (err) { console.error('wallet/verify-signature', err); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------- balance proxy ----------------------------- */
router.get('/balance/:chain/:address', authMiddleware, async (req, res) => {
  try {
    const { chain, address } = req.params;
    if (!web3.SUPPORTED_CHAINS.includes(String(chain).toLowerCase()))
      return res.status(400).json({ error: 'Unsupported chain' });
    if (!web3.validateAddress(chain, address))
      return res.status(400).json({ error: 'Invalid address' });
    const balance = await web3.getBalance(chain, address);
    res.json({ balance });
  } catch (err) {
    console.error('wallet/balance', err.message);
    res.status(502).json({ error: 'Could not fetch balance', detail: err.message });
  }
});

/* ----------------------------- transactions proxy ----------------------------- */
router.get('/transactions/:chain/:address', authMiddleware, async (req, res) => {
  try {
    const { chain, address } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    if (!web3.SUPPORTED_CHAINS.includes(String(chain).toLowerCase()))
      return res.status(400).json({ error: 'Unsupported chain' });
    if (!web3.validateAddress(chain, address))
      return res.status(400).json({ error: 'Invalid address' });
    const data = await web3.getTransactions(chain, address, limit);
    res.json(data);
  } catch (err) {
    console.error('wallet/transactions', err.message);
    res.status(502).json({ error: 'Could not fetch transactions', detail: err.message });
  }
});

module.exports = router;

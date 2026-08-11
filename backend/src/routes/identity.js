'use strict';
/**
 * identity.js — Solaris ID endpoints (ADR 001). Mounted at /api/identity.
 *
 * GET /api/identity/me           — plain-language identity summary
 *                                  (Solaris ID, bindings, GPS end address,
 *                                  agent authority state).
 * PUT /api/identity/me/end-address — set/reset the GPS end address on the
 *                                  subject (Lightning-address shape;
 *                                  configuration only — simulated, no real
 *                                  payments).
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const identity = require('../lib/identity');
const { isValidNpub, npubToHex } = require('../lib/nostr');
const { createChallenge, consumeAndVerify } = require('../lib/nostr-challenges');

const router = express.Router();

// POST /api/identity/nostr/bind-challenge — step 1 of proof-of-control binding
// (blocker #2). The authenticated owner requests a short-lived BIND challenge
// scoped to their subject. The device signs the returned canonical message
// locally with its nsec (never sent to Solaris); the signature is submitted to
// POST /nostr. A LOGIN signature can never satisfy a BIND consume.
router.post('/nostr/bind-challenge', authMiddleware, async (req, res) => {
  try {
    const npub = String(req.body?.npub || '').trim();
    if (!isValidNpub(npub)) {
      return res.status(400).json({ error: 'A valid Identity Key (npub1…) is required.' });
    }
    const subject = await identity.ensureSubjectForUser(req.user.userId);
    if (!subject) return res.status(404).json({ error: 'Identity not found' });

    const { challengeId, nonce, message, expiresInMs } = await createChallenge({
      npub,
      pubkeyHex: npubToHex(npub),
      purpose: 'bind',
      subjectId: subject.subject_id,
      userId: req.user.userId,
    });
    res.json({ challengeId, nonce, message, expiresInMs });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[identity] POST /nostr/bind-challenge failed:', err.message);
    res.status(status).json({ error: err.message || 'Failed to start Identity Key binding' });
  }
});

// POST /api/identity/nostr — step 2: bind the member's Identity Key (Nostr npub)
// AFTER proving control of the key (blocker #2). Body:
//   { npub, challengeId, nonce, signature, handle? }
// The server atomically consumes the BIND challenge, verifies the signature
// against the npub, confirms the challenge was scoped to THIS authenticated
// subject/user, then binds. Solaris stores ONLY the public key (never the nsec
// or mnemonic — those stay on the member's device). A2 §3.2.
router.post('/nostr', authMiddleware, async (req, res) => {
  try {
    const npub = String(req.body?.npub || '').trim();
    const challengeId = String(req.body?.challengeId || '').trim();
    const nonce = String(req.body?.nonce || '').trim();
    const signature = String(req.body?.signature || req.body?.sig || '').trim();
    const handle = req.body?.handle ? String(req.body.handle).trim() : null;
    if (!isValidNpub(npub)) {
      return res.status(400).json({ error: 'A valid Identity Key (npub1…) is required.' });
    }
    if (!challengeId || !nonce || !signature) {
      return res.status(400).json({ error: 'A signed binding challenge (challengeId, nonce, signature) is required.' });
    }

    const subject = await identity.ensureSubjectForUser(req.user.userId);
    if (!subject) return res.status(404).json({ error: 'Identity not found' });

    // Proof-of-control: atomic single-use consume + signature verify, scoped to
    // this authenticated subject/user. The server never receives the nsec.
    await consumeAndVerify({
      challengeId, purpose: 'bind', npub, nonce, sig: signature,
      expectedSubjectId: subject.subject_id,
      expectedUserId: req.user.userId,
    });

    const pubkeyHex = npubToHex(npub);
    const result = await identity.bindNostrKey(req.user.userId, npub, pubkeyHex, handle);
    const summary = await identity.getIdentitySummary(req.user.userId);
    res.json({
      ok: true,
      identityKey: summary.identityKey,
      note: 'Your Identity Key is bound to your Solaris ID. Solaris never stores your secret key.',
      saved: result,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[identity] POST /nostr failed:', err.message);
    res.status(status).json({ error: err.message || 'Failed to bind Identity Key' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const summary = await identity.getIdentitySummary(req.user.userId);
    if (!summary) return res.status(404).json({ error: 'Identity not found' });
    res.json(summary);
  } catch (err) {
    console.error('[identity] GET /me failed:', err.message);
    res.status(500).json({ error: 'Failed to load identity' });
  }
});

router.put('/me/end-address', authMiddleware, async (req, res) => {
  try {
    const { address } = req.body || {};
    await identity.setGpsEndAddress(req.user.userId, address);
    const summary = await identity.getIdentitySummary(req.user.userId);
    res.json({
      ok: true,
      simulated: true,
      note: 'End address saved as configuration only. This showcase makes no real payments.',
      gps: summary.gps,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[identity] PUT /me/end-address failed:', err.message);
    res.status(status).json({ error: err.message || 'Failed to update end address' });
  }
});

module.exports = router;

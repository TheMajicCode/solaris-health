'use strict';
/**
 * Admin activation + TOTP-gated login routes — NODE E4J-RC1.2 item 2/3.
 *
 * Mounted at /api/admin/auth. There is NO public admin signup: every endpoint
 * operates on a pre-existing, server-side admin record. The flow is:
 *
 *   1. POST /activate        {token, password}
 *        -> consume single-use activation token, set password (atomic),
 *           require role=admin + verified email. Returns a SHORT-LIVED, SCOPED
 *           PRE-AUTH token (not a session) to carry the admin into enrollment.
 *   2. POST /totp/setup      (Bearer <preauth>)
 *        -> begin TOTP enrollment; returns otpauth URI + secret to the
 *           authenticated admin ONLY (never logged).
 *   3. POST /totp/confirm    (Bearer <preauth>) {code}
 *        -> verify a real TOTP code; only then is enrollment recorded.
 *   4. POST /login           {email, password, code}
 *        -> password + TOTP; only on success is a normal admin JWT issued,
 *           carrying amr:['pwd','totp'] so adminOnly accepts it.
 *   5. POST /recovery/revoke (Bearer admin session) 
 *        -> revoke the caller's outstanding activation tokens (lost-token prep).
 *
 * Errors are NEUTRAL (no account/token enumeration). No token, password, code,
 * or secret is ever logged.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const {
  generateToken,
  generatePreAuthToken,
  verifyPreAuthToken,
  authMiddleware,
} = require('../../middleware/auth');
const { adminOnly } = require('../../middleware/admin-only');
const {
  activateAdmin,
  adminSessionAllowed,
  revokeOutstandingTokens,
  checkLayeredActivationRateLimit,
} = require('../../lib/admin-activation-flow');
const {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  verifyTotpLogin,
} = require('../../lib/admin-mfa');
const { ensureSubjectForUser } = require('../../lib/identity');

const router = express.Router();

const ENROLL_SCOPE = 'admin_enroll';

/** Best-effort actor identifier (fingerprinted downstream, never stored raw). */
function actorOf(req) {
  return req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || null;
}

async function subjectRef(userId) {
  try { const s = await ensureSubjectForUser(userId); return s ? s.subject_id : null; }
  catch (_e) { return null; }
}

/** Extract + verify a scoped pre-auth token from the Authorization header. */
function preAuth(scope) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const claims = verifyPreAuthToken(h.slice(7), scope);
    if (!claims) return res.status(401).json({ error: 'Unauthorized' });
    req.preAuth = claims;
    next();
  };
}

// 1. Consume activation token + set password. Returns a scoped pre-auth token.
router.post('/activate', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const result = await activateAdmin({
      db, presentedToken: token, newPassword: password, actor: actorOf(req),
    });
    if (!result.ok) {
      // Neutral: do not distinguish bad token vs policy vs rate-limit to a client.
      const code = result.reason === 'rate_limited' ? 429 : 400;
      return res.status(code).json({ error: 'ACTIVATION_FAILED' });
    }
    // NO session is granted. Only a short-lived, scoped pre-auth token that can
    // do nothing except drive TOTP enrollment.
    const preauth = generatePreAuthToken(result.adminUserId, ENROLL_SCOPE);
    return res.json({ ok: true, mustEnrollSecondFactor: true, preAuthToken: preauth });
  } catch (err) {
    console.error('admin activate error');
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2. Begin TOTP enrollment (pre-auth required).
router.post('/totp/setup', preAuth(ENROLL_SCOPE), async (req, res) => {
  try {
    const r = await beginTotpEnrollment({ db, adminUserId: req.preAuth.userId, actor: actorOf(req) });
    if (!r.ok) return res.status(503).json({ error: 'MFA_UNAVAILABLE' });
    // Delivered over this authenticated response only; caller must not log it.
    return res.json({ ok: true, otpauthUri: r.otpauthUri, secret: r.secret });
  } catch (err) {
    console.error('admin totp setup error');
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3. Confirm TOTP enrollment with a real code (pre-auth required).
router.post('/totp/confirm', preAuth(ENROLL_SCOPE), async (req, res) => {
  try {
    const { code } = req.body || {};
    const r = await confirmTotpEnrollment({ db, adminUserId: req.preAuth.userId, code, actor: actorOf(req) });
    if (!r.ok) return res.status(400).json({ error: 'CONFIRM_FAILED' });
    return res.json({ ok: true, enrolled: true });
  } catch (err) {
    console.error('admin totp confirm error');
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4. Admin login: password + TOTP -> full admin JWT (amr:['pwd','totp']).
router.post('/login', async (req, res) => {
  try {
    const { email, password, code } = req.body || {};
    const actor = actorOf(req);
    // Layered rate limit before any credential work (neutral).
    const rl = await checkLayeredActivationRateLimit(db, { actor });
    if (rl.limited) return res.status(429).json({ error: 'ADMIN_LOGIN_FAILED' });

    if (!email || !password || !code) {
      return res.status(401).json({ error: 'ADMIN_LOGIN_FAILED' });
    }
    const { rows } = await db.query(
      `SELECT id, email, role, password_hash, must_change_password,
              admin_activated_at, admin_mfa_enrolled_at, admin_passkey_enrolled_at
         FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );
    const user = rows[0];
    // Constant-ish path: still run bcrypt on a dummy when user missing? Keep it
    // simple + neutral — every failure returns the same generic error.
    if (!user || user.role !== 'admin' || !user.password_hash) {
      return res.status(401).json({ error: 'ADMIN_LOGIN_FAILED' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'ADMIN_LOGIN_FAILED' });

    // Must be fully provisioned (activated, password set, a confirmed factor).
    const decision = adminSessionAllowed(user);
    if (!decision.allowed) return res.status(401).json({ error: 'ADMIN_LOGIN_FAILED' });

    // Verify the TOTP code (real, replay-protected).
    const totpOk = await verifyTotpLogin({ db, adminUserId: user.id, code, actor });
    if (!totpOk.ok) return res.status(401).json({ error: 'ADMIN_LOGIN_FAILED' });

    // Only now: a full admin session, tagged with the methods used.
    const token = generateToken(user.id, user.email, user.role, await subjectRef(user.id), {
      amr: ['pwd', 'totp'],
    });
    return res.json({ ok: true, token });
  } catch (err) {
    console.error('admin login error');
    return res.status(500).json({ error: 'Server error' });
  }
});

// 5. Recovery prep: an authenticated admin revokes their own outstanding
//    activation tokens (e.g. a leaked/lost token). Requires a full admin session.
router.post('/recovery/revoke', authMiddleware, adminOnly, async (req, res) => {
  try {
    const n = await revokeOutstandingTokens({ db, adminUserId: req.user.userId, actor: actorOf(req) });
    return res.json({ ok: true, revoked: n });
  } catch (err) {
    console.error('admin recovery error');
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

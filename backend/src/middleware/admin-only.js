/**
 * adminOnly — gate a route to FULLY-PROVISIONED administrators.
 * Must be chained AFTER authMiddleware so req.user + req.user.canonical are set.
 *
 * A JWT role claim alone is NOT sufficient (RC1.2 defect fix): we require the
 * canonical, DB-sourced admin state loaded by authMiddleware AND proof that the
 * session was established with a second factor (amr includes 'totp'). This means
 * a token minted anywhere other than the real admin TOTP login path — including
 * a stale or forged role=admin claim — cannot reach an admin route.
 */
const { adminSessionAllowed } = require('../lib/admin-activation-flow');

function adminOnly(req, res, next) {
  const c = req.user && req.user.canonical;
  if (!c) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  // Fail-closed on live DB state: role=admin + activated + password set +
  // a confirmed second factor.
  const decision = adminSessionAllowed(c);
  if (!decision.allowed) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  // The session itself must have been raised with TOTP. Pre-auth tokens carry
  // no amr and are already rejected by authMiddleware; a normal (password-only)
  // JWT lacks amr:'totp' and is refused here.
  const amr = Array.isArray(req.user.amr) ? req.user.amr : [];
  if (!amr.includes('totp')) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

module.exports = { adminOnly };

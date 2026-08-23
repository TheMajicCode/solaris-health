const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

// Fail fast: refuse to run without a real signing secret (no insecure fallback).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

// Short-lived, scoped pre-auth tokens: used ONLY to carry an admin between the
// steps of activation/second-factor enrollment. They can NEVER stand in for a
// real session (authMiddleware and adminOnly reject typ==='preauth').
const PREAUTH_TTL = '10m';

function generateToken(userId, email, role, subjectId = null, opts = {}) {
  // jti = unique per token, lets us revoke individual sessions (Gate 6).
  // sub = the permanent Solaris subject id (public_ref) per A2 §1.2 step 5;
  // the internal user id stays in the claim set for compatibility.
  const jti = crypto.randomUUID();
  const claims = { userId, email, role, jti };
  if (subjectId) claims.sub = subjectId;
  // amr = authentication methods references (e.g. ['pwd','totp']). An admin
  // session JWT is only ever minted with amr including 'totp'; adminOnly
  // enforces that, so a password-only path can never yield admin authority.
  if (opts.amr) claims.amr = opts.amr;
  return jwt.sign(claims, JWT_SECRET, { expiresIn: opts.expiresIn || '7d' });
}

/**
 * Mint a short-lived, scoped pre-auth token. Carries NO role and is marked
 * typ='preauth' so it is rejected everywhere a real session is required. Used
 * to bind the steps of admin activation / TOTP enrollment together.
 */
function generatePreAuthToken(userId, scope) {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, scope, typ: 'preauth', jti }, JWT_SECRET, { expiresIn: PREAUTH_TTL });
}

/** Verify a pre-auth token for an expected scope. Returns claims or null. */
function verifyPreAuthToken(token, expectedScope) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.typ !== 'preauth') return null;
    if (expectedScope && decoded.scope !== expectedScope) return null;
    return decoded;
  } catch (_err) {
    return null;
  }
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Pre-auth tokens are NOT sessions — they may only be used by the dedicated
  // activation/enrollment routes (which call verifyPreAuthToken directly).
  if (decoded.typ === 'preauth') {
    return res.status(401).json({ error: 'TOKEN_REQUIRES_RELOGIN' });
  }

  // Fail closed: tokens without jti cannot be revocation-checked — require re-login.
  if (!decoded.jti) {
    return res.status(401).json({ error: 'TOKEN_REQUIRES_RELOGIN' });
  }

  let canonical;
  try {
    // One round-trip: load the canonical user AND the revocation state. The
    // canonical row is the source of truth — the JWT claims are only a hint.
    const { rows } = await db.query(
      `SELECT u.id, u.role, u.deleted_at, u.tokens_valid_after,
              u.must_change_password, u.admin_activated_at,
              u.admin_mfa_enrolled_at, u.admin_passkey_enrolled_at,
              (SELECT 1 FROM revoked_tokens WHERE jti = $2 LIMIT 1) AS revoked
         FROM users u
        WHERE u.id = $1`,
      [decoded.userId, decoded.jti]
    );
    canonical = rows[0];

    // Deleted / disabled / unknown account → reject (deleted_at is the only
    // "disabled" signal on users).
    if (!canonical || canonical.deleted_at) {
      return res.status(401).json({ error: 'Session expired — please log in again.' });
    }
    // Individually revoked session (jti in revoked_tokens).
    if (canonical.revoked) {
      return res.status(401).json({ error: 'Session expired — please log in again.' });
    }
    // Per-account invalidation: any token issued before the cut-off is dead for
    // THIS user only. Password rotation != session revocation — this is the
    // latter, and it never touches other accounts. Requires iat on the token.
    if (canonical.tokens_valid_after) {
      const iatMs = typeof decoded.iat === 'number' ? decoded.iat * 1000 : null;
      if (iatMs == null || iatMs < new Date(canonical.tokens_valid_after).getTime()) {
        return res.status(401).json({ error: 'Session expired — please log in again.' });
      }
    }
    // Role-mismatch: a token minted for a role the account no longer holds
    // (e.g. an admin demoted, or a stale elevated token) is refused.
    if (decoded.role !== canonical.role) {
      return res.status(401).json({ error: 'Session expired — please log in again.' });
    }
  } catch (_err) {
    // Fail closed: store unavailable → deny, never pass through.
    return res.status(503).json({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
  }

  req.user = decoded;
  // Attach the canonical, DB-sourced state so downstream authz (adminOnly) can
  // make decisions on live state rather than trusting the JWT alone. Keeps
  // adminOnly synchronous (no extra query).
  req.user.canonical = {
    id: canonical.id,
    role: canonical.role,
    deleted_at: canonical.deleted_at,
    must_change_password: canonical.must_change_password,
    admin_activated_at: canonical.admin_activated_at,
    admin_mfa_enrolled_at: canonical.admin_mfa_enrolled_at,
    admin_passkey_enrolled_at: canonical.admin_passkey_enrolled_at,
  };
  next();
}

module.exports = {
  generateToken,
  generatePreAuthToken,
  verifyPreAuthToken,
  verifyToken,
  authMiddleware,
  PREAUTH_TTL,
};

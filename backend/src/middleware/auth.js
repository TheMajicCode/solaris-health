const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

// Fail fast: refuse to run without a real signing secret (no insecure fallback).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

function generateToken(userId, email, role, subjectId = null) {
  // jti = unique per token, lets us revoke individual sessions (Gate 6).
  // sub = the permanent Solaris subject id (public_ref) per A2 §1.2 step 5;
  // the internal user id stays in the claim set for compatibility.
  const jti = crypto.randomUUID();
  const claims = { userId, email, role, jti };
  if (subjectId) claims.sub = subjectId;
  return jwt.sign(claims, JWT_SECRET, { expiresIn: '7d' });
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

  // Fail closed: tokens without jti cannot be revocation-checked — require re-login.
  if (!decoded.jti) {
    return res.status(401).json({ error: 'TOKEN_REQUIRES_RELOGIN' });
  }
  try {
    const revoked = await db.query(
      'SELECT id FROM revoked_tokens WHERE jti = $1',
      [decoded.jti]
    );
    if (revoked.rows.length > 0) {
      return res.status(401).json({ error: 'Session expired — please log in again.' });
    }
  } catch (_err) {
    // Fail closed: store unavailable → deny, never pass through.
    return res.status(503).json({ error: 'SESSION_VALIDATION_UNAVAILABLE' });
  }

  req.user = decoded;
  next();
}

module.exports = { generateToken, verifyToken, authMiddleware };

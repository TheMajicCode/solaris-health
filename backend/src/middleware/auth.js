const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');

// Fail fast: refuse to run without a real signing secret (no insecure fallback).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

function generateToken(userId, email, role) {
  // jti = unique per token, lets us revoke individual sessions (Gate 6).
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, email, role, jti }, JWT_SECRET, { expiresIn: '7d' });
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

  // Revocation check (skip if jti absent — older token format).
  if (decoded.jti) {
    try {
      const revoked = await db.query(
        'SELECT id FROM revoked_tokens WHERE jti = $1',
        [decoded.jti]
      );
      if (revoked.rows.length > 0) {
        return res.status(401).json({ error: 'Session expired — please log in again.' });
      }
    } catch (err) {
      // Fail OPEN: if the revocation check itself fails (e.g. DB down), allow the
      // request through. Locking out every user during a DB blip is worse than
      // briefly honouring a token that may have been revoked.
      console.warn('Token revocation check failed:', err.message);
    }
  }

  req.user = decoded;
  next();
}

module.exports = { generateToken, verifyToken, authMiddleware };

/**
 * Rate limiting for the Solaris API.
 *
 * Design goals (post-mortem of the "Too many requests — please slow down." bug):
 *   - Each REAL client gets its own bucket. Requires `app.set('trust proxy', 2)`
 *     in server.js so `req.ip` resolves through cloud proxy + nginx correctly.
 *   - Normal human usage must NEVER hit a limit; brute force must.
 *   - Login is keyed per IP + email and only counts FAILED attempts
 *     (skipSuccessfulRequests), so a member logging in/out all day is unaffected
 *     while password guessing against one account from one IP is capped.
 *   - Uses the library's ipKeyGenerator helper so IPv6 clients are bucketed by
 *     /56 subnet (prevents trivial IPv6 rotation bypass + silences
 *     ERR_ERL_KEY_GEN_IPV6 validation errors).
 *   - Every 429 carries a Retry-After header (standardHeaders) and a plain,
 *     friendly message with minutes remaining.
 *   - All state lives in the default in-memory MemoryStore: it is wiped on every
 *     deploy/restart by construction. No lockout state is persisted anywhere.
 *
 * Env overrides (load testing / bigger deployments):
 *   RATE_LIMIT_MAX        — global requests / 15 min / IP        (default 2000)
 *   AUTH_RATE_LIMIT_MAX   — failed logins / 15 min / IP+email    (default 10)
 *   REGISTER_RATE_LIMIT_MAX — registrations / 15 min / IP        (default 20)
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;

/** Client IP normalized for keying (IPv6 → /56 subnet). */
function clientIpKey(req) {
  return ipKeyGenerator(req.ip || '');
}

/** Friendly 429 handler with an accurate Retry-After. */
function make429Handler(message) {
  return (req, res) => {
    const resetTime = req.rateLimit && req.rateLimit.resetTime;
    const seconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(WINDOW_MS / 1000);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      error: message.replace('{minutes}', String(minutes)),
      retryAfterSeconds: seconds,
    });
  };
}

/**
 * Global safety net: 2000 requests / 15 min per client IP (~2.2 req/s sustained).
 * The SPA polls + navigates at roughly 1 req/s at its busiest, so real users
 * stay far below this; scripted floods do not.
 */
function makeGlobalLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    max: parseInt(process.env.RATE_LIMIT_MAX || '2000', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientIpKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: make429Handler(
      'Too many requests from your connection — please try again in about {minutes} minute(s).'
    ),
  });
}

/**
 * Login: 10 FAILED attempts / 15 min per IP+email pair.
 * - Successful logins never count (skipSuccessfulRequests), so a normal login
 *   flow can never trigger this — only repeated wrong passwords.
 * - Keying on IP+email means one attacker can't lock out a whole office NAT,
 *   and one shared account can't be locked from everywhere by one bad actor.
 */
function makeLoginLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const email = String((req.body && req.body.email) || '')
        .trim()
        .toLowerCase();
      return `${clientIpKey(req)}|${email}`;
    },
    skip: (req) => req.method === 'OPTIONS',
    handler: make429Handler(
      'Too many failed sign-in attempts for this account — please wait about {minutes} minute(s) and try again.'
    ),
  });
}

/** Registration: 20 / 15 min per IP (bulk signup abuse guard). */
function makeRegisterLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || '20', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: clientIpKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: make429Handler(
      'Too many sign-up attempts — please try again in about {minutes} minute(s).'
    ),
  });
}

module.exports = { makeGlobalLimiter, makeLoginLimiter, makeRegisterLimiter, clientIpKey, WINDOW_MS };

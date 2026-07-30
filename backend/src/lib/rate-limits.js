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
 *   - Security-sensitive lockouts (login, registration) are backed by a
 *     Postgres store (`rate_limit_hits`, migration 033) so a brute-force
 *     attacker CANNOT reset an account's failed-attempt count by waiting for /
 *     forcing a redeploy. The state survives restarts. The global flood-guard
 *     limiter stays in the in-memory MemoryStore — it is pure abuse throttling,
 *     so resetting it on restart is harmless and avoids a DB round-trip on
 *     literally every request.
 *
 * Env overrides (load testing / bigger deployments):
 *   RATE_LIMIT_MAX        — global requests / 15 min / IP        (default 2000)
 *   AUTH_RATE_LIMIT_MAX   — failed logins / 15 min / IP+email    (default 10)
 *   REGISTER_RATE_LIMIT_MAX — registrations / 15 min / IP        (default 20)
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const db = require('../db');

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Postgres-backed store for express-rate-limit (v8 Store interface).
 *
 * Buckets are keyed rows in `rate_limit_hits`; each row holds the hit count and
 * the window's `reset_at`. A hit after `reset_at` rolls the window over (hits=1,
 * new reset_at). Because express-rate-limit calls `increment()` on every request
 * and then `decrement()` when `skipSuccessfulRequests` and the response succeeded,
 * only FAILED attempts accumulate — the exact same failed-attempts-only semantics
 * the MemoryStore gave us, now durable across restarts.
 *
 * `prefix` namespaces the keys so the login and register limiters never collide.
 */
class PostgresRateLimitStore {
  constructor({ prefix }) {
    this.prefix = prefix || 'rl';
    this.windowMs = WINDOW_MS;
  }

  // express-rate-limit calls this once with the limiter's resolved options.
  init(options) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  _k(key) { return `${this.prefix}|${key}`; }

  async increment(key) {
    const intervalMs = this.windowMs;
    // Single atomic upsert: fresh window OR roll-over when expired OR +1 within window.
    const { rows } = await db.query(
      `INSERT INTO rate_limit_hits (key, hits, reset_at)
         VALUES ($1, 1, now() + ($2::bigint * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limit_hits.reset_at <= now() THEN 1
                     ELSE rate_limit_hits.hits + 1 END,
         reset_at = CASE WHEN rate_limit_hits.reset_at <= now()
                         THEN now() + ($2::bigint * interval '1 millisecond')
                         ELSE rate_limit_hits.reset_at END
       RETURNING hits, reset_at`,
      [this._k(key), intervalMs]
    );
    const row = rows[0];
    return { totalHits: row.hits, resetTime: new Date(row.reset_at) };
  }

  async decrement(key) {
    // Only walk back a live window — never resurrect an expired bucket.
    await db.query(
      `UPDATE rate_limit_hits
          SET hits = GREATEST(0, hits - 1)
        WHERE key = $1 AND reset_at > now()`,
      [this._k(key)]
    );
  }

  async resetKey(key) {
    await db.query('DELETE FROM rate_limit_hits WHERE key = $1', [this._k(key)]);
  }

  async resetAll() {
    await db.query('DELETE FROM rate_limit_hits WHERE key LIKE $1', [`${this.prefix}|%`]);
  }
}

/**
 * Build the durable store for the security-sensitive limiters.
 *
 * Under the test runner we fall back to the library's in-memory MemoryStore:
 * a persistent Postgres store would carry failed-attempt counts across test
 * runs (and across parallel suites hitting the same DB), producing spurious
 * 429s. Production/dev keep the Postgres store so lockouts survive restarts.
 * Override with RATE_LIMIT_STORE=memory|postgres.
 */
function makeSecurityStore(prefix) {
  const mode =
    process.env.RATE_LIMIT_STORE ||
    (process.env.NODE_ENV === 'test' ? 'memory' : 'postgres');
  if (mode === 'memory') return undefined; // undefined => library default MemoryStore
  return new PostgresRateLimitStore({ prefix });
}

/** Best-effort sweep of expired buckets (call from a cron; safe to skip). */
async function sweepExpiredRateLimits() {
  try { await db.query('DELETE FROM rate_limit_hits WHERE reset_at <= now()'); }
  catch (e) { /* non-fatal */ }
}

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
  const store = makeSecurityStore('login');
  return rateLimit({
    windowMs: WINDOW_MS,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    ...(store ? { store } : {}),
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
  const store = makeSecurityStore('register');
  return rateLimit({
    windowMs: WINDOW_MS,
    max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || '20', 10),
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    ...(store ? { store } : {}),
    keyGenerator: clientIpKey,
    skip: (req) => req.method === 'OPTIONS',
    handler: make429Handler(
      'Too many sign-up attempts — please try again in about {minutes} minute(s).'
    ),
  });
}

module.exports = {
  makeGlobalLimiter,
  makeLoginLimiter,
  makeRegisterLimiter,
  clientIpKey,
  WINDOW_MS,
  PostgresRateLimitStore,
  sweepExpiredRateLimits,
};

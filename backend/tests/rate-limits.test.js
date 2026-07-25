/**
 * Rate limiter tests (login rate-limit bug fix).
 *
 * Verifies:
 *  1. Login limiter keys on IP + email — different clients / different accounts
 *     get independent buckets (the root cause of the production bug was one
 *     shared bucket for everyone behind the proxy).
 *  2. Successful logins never count toward the limit — a normal login flow
 *     can never trigger 429.
 *  3. Repeated FAILED logins for one IP+email pair are capped, respond 429
 *     with a Retry-After header and a friendly message.
 *  4. Global limiter allows a realistic SPA burst without 429.
 *  5. IPv6 addresses are keyed by subnet via ipKeyGenerator (no validation
 *     errors, no per-address bypass).
 */
const express = require('express');
const request = require('supertest');
const { makeGlobalLimiter, makeLoginLimiter, clientIpKey } = require('../src/lib/rate-limits');

/** Minimal app that mirrors server.js middleware order (json before login limiter). */
function makeApp({ failEmails = ['bad@x.com'] } = {}) {
  const app = express();
  app.set('trust proxy', 2);
  app.use(express.json());
  app.use('/api/auth/login', makeLoginLimiter());
  app.post('/api/auth/login', (req, res) => {
    if (failEmails.includes(req.body.email)) return res.status(401).json({ error: 'Invalid credentials' });
    return res.json({ token: 'ok' });
  });
  return app;
}

// Simulate the production chain: XFF = "<client>, <cloud-proxy>"; supertest's
// socket is the innermost hop. With trust proxy 2, req.ip = <client>.
const asClient = (ip) => ({ 'X-Forwarded-For': `${ip}, 10.51.8.1` });

describe('login limiter keying + thresholds', () => {
  const LIMIT = 10; // default AUTH_RATE_LIMIT_MAX

  it('caps repeated FAILED logins per IP+email with 429 + Retry-After', async () => {
    const app = makeApp();
    let last;
    for (let i = 0; i < LIMIT; i++) {
      last = await request(app).post('/api/auth/login')
        .set(asClient('203.0.113.7'))
        .send({ email: 'bad@x.com', password: 'nope' });
      expect(last.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login')
      .set(asClient('203.0.113.7'))
      .send({ email: 'bad@x.com', password: 'nope' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.error).toMatch(/failed sign-in/i);
  });

  it('a DIFFERENT client IP still logs in after another IP is blocked (independent buckets)', async () => {
    const app = makeApp();
    for (let i = 0; i <= LIMIT; i++) {
      await request(app).post('/api/auth/login')
        .set(asClient('203.0.113.7'))
        .send({ email: 'bad@x.com', password: 'nope' });
    }
    const other = await request(app).post('/api/auth/login')
      .set(asClient('198.51.100.9'))
      .send({ email: 'bad@x.com', password: 'nope' });
    expect(other.status).toBe(401); // wrong password, but NOT rate-limited
  });

  it('a DIFFERENT email from the same IP is not blocked (per-account buckets)', async () => {
    const app = makeApp();
    for (let i = 0; i <= LIMIT; i++) {
      await request(app).post('/api/auth/login')
        .set(asClient('203.0.113.7'))
        .send({ email: 'bad@x.com', password: 'nope' });
    }
    const other = await request(app).post('/api/auth/login')
      .set(asClient('203.0.113.7'))
      .send({ email: 'good@x.com', password: 'right' });
    expect(other.status).toBe(200);
  });

  it('successful logins NEVER count — 50 normal logins in a row all succeed', async () => {
    const app = makeApp();
    for (let i = 0; i < 50; i++) {
      const res = await request(app).post('/api/auth/login')
        .set(asClient('203.0.113.7'))
        .send({ email: 'good@x.com', password: 'right' });
      expect(res.status).toBe(200);
    }
  });
});

describe('global limiter', () => {
  it('allows a realistic SPA burst (300 requests) without 429', async () => {
    const app = express();
    app.set('trust proxy', 2);
    app.use(makeGlobalLimiter());
    app.get('/api/ping', (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 300; i++) {
      const res = await request(app).get('/api/ping').set(asClient('203.0.113.7'));
      expect(res.status).toBe(200);
    }
  });
});

describe('IPv6 keying', () => {
  it('buckets IPv6 clients by subnet without throwing', () => {
    const key = clientIpKey({ ip: '2001:db8:85a3:8d3:1319:8a2e:370:7348' });
    expect(typeof key).toBe('string');
    expect(key).toContain('/'); // subnet form, not the raw per-device address
  });

  it('passes IPv4 through unchanged', () => {
    expect(clientIpKey({ ip: '203.0.113.7' })).toBe('203.0.113.7');
  });
});

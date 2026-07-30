const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const credentialsRoutes = require('./routes/credentials');
const agentsRoutes = require('./routes/agents');
const contributionsRoutes = require('./routes/contributions');
const assessmentRoutes = require('./routes/assessment');
const listingsRoutes = require('./routes/listings');
const journeyRoutes = require('./routes/journey');
const journeysRoutes = require('./routes/journeys');
const lucaRoutes = require('./routes/luca');
const practitionerRoutes = require('./routes/practitioner');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');
const timelineRoutes = require('./routes/timeline');
const trendsRoutes = require('./routes/trends');
const walletRoutes = require('./routes/wallet');
const messagesRoutes = require('./routes/messages');
const marketplaceRoutes = require('./routes/marketplace');
const providerApplicationRoutes = require('./routes/provider-application');
const adminProvidersRoutes = require('./routes/admin/providers');
const adminInviteRoutes = require('./routes/admin/invite');
const notificationsRoutes = require('./routes/notifications');
const bookingsRoutes = require('./routes/bookings');
const providerAvailabilityRoutes = require('./routes/provider/availability');
const providerBookingsRoutes = require('./routes/provider/bookings');
const providerEarningsRoutes = require('./routes/provider/earnings');
const passportRoutes = require('./routes/passport');
const identityRoutes = require('./routes/identity');
const adminBookingsRoutes = require('./routes/admin/bookings');
const gpsRoutes = require('./routes/gps');
// --- Solaris sprint routes ---
const organizationsRoutes = require('./routes/organizations');
const paymentsSimRoutes = require('./routes/payments-sim');
const paymentsRoutes = require('./routes/payments');
const lucaContextRoutes = require('./routes/luca-context');
const lucaRecommendationsRoutes = require('./routes/luca-recommendations');
const intelligenceRoutes = require('./routes/intelligence');
const leaderboardRoutes = require('./routes/leaderboard');
const contributionEventsRoutes = require('./routes/contribution-events');
const appointmentsRoutes = require('./routes/appointments');
const journalRoutes = require('./routes/journal');
const audioRoutes = require('./routes/audio');
const healthDocumentsRoutes = require('./routes/health-documents');
// --- Phase 2A: Practitioner journey ---
const lucaPractitionerRoutes = require('./routes/luca-practitioner');
const consentRoutes = require('./routes/consent');
const providerPatientsRoutes = require('./routes/provider/patients');
const publicRoutes = require('./routes/public');
const intakeRoutes = require('./routes/intake');

const app = express();
const PORT = process.env.PORT || 5000;
const START_TIME = Date.now();

// ---- Security middleware (Tier 1 hardening) ----
// Trust the reverse proxy chain so req.ip is the REAL client IP.
// Requests arrive as: client → cloud proxy (adds X-Forwarded-For: <client>)
//                            → host nginx  (appends its upstream addr)
//                            → this app    (socket peer = docker bridge).
// That is 2 proxy hops recorded in X-Forwarded-For, so trust exactly 2.
// (Verified empirically: XFF at nginx = "<real client ip>"; nginx appends one hop.)
// With fewer hops (local curl to :5000) Express falls back to the socket address.
app.set('trust proxy', 2);

// Security headers first.
app.use(helmet({
  contentSecurityPolicy: false, // relaxed here; tighten per-route/CSP in a later tier
  crossOriginEmbedderPolicy: false,
}));

// CORS — allowlist known origins only (comma-separated ALLOWED_ORIGINS env override).
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'https://solaris-health.abacusai.cloud,http://localhost:3000'
).split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin/non-browser requests (no Origin header) and allowlisted origins.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ---- Rate limiting (see backend/src/lib/rate-limits.js) ----
// Root-cause fix for the "Too many requests — please slow down." login bug:
//   1. trust proxy is now 2 (above) so req.ip is the REAL client IP — the old
//      custom keyGenerator read raw X-Forwarded-For and tripped IPv6 validation
//      (ERR_ERL_KEY_GEN_IPV6 in container logs), and the old trust level meant
//      shared buckets behind the proxy chain.
//   2. The global cap was 500 req/15 min — too low for the SPA (polling +
//      navigation is ~1 req/s), so a single active session could exhaust it and
//      then see the global limiter's message on login. Raised to 2000/15 min.
//   3. Login is now keyed per IP+email with 10 failed attempts / 15 min;
//      SUCCESSFUL logins never count, so normal use can never trigger it.
//   4. All limiter state is in-memory (MemoryStore) — it resets automatically
//      on every deploy/container restart; nothing is persisted.
const { makeGlobalLimiter, makeLoginLimiter, makeRegisterLimiter } = require('./lib/rate-limits');
app.use(makeGlobalLimiter());

app.use(express.json({ limit: '2mb' })); // base64 doc uploads (reduced from 15mb)

// Login/register limiters need the parsed body (login keys on IP+email), so
// they mount AFTER express.json.
app.use('/api/auth/login', makeLoginLimiter());
app.use('/api/auth/register', makeRegisterLimiter());

// ---- Incident write-freeze (READ_ONLY_MODE) ----
// When READ_ONLY_MODE=true (checked per-request so a container env change +
// restart is all that's needed), all mutating API requests are rejected with
// 503 while reads keep working. Login stays allowed so operators/members can
// still authenticate and inspect state during an incident.
// See docs/INCIDENT_RESPONSE.md — "Step 1: Freeze writes".
const READ_ONLY_ALLOWED_PATHS = new Set(['/api/auth/login', '/api/auth/logout']);
app.use((req, res, next) => {
  if (String(process.env.READ_ONLY_MODE).toLowerCase() !== 'true') return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (READ_ONLY_ALLOWED_PATHS.has(req.path)) return next();
  return res.status(503).json({
    error: 'Solaris is temporarily in read-only mode for maintenance. Your data is safe — please try again shortly.',
    readOnly: true,
  });
});

// ---- NIP-05 (Identity Key handles; M8, spec A2 §3.3) ----
// GET /.well-known/nostr.json?name=<handle> -> { "names": { "<handle>": "<hex pubkey>" } }
// Resolves a member's `name@solaris.health` handle to their Nostr pubkey.
// Public + CORS-open per the NIP-05 spec. No PII beyond the public key.
app.get('/.well-known/nostr.json', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  try {
    const name = String(req.query.name || '').trim().toLowerCase();
    const names = {};
    const relays = {};
    if (name && /^[a-z0-9._-]{1,64}$/.test(name)) {
      const db = require('./db');
      const r = await db.query('SELECT pubkey_hex FROM nostr_handles WHERE handle=$1 LIMIT 1', [name]);
      if (r.rows.length) names[name] = r.rows[0].pubkey_hex;
    }
    res.json({ names, relays });
  } catch (err) {
    console.error('[nip05] nostr.json failed:', err.message);
    res.json({ names: {} });
  }
});

// GET /.well-known/lnurlp/<name> — Lightning Address (A2 §3.3/§3.4). Not yet
// configured: the identity handle doubles as a payment address, but this
// endpoint stays inert until real payment rails make it meaningful.
app.get('/.well-known/lnurlp/:name', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.status(404).json({
    status: 'ERROR',
    reason: 'Lightning Address not yet configured. Your handle works today for identity (NIP-05); '
      + 'payments are simulated in this pilot.',
  });
});

// ---- Health & monitoring ----
// Liveness probe (legacy path, kept for backwards compatibility)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Liveness + readiness probe (checks DB connectivity)
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    service: 'luca-passport-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    checks: { database: 'unknown' },
  };
  try {
    await db.query('SELECT 1');
    health.checks.database = 'ok';
    res.json(health);
  } catch (err) {
    health.status = 'degraded';
    health.checks.database = 'error';
    res.status(503).json(health);
  }
});

// Metrics endpoint. Defaults to Prometheus-style text for uptime scrapers, but
// returns a JSON operational summary (uptime, memory, live row counts) when the
// client asks for JSON via `?format=json` or an `Accept: application/json` header.
app.get('/api/metrics', async (req, res) => {
  const wantsJson = req.query.format === 'json' ||
    (req.headers.accept || '').includes('application/json');

  if (wantsJson) {
    try {
      const [userCount, checkinCount, bookingCount, messageCount] = await Promise.all([
        db.query('SELECT COUNT(*) FROM users'),
        db.query('SELECT COUNT(*) FROM daily_checkins'),
        db.query('SELECT COUNT(*) FROM booking_requests'),
        db.query('SELECT COUNT(*) FROM luca_messages'),
      ]);
      return res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        counts: {
          users: parseInt(userCount.rows[0].count, 10),
          checkins: parseInt(checkinCount.rows[0].count, 10),
          bookings: parseInt(bookingCount.rows[0].count, 10),
          luca_messages: parseInt(messageCount.rows[0].count, 10),
        },
      });
    } catch (err) {
      return res.status(500).json({ status: 'degraded', error: err.message });
    }
  }

  const mem = process.memoryUsage();
  let dbUp = 0;
  try { await db.query('SELECT 1'); dbUp = 1; } catch { dbUp = 0; }
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(
    [
      '# HELP luca_up Whether the service is up (always 1 when responding).',
      '# TYPE luca_up gauge',
      'luca_up 1',
      '# HELP luca_database_up Whether the database is reachable.',
      '# TYPE luca_database_up gauge',
      `luca_database_up ${dbUp}`,
      '# HELP luca_uptime_seconds Process uptime in seconds.',
      '# TYPE luca_uptime_seconds counter',
      `luca_uptime_seconds ${Math.floor((Date.now() - START_TIME) / 1000)}`,
      '# HELP luca_process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE luca_process_resident_memory_bytes gauge',
      `luca_process_resident_memory_bytes ${mem.rss}`,
      '# HELP luca_process_heap_used_bytes Heap memory used in bytes.',
      '# TYPE luca_process_heap_used_bytes gauge',
      `luca_process_heap_used_bytes ${mem.heapUsed}`,
    ].join('\n') + '\n'
  );
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/contributions', contributionsRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/journey', journeyRoutes);
app.use('/api/journeys', journeysRoutes);
app.use('/api/luca', lucaRoutes);
app.use('/api/luca', lucaPractitionerRoutes); // GET/POST /api/luca/practitioner/messages
app.use('/api/consent', consentRoutes);
app.use('/api/practitioner', practitionerRoutes);
app.use('/api/admin/invite', adminInviteRoutes);
app.use('/api/admin/providers', adminProvidersRoutes);
app.use('/api/admin/bookings', adminBookingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/trends', trendsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/provider/availability', providerAvailabilityRoutes);
app.use('/api/provider/bookings', providerBookingsRoutes);
app.use('/api/provider/patients', providerPatientsRoutes);
app.use('/api/provider/earnings', providerEarningsRoutes);
app.use('/api/provider', providerApplicationRoutes);
app.use('/api/passport', passportRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/gps', gpsRoutes);
// --- Solaris sprint routes ---
app.use('/api/organizations', organizationsRoutes);
app.use('/api/payments', paymentsRoutes); // M6: checkout/webhook/intents (unmatched fall through)
app.use('/api/payments', paymentsSimRoutes);
app.use('/api/luca', lucaContextRoutes); // GET /api/luca/context (luca.js handles /messages)
app.use('/api/luca', lucaRecommendationsRoutes); // GET /api/luca/recommendations
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/contribution-events', contributionEventsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/health-documents', healthDocumentsRoutes);
app.use('/api/public', publicRoutes); // public practitioner directory (no auth)
app.use('/api/intake', intakeRoutes); // new-patient intake forms + patient inbox
app.use('/api/intelligence', intelligenceRoutes); // Intelligence section (spec A3): natural/artificial/enhanced + source exclusions

// Structured error handler (must be the last middleware). Emits a single JSON
// log line per error so it can be parsed by log aggregators, and returns a safe
// message to the client (never leaks internals on 5xx).
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isOperational = status < 500; // 4xx = client/operational, 5xx = server fault
  console.error(JSON.stringify({
    level: isOperational ? 'warn' : 'error',
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    userId: req.user && req.user.userId,
  }));
  res.status(status).json({
    error: isOperational ? err.message : 'Something went wrong — our team has been notified.',
  });
});

// Only start the HTTP listener when run directly (not when imported by tests)
if (require.main === module) {
  // ---- Run pending database migrations on startup ----
  // node-pg-migrate is idempotent: already-applied migrations are skipped via
  // the pgmigrations bookkeeping table, so this is safe on every boot.
  // cwd is the backend root (__dirname is backend/src), where `migrations/` lives.
  const { execSync } = require('child_process');
  try {
    execSync('npm run migrate', {
      cwd: __dirname + '/..',
      stdio: 'inherit',
      env: process.env,
    });
    console.log('✓ Database migrations applied successfully');
  } catch (err) {
    // Do NOT exit — migrations may already be current, or the runner may be
    // unavailable in a minimal runtime. Log and continue serving.
    console.warn('Migration runner warning:', err.message);
  }

  // ---- Clean up expired revoked tokens on startup (Gate 6) ----
  // Rows for tokens that would have expired on their own are no longer useful.
  db.query('DELETE FROM revoked_tokens WHERE expires_at < NOW()')
    .then((r) => { if (r.rowCount > 0) console.log(`Cleaned ${r.rowCount} expired revoked tokens`); })
    .catch((err) => console.warn('Token cleanup warning:', err.message));

  // ---- Intake 48h reminders (spec A5) ----
  // Idempotent pass: gentle reminder for pending intakes whose booking is <48h
  // away and hasn't been reminded yet. Runs shortly after boot, then every 6h.
  const { sendIntakeReminders } = require('./lib/intake-messages');
  const runReminders = () => sendIntakeReminders()
    .then((n) => { if (n > 0) console.log(`[intake] sent ${n} intake reminder(s)`); })
    .catch((err) => console.warn('[intake] reminder pass warning:', err.message));
  setTimeout(runReminders, 30 * 1000).unref();
  setInterval(runReminders, 6 * 60 * 60 * 1000).unref();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ Digital Sovereign Passport Backend running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  });

  // ---- Graceful shutdown (SIGTERM/SIGINT) ----
  // Stop accepting new connections, drain in-flight requests, close the DB
  // pool, then exit. Forced exit after 10s if draining stalls.
  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await db.pool.end();
        console.log('Database pool closed. Goodbye.');
      } catch (err) {
        console.error('Error closing DB pool:', err.message);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

const express = require('express');
const cors = require('cors');
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
const adminBookingsRoutes = require('./routes/admin/bookings');
const gpsRoutes = require('./routes/gps');
// --- Solaris sprint routes ---
const organizationsRoutes = require('./routes/organizations');
const paymentsSimRoutes = require('./routes/payments-sim');
const lucaContextRoutes = require('./routes/luca-context');
const lucaRecommendationsRoutes = require('./routes/luca-recommendations');
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

const app = express();
const PORT = process.env.PORT || 5000;
const START_TIME = Date.now();

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' })); // allow base64 doc uploads

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

// Lightweight metrics endpoint for uptime monitoring (Prometheus-style text)
app.get('/api/metrics', async (req, res) => {
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
app.use('/api/provider', providerApplicationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/gps', gpsRoutes);
// --- Solaris sprint routes ---
app.use('/api/organizations', organizationsRoutes);
app.use('/api/payments', paymentsSimRoutes);
app.use('/api/luca', lucaContextRoutes); // GET /api/luca/context (luca.js handles /messages)
app.use('/api/luca', lucaRecommendationsRoutes); // GET /api/luca/recommendations
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/contribution-events', contributionEventsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/health-documents', healthDocumentsRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Only start the HTTP listener when run directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ LUCA Passport Backend running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV}`);
  });
}

module.exports = app;

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const credentialsRoutes = require('./routes/credentials');
const agentsRoutes = require('./routes/agents');
const contributionsRoutes = require('./routes/contributions');
const assessmentRoutes = require('./routes/assessment');
const listingsRoutes = require('./routes/listings');
const journeyRoutes = require('./routes/journey');
const lucaRoutes = require('./routes/luca');
const practitionerRoutes = require('./routes/practitioner');
const adminRoutes = require('./routes/admin');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' })); // allow base64 doc uploads

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.use('/api/luca', lucaRoutes);
app.use('/api/practitioner', practitionerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ LUCA Passport Backend running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV}`);
});

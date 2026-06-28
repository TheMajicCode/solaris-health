/**
 * Jest global setup for LUCA Passport backend tests.
 *
 * Loads environment variables from backend/.env (falling back to sane
 * development defaults) so that the app + database layer behave the same way
 * they do at runtime. Also exposes a few small helpers on `global` for
 * registering / cleaning up throwaway test users.
 */
const path = require('path');
const dotenv = require('dotenv');

// Load backend/.env if present (does not override already-set vars).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Fallback defaults so tests can run in a bare CI container too.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://luca_user:luca_prod_2026@localhost:5432/luca_passport';

/**
 * Generates a unique e-mail so parallel / repeated test runs never collide.
 */
global.uniqueEmail = (prefix = 'test') =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;

/**
 * Standard payload for registering a throwaway patient account.
 */
global.makeUserPayload = (overrides = {}) => ({
  email: global.uniqueEmail(),
  password: 'Test1234!',
  firstName: 'Test',
  lastName: 'User',
  role: 'patient',
  country: 'Testland',
  language: 'English',
  ...overrides,
});


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

/**
 * Mint a FULLY-PROVISIONED admin session for tests (NODE E4J-RC1.2).
 *
 * The RC1.2 containment model deliberately closes the old "register -> promote
 * to admin -> re-login via /api/auth/login" path: /api/auth/login now refuses
 * role=admin (USE_ADMIN_LOGIN), authMiddleware rejects a JWT whose role differs
 * from the canonical user, and adminOnly requires amr:['...','totp']. So tests
 * that need a working admin session must (a) put the user row into the provisioned
 * admin state and (b) mint a JWT carrying amr:['pwd','totp'] — exactly what the
 * real activation + TOTP login flow produces. This helper does both without
 * enrolling a real TOTP secret, so unrelated admin-route tests stay lightweight.
 *
 * Never used to bypass the containment tests themselves (which exercise the real
 * flow end to end); only to give pre-existing admin-route tests a valid session.
 */
global.makeAdminSession = async (userId, email) => {
  const db = require('../src/db');
  const { generateToken } = require('../src/middleware/auth');
  await db.query(
    `UPDATE users
        SET role = 'admin',
            must_change_password = false,
            admin_activated_at = COALESCE(admin_activated_at, NOW()),
            admin_mfa_enrolled_at = COALESCE(admin_mfa_enrolled_at, NOW())
      WHERE id = $1`,
    [userId]
  );
  return generateToken(userId, email, 'admin', null, { amr: ['pwd', 'totp'] });
};


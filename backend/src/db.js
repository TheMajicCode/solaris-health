const { Pool } = require('pg');
require('dotenv').config();

// 12-factor / portable DB config: DATABASE_URL is the single source of truth.
// No host/port/dbname/credentials are hardcoded anywhere — point this at the
// local Docker Postgres, a managed Neon/RDS instance, or any Postgres by
// changing only the DATABASE_URL env var.
const connectionString = process.env.DATABASE_URL;

// Enable SSL only when the target actually speaks it. Managed providers
// (Neon/Render/RDS) put `sslmode=require` in the connection string, so SSL is
// auto-enabled for them; set PGSSL=true to force it otherwise. The local Docker
// Postgres has no SSL, so this stays off there even though NODE_ENV=production —
// gating on NODE_ENV alone would break the current VM deployment.
const useSsl =
  /sslmode=require/.test(connectionString || '') ||
  process.env.PGSSL === 'true';

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: parseInt(process.env.PG_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Never crash the process on a transient pool error — a single dropped idle
// connection must not take the whole API down. Log and let the pool recover.
pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

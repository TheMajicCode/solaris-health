/**
 * Schema/recovery test (Slice 5 — migration hardening).
 *
 * Catches the "route queries a table that doesn't exist" class of failure —
 * the exact thing that breaks silently after a botched restore or a skipped
 * migration on a fresh environment.
 *
 * Two layers:
 *  1. A curated list of critical tables behind the core journeys
 *     (registration → assessment → passport → check-in → LUCA → booking →
 *      export) must exist.
 *  2. Dynamic sweep: every table name referenced in route/lib SQL that is
 *     ALSO created by a migration file must exist in the live schema.
 *     (Intersecting with migration CREATE TABLE names filters regex noise.)
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const SRC = path.join(__dirname, '..', 'src');
const MIGRATIONS = path.join(__dirname, '..', 'migrations');

const CRITICAL_TABLES = [
  'users',
  'assessment_responses',
  'daily_checkins',
  'luca_messages',
  'ai_execution_receipts',
  'booking_requests',
  'passport_consents',
  'contributions',
  'revoked_tokens',
  'notifications',
  'health_documents',
  'journal_entries',
  'patient_intake_submissions',
  'gps_transactions',
  'pgmigrations', // node-pg-migrate bookkeeping — missing means migrations never ran
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.sql')) out.push(p);
  }
  return out;
}

function referencedTables() {
  const names = new Set();
  const files = walk(path.join(SRC, 'routes')).concat(walk(path.join(SRC, 'lib')));
  const re = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z0-9_]*)/gi;
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    let m;
    while ((m = re.exec(src))) names.add(m[1].toLowerCase());
  }
  return names;
}

// Remove SQL/JS line comments so prose like "-- CREATE TABLE in any schema"
// can't produce false table names.
function stripComments(src) {
  return src.replace(/--.*$/gm, '').replace(/\/\/.*$/gm, '');
}

function migrationCreatedTables() {
  const names = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?/gi;
  for (const f of walk(MIGRATIONS)) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    let m;
    while ((m = re.exec(src))) names.add(m[1].toLowerCase());
  }
  return names;
}

async function existingTables() {
  const r = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  return new Set(r.rows.map((row) => row.tablename));
}

describe('schema recovery — routes never reference missing tables', () => {
  afterAll(async () => { await db.pool.end(); });

  test('all critical core-journey tables exist', async () => {
    const existing = await existingTables();
    const missing = CRITICAL_TABLES.filter((t) => !existing.has(t));
    expect(missing).toEqual([]);
  });

  test('every migration-defined table referenced by route/lib SQL exists', async () => {
    const referenced = referencedTables();
    const defined = migrationCreatedTables();
    expect(defined.size).toBeGreaterThan(20); // sanity: parser actually found tables
    const shouldExist = [...referenced].filter((t) => defined.has(t));
    expect(shouldExist.length).toBeGreaterThan(20); // sanity: sweep is meaningful
    const existing = await existingTables();
    const missing = shouldExist.filter((t) => !existing.has(t));
    expect(missing).toEqual([]);
  });

  test('ai_execution_receipts has the receipt V0 columns', async () => {
    const r = await db.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'ai_execution_receipts'`
    );
    const cols = new Set(r.rows.map((row) => row.column_name));
    for (const c of ['user_id', 'provider', 'compute_target', 'input_hash', 'result_hash', 'policy_version']) {
      expect(cols.has(c)).toBe(true);
    }
  });
});

/**
 * Migration FK-type contract test (RC1, Node E4J-RC1 item 1).
 *
 * STATIC analysis only — does NOT connect to or apply anything against a
 * database. It parses backend/schema*.sql to learn the canonical primary-key
 * type of each referenced table, then parses every migration in
 * backend/migrations and asserts that every column declared as
 *   <col> <TYPE> ... REFERENCES <table>(<col>)
 * uses a TYPE that matches the referenced column's type.
 *
 * It FAILS on a mismatched FK type (e.g. a BIGINT column referencing the
 * canonical UUID users.id). This guards the defect fixed in 041/042 from
 * ever regressing.
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(BACKEND, 'migrations');

// Normalize a Postgres type token to the class relevant for FK compatibility.
function normalizeType(raw) {
  const t = raw.toLowerCase().trim();
  if (/^(uuid)/.test(t)) return 'uuid';
  // Serial / bigserial resolve to integer/bigint storage types.
  if (/^bigserial/.test(t)) return 'bigint';
  if (/^serial/.test(t)) return 'integer';
  if (/^bigint/.test(t)) return 'bigint';
  if (/^(integer|int4|int\b)/.test(t)) return 'integer';
  if (/^smallint/.test(t)) return 'smallint';
  if (/^(text|varchar|character varying)/.test(t)) return 'text';
  return t.split(/\s|\(/)[0];
}

// Strip SQL line comments so they never interfere with parsing.
function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

// Split a CREATE TABLE body into top-level column/constraint definitions,
// honoring parentheses so a column def that spans multiple lines (or contains
// commas inside CHECK(...) / DEFAULT '{}' ) is kept intact.
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  // Collapse internal whitespace/newlines for each definition.
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Parse a CREATE TABLE block and return { tableName: { col: normalizedType } }.
function parseCreateTables(sql) {
  const tables = {};
  const clean = stripComments(sql);
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_."]+)\s*\(([\s\S]*?)\n\s*\);/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const table = m[1].replace(/"/g, '').replace(/^public\./, '');
    const cols = {};
    for (const def of splitTopLevel(m[2])) {
      // Skip table-level constraints.
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(def)) continue;
      const cm = def.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\[\])?(?:\s+varying)?)/i);
      if (!cm) continue;
      cols[cm[1]] = normalizeType(cm[2]);
    }
    tables[table] = cols;
  }
  return tables;
}

// Extract FK edges: for each column def with REFERENCES, capture
// { column, columnType, refTable, refCol }. Only inline column-level FKs
// (`<col> <type> ... REFERENCES <tbl>(<c>)`) are checked for type parity.
function parseForeignKeys(sql) {
  const fks = [];
  const clean = stripComments(sql);
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_."]+)\s*\(([\s\S]*?)\n\s*\);/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const table = m[1].replace(/"/g, '').replace(/^public\./, '');
    for (const def of splitTopLevel(m[2])) {
      const refM = def.match(/REFERENCES\s+([a-zA-Z0-9_."]+)\s*\(\s*([a-zA-Z0-9_]+)\s*\)/i);
      if (!refM) continue;
      // Skip table-level FOREIGN KEY constraints (no inline column type).
      if (/^(FOREIGN\s+KEY|CONSTRAINT)\b/i.test(def)) continue;
      const colM = def.match(/^([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+(?:\[\])?)/i);
      if (!colM) continue;
      // Guard: the first token must not itself be a type keyword / REFERENCES.
      if (/^references$/i.test(colM[1])) continue;
      fks.push({
        table,
        column: colM[1],
        columnType: normalizeType(colM[2]),
        refTable: refM[1].replace(/"/g, '').replace(/^public\./, ''),
        refCol: refM[2],
      });
    }
  }
  return fks;
}

// Build canonical PK/column types from all base schema*.sql files + migrations
// so referenced tables defined anywhere are resolvable.
function buildCanonicalTypes() {
  const catalog = {};
  const schemaFiles = fs.readdirSync(BACKEND).filter((f) => /^schema.*\.sql$/i.test(f));
  const migFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /\.sql$/i.test(f));
  for (const f of schemaFiles) {
    Object.assign(catalog, parseCreateTables(fs.readFileSync(path.join(BACKEND, f), 'utf8')));
  }
  for (const f of migFiles) {
    const t = parseCreateTables(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    for (const [tbl, cols] of Object.entries(t)) {
      catalog[tbl] = Object.assign(catalog[tbl] || {}, cols);
    }
  }
  return catalog;
}

describe('migration FK-type contract', () => {
  const catalog = buildCanonicalTypes();

  test('canonical users.id is UUID (baseline assumption)', () => {
    expect(catalog.users).toBeDefined();
    expect(catalog.users.id).toBe('uuid');
  });

  const migFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /\.sql$/i.test(f))
    .sort();

  for (const f of migFiles) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    const fks = parseForeignKeys(sql);
    if (fks.length === 0) continue;
    test(`${f}: every FK column type matches its referenced column type`, () => {
      const problems = [];
      for (const fk of fks) {
        const refTypes = catalog[fk.refTable];
        if (!refTypes || !(fk.refCol in refTypes)) {
          // Referenced table/column not found in catalog — cannot verify; skip.
          continue;
        }
        const refType = refTypes[fk.refCol];
        if (fk.columnType !== refType) {
          problems.push(
            `${fk.table}.${fk.column} is ${fk.columnType} but references ` +
              `${fk.refTable}.${fk.refCol} which is ${refType}`,
          );
        }
      }
      if (problems.length) {
        throw new Error('FK type mismatch:\n  ' + problems.join('\n  '));
      }
    });
  }

  test('all user FKs across new migrations (039-042) are UUID', () => {
    const bad = [];
    for (const f of ['039_admin_bootstrap.sql', '040_journey_pipeline.sql', '041_luca_recommendations.sql', '042_practitioner_copilot.sql']) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      for (const fk of parseForeignKeys(sql)) {
        if (fk.refTable === 'users' && fk.refCol === 'id' && fk.columnType !== 'uuid') {
          bad.push(`${f}: ${fk.table}.${fk.column} is ${fk.columnType}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

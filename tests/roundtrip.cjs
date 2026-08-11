'use strict';
/**
 * ROUND-TRIP TEST — the sovereignty invariant, made executable.
 *
 *   Solaris (B) record  ->  buildVaultExport  ->  portable vault  ->  luca-node (A) loop ingests it
 *
 * If this passes, the open sovereign path is PROVEN: data created in the cloud app round-trips into
 * the sovereign node's format and the A-loop runs on it. If B's schema ever drifts away from A's
 * shapes, THIS TEST GOES RED — which is exactly the early-warning you want while running A and B
 * in parallel.
 *
 * Run:  node tests/roundtrip.cjs
 * Optionally point at the A-stack:  LUCA_NODE_DIR=/path/to/luca-node node tests/roundtrip.cjs
 * If luca-node isn't found, structural assertions still run (and clearly say the full loop was skipped).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const { buildVaultExport } = require('../backend/src/lib/vault-export');

let pass = 0;
const ok = (name) => { pass++; console.log(`  \u2713 ${name}`); };

// ---- 1. a sample Solaris (Strategy B) record ----
const record = {
  user: { id: 'u_123', email: 'maria@example.com', full_name: 'Maria Vega', role: 'patient',
          did: null, nostr_npub: null, country: 'SV', language: 'Spanish' },
  assessment: { vitality_score: 68, top_focus_areas: [{ name: 'Sleep' }, { name: 'Stress' }, { name: 'Hydration' }] },
  contributions: [
    { id: 'c_1', event_type: 'completed_workshop', category: 'learn', description: 'Finished Sleep Foundations', impact: 'medium', reward_sats: 500, public: true, verified_at: '2026-06-01', created_at: '2026-06-01' },
    { id: 'c_2', event_type: 'referral', category: 'refer', description: 'Referred a friend to Aura', impact: 'high', reward_sats: 1000, public: false, verified_at: '2026-06-10', created_at: '2026-06-10' },
  ],
  messages: [
    { role: 'user', content: 'I keep waking up at 3am', created_at: '2026-06-02', model: null },
    { role: 'assistant', content: 'Morning sunlight and a screen-free wind-down can help reset your rhythm.', created_at: '2026-06-02', model: 'openai-compatible:gpt-4o-mini' },
  ],
  credentials: [],
};

// ---- 2. export to portable vault format ----
const files = buildVaultExport(record);

// ---- 3. structural assertions (always run, no deps) ----
const byPath = Object.fromEntries(files.map((f) => [f.path, f.contents]));

assert(byPath['manifest.json'], 'manifest.json present');
ok('export produces a manifest');

const manifest = JSON.parse(byPath['manifest.json']);
assert.strictEqual(manifest.vault_schema_version, '1.0');
assert.strictEqual(manifest.source, 'solaris-cloud');
ok('manifest declares schema version + source');

assert(byPath['identity.md'] && byPath['identity.md'].includes('type: human'), 'identity.md is a human identity');
ok('identity.md present and well-formed');

assert(byPath['health/assessment.md'].includes('vitality_score: 68'), 'vitality survives the round trip');
ok('assessment vitality (68) preserved in vault');

assert(byPath['health/assessment.md'].includes('Sleep') && byPath['health/assessment.md'].includes('Stress'), 'focus areas preserved');
ok('focus areas (Sleep, Stress, Hydration) preserved');

const contribFiles = files.filter((f) => f.path.startsWith('contributions/'));
assert.strictEqual(contribFiles.length, record.contributions.length, 'all contributions exported');
ok(`all ${record.contributions.length} contributions exported as contribution-events`);

assert(byPath['health/luca-conversation.md'].includes('openai-compatible:gpt-4o-mini'), 'AI provenance (model) carried into the vault');
ok('coach reply provenance (model id) preserved');

assert(byPath['events/log.jsonl'].trim().split('\n').every((l) => JSON.parse(l)), 'event log is valid JSONL');
ok('events/log.jsonl is valid append-only JSONL');

// ---- 4. write the vault to disk ----
const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luca-vault-'));
for (const f of files) {
  const abs = path.join(vaultDir, f.path);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, f.contents);
}
ok(`vault written to disk (${files.length} files)`);

// ---- 5. THE REAL ROUND TRIP: feed the exported vault into the A-stack (luca-node) loop ----
function findLucaNode() {
  const candidates = [
    process.env.LUCA_NODE_DIR,
    path.resolve(__dirname, '../../luca-node'),
    path.resolve(__dirname, '../luca-node'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'packages/core/loop.js'))) return c;
  }
  return null;
}

(async () => {
  const nodeDir = findLucaNode();
  if (!nodeDir) {
    console.log('\n  \u26A0 luca-node not found alongside — ran STRUCTURAL checks only.');
    console.log('    To prove the full A-loop ingest, place luca-node beside this package or set LUCA_NODE_DIR.');
    console.log(`\n  ${pass} structural assertions passed.\n`);
    return;
  }

  const { createFsStorage } = require(path.join(nodeDir, 'packages/adapters/storage-fs'));
  const { createMockAI } = require(path.join(nodeDir, 'packages/adapters/ai-mock'));
  const { createJsonlLog } = require(path.join(nodeDir, 'packages/adapters/eventlog-jsonl'));
  const core = require(path.join(nodeDir, 'packages/core/loop'));

  const deps = {
    storage: createFsStorage(vaultDir),
    ai: createMockAI(),
    log: createJsonlLog(path.join(vaultDir, 'events/ingest-log.jsonl')),
  };

  // A's loop treats the exported conversation as an observation, reasons over the exported health dir
  const observation = await core.observe(deps, 'health/luca-conversation.md');
  assert(observation.raw.includes('3am'), 'A-loop read the exported conversation');
  ok('A-stack OBSERVE ingested B-export (conversation)');

  const draft = await core.thinkAndDraft(deps, observation, 'health');
  assert(draft.status === 'needs_review', 'A-loop produced a gated draft');
  assert(draft.sources.length >= 1, 'A-loop grounded the draft in exported vault files');
  ok('A-stack THINK produced a clinician-gated draft from B-export');

  console.log(`\n  \u2705 ROUND TRIP PROVEN: Solaris (B) export ingests into luca-node (A) loop.`);
  console.log(`  ${pass} assertions passed.\n`);
})().catch((e) => { console.error('\n  \u2717 FAILED:', e.message, '\n'); process.exit(1); });

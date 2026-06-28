/**
 * Vault export tests — exercises the pure serialization function that powers
 * the "user owns their data" sovereignty path. No DB required, so this is the
 * highest-confidence / highest-coverage suite (target >90% of vault-export.js).
 */
const {
  buildVaultExport,
  VAULT_SCHEMA_VERSION,
} = require('../src/lib/vault-export');

const baseRecord = () => ({
  user: {
    id: 42,
    email: 'owner@test.local',
    full_name: 'Data Owner',
    role: 'patient',
    did: 'did:solaris:42',
    nostr_npub: 'npub1xyz',
    country: 'Testland',
    language: 'English',
  },
  assessment: {
    vitality_score: 78,
    top_focus_areas: [{ name: 'Sleep' }, { name: 'Hydration' }],
  },
  contributions: [
    {
      id: 1,
      event_type: 'workshop',
      category: 'community',
      description: 'Led a breathwork session',
      impact: 'high',
      reward_sats: 1000,
      public: true,
      verified_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ],
  messages: [
    { role: 'user', content: 'How do I sleep better?', created_at: '2026-01-02T00:00:00.000Z', model: null },
    { role: 'assistant', content: 'Try morning sunlight.', created_at: '2026-01-02T00:00:01.000Z', model: 'mock' },
  ],
  credentials: [
    {
      id: 7,
      credential_type: 'certification',
      credential_name: 'Yoga Instructor',
      public: true,
      issued_at: '2025-06-01T00:00:00.000Z',
    },
  ],
});

describe('buildVaultExport', () => {
  it('exports a stable schema version string', () => {
    expect(typeof VAULT_SCHEMA_VERSION).toBe('string');
    expect(VAULT_SCHEMA_VERSION).toMatch(/^\d+\.\d+$/);
  });

  it('returns an array of { path, contents } files', () => {
    const files = buildVaultExport(baseRecord());
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(typeof f.path).toBe('string');
      expect(typeof f.contents).toBe('string');
      expect(f.path.length).toBeGreaterThan(0);
    }
  });

  it('includes the identity root file with DID and npub carried through', () => {
    const files = buildVaultExport(baseRecord());
    const identity = files.find((f) => f.path === 'identity.md');
    expect(identity).toBeDefined();
    expect(identity.contents).toContain('did:solaris:42');
    expect(identity.contents).toContain('npub1xyz');
    expect(identity.contents).toContain('owner@test.local');
  });

  it('includes the assessment file with the vitality score', () => {
    const files = buildVaultExport(baseRecord());
    const assessment = files.find((f) => f.path === 'health/assessment.md');
    expect(assessment).toBeDefined();
    expect(assessment.contents).toContain('78');
  });

  it('includes the luca conversation file with both turns', () => {
    const files = buildVaultExport(baseRecord());
    const convo = files.find((f) => f.path === 'health/luca-conversation.md');
    expect(convo).toBeDefined();
    expect(convo.contents).toContain('How do I sleep better?');
    expect(convo.contents).toContain('Try morning sunlight.');
  });

  it('emits one markdown file per contribution and credential', () => {
    const files = buildVaultExport(baseRecord());
    expect(files.find((f) => f.path === 'contributions/contribution-1.md')).toBeDefined();
    expect(files.find((f) => f.path === 'credentials/credential-7.md')).toBeDefined();
  });

  it('emits a JSONL event log whose lines are valid JSON', () => {
    const files = buildVaultExport(baseRecord());
    const log = files.find((f) => f.path === 'events/log.jsonl');
    expect(log).toBeDefined();
    const lines = log.contents.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('emits a manifest.json that parses and references the schema version', () => {
    const files = buildVaultExport(baseRecord());
    const manifest = files.find((f) => f.path === 'manifest.json');
    expect(manifest).toBeDefined();
    const parsed = JSON.parse(manifest.contents);
    expect(parsed).toBeTruthy();
    expect(JSON.stringify(parsed)).toContain(VAULT_SCHEMA_VERSION);
  });

  it('handles a minimal record (no assessment / empty arrays) gracefully', () => {
    const files = buildVaultExport({
      user: { id: 1, email: 'min@test.local', role: 'patient' },
      assessment: null,
      contributions: [],
      messages: [],
      credentials: [],
    });
    expect(Array.isArray(files)).toBe(true);
    // identity, event log and manifest should still always be present.
    expect(files.find((f) => f.path === 'identity.md')).toBeDefined();
    expect(files.find((f) => f.path === 'manifest.json')).toBeDefined();
  });

  it('falls back to a synthetic DID when the user has none', () => {
    const rec = baseRecord();
    delete rec.user.did;
    const files = buildVaultExport(rec);
    const identity = files.find((f) => f.path === 'identity.md');
    expect(identity.contents).toContain('solaris:user:42');
  });

  it('supports string-form focus areas as well as object-form', () => {
    const rec = baseRecord();
    rec.assessment.top_focus_areas = ['Movement', 'Nutrition'];
    const files = buildVaultExport(rec);
    const assessment = files.find((f) => f.path === 'health/assessment.md');
    expect(assessment.contents).toContain('Movement');
    expect(assessment.contents).toContain('Nutrition');
  });
});

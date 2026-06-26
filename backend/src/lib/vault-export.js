'use strict';
/**
 * VAULT EXPORT — the open sovereign path, made concrete and testable.
 *
 * Takes a Solaris (Strategy B) user record and serializes it into the SAME portable vault
 * format the luca-node (Strategy A) stack ingests: Markdown + YAML frontmatter, plus a JSONL
 * event. If this export round-trips into A's vault loop, the "user owns their data" claim is
 * PROVEN, not promised. (See tests/roundtrip.mjs.)
 *
 * Pure function — no DB, no fs — so it's trivially testable. Returns an array of
 * { path, contents } files. The route (routes/export.js) gathers the record and zips/returns them.
 */

const VAULT_SCHEMA_VERSION = '1.0';

function fm(obj) {
  // minimal YAML frontmatter writer (flat keys + simple arrays)
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`  - ${item}`);
    } else {
      lines.push(`${k}: ${v ?? ''}`);
    }
  }
  lines.push('---', '');
  return lines.join('\n');
}

/**
 * @param {Object} record
 * @param {Object} record.user          { id, email, full_name, role, did, nostr_npub, country, language }
 * @param {Object|null} record.assessment { vitality_score, top_focus_areas } (top_focus_areas: [{name}] or [string])
 * @param {Array}  record.contributions  [{ id, event_type, category, description, impact, reward_sats, public, verified_at, created_at }]
 * @param {Array}  record.messages       [{ role, content, created_at, model }]
 * @param {Array}  record.credentials    [{ id, credential_type, credential_name, public, issued_at }]
 * @returns {{path:string, contents:string}[]}
 */
function buildVaultExport(record) {
  const { user, assessment, contributions = [], messages = [], credentials = [] } = record;
  const exportedAt = new Date().toISOString();
  const files = [];

  // 0 · IDENTITY (root of the vault — note did/npub carried through even from B)
  files.push({
    path: 'identity.md',
    contents:
      fm({
        id: user.did || `solaris:user:${user.id}`,
        type: 'human',
        display_name: user.full_name || user.email,
        email: user.email,
        role: user.role,
        did: user.did || '(not yet minted — Strategy A, Phase 2)',
        npub: user.nostr_npub || '(not yet minted)',
        country: user.country || '',
        language: user.language || '',
        exported_at: exportedAt,
      }) +
      `# Identity\n\nThis record was exported from the Solaris (cloud) node in the portable LUCA vault format. ` +
      `When the sovereign stack is stood up, this identity is re-rooted under keys you control — the ` +
      `\`did\`/\`npub\` fields above are the hooks for that step.\n`,
  });

  // 1 · HEALTH — assessment
  if (assessment) {
    const focus = (assessment.top_focus_areas || []).map((f) => (f && f.name) ? f.name : f);
    files.push({
      path: 'health/assessment.md',
      contents:
        fm({
          id: 'solaris-method-assessment',
          type: 'health-assessment',
          sensitivity: 'private',
          vitality_score: assessment.vitality_score ?? '',
          focus_areas: focus,
          exported_at: exportedAt,
        }) +
        `# Solaris Method Assessment\n\nVitality score: **${assessment.vitality_score ?? 'n/a'}/100**\n\n` +
        `Top focus areas: ${focus.join(', ') || 'balanced'}\n`,
    });
  }

  // 1 · HEALTH — conversation history with the coach
  if (messages.length) {
    const body = messages
      .map((m) => `**${m.role}**${m.model ? ` _(${m.model})_` : ''}: ${m.content}`)
      .join('\n\n');
    files.push({
      path: 'health/luca-conversation.md',
      contents:
        fm({ id: 'luca-conversation', type: 'conversation', sensitivity: 'private', messages: String(messages.length), exported_at: exportedAt }) +
        `# Conversation with LUCA\n\n${body}\n`,
    });
  }

  // 5 · EARN — contributions as contribution-events (matches the GPS schema)
  for (const c of contributions) {
    files.push({
      path: `contributions/contribution-${c.id}.md`,
      contents: fm({
        event_id: c.id,
        type: 'contribution-event',
        category: c.category || '',
        event_type: c.event_type || '',
        reward_impact: c.reward_sats ?? 0,
        visibility: c.public ? 'public' : 'private',
        verified_at: c.verified_at || '',
        created_at: c.created_at || '',
      }) + `# Contribution\n\n${c.description || ''}\n\nImpact: ${c.impact || 'n/a'}\n`,
    });
  }

  // CREDENTIALS
  for (const cr of credentials) {
    files.push({
      path: `credentials/credential-${cr.id}.md`,
      contents: fm({
        id: cr.id,
        type: 'credential',
        credential_type: cr.credential_type || '',
        name: cr.credential_name || '',
        visibility: cr.public ? 'public' : 'private',
        issued_at: cr.issued_at || '',
      }) + `# Credential: ${cr.credential_name || cr.credential_type}\n`,
    });
  }

  // EVENTS — an export event in the append-only audit format
  files.push({
    path: 'events/log.jsonl',
    contents:
      JSON.stringify({
        event_id: `evt_export_${Date.now()}`,
        actor_type: 'human',
        actor_id: user.did || `solaris:user:${user.id}`,
        action: 'exported_vault',
        resource: 'full_user_record',
        counts: { contributions: contributions.length, messages: messages.length, credentials: credentials.length },
        human_approval: 'self',
        timestamp: exportedAt,
      }) + '\n',
  });

  // MANIFEST — what's in the bundle + schema version (lets A verify it can ingest)
  files.push({
    path: 'manifest.json',
    contents: JSON.stringify(
      {
        vault_schema_version: VAULT_SCHEMA_VERSION,
        source: 'solaris-cloud',
        exported_at: exportedAt,
        owner: user.did || `solaris:user:${user.id}`,
        files: files.map((f) => f.path),
        ingestable_by: 'luca-node >= 0.1.0',
      },
      null,
      2
    ),
  });

  return files;
}

module.exports = { buildVaultExport, VAULT_SCHEMA_VERSION };

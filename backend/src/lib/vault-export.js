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
  const {
    user, assessment, contributions = [], messages = [], credentials = [],
    journal = [], healthDocs = [], habitTicks = [], audioUnlocks = [],
    aiReceipts = [],
    agentAuthority = null,
    solarisIdentity = null,
    notifications = [],
  } = record;
  const exportedAt = new Date().toISOString();
  const files = [];

  const dateOf = (v) => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
  };
  const slugify = (s) => String(s || '').replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'note';

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

  // 1 · HEALTH — journal reflections
  if (journal && journal.length) {
    const entries = journal.map((e) =>
      `### ${dateOf(e.created_at)}\n` +
      `**Mood:** ${e.mood || '—'}\n\n${e.content || ''}\n`
    ).join('\n---\n\n');
    files.push({
      path: 'health/journal.md',
      contents: fm({ type: 'journal', entries: journal.length, exported_at: exportedAt }) +
        `# Health Journal\n\n${entries}`,
    });
  }

  // 1 · HEALTH — documents (LUCA summaries + metadata, never the raw bytes)
  if (healthDocs && healthDocs.length) {
    healthDocs.forEach((d, i) => {
      files.push({
        path: `health/documents/${i + 1}-${slugify(d.filename || d.doc_type)}.md`,
        contents: fm({ type: d.doc_type || 'upload', filename: d.filename || '', created_at: d.created_at || '' }) +
          `# ${d.filename || 'Health Note'}\n\n**Description:** ${d.description || '—'}\n\n` +
          (d.luca_summary ? `## LUCA Summary\n\n${d.luca_summary}\n\n*This summary is for your personal understanding. Not a medical interpretation.*\n` : ''),
      });
    });
  }

  // 1 · HEALTH — habit tracker (last 30 days)
  if (habitTicks && habitTicks.length) {
    const byHabit = {};
    habitTicks.forEach((t) => {
      const key = `${t.icon || ''} ${t.name}`.trim();
      if (!byHabit[key]) byHabit[key] = [];
      byHabit[key].push(t.tick_date);
    });
    const habitContent = Object.entries(byHabit).map(([name, dates]) =>
      `**${name}** — ${dates.length} completion${dates.length === 1 ? '' : 's'} in the last 30 days`
    ).join('\n');
    files.push({
      path: 'health/habits.md',
      contents: fm({ type: 'habit-log', habits: Object.keys(byHabit).length, exported_at: exportedAt }) +
        `# Habit Tracker\n\n${habitContent}\n`,
    });
  }

  // 1 · HEALTH — unlocked audio practices
  if (audioUnlocks && audioUnlocks.length) {
    const audioList = audioUnlocks.map((a) =>
      `- **${a.title}** — ${a.description || ''} *(unlocked ${dateOf(a.unlocked_at)})*`
    ).join('\n');
    files.push({
      path: 'health/audio-library.md',
      contents: fm({ type: 'audio-library', tracks: audioUnlocks.length, exported_at: exportedAt }) +
        `# Audio Library\n\n${audioList}\n`,
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

  // AI — execution receipts (provenance metadata + non-reversible hashes; no raw prompts/PHI)
  if (aiReceipts && aiReceipts.length) {
    const lines = aiReceipts.map((r) => JSON.stringify({
      event_type: r.event_type,
      agent_id: r.agent_id,
      provider: r.provider,
      requested_model: r.requested_model || null,
      actual_model: r.actual_model || null,
      compute_target: r.compute_target,
      data_class: r.data_class,
      consent_basis: r.consent_basis,
      latency_ms: r.latency_ms ?? null,
      input_hash: r.input_hash || null,
      result_hash: r.result_hash || null,
      degraded: Boolean(r.degraded),
      error_class: r.error_class || null,
      policy_version: r.policy_version,
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
    }));
    files.push({
      path: 'ai/execution-receipts.jsonl',
      contents: lines.join('\n') + '\n',
    });
  }

  // AGENTS — the user's LUCA agent identity + scoped capability grants (no PHI)
  // SOLARIS ID — the permanent subject + its bindings (ADR 001).
  // PHI-safe by construction: the email binding carries only a SHA-256 hash.
  if (solarisIdentity && solarisIdentity.solarisId) {
    const bindingLines = (solarisIdentity.bindings || []).map((b) =>
      `| ${b.type} | ${b.value || '(hash only — stored privately)'} | ${b.status} | ${b.hash ? b.hash.slice(0, 12) + '…' : ''} |`
    );
    files.push({
      path: 'identity/solaris-id.md',
      contents:
        fm({
          solaris_id: solarisIdentity.solarisId,
          status: solarisIdentity.status,
          created_at: solarisIdentity.createdAt ? new Date(solarisIdentity.createdAt).toISOString() : null,
          gps_end_address: solarisIdentity.gpsEndAddress,
          gps_end_address_type: solarisIdentity.gpsEndAddressType,
          bindings_count: (solarisIdentity.bindings || []).length,
          exported_at: exportedAt,
        }) +
        `# Your Solaris ID\n\n` +
        `\`${solarisIdentity.solarisId}\` is your permanent identity — random, never derived from ` +
        `your email or any personal detail. Emails, DIDs, nostr keys and wallets are replaceable ` +
        `bindings attached to it; replacing them never erases your history.\n\n` +
        `## Bindings\n\n| type | value | status | hash |\n|---|---|---|---|\n` +
        (bindingLines.length ? bindingLines.join('\n') + '\n' : '_(none)_\n') +
        `\nYour GPS end address (\`${solarisIdentity.gpsEndAddress}\`) is configuration only in this ` +
        `showcase — no real payments are made.\n`,
    });
  }

  if (agentAuthority && (agentAuthority.agents?.length || agentAuthority.grants?.length)) {
    files.push({
      path: 'agents/authority.json',
      contents: JSON.stringify({
        note: 'Your AI agents and exactly what they are allowed to do on your behalf. Revocable at any time.',
        agents: agentAuthority.agents,
        capability_grants: agentAuthority.grants,
      }, null, 2) + '\n',
    });
  }

  // NOTIFICATIONS — the user's in-app notification history (JSONL, append-only shape)
  if (notifications && notifications.length) {
    const lines = notifications.map((n) => JSON.stringify({
      type: n.type,
      title: n.title || null,
      message: n.message || null,
      read: Boolean(n.read),
      data: n.data || null,
      created_at: n.created_at ? new Date(n.created_at).toISOString() : null,
    }));
    files.push({
      path: 'notifications/log.jsonl',
      contents: lines.join('\n') + '\n',
    });
  }

  // EVENTS — append-only audit log. One line per meaningful action, then the export event.
  const actorId = user.did || `solaris:user:${user.id}`;
  const eventLines = [];
  journal.forEach((e, i) => {
    eventLines.push(JSON.stringify({
      event_id: `evt_journal_${i + 1}`,
      actor_type: 'human',
      actor_id: actorId,
      action: 'journal.entry',
      resource: 'health/journal',
      date: e.created_at ? new Date(e.created_at).toISOString() : null,
      mood_tag: e.mood || null,
      human_approval: 'self',
      timestamp: e.created_at ? new Date(e.created_at).toISOString() : exportedAt,
    }));
  });
  audioUnlocks.forEach((a, i) => {
    eventLines.push(JSON.stringify({
      event_id: `evt_audio_unlock_${i + 1}`,
      actor_type: 'human',
      actor_id: actorId,
      action: 'audio.unlock',
      resource: 'health/audio-library',
      title: a.title || null,
      human_approval: 'self',
      timestamp: a.unlocked_at ? new Date(a.unlocked_at).toISOString() : exportedAt,
    }));
  });
  eventLines.push(JSON.stringify({
    event_id: `evt_export_${Date.now()}`,
    actor_type: 'human',
    actor_id: actorId,
    action: 'exported_vault',
    resource: 'full_user_record',
    counts: {
      contributions: contributions.length, messages: messages.length, credentials: credentials.length,
      journal: journal.length, health_documents: healthDocs.length, audio_unlocks: audioUnlocks.length,
      ai_execution_receipts: aiReceipts.length,
      identity_bindings: solarisIdentity ? (solarisIdentity.bindings || []).length : 0,
      notifications: notifications.length,
    },
    human_approval: 'self',
    timestamp: exportedAt,
  }));
  files.push({
    path: 'events/log.jsonl',
    contents: eventLines.join('\n') + '\n',
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

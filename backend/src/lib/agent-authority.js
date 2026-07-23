'use strict';
/**
 * Agent authority (Slice 7) — scoped, revocable capability grants for the
 * user-owned LUCA agent.
 *
 * Design:
 * - Each user owns exactly one LUCA agent row in `agents` (name 'LUCA',
 *   created lazily). `agents.active` is the owner's kill-switch: disabling
 *   LUCA never deletes the user or their data, and never logs them out.
 * - Fine-grained authority lives in `agent_capability_grants`: a capability
 *   is allowed only while its grant is active, unexpired, and the agent is
 *   active. Sensitive capabilities can carry `requires_human_approval`.
 * - Every grant *use* is audited into the existing `audit_logs` table
 *   (action 'agent.grant.used') — best-effort, never breaks the request.
 */
const db = require('../db');

const LUCA_AGENT_NAME = 'LUCA';
const DEFAULT_GRANTS = [
  // Conversational coaching over the member's own passport context.
  { capability: 'luca.chat', requiresHumanApproval: false },
  // Reading the member's passport summary to build coaching context.
  { capability: 'passport.read.summary', requiresHumanApproval: false },
];

/** Get-or-create the user's LUCA agent (idempotent) with default grants. */
async function ensureLucaAgent(userId) {
  const existing = await db.query(
    `SELECT * FROM agents WHERE owner_id=$1 AND name=$2 AND deleted_at IS NULL LIMIT 1`,
    [userId, LUCA_AGENT_NAME]
  );
  let agent = existing.rows[0];
  if (!agent) {
    const created = await db.query(
      `INSERT INTO agents (owner_id, name, purpose, permissions)
       VALUES ($1, $2, $3, '[]'::jsonb)
       RETURNING *`,
      [userId, LUCA_AGENT_NAME, 'Your personal wellness guide — educates and encourages, never diagnoses or prescribes.']
    );
    agent = created.rows[0];
  }
  // Seed default grants idempotently (UNIQUE(agent_id, capability)).
  for (const g of DEFAULT_GRANTS) {
    await db.query(
      `INSERT INTO agent_capability_grants (agent_id, owner_id, capability, requires_human_approval)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, capability) DO NOTHING`,
      [agent.id, userId, g.capability, g.requiresHumanApproval]
    );
  }
  return agent;
}

/**
 * Check whether the user's LUCA agent may exercise `capability` right now.
 * Returns { allowed, reason, agent, grant } — never throws for flow control.
 */
async function checkCapability(userId, capability) {
  const agent = await ensureLucaAgent(userId);
  if (!agent.active) {
    return { allowed: false, reason: 'agent_disabled', agent, grant: null };
  }
  const r = await db.query(
    `SELECT * FROM agent_capability_grants
      WHERE agent_id=$1 AND capability=$2 LIMIT 1`,
    [agent.id, capability]
  );
  const grant = r.rows[0] || null;
  if (!grant) return { allowed: false, reason: 'no_grant', agent, grant: null };
  if (grant.status !== 'active') return { allowed: false, reason: 'grant_revoked', agent, grant };
  if (grant.expires_at && new Date(grant.expires_at) < new Date()) {
    return { allowed: false, reason: 'grant_expired', agent, grant };
  }
  return { allowed: true, reason: null, agent, grant };
}

/** Audit one use of a grant (best-effort — never throws). */
async function recordGrantUse(grant, { result = 'success', reason = null } = {}) {
  if (!grant) return;
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, result, result_reason, new_values)
       VALUES ($1, 'agent.grant.used', 'agent_capability_grant', $2, $3, $4, $5)`,
      [grant.owner_id, grant.id, result, reason, JSON.stringify({ capability: grant.capability, agent_id: grant.agent_id })]
    );
  } catch (err) {
    console.warn('[agent-authority] audit write failed (non-fatal):', err.code || err.name || 'error');
  }
}

/** Owner disables/enables their LUCA agent. Returns the updated agent or null. */
async function setLucaActive(userId, active) {
  const agent = await ensureLucaAgent(userId);
  const r = await db.query(
    `UPDATE agents SET active=$1, updated_at=NOW()
      WHERE id=$2 AND owner_id=$3 RETURNING *`,
    [Boolean(active), agent.id, userId]
  );
  return r.rows[0] || null;
}

/** Owner revokes a single capability grant (their own agent only). */
async function revokeGrant(userId, grantId) {
  const r = await db.query(
    `UPDATE agent_capability_grants
        SET status='revoked', revoked_at=NOW()
      WHERE id=$1 AND owner_id=$2 AND status='active'
      RETURNING *`,
    [grantId, userId]
  );
  return r.rows[0] || null;
}

/** Export representation: the user's agents + grants, PHI-free by design. */
async function exportAgentAuthority(userId) {
  const agents = await db.query(
    `SELECT id, name, purpose, active, created_at, updated_at
       FROM agents WHERE owner_id=$1 AND deleted_at IS NULL`,
    [userId]
  );
  const grants = await db.query(
    `SELECT id, agent_id, capability, scope, requires_human_approval, status,
            granted_at, expires_at, revoked_at
       FROM agent_capability_grants WHERE owner_id=$1`,
    [userId]
  );
  return { agents: agents.rows, grants: grants.rows };
}

module.exports = {
  LUCA_AGENT_NAME,
  ensureLucaAgent,
  checkCapability,
  recordGrantUse,
  setLucaActive,
  revokeGrant,
  exportAgentAuthority,
};

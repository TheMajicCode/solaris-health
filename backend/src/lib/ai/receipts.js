'use strict';
/**
 * AI execution receipts — provenance without PHI.
 *
 * A receipt records that an AI execution happened on a user's behalf: which
 * provider and model, over what class of data, under what consent basis, how
 * long it took, and whether it degraded or failed. It NEVER stores raw
 * prompts, raw replies, or any passport context — only SHA-256 digests.
 *
 * Recording is strictly best-effort: a receipt failure must never break the
 * user-facing request (the table might not exist yet mid-migration, etc.).
 */
const crypto = require('crypto');
const db = require('../../db');
const { subjectIdForUser } = require('../identity');

const POLICY_VERSION = 'v0';
const AGENT_ID = 'sol_agent_luca';

/** Non-reversible digest of arbitrary text. Never store the text itself. */
function sha256(text) {
  return crypto.createHash('sha256').update(String(text ?? '')).digest('hex');
}

/** Derive provider + compute target labels from an AIProvider instance id like "abacus:claude-sonnet-4-6". */
function describeProvider(ai) {
  const id = (ai && ai.id) || 'unknown:unknown';
  const sep = id.indexOf(':');
  const provider = sep === -1 ? id : id.slice(0, sep);
  const actualModel = sep === -1 ? null : id.slice(sep + 1);
  const computeTarget = provider === 'local' ? 'local' : provider === 'mock' ? 'in_process' : 'managed_cloud';
  return { provider, actualModel, computeTarget };
}

/**
 * Persist one AI execution receipt. Best-effort; resolves to the inserted row
 * id or null. All free-text inputs are hashed here — callers pass raw strings
 * and this function guarantees only digests are written.
 */
async function recordAIReceipt({
  userId,
  eventType,
  ai,
  requestedModel = null,
  dataClass = 'health_context',
  consentBasis = 'member_self_query',
  latencyMs = null,
  inputText = null,
  resultText = null,
  degraded = false,
  errorClass = null,
}) {
  try {
    const { provider, actualModel, computeTarget } = describeProvider(ai);
    // Stamp the permanent Solaris subject id (ADR 001) — best-effort join key.
    const subjectId = await subjectIdForUser(userId);
    const r = await db.query(
      `INSERT INTO ai_execution_receipts
         (user_id, event_type, agent_id, provider, requested_model, actual_model,
          compute_target, data_class, consent_basis, latency_ms, input_hash,
          result_hash, degraded, error_class, policy_version, subject_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id`,
      [
        userId,
        eventType,
        AGENT_ID,
        provider,
        requestedModel,
        actualModel,
        computeTarget,
        dataClass,
        consentBasis,
        latencyMs,
        inputText != null ? sha256(inputText) : null,
        resultText != null ? sha256(resultText) : null,
        Boolean(degraded),
        errorClass,
        POLICY_VERSION,
        subjectId,
      ]
    );
    return r.rows[0] ? r.rows[0].id : null;
  } catch (err) {
    // Never break the request path over a receipt. Log the class only.
    console.warn('[ai-receipts] write failed (non-fatal):', err.code || err.name || 'error');
    return null;
  }
}

module.exports = { recordAIReceipt, sha256, describeProvider, POLICY_VERSION, AGENT_ID };

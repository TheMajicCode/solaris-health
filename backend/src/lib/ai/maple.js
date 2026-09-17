'use strict';
/**
 * Maple provider — PRIVATE, owner-scoped inference through the local Maple proxy.
 *
 * This adapter talks ONLY to the supervised loopback Maple proxy
 * (default http://127.0.0.1:8788/v1), which forwards each request into Maple's
 * TEE-backed OpenAI-compatible backend over its production HTTPS + attestation.
 *
 * Boundaries this module enforces:
 *  - Provider id is `maple:<model>` so phi-boundary.isExternalProvider() === true.
 *    A localhost proxy is STILL a route to remote inference — never labelled local.
 *  - The backend supplies LUCA_MAPLE_API_KEY as a per-request bearer. Browsers
 *    never receive the key, the upstream URL, the billing identity, the system
 *    role or the provider choice.
 *  - Bounded input size, bounded output tokens, request deadline, cancellation.
 *  - On ANY failure it THROWS a bounded, class-only error. It NEVER falls back to
 *    mock or any other cloud provider, and NEVER leaks raw provider error bodies.
 */

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_INPUT_CHARS = 16000;   // outbound prompt+context ceiling
const MAX_OUTPUT_CHARS = 8000;   // defensive ceiling (NOT a truncation of a complete reply)
const DEFAULT_MAX_OUTPUT_TOKENS = 256; // bounded usage (also the smoke cap)

// Completion states we accept as a *complete* reply. Anything else (notably
// 'length' = the model hit max_tokens and was cut off, or 'content_filter',
// 'tool_calls') means the answer is INCOMPLETE and must be treated as a failure —
// we never slice/pad a partial answer to force-fit it. `null`/absent is tolerated
// because some OpenAI-compatible backends omit finish_reason on a full non-stream
// response; blank content is still rejected separately below.
const COMPLETE_FINISH_REASONS = new Set(['stop', null, undefined]);

/**
 * Typed error for an incomplete / unusable upstream completion (truncated,
 * blank, or an unsupported finish state). Carries a bounded class-only `code`;
 * the caller maps it to a truthful degraded state and NEVER shows raw output.
 */
class MapleIncompleteError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MapleIncompleteError';
    this.code = code;
  }
}

function mapleTimeoutMs(env = process.env) {
  const parsed = Number.parseInt(env.LUCA_AI_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function mapleMaxOutputTokens(env = process.env) {
  const parsed = Number.parseInt(env.LUCA_MAPLE_MAX_TOKENS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, DEFAULT_MAX_OUTPUT_TOKENS) : DEFAULT_MAX_OUTPUT_TOKENS;
}

/**
 * Build a Maple provider instance.
 * @param {object} opts
 * @param {string} opts.baseUrl  loopback proxy base (…/v1)
 * @param {string} opts.model    model id (e.g. llama3-3-70b)
 * @param {string} opts.apiKey   LUCA_MAPLE_API_KEY (never logged)
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxOutputTokens]
 * @param {AbortSignal} [opts.signal] external cancellation (e.g. client disconnect)
 */
function createMapleAI({ baseUrl, model, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS, maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS, signal }) {
  // Detailed form used by the Maple route: returns not just the text but the
  // PROVIDER-REPORTED model and the finish reason, so callers can record honest
  // provenance and reject incomplete answers. `complete()` wraps this and returns
  // only the string, so the generic AIProvider port contract stays unchanged.
  async function completeDetailed({ system, prompt, context }) {
    const userContent = context
      ? `CONTEXT (use this, do not invent):\n${context}\n\n${prompt}`
      : prompt;

    if (typeof userContent === 'string' && userContent.length > MAX_INPUT_CHARS) {
      // Bound outbound size — do not send oversized payloads to the enclave.
      throw new Error('maple_input_too_large');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    // Link external cancellation (client disconnect) to this request, and keep a
    // reference so the listener can be removed in finally (no dangling listener).
    let onExternalAbort = null;
    if (signal) {
      if (signal.aborted) controller.abort();
      else {
        onExternalAbort = () => controller.abort();
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const res = await fetch(`${String(baseUrl).replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0.4,
          max_tokens: maxOutputTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Never include the raw provider body in the error — status class only.
        // Drain the body so the socket can be reused, but discard its contents.
        await res.text().catch(() => {});
        throw new Error(`maple_proxy_status_${res.status}`);
      }

      const data = await res.json();
      const choice = data && Array.isArray(data.choices) ? data.choices[0] : null;
      const finishReason = choice ? choice.finish_reason : undefined;
      // Provider-reported model (evidence, NOT independent attestation). Absent ⇒ null.
      const reportedModel = data && typeof data.model === 'string' && data.model ? data.model : null;

      // Truncation / unsupported completion state ⇒ INCOMPLETE. Do not slice or
      // pad a partial answer to force-fit it — treat it as a failure.
      if (!COMPLETE_FINISH_REASONS.has(finishReason)) {
        throw new MapleIncompleteError(
          finishReason === 'length' ? 'maple_incomplete_length' : 'maple_incomplete'
        );
      }

      let out = choice && choice.message && typeof choice.message.content === 'string'
        ? choice.message.content
        : '';
      out = out.trim();
      if (!out) throw new MapleIncompleteError('maple_blank');
      // Defensive ceiling only (unreachable at 256 output tokens); a complete
      // 'stop' reply is never truncated here — finish_reason is validated above.
      if (out.length > MAX_OUTPUT_CHARS) out = out.slice(0, MAX_OUTPUT_CHARS);
      return { text: out, model: reportedModel, finishReason: finishReason ?? null };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new Error('maple_timeout');
      }
      // Re-throw our own typed incomplete errors and bounded maple_* classes as-is;
      // wrap anything else to a generic class so raw network/parse messages never
      // propagate to logs/clients.
      if (error instanceof MapleIncompleteError) throw error;
      const msg = error && typeof error.message === 'string' ? error.message : '';
      if (/^maple_/.test(msg)) throw error;
      throw new Error('maple_request_failed');
    } finally {
      clearTimeout(timeout);
      if (signal && onExternalAbort) signal.removeEventListener('abort', onExternalAbort);
    }
  }

  return {
    id: `maple:${model}`,
    // Generic port contract (unchanged): resolve to the reply string only.
    async complete(args) {
      const { text } = await completeDetailed(args);
      return text;
    },
    completeDetailed,
  };
}

/**
 * Factory that reads Maple config from env. THROWS a bounded error when the
 * required key is absent (the caller turns that into a truthful degraded state —
 * never a mock reply).
 */
function createMapleProvider(env = process.env, { signal } = {}) {
  const apiKey = env.LUCA_MAPLE_API_KEY;
  if (!apiKey) {
    const e = new Error('maple_no_api_key');
    e.code = 'MAPLE_NO_KEY';
    throw e;
  }
  const baseUrl = env.LUCA_MAPLE_BASE_URL || 'http://127.0.0.1:8788/v1';
  const model = env.LUCA_MAPLE_MODEL || 'llama3-3-70b';
  return createMapleAI({
    baseUrl,
    model,
    apiKey,
    timeoutMs: mapleTimeoutMs(env),
    maxOutputTokens: mapleMaxOutputTokens(env),
    signal,
  });
}

module.exports = {
  createMapleAI,
  createMapleProvider,
  mapleTimeoutMs,
  mapleMaxOutputTokens,
  MapleIncompleteError,
  MAX_INPUT_CHARS,
  DEFAULT_MAX_OUTPUT_TOKENS,
};

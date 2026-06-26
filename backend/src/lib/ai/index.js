'use strict';
/**
 * AIProvider — THE shared seam between Strategy B (cloud, now) and Strategy A (local QVAC, funded).
 *
 * This is the same port shape as the luca-node scaffold (packages/ports). The Solaris app calls
 * through this; whether it hits a cloud LLM or a local QVAC endpoint is one env var. When funding
 * lands and you stand up the sovereign stack, you change LUCA_AI_MODE — not the application code.
 *
 *   LUCA_AI_MODE = cloud   -> OpenAI-compatible cloud endpoint (the fundraising demo)
 *   LUCA_AI_MODE = local   -> QVAC at http://127.0.0.1:8080/v1 (Strategy A; same code path)
 *   LUCA_AI_MODE = mock    -> the old regex (offline fallback; zero cost; no key)
 *
 * Both `cloud` and `local` use ONE adapter (OpenAI-compatible Chat Completions), because QVAC
 * speaks the same protocol. That single fact is why B converges to A with no rewrite.
 */

const { createMockReply } = require('./mock');

/** OpenAI-compatible adapter — works with OpenAI, Together, Groq, OpenRouter, AND local QVAC. */
function createOpenAICompatibleAI({ baseUrl, model, apiKey }) {
  return {
    id: `openai-compatible:${model}`,
    async complete({ system, prompt, context }) {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey || 'not-needed'}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: context ? `CONTEXT (use this, do not invent):\n${context}\n\n${prompt}` : prompt },
          ],
          temperature: 0.4,
          max_tokens: 700,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`AI endpoint ${baseUrl} -> ${res.status} ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content?.trim() ?? '';
    },
  };
}

/** Anthropic adapter — for running the coach on Claude directly. */
function createAnthropicAI({ model, apiKey }) {
  return {
    id: `anthropic:${model}`,
    async complete({ system, prompt, context }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          system,
          messages: [{ role: 'user', content: context ? `CONTEXT (use this, do not invent):\n${context}\n\n${prompt}` : prompt }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Anthropic -> ${res.status} ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    },
  };
}

/** Mock adapter — the original regex, kept as a zero-cost, no-key, offline fallback. */
function createMockAI() {
  return {
    id: 'mock:luca-reflex-v0',
    async complete({ prompt, context }) {
      return createMockReply(prompt, context);
    },
  };
}

/**
 * Factory: returns the configured provider, with safe fallback to mock if a cloud key is missing.
 * Never throws on construction — a missing key degrades to mock so the demo never hard-fails.
 */
function getAIProvider(env = process.env) {
  const mode = (env.LUCA_AI_MODE || 'mock').toLowerCase();

  if (mode === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) return { ...createMockAI(), degraded: 'no ANTHROPIC_API_KEY' };
    return createAnthropicAI({ model: env.LUCA_AI_MODEL || 'claude-sonnet-4-6', apiKey: env.ANTHROPIC_API_KEY });
  }

  if (mode === 'cloud') {
    if (!env.LUCA_AI_API_KEY) return { ...createMockAI(), degraded: 'no LUCA_AI_API_KEY' };
    return createOpenAICompatibleAI({
      baseUrl: env.LUCA_AI_BASE_URL || 'https://api.openai.com/v1',
      model: env.LUCA_AI_MODEL || 'gpt-4o-mini',
      apiKey: env.LUCA_AI_API_KEY,
    });
  }

  if (mode === 'local') {
    // Strategy A: local QVAC. Same adapter as cloud — only the baseUrl changes.
    return createOpenAICompatibleAI({
      baseUrl: env.LUCA_AI_BASE_URL || 'http://127.0.0.1:8080/v1',
      model: env.LUCA_AI_MODEL || 'Qwen2.5-7B-Instruct',
      apiKey: 'not-needed',
    });
  }

  return createMockAI();
}

module.exports = { getAIProvider, createOpenAICompatibleAI, createAnthropicAI, createMockAI };

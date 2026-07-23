'use strict';
/**
 * AIProvider — the shared seam between managed cloud, Abacus RouteLLM, and local QVAC.
 *
 * The Solaris app calls through this port. Provider changes are configuration changes,
 * not route rewrites:
 *
 *   LUCA_AI_MODE = abacus   -> Abacus RouteLLM (OpenAI-compatible)
 *   LUCA_AI_MODE = cloud    -> any OpenAI-compatible cloud endpoint
 *   LUCA_AI_MODE = anthropic-> Anthropic Messages API
 *   LUCA_AI_MODE = local    -> local QVAC/OpenAI-compatible endpoint
 *   LUCA_AI_MODE = mock     -> deterministic offline fallback
 */
const { createMockReply } = require('./mock');

const DEFAULT_TIMEOUT_MS = 20000;

function requestTimeoutMs(env = process.env) {
  const parsed = Number.parseInt(env.LUCA_AI_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * OpenAI-compatible adapter.
 * Works with Abacus RouteLLM, OpenAI, Together, Groq, OpenRouter, and local QVAC.
 */
function createOpenAICompatibleAI({
  baseUrl,
  model,
  apiKey,
  provider = 'openai-compatible',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  return {
    id: `${provider}:${model}`,
    async complete({ system, prompt, context }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey || 'not-needed'}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              {
                role: 'user',
                content: context
                  ? `CONTEXT (use this, do not invent):\n${context}\n\n${prompt}`
                  : prompt,
              },
            ],
            temperature: 0.4,
            max_tokens: 700,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`AI endpoint ${baseUrl} -> ${res.status} ${body.slice(0, 200)}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() ?? '';
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error(`AI endpoint ${baseUrl} timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Anthropic adapter — for running the coach on Claude directly. */
function createAnthropicAI({ model, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  return {
    id: `anthropic:${model}`,
    async complete({ system, prompt, context }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
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
            messages: [
              {
                role: 'user',
                content: context
                  ? `CONTEXT (use this, do not invent):\n${context}\n\n${prompt}`
                  : prompt,
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`Anthropic -> ${res.status} ${body.slice(0, 200)}`);
        }

        const data = await res.json();
        return (data.content || [])
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
          .trim();
      } catch (error) {
        if (error && error.name === 'AbortError') {
          throw new Error(`Anthropic timed out after ${timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

/** Mock adapter — deterministic, zero-cost, no-key, offline fallback. */
function createMockAI() {
  return {
    id: 'mock:luca-reflex-v0',
    async complete({ prompt, context }) {
      return createMockReply(prompt, context);
    },
  };
}

/**
 * Factory: returns the configured provider.
 * Construction never throws; missing credentials degrade to mock so the app remains usable.
 */
function getAIProvider(env = process.env) {
  const mode = (env.LUCA_AI_MODE || 'mock').toLowerCase();
  const timeoutMs = requestTimeoutMs(env);

  if (mode === 'abacus') {
    if (!env.LUCA_AI_API_KEY) {
      return { ...createMockAI(), degraded: 'no LUCA_AI_API_KEY for Abacus RouteLLM' };
    }
    return createOpenAICompatibleAI({
      baseUrl: env.LUCA_AI_BASE_URL || 'https://routellm.abacus.ai/v1',
      model: env.LUCA_AI_MODEL || 'claude-sonnet-4-6',
      apiKey: env.LUCA_AI_API_KEY,
      provider: 'abacus',
      timeoutMs,
    });
  }

  if (mode === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) {
      return { ...createMockAI(), degraded: 'no ANTHROPIC_API_KEY' };
    }
    return createAnthropicAI({
      model: env.LUCA_AI_MODEL || 'claude-sonnet-4-6',
      apiKey: env.ANTHROPIC_API_KEY,
      timeoutMs,
    });
  }

  if (mode === 'cloud') {
    if (!env.LUCA_AI_API_KEY) {
      return { ...createMockAI(), degraded: 'no LUCA_AI_API_KEY' };
    }
    return createOpenAICompatibleAI({
      baseUrl: env.LUCA_AI_BASE_URL || 'https://api.openai.com/v1',
      model: env.LUCA_AI_MODEL || 'gpt-4o-mini',
      apiKey: env.LUCA_AI_API_KEY,
      provider: env.LUCA_AI_PROVIDER || 'openai-compatible',
      timeoutMs,
    });
  }

  if (mode === 'local') {
    return createOpenAICompatibleAI({
      baseUrl: env.LUCA_AI_BASE_URL || 'http://127.0.0.1:8080/v1',
      model: env.LUCA_AI_MODEL || 'Qwen2.5-7B-Instruct',
      apiKey: 'not-needed',
      provider: 'local',
      timeoutMs,
    });
  }

  return createMockAI();
}

module.exports = {
  getAIProvider,
  createOpenAICompatibleAI,
  createAnthropicAI,
  createMockAI,
  requestTimeoutMs,
};

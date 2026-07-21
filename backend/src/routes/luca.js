'use strict';
/**
 * LUCA health-coach route — now a REAL AI coach behind the shared AIProvider.
 *
 * Same API surface as before (GET/POST /messages) so the frontend doesn't change.
 * The regex is gone from the hot path; it survives only as the mock fallback inside the provider.
 * Every reply records which model produced it (provenance) — the same audit instinct as Strategy A.
 *
 * Drop-in: replace backend/src/routes/luca.js with this file.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');

const router = express.Router();

const SYSTEM_PROMPT = `You are LUCA — a warm, heart-centered holistic health coach and concierge for the Solaris ecosystem.

Your role: facilitate a person's holistic health journey — listening, educating, encouraging small sustainable habits, and connecting them to the right human care (including Aura, a holistic, minimally-invasive dental and wellness clinic).

Hard rules (never break):
- You NEVER diagnose, prescribe, or replace a licensed clinician. You may educate, organize, and prepare.
- For anything clinical, urgent, or beyond wellness education, you guide the person to a licensed practitioner (and offer to help them book with Aura or a Solaris practitioner).
- You never invent facts about the person. Use only the context provided.
- You are calm, sovereign, and encouraging — the person is always in control of their own care and data.

Style: brief, warm, concrete. 2-4 short paragraphs max. Offer one clear next step. Avoid clinical jargon. Never alarmist.`;

async function buildContext(userId) {
  const parts = [];

  const a = await db.query(
    'SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  if (a.rows[0]) {
    const focus = (a.rows[0].top_focus_areas_json || []).map((f) => f.name || f).join(', ');
    parts.push(`Assessment — vitality ${a.rows[0].vitality_score}/100; focus areas: ${focus || 'not specified'}.`);
  } else {
    parts.push('Assessment — not completed yet (encourage completing the Solaris Method assessment).');
  }

  const recent = await db.query(
    'SELECT role, content FROM luca_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 6',
    [userId]
  );
  if (recent.rows.length) {
    const history = recent.rows.reverse().map((r) => `${r.role}: ${r.content}`).join('\n');
    parts.push(`Recent conversation:\n${history}`);
  }

  return parts.join('\n\n');
}

router.get('/messages', authMiddleware, async (req, res) => {
  const r = await db.query(
    'SELECT role, content, created_at FROM luca_messages WHERE user_id=$1 ORDER BY created_at ASC LIMIT 100',
    [req.user.userId]
  );
  res.json({ messages: r.rows });
});

// ── Abacus Custom Chatbot (the LUCA deployment) ──────────────────────────────
// deploymentToken and deploymentId are non-secret routing values (safe as constants).
// The apiKey is server-side only (process.env.ABACUS_API_KEY, injected from VM metadata).
const ABACUS_DEPLOYMENT_TOKEN = 'c77ed09b44dc4728b07dec5afc89c6ff';
const ABACUS_DEPLOYMENT_ID = '324938b78';
const ABACUS_CHAT_URL = 'https://api.abacus.ai/api/v0/getChatResponse';

/** Pull the assistant reply text out of the Abacus getChatResponse payload (shape-tolerant). */
function parseAbacusReply(data) {
  if (!data) return '';
  // Common shapes: { success, result: { messages:[{is_user:false,text}], ... } } or { result: "text" }
  const r = data.result ?? data.response ?? data.reply ?? data;
  if (typeof r === 'string') return r.trim();
  if (Array.isArray(r?.messages)) {
    const last = [...r.messages].reverse().find((m) => m && m.is_user === false && (m.text || m.content));
    if (last) return String(last.text || last.content).trim();
  }
  // some deployments return { result: { text } } or { messages } at top level
  if (r?.text) return String(r.text).trim();
  if (Array.isArray(data.messages)) {
    const last = [...data.messages].reverse().find((m) => m && m.is_user === false && (m.text || m.content));
    if (last) return String(last.text || last.content).trim();
  }
  return '';
}

/** Fall back to the local AIProvider (mock by default) so the chat never hard-fails. */
async function fallbackReply(content, context) {
  const mock = getAIProvider({ ...process.env, LUCA_AI_MODE: 'mock' });
  const reply = await mock.complete({ system: SYSTEM_PROMPT, prompt: content, context });
  return { reply, model: mock.id };
}

router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });

    const userId = req.user.userId;

    // 1. persist the user's message
    await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'user', content]);

    // 2. health context primer (assessment + recent conversation)
    const context = await buildContext(userId);

    // 3. load recent conversation thread (ASC, last 20) for the chatbot
    const hist = await db.query(
      'SELECT role, content FROM luca_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    const ordered = hist.rows.reverse(); // back to chronological

    // 4. build the Abacus messages array: context primer first, then the thread
    const messages = [
      {
        is_user: false,
        text: `[Health context for this session — use this to personalize; do not repeat it verbatim to the user]:\n${context}`,
      },
      ...ordered.map((m) => ({ is_user: m.role === 'user', text: m.content })),
    ];
    // ensure the newest user message is present as the final turn
    if (!ordered.length || ordered[ordered.length - 1].role !== 'user') {
      messages.push({ is_user: true, text: content });
    }

    // 5. call the Abacus Custom Chatbot
    let reply = '';
    let model = 'abacus-luca';
    let degraded = false;

    const apiKey = process.env.ABACUS_API_KEY;
    if (!apiKey) {
      console.error('ABACUS_API_KEY missing — falling back to mock');
      const fb = await fallbackReply(content, context);
      reply = fb.reply; model = fb.model; degraded = true;
    } else {
      try {
        const params = new URLSearchParams({
          deploymentToken: ABACUS_DEPLOYMENT_TOKEN,
          deploymentId: ABACUS_DEPLOYMENT_ID,
        });
        const abRes = await fetch(`${ABACUS_CHAT_URL}?${params.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apiKey },
          body: JSON.stringify({ messages }),
        });
        if (!abRes.ok) {
          const body = await abRes.text().catch(() => '');
          throw new Error(`Abacus chat ${abRes.status}: ${body.slice(0, 200)}`);
        }
        const data = await abRes.json();
        reply = parseAbacusReply(data);
        if (!reply) {
          console.error('Abacus reply empty/unrecognized shape:', JSON.stringify(data).slice(0, 400));
          throw new Error('Empty reply from Abacus');
        }
      } catch (e) {
        console.error('Abacus chatbot error, falling back to mock:', e.message);
        const fb = await fallbackReply(content, context);
        reply = fb.reply; model = fb.model; degraded = true;
      }
    }

    // 6. persist the assistant reply (with provenance)
    await db.query(
      'INSERT INTO luca_messages (user_id, role, content, model) VALUES ($1,$2,$3,$4)',
      [userId, 'assistant', reply, model]
    ).catch(async () => {
      await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'assistant', reply]);
    });

    res.json({ reply, model, degraded });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

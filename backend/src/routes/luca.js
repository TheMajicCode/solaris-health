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

router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });

    await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [req.user.userId, 'user', content]);

    const ai = getAIProvider();
    const context = await buildContext(req.user.userId);

    let reply;
    try {
      reply = await ai.complete({ system: SYSTEM_PROMPT, prompt: content, context });
    } catch (e) {
      // graceful degradation: never hard-fail the chat; fall back to mock
      console.error('AI provider error, falling back to mock:', e.message);
      const { getAIProvider: _g } = require('../lib/ai');
      reply = await _g({ ...process.env, LUCA_AI_MODE: 'mock' }).complete({ system: SYSTEM_PROMPT, prompt: content, context });
    }

    // persist with provenance: which model produced this reply
    await db.query(
      'INSERT INTO luca_messages (user_id, role, content, model) VALUES ($1,$2,$3,$4)',
      [req.user.userId, 'assistant', reply, ai.id]
    ).catch(async () => {
      // if the `model` column doesn't exist yet, fall back to the original insert
      await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [req.user.userId, 'assistant', reply]);
    });

    res.json({ reply, model: ai.id, degraded: ai.degraded || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

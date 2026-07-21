'use strict';
/**
 * LUCA health-coach route — a REAL AI coach behind the shared AIProvider.
 *
 * The in-app LUCA Coach uses the VM LLM directly (cloud mode) so we have full
 * control over what LUCA knows and can say. A rich [PASSPORT CONTEXT] block is
 * injected on every turn from the user's real Solaris data, and the system prompt
 * explicitly grants LUCA the authority to use it.
 *
 * (The Abacus Custom Chatbot — a RAG/document-grounded bot — was retired from the
 * in-app flow because its uploaded docs claim it "can't see health data". Its
 * routing constants are kept commented below for a future public landing-page widget.)
 *
 * Same API surface as before (GET/POST /messages) so the frontend doesn't change.
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');

const router = express.Router();

// ── Abacus Custom Chatbot (retired from in-app flow; kept for a future public widget) ──
// deploymentToken and deploymentId are non-secret routing values (safe as constants).
// const ABACUS_DEPLOYMENT_TOKEN = 'c77ed09b44dc4728b07dec5afc89c6ff';
// const ABACUS_DEPLOYMENT_ID = '324938b78';
// const ABACUS_CHAT_URL = 'https://api.abacus.ai/api/v0/getChatResponse';

const SYSTEM_PROMPT = `You are LUCA — the Heart-Centered Intelligence guide for the Solaris Sovereign Health Platform.

WHAT YOU KNOW:
At the start of every conversation, you receive a [PASSPORT CONTEXT] block containing this user's real health data from their Solaris Passport: their name, vitality score, focus areas, recent daily check-ins (sleep, energy, mood, hydration, movement), LOVE points, and recent activity. USE THIS DATA. It is real. Reference it directly and specifically. Never say you can't see their health data — you have it.

WHAT YOU DO:
- Give personalized, specific guidance based on the user's actual Passport data
- Interpret their numbers for them (what does a 67 vitality score mean in plain terms?)
- Notice patterns across their check-ins (e.g. low sleep + low energy trend)
- Suggest concrete, small next steps anchored in their real data
- Name specific focus areas from their assessment and help them act on them
- Connect them to relevant care in the Solaris network (practitioners, workshops, clinics)
- Celebrate their LOVE points and contributions as evidence of their commitment
- Help them understand what their Solaris Passport is doing for them

WHAT YOU NEVER DO:
- Diagnose, prescribe, or make clinical/legal/financial decisions — those go to licensed practitioners
- Invent data — use only what is in the [PASSPORT CONTEXT] block
- Say generic things like "I can't see your data" or "I'm just an AI" — you have their data and you use it
- Give alarmist or fear-based guidance
- Be vague when you can be specific

TONE: warm, sovereign, grounded. Speak like a trusted health advisor who actually knows them — because you do. Be brief and actionable: 2-4 short paragraphs, one clear next step per reply. Plain language, no jargon.

SAFETY: If someone describes symptoms that need clinical attention, be warm but clear: guide them to a licensed practitioner and offer to help them find one in the Solaris network. Never minimize urgent concerns.

FOLLOW-UP SUGGESTIONS: After your reply, always add 2-3 short follow-up prompts the user might tap next. Write them from the USER's point of view (what they'd ask you), each 2-6 words. Output them at the very end of your message inside a fenced block exactly like this:
\`\`\`suggestions
["Log today's check-in", "What should I focus on?", "Find a practitioner"]
\`\`\`
The suggestions block must be valid JSON array of strings and must be the last thing in your message.`;

async function buildContext(userId) {
  const parts = [];

  // User basics
  const user = await db.query(
    'SELECT first_name, full_name, email, love_points, current_phase FROM users WHERE id=$1',
    [userId]
  );
  if (user.rows[0]) {
    const u = user.rows[0];
    parts.push(`User: ${u.full_name || u.first_name || 'Member'} (${u.email})`);
    parts.push(`LOVE Points: ${u.love_points || 0} | Phase: ${u.current_phase || 'active'}`);
  }

  // Latest assessment
  const assessment = await db.query(
    `SELECT vitality_score, mental_score, physical_score, emotional_score, spiritual_score,
            top_focus_areas_json, completed_at
     FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (assessment.rows[0]) {
    const a = assessment.rows[0];
    const focus = (a.top_focus_areas_json || []).map((f) => {
      if (typeof f === 'string') return f;
      return `${f.name}${typeof f.score === 'number' ? ` (score: ${f.score})` : ''}`;
    }).join(', ');
    parts.push(`\n[PASSPORT CONTEXT — VITALITY ASSESSMENT]
Vitality Score: ${a.vitality_score}/100
Mental: ${a.mental_score || '—'} | Physical: ${a.physical_score || '—'} | Emotional: ${a.emotional_score || '—'} | Spiritual: ${a.spiritual_score || '—'}
Top Focus Areas: ${focus || 'not specified'}
Last assessed: ${a.completed_at ? new Date(a.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'}`);
  } else {
    parts.push('\n[PASSPORT CONTEXT — VITALITY ASSESSMENT]\nNot completed yet. Encourage completing the Solaris Method assessment to unlock their vitality score and focus areas.');
  }

  // Last 7 daily check-ins
  const checkins = await db.query(
    `SELECT checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes
     FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 7`,
    [userId]
  );
  if (checkins.rows.length) {
    const rows = checkins.rows;
    const avgEnergy = Math.round(rows.reduce((s, r) => s + (r.energy_score || 0), 0) / rows.length);
    const avgMood = Math.round(rows.reduce((s, r) => s + (r.mood_score || 0), 0) / rows.length);
    const avgSleep = (rows.reduce((s, r) => s + parseFloat(r.sleep_hours || 0), 0) / rows.length).toFixed(1);
    const latest = rows[0];
    parts.push(`\n[PASSPORT CONTEXT — DAILY CHECK-INS (last ${rows.length} days)]
Latest (${new Date(latest.checkin_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}): Energy ${latest.energy_score}/100, Mood ${latest.mood_score}/100, Sleep ${parseFloat(latest.sleep_hours || 0).toFixed(1)}h, Hydration ${latest.hydration_glasses} glasses, Movement ${latest.movement_minutes}min
7-day averages: Energy ${avgEnergy}/100, Mood ${avgMood}/100, Sleep ${avgSleep}h`);
  } else {
    parts.push('\n[PASSPORT CONTEXT — DAILY CHECK-INS]\nNo check-ins logged yet. Encourage them to start their first check-in from the Health Passport.');
  }

  // Recent bookings (last 3) — booking_requests.user_id is the patient; date col is preferred_date
  const bookings = await db.query(
    `SELECT br.preferred_date, br.status, l.title as service_title
     FROM booking_requests br
     JOIN listings l ON l.id = br.listing_id
     WHERE br.user_id=$1 ORDER BY br.created_at DESC LIMIT 3`,
    [userId]
  );
  if (bookings.rows.length) {
    const blist = bookings.rows.map((b) =>
      `  • ${b.service_title} — ${b.preferred_date ? new Date(b.preferred_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'} (${b.status})`
    ).join('\n');
    parts.push(`\n[PASSPORT CONTEXT — RECENT BOOKINGS]\n${blist}`);
  }

  // Reward events (last 5)
  const rewards = await db.query(
    `SELECT event_type, points, note FROM reward_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );
  if (rewards.rows.length) {
    const rlist = rewards.rows.map((r) => `  • ${r.note || r.event_type}: +${r.points} LOVE`).join('\n');
    parts.push(`\n[PASSPORT CONTEXT — RECENT REWARDS]\n${rlist}`);
  }

  return parts.join('\n');
}

router.get('/messages', authMiddleware, async (req, res) => {
  const r = await db.query(
    'SELECT role, content, created_at FROM luca_messages WHERE user_id=$1 ORDER BY created_at ASC LIMIT 100',
    [req.user.userId]
  );
  res.json({ messages: r.rows });
});

// Default follow-up chips shown when the model doesn't return any
const DEFAULT_SUGGESTIONS = [
  "How is my vitality trending?",
  "Log today's check-in",
  "What should I focus on?",
];

// Extract a ```suggestions [...] ``` block from the reply; return cleaned text + array
function extractSuggestions(text) {
  if (!text) return { reply: text, suggestions: [] };
  const re = /```suggestions\s*([\s\S]*?)```/i;
  const m = text.match(re);
  let suggestions = [];
  let reply = text;
  if (m) {
    reply = text.replace(re, '').trim();
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s) => typeof s === 'string' && s.trim())
          .map((s) => s.trim())
          .slice(0, 3);
      }
    } catch (_) {
      // Fallback: line-based parse
      suggestions = m[1]
        .split('\n')
        .map((l) => l.replace(/^[-*\d.\[\]"']+\s*/, '').replace(/["',]+$/, '').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  }
  return { reply, suggestions };
}

router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });

    const userId = req.user.userId;

    // 1. Persist user message
    await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'user', content]);

    // 2. Build rich health context
    const context = await buildContext(userId);

    // 3. Use AIProvider (cloud mode = VM LLM, never the Abacus RAG bot)
    const ai = getAIProvider();
    let reply;
    try {
      reply = await ai.complete({ system: SYSTEM_PROMPT, prompt: content, context });
    } catch (e) {
      console.error('AI provider error, falling back to mock:', e.message);
      const fallback = getAIProvider({ ...process.env, LUCA_AI_MODE: 'mock' });
      reply = await fallback.complete({ system: SYSTEM_PROMPT, prompt: content, context });
    }

    // 3b. Parse & strip follow-up suggestions from the raw reply
    const { reply: cleanReply, suggestions: parsedSuggestions } = extractSuggestions(reply);
    const suggestions = parsedSuggestions.length ? parsedSuggestions : DEFAULT_SUGGESTIONS;

    // 4. Persist assistant reply (cleaned, with provenance)
    await db.query(
      'INSERT INTO luca_messages (user_id, role, content, model) VALUES ($1,$2,$3,$4)',
      [userId, 'assistant', cleanReply, ai.id]
    ).catch(async () => {
      await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'assistant', cleanReply]);
    });

    res.json({ reply: cleanReply, suggestions, model: ai.id, degraded: ai.degraded || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

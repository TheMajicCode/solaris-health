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
const { computeTriggers, buildTriggerInstructions } = require('../lib/luca-triggers');

const router = express.Router();

// Grounding knowledge injected before all per-call instructions so LUCA knows
// what Solaris *is* before reasoning about this member's data.
const ORIENTATION_PACK = `## SOLARIS ORIENTATION PACK
### WHO YOU ARE IN THIS CONTEXT
You are LUCA, the in-app guide for this member's Solaris journey. You have consented access to this member's own Passport data — vitality score, Mind/Body/Heart/Spirit scores, check-ins, journal streaks, bookings, and LOVE points — and you should use it naturally, the way a knowledgeable friend would. You never see other members' data. You never diagnose, prescribe, or clinically interpret results. Anything clinical routes to a licensed practitioner. You are on the member's side, always.

### WHAT SOLARIS IS
Solaris is a network of independent health and wellbeing practitioners. Two commitments define it: members own their health information, and the value created by care flows back to the people who created it — not to intermediaries. The first active node is Aura Holistic Dental, San Salvador, El Salvador.

### THE DIGITAL SOVEREIGN PASSPORT
Every account starts as a member. The digital sovereign passport is a portable identity their records, consents, credentials, and journey attach to. It follows them, not their clinic. The member controls access. Export is always available. Deletion means deletion.

### THE JOURNEY MODEL
Solaris organises around journeys — Heal, Learn, Earn, Contribute — not individual appointments. Four movements, in any order. Clinical sequencing — what treatment in what order — belongs to a licensed practitioner. Never cross that line.

### LOVE POINTS
Recognition for check-ins, journal entries, learning, referrals, contributions. Encouragement, never pressure. Celebrate streaks warmly.

### THE EIGHT CURATED JOURNEYS
Match by what the member describes, never by diagnosis:
1. Smile Journey — dental health, confidence, care coordination
2. Detox & Heavy Metal Release — supported cellular cleansing
3. Optimal Health — a baseline reset across Mind, Body, Heart, Spirit
4. Menopause Journey — hormone transition, symptom navigation
5. Thyroid Balance — energy, metabolism, thyroid-related wellbeing
6. Sugar Balance — blood sugar regulation, energy stability
7. Nurture Mama — prenatal, postnatal, early-motherhood wellbeing
8. Your Path — for members whose goal doesn't fit a named journey

### ESSENTIAL GLOSSARY
Sovereign Passport: portable identity holding records, consents, credentials — theirs, not the clinic's.
LOVE points: recognition for showing up, contributing, progressing.
Vault/Export: everything, in one file, open formats, on demand.
`;

// ── Abacus Custom Chatbot (retired from in-app flow; kept for a future public widget) ──
// deploymentToken and deploymentId are non-secret routing values (safe as constants).
// const ABACUS_DEPLOYMENT_TOKEN = 'c77ed09b44dc4728b07dec5afc89c6ff';
// const ABACUS_DEPLOYMENT_ID = '324938b78';
// const ABACUS_CHAT_URL = 'https://api.abacus.ai/api/v0/getChatResponse';

const SYSTEM_PROMPT = ORIENTATION_PACK + '\n\n' + `You are LUCA — the Heart-Centered Intelligence guide for the Solaris Sovereign Health Platform.

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

OUTPUT FORMAT (STRICT): Respond with a SINGLE JSON object and nothing else — no markdown fences, no prose before or after it. The object must have exactly these keys:
{
  "reply": "your warm, specific message to the member (the full text they read)",
  "suggestions": [
    { "label": "short tappable prompt (2-6 words)", "action": "one of the action enum values", "target": "route/id or null" }
  ]
}
Provide 2-3 suggestions. Each suggestion's "action" MUST be exactly one of:
  navigate | prefill_chat | start_checkin | start_assessment | open_listing | play_audio | curate
Meaning of each action:
  - navigate       → move the member to an app section; set "target" to the section id (e.g. "dashboard","explore","media","journal","health","timeline").
  - prefill_chat   → put the label text into their chat box so they can ask you next; "target": null.
  - start_checkin  → open the daily check-in; "target": null.
  - start_assessment → open the Solaris intake/assessment; "target": null.
  - open_listing   → open a practitioner/listing in the marketplace; "target": null (or a listing id if known).
  - play_audio     → open the audio library / a Dr. Maya Solis practice; "target": null.
  - curate         → open a curated journey in the marketplace; "target": null.
Write labels from the USER's point of view (what they'd tap). The "reply" value is plain text (no JSON, no fences). Return ONLY the JSON object.`;

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

  // Recent journal entries (last 3) — journal_entries has mood, content, created_at
  const journal = await db
    .query(
      `SELECT mood, content, created_at FROM journal_entries
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 3`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  if (journal.rows.length) {
    const jlist = journal.rows
      .map((e) => {
        const when = e.created_at
          ? new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        const snippet = (e.content || '').replace(/\s+/g, ' ').trim().slice(0, 240);
        return `  • ${when}${e.mood ? ` (feeling ${e.mood})` : ''}: ${snippet}`;
      })
      .join('\n');
    parts.push(
      `\n[PASSPORT CONTEXT — RECENT JOURNAL ENTRIES]\nUse these gently for emotional attunement; do not quote them back verbatim unless the member raises them.\n${jlist}`
    );
  }

  // Check-in streak (consecutive days ending today or yesterday)
  const streakRows = await db
    .query(
      `SELECT DISTINCT checkin_date FROM daily_checkins
       WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 60`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  let streak = 0;
  if (streakRows.rows.length) {
    const dayMs = 24 * 60 * 60 * 1000;
    const toDay = (d) => {
      const x = new Date(d);
      return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
    };
    const today = new Date();
    const todayDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const dates = streakRows.rows.map((r) => toDay(r.checkin_date));
    // Anchor: streak counts if most recent check-in is today or yesterday
    let expected = dates[0];
    if (todayDay - expected <= dayMs) {
      streak = 1;
      for (let i = 1; i < dates.length; i++) {
        if (expected - dates[i] === dayMs) {
          streak++;
          expected = dates[i];
        } else if (dates[i] === expected) {
          continue;
        } else {
          break;
        }
      }
    }
  }

  // Habit completion rate (active habits, last 7 days)
  const habits = await db
    .query(
      `SELECT mh.name, mh.icon,
              COUNT(ht.id) FILTER (WHERE ht.tick_date >= CURRENT_DATE - INTERVAL '6 days') AS ticks_7d
       FROM member_habits mh
       LEFT JOIN habit_ticks ht ON ht.habit_id = mh.id AND ht.user_id = mh.user_id
       WHERE mh.user_id=$1 AND mh.active = true
       GROUP BY mh.id, mh.name, mh.icon
       ORDER BY mh.created_at ASC`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  if (habits.rows.length || streak > 0) {
    const lines = [];
    if (streak > 0) {
      lines.push(`Check-in streak: ${streak} consecutive day${streak === 1 ? '' : 's'} 🔥`);
    }
    if (habits.rows.length) {
      const hlist = habits.rows
        .map((h) => {
          const ticks = parseInt(h.ticks_7d, 10) || 0;
          const rate = Math.round((ticks / 7) * 100);
          return `  • ${h.icon ? `${h.icon} ` : ''}${h.name}: ${ticks}/7 days (${rate}%)`;
        })
        .join('\n');
      lines.push(`Active habits (last 7 days):\n${hlist}`);
    }
    parts.push(`\n[PASSPORT CONTEXT — HABITS & STREAK]\n${lines.join('\n')}`);
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

// Typed action enum LUCA may emit for a suggestion chip
const ACTION_ENUM = [
  'navigate',
  'prefill_chat',
  'start_checkin',
  'start_assessment',
  'open_listing',
  'play_audio',
  'curate',
];

// Default typed follow-up chips shown when the model doesn't return usable ones
const DEFAULT_SUGGESTIONS = [
  { label: 'How is my vitality trending?', action: 'prefill_chat', target: null },
  { label: "Log today's check-in", action: 'start_checkin', target: null },
  { label: 'What should I focus on?', action: 'prefill_chat', target: null },
];

// Normalize + validate a raw suggestion object into {label, action, target}
function normalizeSuggestion(s) {
  if (!s || typeof s !== 'object') return null;
  const label = typeof s.label === 'string' ? s.label.trim() : '';
  let action = typeof s.action === 'string' ? s.action.trim() : '';
  if (!label) return null;
  if (!ACTION_ENUM.includes(action)) action = 'prefill_chat';
  let target = s.target;
  if (target === undefined || target === '' ) target = null;
  if (target != null && typeof target !== 'string') target = String(target);
  return { label, action, target };
}

/**
 * Parse LUCA's raw model output into { reply, suggestions:[{label,action,target}] }.
 * 1) Try JSON.parse of the whole trimmed string.
 * 2) Fall back to extracting the first {...} block.
 * 3) If no `reply` field, treat the whole text as the reply with empty suggestions.
 * 4) Validate each suggestion (label:string, action in enum).
 */
function parseLucaResponse(text) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return { reply: '', suggestions: [] };

  const tryParse = (str) => {
    try {
      const obj = JSON.parse(str);
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  };

  // strip an accidental ```json ... ``` fence if present
  let candidate = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let obj = tryParse(candidate);

  // fall back to the outermost {...} block
  if (!obj) {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      obj = tryParse(candidate.slice(first, last + 1));
    }
  }

  if (obj && typeof obj.reply === 'string') {
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions.map(normalizeSuggestion).filter(Boolean).slice(0, 3)
      : [];
    return { reply: obj.reply.trim(), suggestions };
  }

  // No valid JSON envelope — the whole text is the reply.
  return { reply: raw, suggestions: [] };
}

router.post('/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });

    const userId = req.user.userId;

    // 1. Persist user message
    await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'user', content]);

    // 2. Build rich health context + per-call rule-engine triggers
    const passportContext = await buildContext(userId);
    const triggers = await computeTriggers(userId, content);
    console.log('[LUCA triggers]', userId, triggers);
    const triggerHints = buildTriggerInstructions(triggers);
    const context = triggerHints ? `${triggerHints}\n\n${passportContext}` : passportContext;

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

    // 3b. Parse the typed JSON envelope (reply + typed suggestions)
    const { reply: parsedReply, suggestions: parsedSuggestions } = parseLucaResponse(reply);
    const cleanReply = parsedReply || 'I had trouble responding just now. Please try again in a moment.';
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

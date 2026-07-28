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
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { clientIpKey } = require('../lib/rate-limits');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');
const { recordAIReceipt } = require('../lib/ai/receipts');
const { redactForExternalAI, isExternalProvider } = require('../lib/phi-boundary');
const { checkCapability, recordGrantUse } = require('../lib/agent-authority');
const { computeTriggers, buildTriggerInstructions, buildTriggerSuggestions } = require('../lib/luca-triggers');
const { getFoundational } = require('../lib/foundational');
const { getExclusions } = require('../lib/intelligence');
const { MILESTONE_DEFS_COUNT } = require('./journeys');

// Warm labels for journey types (kept in sync with the frontend).
const JOURNEY_LABELS = {
  optimal_health: 'Optimal Health',
  detox: 'Gentle Detox',
  menopause: 'Menopause Support',
  heavy_metal: 'Heavy Metal Release',
  smile: 'The Smile Journey',
  thyroid: 'Thyroid Balance',
  sugar: 'Sugar Balance',
  nurture_mama: 'Nurture Mama',
  your_path: 'Your Path',
};

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
  navigate | prefill_chat | start_checkin | start_assessment | open_listing | play_audio | curate | open_intake
Meaning of each action:
  - navigate       → move the member to an app section; set "target" to the section id (e.g. "dashboard","explore","media","journal","health","timeline").
  - prefill_chat   → put the label text into their chat box so they can ask you next; "target": null.
  - start_checkin  → open the daily check-in; "target": null.
  - start_assessment → open the Solaris intake/assessment; "target": null.
  - open_listing   → open a specific practitioner's profile in the marketplace; "target" MUST be one of the exact practitioner ids from the [PASSPORT CONTEXT — SOLARIS PRACTITIONER DIRECTORY] block (never invent an id; use null if unsure).
  - play_audio     → open the audio library / a Dr. Maya Solis practice; "target": null.
  - curate         → ask Solaris to curate the best-matched practitioner for the member in the marketplace; "target": null.
  - open_intake    → open the member's intake / health questionnaire flow; "target": null.
Write labels from the USER's point of view (what they'd tap). The "reply" value is plain text (no JSON, no fences). Return ONLY the JSON object.`;

async function buildContext(userId, collector = {}) {
  const parts = [];

  // A member may switch off any context source (spec A3 — Artificial pane).
  // `collector.excluded` is a Set of source keys; absence = included. We record
  // every excludable source we consulted into `collector.sources` (key, label,
  // count, included) so the Intelligence tab can show *exactly* what LUCA saw
  // this turn — never hardcoded. `emit` pushes text to the prompt only when the
  // source is included, but always records the source + its record count.
  const excluded = collector.excluded instanceof Set ? collector.excluded : new Set();
  collector.sources = [];
  const emit = (key, label, count, text) => {
    const included = !excluded.has(key);
    collector.sources.push({ key, label, count, included });
    if (included && text) parts.push(text);
  };

  // User basics — always on (not PHI, needed to address the member at all).
  const user = await db.query(
    'SELECT first_name, full_name, email, love_points, current_phase FROM users WHERE id=$1',
    [userId]
  );
  if (user.rows[0]) {
    const u = user.rows[0];
    parts.push(`User: ${u.full_name || u.first_name || 'Member'} (${u.email})`);
    parts.push(`LOVE Points: ${u.love_points || 0} | Phase: ${u.current_phase || 'active'}`);
  }

  // Foundational health profile (spec A5 Part A @ L2) — self-reported baseline.
  const foundational = await getFoundational(db, userId).catch(() => null);
  if (foundational && foundational.data && Object.keys(foundational.data).length) {
    const fd = foundational.data;
    const keys = Object.keys(fd).filter((k) => fd[k] != null && fd[k] !== '');
    const summary = keys.slice(0, 10).map((k) => {
      const v = Array.isArray(fd[k]) ? fd[k].join(', ') : fd[k];
      return `  • ${k}: ${v}`;
    }).join('\n');
    emit('foundational', 'Foundational health profile', keys.length,
      `\n[PASSPORT CONTEXT — FOUNDATIONAL HEALTH PROFILE (self-reported, L${foundational.level ?? 2})]\nLast updated ${foundational.observedAt ? new Date(foundational.observedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'}.\n${summary}`);
  } else {
    emit('foundational', 'Foundational health profile', 0, null);
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
    emit('assessment', 'Vitality assessment', 1, `\n[PASSPORT CONTEXT — VITALITY ASSESSMENT]
Vitality Score: ${a.vitality_score}/100
Mental: ${a.mental_score || '—'} | Physical: ${a.physical_score || '—'} | Emotional: ${a.emotional_score || '—'} | Spiritual: ${a.spiritual_score || '—'}
Top Focus Areas: ${focus || 'not specified'}
Last assessed: ${a.completed_at ? new Date(a.completed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'unknown'}`);
  } else {
    emit('assessment', 'Vitality assessment', 0, '\n[PASSPORT CONTEXT — VITALITY ASSESSMENT]\nNot completed yet. Encourage completing the Solaris Method assessment to unlock their vitality score and focus areas.');
  }

  // Last 7 daily check-ins
  const checkins = await db.query(
    `SELECT checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes, nutrition_score
     FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 7`,
    [userId]
  );
  if (checkins.rows.length) {
    const rows = checkins.rows;
    const avgEnergy = Math.round(rows.reduce((s, r) => s + (r.energy_score || 0), 0) / rows.length);
    const avgMood = Math.round(rows.reduce((s, r) => s + (r.mood_score || 0), 0) / rows.length);
    const avgSleep = (rows.reduce((s, r) => s + parseFloat(r.sleep_hours || 0), 0) / rows.length).toFixed(1);
    const latest = rows[0];
    emit('checkins', 'Daily check-ins', rows.length, `\n[PASSPORT CONTEXT — DAILY CHECK-INS (last ${rows.length} days)]
Latest (${new Date(latest.checkin_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}): Energy ${latest.energy_score}/100, Mood ${latest.mood_score}/100, Sleep ${parseFloat(latest.sleep_hours || 0).toFixed(1)}h, Hydration ${latest.hydration_glasses} glasses, Movement ${latest.movement_minutes}min, Nutrition ${latest.nutrition_score != null ? `${latest.nutrition_score}/10` : '—'}
7-day averages: Energy ${avgEnergy}/100, Mood ${avgMood}/100, Sleep ${avgSleep}h`);
  } else {
    emit('checkins', 'Daily check-ins', 0, '\n[PASSPORT CONTEXT — DAILY CHECK-INS]\nNo check-ins logged yet. Encourage them to start their first check-in from the Health Passport.');
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
    emit('bookings', 'Recent bookings', bookings.rows.length, `\n[PASSPORT CONTEXT — RECENT BOOKINGS]\n${blist}`);
  } else {
    emit('bookings', 'Recent bookings', 0, null);
  }

  // Reward events (last 5)
  const rewards = await db.query(
    `SELECT event_type, points, note FROM reward_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5`,
    [userId]
  );
  if (rewards.rows.length) {
    const rlist = rewards.rows.map((r) => `  • ${r.note || r.event_type}: +${r.points} LOVE`).join('\n');
    emit('rewards', 'LOVE rewards', rewards.rows.length, `\n[PASSPORT CONTEXT — RECENT REWARDS]\n${rlist}`);
  } else {
    emit('rewards', 'LOVE rewards', 0, null);
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
    emit('journal', 'Journal entries', journal.rows.length,
      `\n[PASSPORT CONTEXT — RECENT JOURNAL ENTRIES]\nUse these gently for emotional attunement; do not quote them back verbatim unless the member raises them.\n${jlist}`
    );
  } else {
    emit('journal', 'Journal entries', 0, null);
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
    emit('habits', 'Habits & streak', habits.rows.length, `\n[PASSPORT CONTEXT — HABITS & STREAK]\n${lines.join('\n')}`);
  } else {
    emit('habits', 'Habits & streak', 0, null);
  }

  // Active journeys — the guided program(s) the member is walking.
  const journeyRes = await db
    .query(
      `SELECT journey_type, status, milestones_json, started_at
       FROM member_journeys WHERE user_id=$1 AND status='active'
       ORDER BY started_at DESC`,
      [userId]
    )
    .catch(() => ({ rows: [] }));
  if (journeyRes.rows.length > 0) {
    const jlines = journeyRes.rows.map((j) => {
      const done = (Array.isArray(j.milestones_json) ? j.milestones_json : []).filter(
        (m) => m.completed
      ).length;
      const total = MILESTONE_DEFS_COUNT[j.journey_type] || 4;
      const label = JOURNEY_LABELS[j.journey_type] || j.journey_type;
      return `  • ${label}: ${done}/${total} milestones complete (started ${new Date(
        j.started_at
      ).toLocaleDateString()})`;
    });
    emit('journeys', 'Active journeys', journeyRes.rows.length,
      `\n[PASSPORT CONTEXT — ACTIVE JOURNEY]\n${jlines.join(
        '\n'
      )}\nGently encourage progress toward the next milestone when it feels natural.`
    );
  } else {
    emit('journeys', 'Active journeys', 0, null);
  }

  // Practitioner directory — real bookable practitioners LUCA may deep-link to.
  const providers = await db
    .query(
      `SELECT id, business_name, provider_type, city, specialties
       FROM provider_profiles
       WHERE status='active' AND approval_status='approved' AND hidden=false
       ORDER BY rating DESC NULLS LAST LIMIT 20`
    )
    .catch(() => ({ rows: [] }));
  if (providers.rows.length) {
    collector.providerIds = new Set(providers.rows.map((p) => String(p.id)));
    const plist = providers.rows
      .map((p) => {
        const specs = (Array.isArray(p.specialties) ? p.specialties : []).slice(0, 3).join(', ');
        return `  • id=${p.id} | ${p.business_name} (${p.provider_type}${p.city ? `, ${p.city}` : ''})${specs ? ` — ${specs}` : ''}`;
      })
      .join('\n');
    parts.push(
      `\n[PASSPORT CONTEXT — SOLARIS PRACTITIONER DIRECTORY]\nWhen suggesting a practitioner (action "open_listing"), set "target" to one of these EXACT ids:\n${plist}`
    );
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
  'open_intake',
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

    // 0. Agent authority (Slice 7): LUCA acts only under an active, unexpired
    // capability grant. A disabled LUCA never deletes data or logs anyone out.
    const authority = await checkCapability(userId, 'luca.chat').catch(() => ({ allowed: true, grant: null }));
    if (!authority.allowed) {
      return res.status(403).json({
        error: 'LUCA is currently switched off for your account. Your data and Passport are untouched — you can re-enable LUCA anytime from your Passport.',
        reason: authority.reason,
        agentDisabled: true,
      });
    }

    // 1. Persist user message
    await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'user', content]);

    // 2. Build rich health context + per-call rule-engine triggers.
    //    Honor the member's source-exclusion toggles (spec A3): any source they
    //    switched off is dropped from the context LUCA sees this turn.
    const ctxCollector = { excluded: await getExclusions(db, userId).catch(() => new Set()) };
    const passportContext = await buildContext(userId, ctxCollector);
    const triggers = await computeTriggers(userId, content);
    console.log('[LUCA triggers]', userId, Object.keys(triggers)); // keys only — never trigger values (health-derived)
    const triggerHints = buildTriggerInstructions(triggers);
    const context = triggerHints ? `${triggerHints}\n\n${passportContext}` : passportContext;

    // 3. Use AIProvider (cloud mode = VM LLM, never the Abacus RAG bot)
    let ai = getAIProvider();
    // PHI boundary rule (policy v0): restricted identifiers (SSN/card/IBAN-like)
    // never leave the platform toward an external model. The member's stored
    // message is untouched; only the outbound copy is redacted.
    const outbound = isExternalProvider(ai) ? redactForExternalAI(content).text : content;
    let reply;
    let errorClass = null;
    const startedAt = Date.now();
    try {
      reply = await ai.complete({ system: SYSTEM_PROMPT, prompt: outbound, context });
    } catch (e) {
      console.error('AI provider error, falling back to mock:', e.message);
      errorClass = /timed out/i.test(e.message || '') ? 'provider_timeout' : 'provider_error';
      const fallback = getAIProvider({ ...process.env, LUCA_AI_MODE: 'mock' });
      reply = await fallback.complete({ system: SYSTEM_PROMPT, prompt: outbound, context });
      ai = { ...fallback, degraded: ai.degraded || errorClass };
    }
    const latencyMs = Date.now() - startedAt;

    // 3b. Parse the typed JSON envelope (reply + typed suggestions)
    const { reply: parsedReply, suggestions: parsedSuggestions } = parseLucaResponse(reply);
    const cleanReply = parsedReply || 'I had trouble responding just now. Please try again in a moment.';
    // Server-side guard: open_listing targets must be real practitioner ids.
    const validProviderIds = ctxCollector.providerIds || new Set();
    let suggestions = parsedSuggestions.map((sug) => {
      if (sug.action === 'open_listing' && sug.target && !validProviderIds.has(sug.target)) {
        return { ...sug, target: null };
      }
      return sug;
    });
    // Always surface exactly 3 agentic chips. Pad first with RULE-DERIVED
    // suggestions (A1 §6 — the same fired rules that drive the dashboard cards),
    // then with static defaults, so fallback chips reflect what the member
    // actually needs next rather than generic prompts.
    const ruleFallbacks = buildTriggerSuggestions(triggers);
    for (const d of [...ruleFallbacks, ...DEFAULT_SUGGESTIONS]) {
      if (suggestions.length >= 3) break;
      if (!suggestions.some((sug) => sug.action === d.action && sug.label === d.label)) suggestions.push(d);
    }
    suggestions = suggestions.slice(0, 3);

    // 4. Persist assistant reply (cleaned, with provenance + AI audit trail).
    //    inputs_hash = non-reversible SHA-256 of the system-prompt prefix + user
    //    message, so we can audit *what shaped* a reply without storing raw prompts.
    const inputsHash = crypto.createHash('sha256')
      .update(JSON.stringify({ systemPrompt: SYSTEM_PROMPT.slice(0, 200), userMessage: content }))
      .digest('hex');
    const modelId = process.env.LUCA_AI_MODEL || ai.id || 'unknown';
    await db.query(
      'INSERT INTO luca_messages (user_id, role, content, model, model_id, inputs_hash) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId, 'assistant', cleanReply, ai.id, modelId, inputsHash]
    ).catch(async () => {
      await db.query('INSERT INTO luca_messages (user_id, role, content) VALUES ($1,$2,$3)', [userId, 'assistant', cleanReply]);
    });

    // 5. AI execution receipt — provenance only, hashes only, never raw text/PHI.
    await recordAIReceipt({
      userId,
      eventType: 'luca.member.chat',
      ai,
      requestedModel: process.env.LUCA_AI_MODEL || null,
      dataClass: 'health_context',
      consentBasis: 'member_self_query',
      latencyMs,
      inputText: content,
      resultText: cleanReply,
      degraded: Boolean(ai.degraded),
      errorClass,
    });
    recordGrantUse(authority.grant, { result: 'success' }); // audit: grant exercised (best-effort)

    res.json({ reply: cleanReply, suggestions, model: ai.id, degraded: ai.degraded || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ================================ LUCA TTS ================================
 * POST /api/luca/tts  { text }
 * Speaks a LUCA message aloud via an OpenAI-compatible /audio/speech endpoint.
 * This is a *progressive enhancement*: on ANY failure (no key, endpoint down,
 * unsupported) it responds 200 with { error, fallback:true } so the client can
 * silently hide the speaker button — it must NEVER crash the request path.
 */
const MAX_TTS_CHARS = 500;

// Rate-limit: 20 requests / minute / user (falls back to IP if unauthenticated).
const ttsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Per-user; unauthenticated falls back to IPv6-safe client IP key.
  keyGenerator: (req) => (req.user && String(req.user.userId)) || clientIpKey(req),
  handler: (req, res) => res.status(200).json({ error: 'Too many voice requests, please pause a moment.', fallback: true }),
});

// Strip lightweight markdown so the voice reads clean prose, not symbols.
function stripMarkdownForSpeech(s) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, ' ')        // code fences
    .replace(/`([^`]+)`/g, '$1')            // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')  // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')// links -> text
    .replace(/^#{1,6}\s+/gm, '')            // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2')     // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')        // italic
    .replace(/^\s*[-*+]\s+/gm, '')          // bullets
    .replace(/^\s*\d+\.\s+/gm, '')          // numbered lists
    .replace(/^\s*>\s?/gm, '')              // blockquotes
    .replace(/\s+/g, ' ')
    .trim();
}

router.post('/tts', authMiddleware, ttsLimiter, async (req, res) => {
  try {
    const raw = (req.body && req.body.text) || '';
    const text = stripMarkdownForSpeech(raw).slice(0, MAX_TTS_CHARS);
    if (!text) return res.status(200).json({ error: 'Nothing to speak', fallback: true });

    // TTS config: dedicated env vars fall back to the shared LUCA cloud creds.
    const baseUrl = (process.env.LUCA_TTS_BASE_URL || process.env.LUCA_AI_BASE_URL || '').replace(/\/$/, '');
    const apiKey = process.env.LUCA_TTS_API_KEY || process.env.LUCA_AI_API_KEY;
    const model = process.env.LUCA_TTS_MODEL || 'tts-1';
    const voice = process.env.LUCA_TTS_VOICE || 'nova';
    if (!baseUrl || !apiKey) {
      return res.status(200).json({ error: 'Voice is not configured', fallback: true });
    }

    // Guard against a hung upstream so the request never blocks indefinitely.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let upstream;
    try {
      upstream = await fetch(`${baseUrl}/audio/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, voice, input: text, response_format: 'mp3' }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!upstream || !upstream.ok) {
      const detail = upstream ? `${upstream.status}` : 'no response';
      console.warn('[luca tts] upstream failed:', detail);
      return res.status(200).json({ error: 'Voice unavailable right now', fallback: true });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (!buf.length) return res.status(200).json({ error: 'Empty audio', fallback: true });

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    return res.send(buf);
  } catch (err) {
    // Never crash — always degrade gracefully.
    console.warn('[luca tts] error (non-fatal):', err.message);
    return res.status(200).json({ error: 'Voice unavailable right now', fallback: true });
  }
});

// Expose buildContext so the Intelligence section (spec A3, Artificial pane)
// can compute *exactly* what LUCA would see this turn — same code path, no
// hardcoding. Attached to the router export to keep a single import site.
router.buildContext = buildContext;
module.exports = router;

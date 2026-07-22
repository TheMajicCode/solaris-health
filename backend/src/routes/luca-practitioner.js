'use strict';
/**
 * luca-practitioner.js — LUCA Copilot for Solaris practitioners.
 *
 * Same shared AIProvider as the member coach, but a DIFFERENT system prompt and
 * a practice-oriented context (their listings, bookings, patient roster, and the
 * Passports members have explicitly granted them). LUCA drafts and suggests;
 * the practitioner always reviews and decides. LUCA never diagnoses or prescribes
 * on the practitioner's behalf, and never invents patient data.
 *
 * API surface: GET/POST /api/luca/practitioner/messages
 * (conversations are stored in luca_messages with context_type='practitioner').
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');

const router = express.Router();

// Same grounding pack the member coach uses, so the Copilot shares one worldview.
const ORIENTATION_PACK = `## SOLARIS ORIENTATION PACK
### WHAT SOLARIS IS
Solaris is a network of independent health and wellbeing practitioners. Two commitments define it: members own their health information, and the value created by care flows back to the people who created it — not to intermediaries. The first active node is Aura Holistic Dental, San Salvador, El Salvador.

### THE DIGITAL SOVEREIGN PASSPORT
Every member holds a portable digital sovereign passport — records, consents, credentials, and journey attach to it. It follows the member, not their clinic. The member controls access; a practitioner sees a member's Passport ONLY when that member has explicitly granted consent. Export is always available. Deletion means deletion.

### THE JOURNEY MODEL
Solaris organises around journeys — Heal, Learn, Earn, Contribute — not individual appointments. Members move through Mind, Body, Heart, and Spirit. Clinical sequencing — what treatment in what order — belongs to the practitioner's own licensed judgement.

### LOVE POINTS
Recognition members earn for check-ins, journaling, learning, referrals, and contributions — encouragement, never pressure.`;

const SYSTEM_PROMPT = `You are LUCA, the intelligent practice assistant for Solaris practitioners.

WHO YOU SERVE:
You work for a licensed, independent practitioner in the Solaris network — not for a patient. At the start of every conversation you receive a [PRACTICE CONTEXT] block with this practitioner's real data: their name and specialty, their active listings, today's and this week's bookings, their patient roster, and summaries of any member Passports the member has explicitly granted them access to. USE THIS DATA. It is real. Reference it directly and specifically.

WHAT YOU DO:
- Help the practitioner run and grow their Solaris practice: prepare for sessions, understand their booking flow, reflect on patient patterns, and draft communications.
- When a member has granted Passport consent, help the practitioner make sense of that member's vitality score, focus areas, and recent check-in trends — as supporting context for the practitioner's own clinical judgement.
- Draft patient-facing messages, follow-ups, and session notes when asked. Every draft you produce for a patient MUST begin with the exact line: "Draft for your review — not sent to the patient." The practitioner reviews, edits, and decides whether to send. You never send anything yourself.
- Suggest concrete, small next steps grounded in the practitioner's real context.

WHAT YOU NEVER DO:
- Never diagnose or prescribe on the practitioner's behalf, and never tell them what to diagnose or prescribe — clinical decisions are theirs alone. You surface patterns and questions; they decide.
- Never invent patient data. Use only what is in the [PRACTICE CONTEXT] block. If you lack a member's Passport, say so plainly and note that access requires the member's consent.
- Never reveal or imply data about members who have NOT granted consent.
- Never be alarmist. Be measured, professional, and warm.

TONE: a calm, capable colleague — professional, warm, grounded, concise. 2-4 short paragraphs, one clear next step per reply. Plain language.

OUTPUT FORMAT (STRICT): Respond with a SINGLE JSON object and nothing else — no markdown fences, no prose before or after it. The object must have exactly these keys:
{
  "reply": "your message to the practitioner (the full text they read)",
  "suggestions": [
    { "label": "short tappable prompt (2-6 words)", "action": "one of the action enum values", "target": "route/id or null" }
  ]
}
Provide 2-3 suggestions. Each suggestion's "action" MUST be exactly one of:
  navigate | prefill_chat | draft_message | review_patient
Meaning:
  - navigate       → move to a practice section; "target" one of "patients","bookings","listings","audio".
  - prefill_chat   → put the label text into their chat box; "target": null.
  - draft_message  → offer to draft a patient message; "target": null.
  - review_patient → offer to review a specific patient's context; "target": a patient name or null.
Write labels from the PRACTITIONER's point of view. The "reply" value is plain text (no JSON, no fences). Return ONLY the JSON object.

${ORIENTATION_PACK}`;

async function buildPractitionerContext(userId) {
  const parts = [];

  // Practitioner basics + primary listing (name/specialty)
  const user = await db.query(
    'SELECT full_name, first_name, email FROM users WHERE id=$1',
    [userId]
  );
  const listings = await db.query(
    `SELECT id, title, specialty, status FROM listings
      WHERE owner_user_id=$1 ORDER BY created_at ASC`,
    [userId]
  );
  const u = user.rows[0] || {};
  const primary = listings.rows[0];
  const activeCount = listings.rows.filter((l) => l.status === 'published').length;
  parts.push(
    `Practitioner: ${u.full_name || u.first_name || 'Practitioner'} (${u.email || '—'})`
  );
  if (primary) {
    parts.push(`Primary listing: ${primary.title}${primary.specialty ? ` — ${primary.specialty}` : ''}`);
  }
  parts.push(`Active published listings: ${activeCount}`);

  const listingIds = listings.rows.map((l) => l.id);
  if (!listingIds.length) {
    parts.push('\n[PRACTICE CONTEXT — BOOKINGS]\nNo listings yet, so no bookings to show.');
    return parts.join('\n');
  }

  // Today's bookings
  const today = await db.query(
    `SELECT br.preferred_time, br.status, u.full_name AS patient_name, l.title AS service_title
       FROM booking_requests br
       JOIN listings l ON l.id = br.listing_id AND l.owner_user_id = $1
       JOIN users u ON u.id = br.user_id
      WHERE br.preferred_date = CURRENT_DATE
      ORDER BY br.preferred_time ASC`,
    [userId]
  );
  if (today.rows.length) {
    const list = today.rows
      .map((b) => `  • ${b.preferred_time || 'time TBD'} — ${b.patient_name || 'Member'} (${b.service_title}, ${b.status})`)
      .join('\n');
    parts.push(`\n[PRACTICE CONTEXT — TODAY'S BOOKINGS]\n${list}`);
  } else {
    parts.push(`\n[PRACTICE CONTEXT — TODAY'S BOOKINGS]\nNo bookings scheduled for today.`);
  }

  // Last-7-day bookings + total distinct patients
  const stats = await db.query(
    `SELECT
        COUNT(*) FILTER (WHERE br.created_at >= CURRENT_DATE - INTERVAL '6 days')::int AS last7,
        COUNT(DISTINCT br.user_id)::int AS distinct_patients,
        COUNT(*)::int AS total_requests
       FROM booking_requests br
       JOIN listings l ON l.id = br.listing_id AND l.owner_user_id = $1`,
    [userId]
  );
  const s = stats.rows[0] || {};
  parts.push(
    `\n[PRACTICE CONTEXT — ACTIVITY]\nBooking requests in last 7 days: ${s.last7 || 0}\nTotal booking requests: ${s.total_requests || 0}\nDistinct patients seen: ${s.distinct_patients || 0}`
  );

  // Passports the practitioner has been granted consent to
  const granted = await db.query(
    `SELECT pc.member_id, pc.granted_sections, u.full_name, u.first_name
       FROM passport_consents pc
       JOIN users u ON u.id = pc.member_id
      WHERE pc.practitioner_id=$1 AND pc.status='granted'`,
    [userId]
  );
  if (granted.rows.length) {
    const lines = [];
    for (const g of granted.rows) {
      const name = g.full_name || g.first_name || 'Member';
      const sections = g.granted_sections || ['assessment', 'checkins'];
      let summary = `  • ${name} — granted: ${sections.join(', ')}`;
      if (sections.includes('assessment')) {
        const a = await db.query(
          `SELECT vitality_score, mental_score, physical_score, emotional_score, spiritual_score, top_focus_areas_json
             FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
          [g.member_id]
        );
        if (a.rows[0]) {
          const av = a.rows[0];
          const focus = (av.top_focus_areas_json || [])
            .map((f) => (typeof f === 'string' ? f : f.name))
            .filter(Boolean)
            .join(', ');
          summary += `\n      Vitality ${av.vitality_score}/100 (Mind ${av.mental_score || '—'}, Body ${av.physical_score || '—'}, Heart ${av.emotional_score || '—'}, Spirit ${av.spiritual_score || '—'})${focus ? `; focus: ${focus}` : ''}`;
        }
      }
      if (sections.includes('checkins')) {
        const c = await db.query(
          `SELECT AVG(energy_score)::numeric(5,1) AS e, AVG(mood_score)::numeric(5,1) AS m,
                  AVG(sleep_hours)::numeric(5,1) AS s, COUNT(*)::int AS n
             FROM (SELECT energy_score, mood_score, sleep_hours FROM daily_checkins
                    WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 7) t`,
          [g.member_id]
        );
        if (c.rows[0] && c.rows[0].n > 0) {
          const cv = c.rows[0];
          summary += `\n      Last ${cv.n} check-ins avg — Energy ${cv.e}/100, Mood ${cv.m}/100, Sleep ${cv.s}h`;
        }
      }
      lines.push(summary);
    }
    parts.push(
      `\n[PRACTICE CONTEXT — CONSENTED MEMBER PASSPORTS]\nThese members have explicitly granted you access. Use as supporting context for your own clinical judgement.\n${lines.join('\n')}`
    );
  } else {
    parts.push(
      `\n[PRACTICE CONTEXT — CONSENTED MEMBER PASSPORTS]\nNo members have granted you Passport access yet. You can request access from a patient's profile; the member decides.`
    );
  }

  return parts.join('\n');
}

// Typed action enum LUCA Copilot may emit
const ACTION_ENUM = ['navigate', 'prefill_chat', 'draft_message', 'review_patient'];

const DEFAULT_SUGGESTIONS = [
  { label: "Prep for today's sessions", action: 'prefill_chat', target: null },
  { label: 'Draft a patient follow-up', action: 'draft_message', target: null },
  { label: 'Review my patient roster', action: 'navigate', target: 'patients' },
];

function normalizeSuggestion(s) {
  if (!s || typeof s !== 'object') return null;
  const label = typeof s.label === 'string' ? s.label.trim() : '';
  let action = typeof s.action === 'string' ? s.action.trim() : '';
  if (!label) return null;
  if (!ACTION_ENUM.includes(action)) action = 'prefill_chat';
  let target = s.target;
  if (target === undefined || target === '') target = null;
  if (target != null && typeof target !== 'string') target = String(target);
  return { label, action, target };
}

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
  let candidate = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let obj = tryParse(candidate);
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
  return { reply: raw, suggestions: [] };
}

// GET /api/luca/practitioner/messages — practitioner Copilot history
router.get('/practitioner/messages', authMiddleware, async (req, res) => {
  try {
    const r = await db.query(
      `SELECT role, content, created_at FROM luca_messages
        WHERE user_id=$1 AND context_type='practitioner'
        ORDER BY created_at ASC LIMIT 100`,
      [req.user.userId]
    );
    res.json({ messages: r.rows });
  } catch (err) {
    console.error('[luca-practitioner] history error', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/luca/practitioner/messages — send a message to the Copilot
router.post('/practitioner/messages', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Empty message' });
    const userId = req.user.userId;

    await db.query(
      `INSERT INTO luca_messages (user_id, role, content, context_type) VALUES ($1,$2,$3,'practitioner')`,
      [userId, 'user', content]
    );

    const context = await buildPractitionerContext(userId);

    const ai = getAIProvider();
    let reply;
    try {
      reply = await ai.complete({ system: SYSTEM_PROMPT, prompt: content, context });
    } catch (e) {
      console.error('AI provider error, falling back to mock:', e.message);
      const fallback = getAIProvider({ ...process.env, LUCA_AI_MODE: 'mock' });
      reply = await fallback.complete({ system: SYSTEM_PROMPT, prompt: content, context });
    }

    const { reply: parsedReply, suggestions: parsedSuggestions } = parseLucaResponse(reply);
    const cleanReply = parsedReply || 'I had trouble responding just now. Please try again in a moment.';
    const suggestions = parsedSuggestions.length ? parsedSuggestions : DEFAULT_SUGGESTIONS;

    await db
      .query(
        `INSERT INTO luca_messages (user_id, role, content, model, context_type) VALUES ($1,$2,$3,$4,'practitioner')`,
        [userId, 'assistant', cleanReply, ai.id]
      )
      .catch(async () => {
        await db.query(
          `INSERT INTO luca_messages (user_id, role, content, context_type) VALUES ($1,$2,$3,'practitioner')`,
          [userId, 'assistant', cleanReply]
        );
      });

    res.json({ reply: cleanReply, suggestions, model: ai.id, degraded: ai.degraded || null });
  } catch (err) {
    console.error('[luca-practitioner] send error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

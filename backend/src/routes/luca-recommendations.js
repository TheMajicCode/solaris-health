'use strict';
/**
 * luca-recommendations.js
 * GET /api/luca/recommendations
 *
 * Returns two LUCA-generated recommendations for the authenticated user:
 *   1. nextStep       — a single actionable habit or self-care step
 *   2. curatedJourney — a specific, real listing from the marketplace matched to focus areas
 *
 * Flow:
 *   1. Load user context (assessment, recent checkins, rewards)
 *   2. Load published listings that overlap with the user's focus areas
 *   3. Call LUCA AI with a structured-output prompt
 *   4. Parse the JSON response (strip markdown fences)
 *   5. Validate that the chosen listingId is real
 *   6. Persist to the recommendations table (source_type='luca-ai')
 *   7. Return { nextStep, curatedJourney, generatedAt }
 *
 * Caching: regenerated at most once per 6h per user (served from DB otherwise).
 * Healthcare safety: LUCA suggests only — it NEVER diagnoses or prescribes.
 * Resilience: on any AI error, a graceful rules-based fallback is returned (never 500).
 */

const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getAIProvider } = require('../lib/ai');
const { computeTriggers, buildTriggerInstructions } = require('../lib/luca-triggers');

const router = express.Router();

const CACHE_HOURS = 6;

const SYSTEM_PROMPT = `You are LUCA — a warm, heart-centered holistic health concierge for the Solaris ecosystem.

Your job here: from a person's health context and a list of real practitioners/clinics/places, produce exactly TWO recommendations:
  1. nextStep — one small, sustainable self-care habit they can start today.
  2. curatedJourney — the single best-matched listing (by id) from the provided list, with a short warm reason.

Hard rules (never break):
- You NEVER diagnose, prescribe, or make clinical decisions. You may suggest, educate, and encourage only.
- Choose curatedJourney ONLY from the provided listings, using its exact id. Never invent a listing or id.
- Use only the context provided. Never invent facts about the person.
- Be calm, concrete, and encouraging. Keep every string short (title <= 8 words, description 1-2 sentences).

Respond with STRICT JSON only (no markdown, no prose), matching exactly:
{
  "nextStep": { "title": "string", "description": "string", "action": "string" },
  "curatedJourney": { "listingId": "string", "title": "string", "reason": "string" }
}`;

/** Strip markdown code fences and parse the first JSON object found. */
function parseAIJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  // remove ```json ... ``` or ``` ... ``` fences
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  // if there is surrounding prose, grab the outermost {...}
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function focusNames(json) {
  if (!Array.isArray(json)) return [];
  return json.map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
}

async function loadContext(userId) {
  const ctx = { vitality: null, focus: [], checkins: [], rewardsTotal: 0 };

  const a = await db
    .query(
      'SELECT vitality_score, top_focus_areas_json FROM assessment_responses WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    )
    .catch(() => ({ rows: [] }));
  if (a.rows[0]) {
    ctx.vitality = a.rows[0].vitality_score;
    ctx.focus = focusNames(a.rows[0].top_focus_areas_json || []);
  }

  const c = await db
    .query(
      'SELECT checkin_date, energy_score, mood_score, sleep_hours, hydration_glasses, movement_minutes FROM daily_checkins WHERE user_id=$1 ORDER BY checkin_date DESC LIMIT 3',
      [userId]
    )
    .catch(() => ({ rows: [] }));
  ctx.checkins = c.rows || [];

  const r = await db
    .query('SELECT COALESCE(SUM(points),0) AS total FROM reward_events WHERE user_id=$1', [userId])
    .catch(() => ({ rows: [{ total: 0 }] }));
  ctx.rewardsTotal = Number(r.rows[0]?.total || 0);

  return ctx;
}

async function loadListings() {
  const q = await db
    .query(
      `SELECT id, title, specialty, city, country, listing_type, focus_areas_json, short_description, tagline
       FROM listings
       WHERE status='published'
       ORDER BY (focus_areas_json IS NOT NULL AND jsonb_array_length(COALESCE(focus_areas_json,'[]'::jsonb)) > 0) DESC,
                created_at DESC
       LIMIT 20`
    )
    .catch(() => ({ rows: [] }));
  return q.rows || [];
}

function buildContextString(ctx) {
  const parts = [];
  if (ctx.vitality != null) parts.push(`Vitality score: ${ctx.vitality}/100.`);
  parts.push(`Focus areas: ${ctx.focus.length ? ctx.focus.join(', ') : 'not specified (assessment incomplete)'}.`);
  if (ctx.checkins.length) {
    const c = ctx.checkins[0];
    parts.push(
      `Latest check-in — energy ${c.energy_score ?? '—'}/100, mood ${c.mood_score ?? '—'}/100, sleep ${c.sleep_hours ?? '—'}h, hydration ${c.hydration_glasses ?? '—'} glasses, movement ${c.movement_minutes ?? '—'} min.`
    );
  } else {
    parts.push('No recent daily check-ins.');
  }
  parts.push(`LOVE points earned: ${ctx.rewardsTotal}.`);
  return parts.join('\n');
}

function buildListingsString(listings) {
  return listings
    .map((l) => {
      const fa = focusNames(l.focus_areas_json || []);
      return `- id=${l.id} | ${l.title}${l.specialty ? ' (' + l.specialty + ')' : ''} | type=${l.listing_type} | city=${l.city || '—'} | focus=[${fa.join(', ')}] | ${l.tagline || l.short_description || ''}`.trim();
    })
    .join('\n');
}

/** Rules-based fallback used when the AI is unavailable or returns unusable output.
 *  Uses the shared trigger engine so the fallback cards follow the same rules the coach does. */
function fallbackRecommendation(ctx, listings, triggers = {}) {
  const topFocus = ctx.focus[0] || 'rest and recovery';

  // Trigger-driven next step (same priority order as buildTriggerInstructions)
  let nextStep;
  if (triggers.onboardingIncomplete) {
    nextStep = {
      title: 'Complete your Solaris intake',
      description: 'Finish your intake so LUCA can tailor your journey to what matters most to you.',
      action: 'Complete my Solaris intake',
    };
  } else if (triggers.daysSinceCheckin != null && triggers.daysSinceCheckin >= 3) {
    nextStep = {
      title: 'Reconnect with a check-in',
      description: `It's been ${triggers.daysSinceCheckin} days since your last check-in. A quick one helps LUCA see how you're really doing.`,
      action: 'Log today\'s check-in',
    };
  } else if (triggers.streakDays >= 3) {
    nextStep = {
      title: `Keep your ${triggers.streakDays}-day streak alive`,
      description: `You've checked in ${triggers.streakDays} days running — that consistency is exactly what builds vitality. One more today?`,
      action: 'Log today\'s check-in',
    };
  } else {
    nextStep = {
      title: 'A gentle reset today',
      description: `Take five slow breaths and a short walk to support your ${topFocus.toLowerCase()}. Small, steady steps move vitality the fastest.`,
      action: 'Try this today: pause for 3 minutes of calm breathing after lunch.',
    };
  }

  // pick the listing whose focus areas overlap the user's focus areas, else the first
  let match = null;
  const userFocus = ctx.focus.map((f) => f.toLowerCase());
  for (const l of listings) {
    const fa = focusNames(l.focus_areas_json || []).map((f) => f.toLowerCase());
    if (fa.some((f) => userFocus.some((u) => f.includes(u) || u.includes(f)))) {
      match = l;
      break;
    }
  }
  if (!match) match = listings[0] || null;

  const curatedJourney = match
    ? {
        listingId: match.id,
        title: match.title,
        reason: `A trusted match for your journey${match.city ? ' near ' + match.city : ''} — a caring next step when you're ready.`,
      }
    : null;

  return { nextStep, curatedJourney };
}

/** Merge AI listing choice with real DB row so we always return verified details. */
function decorateJourney(journey, listings) {
  if (!journey || !journey.listingId) return null;
  const row = listings.find((l) => String(l.id) === String(journey.listingId));
  if (!row) return null; // AI hallucinated an id — reject
  return {
    listingId: row.id,
    title: journey.title || row.title,
    specialty: row.specialty || '',
    city: row.city || '',
    country: row.country || '',
    listingType: row.listing_type,
    reason: journey.reason || 'A caring next step matched to your focus areas.',
  };
}

async function persist(userId, nextStep, journey) {
  // one row per recommendation type; linked_listing_id set for the journey
  try {
    await db.query(
      `INSERT INTO recommendations (user_id, source_type, recommendation_type, title, description, priority, status)
       VALUES ($1,'luca-ai','next-step',$2,$3,1,'active')`,
      [userId, (nextStep?.title || '').slice(0, 200), nextStep?.description || '']
    );
    if (journey) {
      await db.query(
        `INSERT INTO recommendations (user_id, source_type, recommendation_type, title, description, priority, linked_listing_id, status)
         VALUES ($1,'luca-ai','curated-journey',$2,$3,2,$4,'active')`,
        [userId, (journey.title || '').slice(0, 200), journey.reason || '', journey.listingId]
      );
    }
  } catch (e) {
    console.error('recommendations persist failed (non-fatal):', e.message);
  }
}

router.get('/recommendations', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  try {
    // 1. Serve a fresh cached recommendation set if < CACHE_HOURS old
    const cached = await db
      .query(
        `SELECT recommendation_type, title, description, linked_listing_id, created_at
         FROM recommendations
         WHERE user_id=$1 AND source_type='luca-ai'
           AND created_at > NOW() - INTERVAL '${CACHE_HOURS} hours'
         ORDER BY created_at DESC`,
        [userId]
      )
      .catch(() => ({ rows: [] }));

    if (cached.rows.length) {
      const ns = cached.rows.find((r) => r.recommendation_type === 'next-step');
      const cj = cached.rows.find((r) => r.recommendation_type === 'curated-journey');
      if (ns) {
        let journey = null;
        if (cj && cj.linked_listing_id) {
          const lr = await db
            .query(
              `SELECT id, title, specialty, city, country, listing_type FROM listings WHERE id=$1`,
              [cj.linked_listing_id]
            )
            .catch(() => ({ rows: [] }));
          const row = lr.rows[0];
          if (row) {
            journey = {
              listingId: row.id,
              title: cj.title || row.title,
              specialty: row.specialty || '',
              city: row.city || '',
              country: row.country || '',
              listingType: row.listing_type,
              reason: cj.description || '',
            };
          }
        }
        return res.json({
          nextStep: { title: ns.title, description: ns.description, action: '' },
          curatedJourney: journey,
          generatedAt: ns.created_at,
          cached: true,
        });
      }
    }

    // 2-3. Load context + candidate listings + shared rule-engine triggers
    const [ctx, listings, triggers] = await Promise.all([
      loadContext(userId),
      loadListings(),
      computeTriggers(userId),
    ]);

    // 4. Ask LUCA
    const ai = getAIProvider();
    const triggerHints = buildTriggerInstructions(triggers);
    const contextStr = triggerHints ? `${triggerHints}\n\n${buildContextString(ctx)}` : buildContextString(ctx);
    const listingsStr = buildListingsString(listings);
    const prompt = `The person's context and the real listings are provided. Return the two recommendations as strict JSON.\n\nLISTINGS (choose curatedJourney.listingId from these exact ids):\n${listingsStr}`;

    let parsed = null;
    let modelId = ai.id;
    try {
      const raw = await ai.complete({ system: SYSTEM_PROMPT, prompt, context: contextStr });
      parsed = parseAIJson(raw);
    } catch (e) {
      console.error('LUCA recommendations AI error, using fallback:', e.message);
    }

    let nextStep = parsed && parsed.nextStep;
    let journey = decorateJourney(parsed && parsed.curatedJourney, listings);

    // 5. Fallback if the AI failed or produced unusable output
    if (!nextStep || !nextStep.title) {
      const fb = fallbackRecommendation(ctx, listings, triggers);
      nextStep = fb.nextStep;
      if (!journey) journey = decorateJourney(fb.curatedJourney, listings);
      modelId = `${ai.id} (fallback)`;
    } else if (!journey) {
      // valid nextStep but bad/hallucinated listing — patch journey from fallback
      const fb = fallbackRecommendation(ctx, listings, triggers);
      journey = decorateJourney(fb.curatedJourney, listings);
    }

    // normalize nextStep shape
    nextStep = {
      title: String(nextStep.title || '').slice(0, 200),
      description: String(nextStep.description || ''),
      action: String(nextStep.action || ''),
    };

    // 6. Persist
    await persist(userId, nextStep, journey);

    // 7. Respond
    return res.json({
      nextStep,
      curatedJourney: journey,
      generatedAt: new Date().toISOString(),
      model: modelId,
      cached: false,
    });
  } catch (err) {
    console.error('recommendations fatal (returning safe fallback):', err.message);
    // absolute last-resort static fallback — never 500 the dashboard
    return res.json({
      nextStep: {
        title: 'A gentle reset today',
        description: 'Take five slow breaths and a short mindful walk. Small, steady steps move vitality the fastest.',
        action: 'Try this today: 3 minutes of calm breathing after lunch.',
      },
      curatedJourney: null,
      generatedAt: new Date().toISOString(),
      cached: false,
    });
  }
});

module.exports = router;

'use strict';
/**
 * Intelligence section (spec A3) — the honest window onto the mind working for
 * the member. Three panes:
 *
 *   • Natural    — what the member knows / is, arranged on shelves. Their own
 *                  facts, each with source + provenance level + when observed.
 *   • Artificial — what LUCA can actually see *right now*: the real context
 *                  sources + record counts (computed via the SAME buildContext
 *                  the coach uses — never hardcoded), the never-list, the model
 *                  + compute target + latency of the last real AI call, the
 *                  rules firing this turn, recent AI actions, and the member's
 *                  own source-exclusion toggles. NEVER any raw PHI — only
 *                  counts, labels, source names.
 *   • Enhanced   — hedged, sourced insight cards (timeline, patterns, open
 *                  questions, suggestions). Every card carries source·date·level.
 *
 * GET  /api/intelligence/context      → { natural, artificial, enhanced }
 * GET  /api/intelligence/exclusions   → { sources:[{key,label,excluded}] }
 * PUT  /api/intelligence/exclusions   → { source, excluded } toggles one source
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const lucaRouter = require('./luca');
const { computeTriggers, buildTriggerSuggestions } = require('../lib/luca-triggers');
const { getFoundational } = require('../lib/foundational');
const {
  EXCLUDABLE_SOURCES,
  NEVER_LIST,
  getExclusions,
  setExclusion,
} = require('../lib/intelligence');

const buildContext = lucaRouter.buildContext;

/** Human labels for firing rules (spec A1 §6) — engagement nudges, never clinical. */
function firingRules(t) {
  const rules = [];
  if (t.onboardingIncomplete) {
    rules.push({ id: 'onboarding_incomplete', label: 'Intake not complete', because: 'No completed Solaris intake on file.' });
  }
  if (t.daysSinceCheckin != null && t.daysSinceCheckin >= 3) {
    rules.push({ id: 'checkin_lapsed', label: 'Check-in lapsed', because: `No check-in in ${t.daysSinceCheckin} days.` });
  }
  if (t.vitality > 0 && t.vitality < 60) {
    rules.push({ id: 'low_vitality', label: 'Vitality below 60', because: `Latest vitality score is ${t.vitality}.` });
  }
  if (t.noAudioUnlocked && t.hasMentionedStress) {
    rules.push({ id: 'stress_no_audio', label: 'Stress + no audio unlocked', because: 'Member mentioned stress and has no audio practice unlocked.' });
  }
  if (t.daysSinceBooking == null && t.vitality > 0) {
    rules.push({ id: 'no_bookings', label: 'No bookings yet', because: 'Member has completed intake but has not booked a practitioner.' });
  } else if (t.daysSinceBooking != null && t.daysSinceBooking >= 30) {
    rules.push({ id: 'booking_stale', label: 'Booking over 30 days ago', because: `Last booking was ${t.daysSinceBooking} days ago.` });
  }
  if (t.streakDays >= 3) {
    rules.push({ id: 'streak_active', label: `${t.streakDays}-day check-in streak`, because: 'Celebrate momentum and encourage the next check-in.' });
  }
  return rules;
}

// GET /api/intelligence/context ------------------------------------------------
router.get('/context', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // ---- shared reads (used across panes) ----
    const excluded = await getExclusions(db, userId).catch(() => new Set());
    const foundational = await getFoundational(db, userId).catch(() => null);
    const triggers = await computeTriggers(userId, '').catch(() => ({}));

    // ============================ NATURAL PANE ============================
    // The member's own facts, on shelves. Each item carries source + level +
    // observed date so provenance is always visible.
    const natural = [];

    // Canon (Foundational) — self-reported baseline @ L2.
    if (foundational && foundational.data && Object.keys(foundational.data).length) {
      const fdKeys = Object.keys(foundational.data).filter((k) => foundational.data[k] != null && foundational.data[k] !== '');
      natural.push({
        shelf: 'Canon', title: 'Foundational health profile',
        detail: `${fdKeys.length} field${fdKeys.length === 1 ? '' : 's'} on record (conditions, meds, allergies, lifestyle).`,
        source: foundational.source || 'self', level: foundational.level ?? 2,
        observedAt: foundational.observedAt || null,
      });
    }

    // Principles — the member's stated focus areas + vitality (assessment).
    const assess = await db.query(
      `SELECT vitality_score, top_focus_areas_json, completed_at FROM assessment_responses
       WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] }));
    if (assess.rows[0]) {
      const a = assess.rows[0];
      const focus = (Array.isArray(a.top_focus_areas_json) ? a.top_focus_areas_json : [])
        .map((f) => (typeof f === 'string' ? f : f && f.name)).filter(Boolean);
      natural.push({
        shelf: 'Principles', title: 'What matters most right now',
        detail: focus.length ? `Focus areas: ${focus.join(', ')} · vitality ${a.vitality_score}/100.` : `Vitality ${a.vitality_score}/100.`,
        source: 'self', level: 1, observedAt: a.completed_at || null,
      });
    }

    // Log — recent check-ins (L1) + journal (L0).
    const ci = await db.query(
      `SELECT COUNT(*)::int AS n, MAX(checkin_date) AS last FROM daily_checkins WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ n: 0 }] }));
    if (ci.rows[0] && ci.rows[0].n > 0) {
      natural.push({
        shelf: 'Log', title: 'Daily check-ins', detail: `${ci.rows[0].n} check-in${ci.rows[0].n === 1 ? '' : 's'} logged.`,
        source: 'self', level: 1, observedAt: ci.rows[0].last || null,
      });
    }
    const jr = await db.query(
      `SELECT COUNT(*)::int AS n, MAX(created_at) AS last FROM journal_entries WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ n: 0 }] }));
    if (jr.rows[0] && jr.rows[0].n > 0) {
      natural.push({
        shelf: 'Log', title: 'Journal entries', detail: `${jr.rows[0].n} private reflection${jr.rows[0].n === 1 ? '' : 's'}.`,
        source: 'self', level: 0, observedAt: jr.rows[0].last || null,
      });
    }

    // Decisions — bookings the member chose to make.
    const bk = await db.query(
      `SELECT COUNT(*)::int AS n, MAX(created_at) AS last FROM booking_requests WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ n: 0 }] }));
    if (bk.rows[0] && bk.rows[0].n > 0) {
      natural.push({
        shelf: 'Decisions', title: 'Care choices', detail: `${bk.rows[0].n} booking${bk.rows[0].n === 1 ? '' : 's'} requested.`,
        source: 'self', level: 1, observedAt: bk.rows[0].last || null,
      });
    }

    // Evolution — journeys the member is walking.
    const jy = await db.query(
      `SELECT COUNT(*)::int AS n, MAX(started_at) AS last FROM member_journeys WHERE user_id=$1 AND status='active'`, [userId]).catch(() => ({ rows: [{ n: 0 }] }));
    if (jy.rows[0] && jy.rows[0].n > 0) {
      natural.push({
        shelf: 'Evolution', title: 'Active journeys', detail: `${jy.rows[0].n} guided journey${jy.rows[0].n === 1 ? '' : 's'} in progress.`,
        source: 'self', level: 1, observedAt: jy.rows[0].last || null,
      });
    }

    // Inventory — uploaded health documents (level as stored, source as stored).
    const docs = await db.query(
      `SELECT COUNT(*)::int AS n, MAX(created_at) AS last, MAX(provenance_level) AS lvl FROM health_documents WHERE user_id=$1`, [userId]).catch(() => ({ rows: [{ n: 0 }] }));
    if (docs.rows[0] && docs.rows[0].n > 0) {
      natural.push({
        shelf: 'Inventory', title: 'Health documents', detail: `${docs.rows[0].n} document${docs.rows[0].n === 1 ? '' : 's'} uploaded.`,
        source: 'self', level: docs.rows[0].lvl ?? 0, observedAt: docs.rows[0].last || null,
      });
    }

    // Open questions — honest gaps (drives the "what would deepen the picture" nudge).
    const openQ = [];
    if (!(docs.rows[0] && docs.rows[0].n > 0) || (docs.rows[0] && (docs.rows[0].lvl ?? 0) < 4)) {
      openQ.push({ shelf: 'Open questions', title: 'No verified lab on record', detail: 'A lab or test result (L4) would let LUCA reason from measured data, not just self-report.', source: 'system', level: null, observedAt: null });
    }
    if (!foundational || !foundational.data || !Object.keys(foundational.data || {}).length) {
      openQ.push({ shelf: 'Open questions', title: 'Foundational profile incomplete', detail: 'Completing the foundational intake unlocks safer, more personal coaching.', source: 'system', level: null, observedAt: null });
    }
    natural.push(...openQ);

    // ============================ ARTIFICIAL PANE ============================
    // Compute EXACTLY what LUCA would see this turn — same buildContext the coach
    // uses, honoring the member's exclusions. Only counts/labels leave here.
    const collector = { excluded };
    await buildContext(userId, collector).catch(() => null);
    const sources = (collector.sources || []).map((s) => ({
      key: s.key, label: s.label, count: s.count, included: s.included,
      excludable: EXCLUDABLE_SOURCES.some((e) => e.key === s.key),
    }));

    // Last real AI call — model, compute target, latency (from receipts).
    const lastRx = await db.query(
      `SELECT provider, actual_model, requested_model, compute_target, latency_ms, degraded, created_at
       FROM ai_execution_receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [userId]).catch(() => ({ rows: [] }));
    const lastCall = lastRx.rows[0] ? {
      provider: lastRx.rows[0].provider,
      model: lastRx.rows[0].actual_model || lastRx.rows[0].requested_model || 'unknown',
      computeTarget: lastRx.rows[0].compute_target,
      latencyMs: lastRx.rows[0].latency_ms,
      degraded: lastRx.rows[0].degraded,
      at: lastRx.rows[0].created_at,
    } : null;

    // Recent AI actions — event type + timing only, never PHI.
    const recentRx = await db.query(
      `SELECT event_type, provider, compute_target, degraded, created_at
       FROM ai_execution_receipts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 8`, [userId]).catch(() => ({ rows: [] }));
    const recentActions = recentRx.rows.map((r) => ({
      event: r.event_type, provider: r.provider, computeTarget: r.compute_target,
      degraded: r.degraded, at: r.created_at,
    }));

    const artificial = {
      sources,                                 // what LUCA can see now (real counts)
      neverList: NEVER_LIST,                   // what it structurally cannot see
      lastCall,                                // model + compute target of last real call
      firingRules: firingRules(triggers),      // rules active this turn
      recentActions,                           // recent AI executions (metadata only)
      exclusions: [...excluded],               // sources currently switched off
    };

    // ============================ ENHANCED PANE ============================
    // Four card types only. Every card carries source·date·level. Hedged,
    // sourced, never causal, never a diagnosis.
    const enhanced = [];

    // 1) Timeline — real dated events from the member's own activity.
    const tl = [];
    if (foundational && foundational.observedAt) tl.push({ label: 'Foundational profile updated', at: foundational.observedAt, source: 'self', level: foundational.level ?? 2 });
    if (ci.rows[0] && ci.rows[0].last) tl.push({ label: 'Most recent check-in', at: ci.rows[0].last, source: 'self', level: 1 });
    if (bk.rows[0] && bk.rows[0].last) tl.push({ label: 'Most recent booking', at: bk.rows[0].last, source: 'self', level: 1 });
    if (lastCall && lastCall.at) tl.push({ label: 'Last coaching turn with LUCA', at: lastCall.at, source: 'system', level: null });
    tl.sort((a, b) => new Date(b.at) - new Date(a.at));
    if (tl.length) {
      enhanced.push({ type: 'timeline', title: 'Recent timeline', items: tl });
    }

    // 2) Patterns — hedged, sourced observations from check-ins (never causal).
    const trend = await db.query(
      `SELECT ROUND(AVG(energy_score))::int AS energy, ROUND(AVG(mood_score))::int AS mood,
              ROUND(AVG(sleep_hours)::numeric,1) AS sleep, COUNT(*)::int AS n
       FROM daily_checkins WHERE user_id=$1 AND checkin_date >= CURRENT_DATE - INTERVAL '7 days'`, [userId]).catch(() => ({ rows: [] }));
    if (trend.rows[0] && trend.rows[0].n >= 3) {
      const p = trend.rows[0];
      enhanced.push({
        type: 'pattern', title: 'Last 7 days, at a glance',
        body: `Over ${p.n} check-ins your energy has averaged ${p.energy}/100, mood ${p.mood}/100, and sleep ${p.sleep}h. This is an observation from your own logs, not a diagnosis.`,
        source: 'self', level: 1, observedAt: ci.rows[0] ? ci.rows[0].last : null,
      });
    }

    // 3) Open questions — same honest gaps surfaced as a card.
    if (openQ.length) {
      enhanced.push({
        type: 'open_question', title: 'What would deepen the picture',
        items: openQ.map((q) => ({ text: q.title + ' — ' + q.detail, source: q.source, level: q.level })),
      });
    }

    // 4) Suggestions — tied to a fired rule + evidence + a typed action (A1 §5).
    const suggestions = buildTriggerSuggestions(triggers).slice(0, 4).map((s) => {
      const rule = firingRules(triggers).find((r) => (
        (s.action === 'start_assessment' && r.id === 'onboarding_incomplete') ||
        (s.action === 'start_checkin' && (r.id === 'checkin_lapsed' || r.id === 'streak_active')) ||
        (s.action === 'curate' && (r.id === 'low_vitality' || r.id === 'no_bookings' || r.id === 'booking_stale')) ||
        (s.action === 'play_audio' && r.id === 'stress_no_audio')
      ));
      return { label: s.label, action: s.action, target: s.target || null, because: rule ? rule.because : 'Suggested next step for your journey.' };
    });
    if (suggestions.length) {
      enhanced.push({ type: 'suggestion', title: 'Suggested next steps', items: suggestions });
    }

    res.json({ natural, artificial, enhanced });
  } catch (err) {
    console.error('[intelligence/context]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/intelligence/exclusions --------------------------------------------
router.get('/exclusions', authMiddleware, async (req, res) => {
  try {
    const excluded = await getExclusions(db, req.user.userId).catch(() => new Set());
    res.json({
      sources: EXCLUDABLE_SOURCES.map((s) => ({ key: s.key, label: s.label, excluded: excluded.has(s.key) })),
    });
  } catch (err) {
    console.error('[intelligence/exclusions GET]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/intelligence/exclusions  { source, excluded } -----------------------
router.put('/exclusions', authMiddleware, async (req, res) => {
  try {
    const { source, excluded } = req.body || {};
    if (!source || !EXCLUDABLE_SOURCES.some((s) => s.key === source)) {
      return res.status(400).json({ error: 'Unknown or non-excludable source' });
    }
    const result = await setExclusion(db, req.user.userId, source, Boolean(excluded));
    if (!result) return res.status(400).json({ error: 'Could not resolve member identity' });
    // Audit: a member exercised control over what LUCA may read (no PHI).
    console.log('[intelligence] exclusion toggled', { source, excluded: Boolean(excluded) });
    res.json({ ok: true, source, excluded: Boolean(excluded) });
  } catch (err) {
    console.error('[intelligence/exclusions PUT]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

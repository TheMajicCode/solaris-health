// lucaActions.js — Node K1 §D
//
// ONE action registry shared by the Dashboard and the LUCA screen. Each action
// either opens a real workflow (a multi-step sheet / a marketplace flow) or
// returns a genuinely contextual response computed from the member's own,
// already-permissioned context — never a dead chip and never a generic canned
// paragraph. Framework-agnostic (no React) so it is unit-testable with fixtures.
//
// Safety envelope: LUCA suggests, drafts, summarizes, prioritizes and opens
// workflows. It must NEVER autonomously book, send a message, approve a journey,
// spend money, diagnose or prescribe. Every "action" here at most NAVIGATES the
// member to a screen or OPENS a sheet the member then drives themselves.
//
// De-identification: `deidentifyContext` returns the only shape allowed to leave
// the device for a cloud model — counts, flags and coarse labels, never names,
// emails, raw health narratives, conversation content, or booking notes.

import resolveNextAction, { hasCheckedInToday } from './nextAction.js';

// The five restored quick actions. `kind`:
//   'response' — LUCA replies in the transcript with contextual guidance.
//   'workflow' — LUCA opens the workflow it promises (member drives it).
export const LUCA_ACTIONS = [
  { id: 'next_step',              label: 'What is my next step?',        icon: 'compass',      kind: 'response' },
  { id: 'recommend_practitioner', label: 'Recommend a practitioner',     icon: 'store',        kind: 'response' },
  { id: 'build_journey',          label: 'Build a personalized journey', icon: 'sparkles',     kind: 'workflow' },
  { id: 'review_progress',        label: 'Review my progress',           icon: 'activity',     kind: 'response' },
  { id: 'prepare_appointment',    label: 'Prepare for an appointment',   icon: 'calendarClock', kind: 'response' },
];

export const LUCA_ACTION_IDS = LUCA_ACTIONS.map((a) => a.id);
export const getLucaAction = (id) => LUCA_ACTIONS.find((a) => a.id === id) || null;

// ---- context normalization -------------------------------------------------

function pct(completeness) {
  if (completeness == null) return null;
  if (typeof completeness === 'number') return Math.max(0, Math.min(100, Math.round(completeness)));
  if (typeof completeness.percent === 'number') return Math.round(completeness.percent);
  const checks = completeness.checks || {};
  const keys = Object.keys(checks);
  if (!keys.length) return null;
  const done = keys.filter((k) => checks[k] === true).length;
  return Math.round((done / keys.length) * 100);
}

const idOf = (x) => (x == null ? null : String(x.id ?? x._id ?? x.providerId ?? x));

// Next upcoming, still-relevant booking (soonest first). A booking "needs
// action" when it is pending/awaiting the member.
function upcomingBookings(bookings = [], now = new Date()) {
  const t0 = now.getTime();
  return bookings
    .filter((b) => {
      const when = new Date(b.start_at || b.startAt || b.date || b.scheduled_at || 0).getTime();
      const status = String(b.status || '').toLowerCase();
      if (['cancelled', 'canceled', 'declined', 'completed', 'expired'].includes(status)) return false;
      return Number.isFinite(when) && when >= t0 - 60 * 60 * 1000; // small grace window
    })
    .sort((a, b) => new Date(a.start_at || a.startAt || a.date || 0) - new Date(b.start_at || b.startAt || b.date || 0));
}

function bookingsNeedingAction(bookings = []) {
  return bookings.filter((b) => {
    const s = String(b.status || '').toLowerCase();
    return ['action_required', 'reschedule_requested', 'awaiting_member', 'needs_confirmation', 'pending_member'].includes(s);
  });
}

function activeJourney({ journeys = [], approvedJourney = null } = {}) {
  if (approvedJourney) return approvedJourney;
  return (journeys || []).find((j) => {
    const s = String(j.status || '').toLowerCase();
    return s === 'active' || s === 'in_progress' || j.active === true;
  }) || null;
}

function journeyLabel(j) {
  if (!j) return null;
  return String(j.title || j.name || j.journeyType || j.type || 'your journey').replace(/_/g, ' ');
}

function fmtDate(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(d) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---- de-identification (the only shape allowed to reach a cloud model) ------

export function deidentifyContext(raw = {}) {
  const {
    completeness = null, vitality = 0, checkins = [], journeys = [],
    approvedJourney = null, bookings = [], providers = [],
    savedIds = [], dismissedIds = [], bookedIds = [], goals = [], locale = 'en',
  } = raw;
  const aj = activeJourney({ journeys, approvedJourney });
  return {
    completenessPct: pct(completeness),
    hasAssessment: vitality > 0,
    vitalityBand: vitality >= 70 ? 'high' : vitality >= 40 ? 'moderate' : vitality > 0 ? 'building' : 'none',
    checkinCount: checkins.length,
    hasCheckinToday: hasCheckinToday(checkins),
    activeJourneyType: aj ? String(aj.journeyType || aj.type || 'personalized') : null,
    journeyStepIndex: aj ? Number(aj.currentStep ?? aj.step ?? 0) : null,
    upcomingBookingCount: upcomingBookings(bookings).length,
    bookingsNeedingActionCount: bookingsNeedingAction(bookings).length,
    savedProviderCount: savedIds.length,
    bookedProviderCount: bookedIds.length,
    dismissedProviderCount: dismissedIds.length,
    goalCount: (goals || []).length,
    providerPoolSize: (providers || []).length,
    locale,
  };
  // NOTE: no names, emails, free-text notes, narratives, or ids of any kind.
}

// A structured, de-identified instruction the cloud model may receive.
export function buildModelPrompt(actionId, deid = {}) {
  const action = getLucaAction(actionId);
  const label = action ? action.label : String(actionId);
  return [
    `Member quick action: "${label}".`,
    `Context (de-identified counts/flags only): ${JSON.stringify(deid)}.`,
    'Respond with brief, contextual guidance. Suggest and educate only —',
    'never diagnose, prescribe, book, message, approve, or move money.',
  ].join(' ');
}

// ---- deterministic, contextual responses (the honest offline fallback) ------

function hasCheckinToday(checkins = [], now = new Date()) {
  const key = (d) => {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? null
      : `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  };
  const today = key(now);
  return checkins.some((c) => key(c.created_at || c.createdAt || c.date) === today);
}

// §14/§15 — the single source of truth for LUCA's "What is my next step?"
// answer. It NEVER phones a model. It reuses the same deterministic resolver the
// Dashboard green card uses (resolveNextAction), so LUCA and the card can never
// disagree, then shapes the answer into the bounded action contract:
//
//   { message, reason, actions[], evidence[], requiresConsent, safety, generatedAt }
//
// The action set follows the contract:
//   • a real task exists  -> Start next step / View my journey / Not now
//   • no journey yet       -> one high-information question + Choose a guided
//     journey / Personalize my journey / Find professional support
// Every action is validated against the allowlist and mapped through the shell's
// own routing — a model can never inject an arbitrary URL or command here.

const LUCA_SAFETY_LINE =
  'LUCA suggests and organizes only — it never diagnoses, prescribes, orders labs, books, or moves money without your review.';

// Map a resolveNextAction destination to a validated {action_type, action_target}.
// Only known destination types produce a concrete target; anything unexpected
// falls back to a safe navigation, never an arbitrary command.
function startActionFor(dest = {}) {
  switch (dest.type) {
    case 'checkin':        return { action_type: 'start_checkin', action_target: null };
    case 'assessment':     return { action_type: 'start_assessment', action_target: null };
    case 'communications': return { action_type: 'navigate', action_target: dest.section || 'growth' };
    case 'section':        return { action_type: 'navigate', action_target: dest.tab || 'health' };
    case 'explore':        return { action_type: 'navigate', action_target: 'explore' };
    case 'booking':        return { action_type: 'navigate', action_target: 'health' };
    case 'journey':        return { action_type: 'open_journey', action_target: null };
    default:               return { action_type: 'navigate', action_target: 'dashboard' };
  }
}

const DISMISS_ACTION = { id: 'next_step:dismiss', label: 'Not now', action_type: 'dismiss', action_target: null, requiresConfirmation: false };

export function buildNextStepContract(raw = {}) {
  const ctx = raw || {};
  const now = ctx.now || new Date();
  const focus = ctx.goals || [];
  const goalText = typeof focus[0] === 'string' ? focus[0] : (focus[0]?.name || '');

  const d = resolveNextAction({
    vitality: ctx.vitality || 0,
    completeness: ctx.completeness || null,
    checkins: ctx.checkins || [],
    journeys: ctx.journeys || [],
    approvedJourney: ctx.approvedJourney || null,
    todos: ctx.todos || [],
    bookings: ctx.bookings || [],
    now,
    dataError: ctx.dataError || false,
  });

  const deid = deidentifyContext(ctx);
  const evidence = [
    `check-in today: ${hasCheckedInToday(ctx.checkins || [], now) ? 'complete' : 'pending'}`,
    `active journey: ${deid.activeJourneyType || 'none'}`,
    `Passport completeness: ${deid.completenessPct == null ? 'n/a' : deid.completenessPct + '%'}`,
    `open Growth tasks: ${(ctx.todos || []).filter((t) => !(t && (t.done || t.completed || t.completed_at))).length}`,
    `bookings needing action: ${deid.bookingsNeedingActionCount}`,
  ];

  let message;
  let question = null;
  let actions;

  const startNext = { id: `next_step:${d.key}:start`, label: 'Start next step', requiresConfirmation: false, ...startActionFor(d.destination) };
  const viewJourney = { id: 'next_step:journey', label: 'View my journey', action_type: 'navigate', action_target: 'growth', requiresConfirmation: false };

  switch (d.key) {
    case 'unavailable':
      message = 'I had trouble reaching your latest activity, so I can\u2019t name your next step with confidence right now.';
      actions = [{ id: 'next_step:retry', label: 'Try again', action_type: 'navigate', action_target: 'dashboard', requiresConfirmation: false }];
      break;

    case 'checkin':
      message = 'Your next step is today\u2019s check-in \u2014 a quick moment so LUCA can notice what moves your vitality.';
      actions = [{ id: 'next_step:checkin', label: 'Check in', action_type: 'start_checkin', action_target: null, requiresConfirmation: false }, DISMISS_ACTION];
      break;

    case 'assessment':
      message = 'Let\u2019s map your health first. The Solaris Method assessment gives LUCA a real starting point to guide you from.';
      actions = [{ id: 'next_step:assessment', label: 'Start assessment', action_type: 'start_assessment', action_target: null, requiresConfirmation: false }];
      break;

    case 'passport':
      message = `Your next step: ${d.title}. ${d.explanation || ''}`.trim();
      actions = [{ id: 'next_step:passport', label: d.cta || 'Continue', ...startActionFor(d.destination), requiresConfirmation: false }, DISMISS_ACTION];
      break;

    case 'booking':
      message = 'A practitioner proposed a new session time \u2014 review and confirm it to lock the appointment in.';
      actions = [{ id: 'next_step:booking', label: 'Review & confirm', action_type: 'navigate', action_target: 'health', requiresConfirmation: false }, DISMISS_ACTION];
      break;

    case 'journey_todo':
    case 'journey_growth':
    case 'journey_journal':
    case 'journey_media':
    case 'journey_continue':
      // A real task exists in the member's approved journey.
      message = `Your next step: ${d.title}.${d.explanation ? ` ${d.explanation}` : ''}`;
      actions = [startNext, viewJourney, DISMISS_ACTION];
      break;

    case 'fallback':
    default: {
      // No active journey. Acknowledge what is actually known, ask ONE
      // high-information question, and offer the three real routes.
      const sufficient = focus.length > 0 || (ctx.vitality || 0) > 0;
      if (sufficient) {
        message = 'You don\u2019t have an active journey yet, but I can see what you\u2019re focused on.';
        question = goalText
          ? `To shape the right next step \u2014 what matters most about ${goalText} for you right now?`
          : 'To shape the right next step \u2014 what\u2019s the one outcome you\u2019d most like to work toward first?';
      } else {
        message = 'You don\u2019t have an active journey yet, and I don\u2019t have enough goal detail to pick one for you.';
        question = 'To point you in the right direction \u2014 what\u2019s the main thing you\u2019d like to focus on: sleep, stress, energy, movement, or something else?';
      }
      actions = [
        { id: 'next_step:guided', label: 'Choose a guided journey', action_type: 'navigate', action_target: 'explore', requiresConfirmation: false },
        { id: 'next_step:personalize', label: 'Personalize my journey', action_type: 'open_journey', action_target: null, requiresConfirmation: false },
        { id: 'next_step:support', label: 'Find professional support', action_type: 'curate', action_target: null, requiresConfirmation: false },
      ];
      break;
    }
  }

  return {
    message,
    reason: whyForAction('next_step', ctx),
    actions: (actions || []).filter(isValidLucaAction).slice(0, 3),
    evidence,
    requiresConsent: false, // built entirely from already-permissioned local state
    safety: LUCA_SAFETY_LINE,
    generatedAt: new Date().toISOString(),
    question,
    degraded: true,
    key: d.key,
  };
}

// Returns { text, chips, degraded:true, needsContext?:bool }.
// `degraded:true` marks this as the deterministic (no-model) runtime state so
// the UI can label it honestly.
export function deterministicResponse(actionId, raw = {}) {
  const ctx = raw || {};
  const now = ctx.now || new Date();
  switch (actionId) {
    case 'next_step': {
      // §14/§15 — a grounded, state-aware, actionable next step (never the
      // generic concierge intro + score list). Delegates to the structured
      // contract builder so the transcript reply and the offered actions come
      // from the member's real, permissioned local state.
      const c = buildNextStepContract(ctx);
      return {
        text: c.question ? `${c.message} ${c.question}` : c.message,
        chips: c.actions.map((a) => ({ label: a.label, action: a.action_type, target: a.action_target })),
        degraded: true,
        contract: c,
      };
    }

    case 'review_progress': {
      const p = pct(ctx.completeness);
      const vit = ctx.vitality || 0;
      const checks = (ctx.checkins || []).length;
      const aj = activeJourney(ctx);
      const parts = [];
      if (vit > 0) parts.push(`your vitality score is ${vit}/100`);
      if (p != null) parts.push(`your Passport is ${p}% complete`);
      if (checks > 0) parts.push(`you've logged ${checks} check-in${checks === 1 ? '' : 's'}`);
      if (aj) {
        const step = Number(aj.currentStep ?? aj.step ?? 0);
        parts.push(`you're on step ${step + 1} of your ${journeyLabel(aj)} journey`);
      }
      if (!parts.length) {
        return {
          text: 'I don\u2019t have enough yet to review your progress. Taking the Solaris Method assessment gives me a starting point I can track over time.',
          chips: [{ label: 'Start assessment', action: 'start_assessment', target: null }],
          degraded: true,
          needsContext: true,
        };
      }
      const chips = [{ label: 'Open Health Passport', action: 'navigate', target: 'health' }];
      if (aj) chips.push({ label: 'Continue journey', action: 'navigate', target: 'growth' });
      return {
        text: `Here\u2019s where you stand: ${parts.join(', ')}. ${hasCheckinToday(ctx.checkins || [], now) ? 'You\u2019ve already checked in today — nicely done.' : 'A quick check-in today keeps the picture current.'}`,
        chips,
        degraded: true,
      };
    }

    case 'prepare_appointment': {
      const up = upcomingBookings(ctx.bookings || [], now);
      if (!up.length) {
        return {
          text: 'You have no upcoming appointments. Want me to help you find the right practitioner for what you\u2019re working on?',
          chips: [{ label: 'Find practitioners', action: 'curate', target: null }, { label: 'Browse Explore', action: 'navigate', target: 'explore' }],
          degraded: true,
          needsContext: true,
        };
      }
      const b = up[0];
      const who = b.provider_name || b.providerName || b.practitioner_name || 'your practitioner';
      const when = fmtDate(b.start_at || b.startAt || b.date);
      const at = fmtTime(b.start_at || b.startAt || b.date);
      const whenStr = when ? `${when}${at ? ` at ${at}` : ''}` : 'soon';
      return {
        text: `Your next appointment is with ${who} on ${whenStr}. To prepare: note your top 1\u20132 goals for the visit, jot any recent changes or symptoms, list current supplements or medications, and prepare questions. I can help you draft any of these — I\u2019ll never send anything without you.`,
        chips: [
          { label: 'Open My Bookings', action: 'navigate', target: 'health' },
          { label: 'Message practitioner', action: 'navigate', target: 'communications' },
        ],
        degraded: true,
      };
    }

    case 'recommend_practitioner': {
      const saved = (ctx.savedIds || []).length;
      const booked = (ctx.bookedIds || []).length;
      const focus = (ctx.goals || []).slice(0, 2).map((g) => (typeof g === 'string' ? g : g?.name)).filter(Boolean);
      const bits = [];
      if (focus.length) bits.push(`what you\u2019re focused on (${focus.join(', ')})`);
      if (saved) bits.push(`${saved} provider${saved === 1 ? '' : 's'} you\u2019ve saved`);
      if (booked) bits.push(`practitioners you\u2019ve already worked with`);
      const lead = bits.length
        ? `Based on ${bits.join(' and ')}, I can line up a few good matches.`
        : 'I can line up a few good matches from the Solaris network.';
      return {
        text: `${lead} Curate for me ranks the marketplace to your Passport, or you can browse Explore yourself. I\u2019ll never book on your behalf — you always confirm.`,
        chips: [
          { label: 'Curate for me', action: 'curate', target: null },
          { label: 'Browse Explore', action: 'navigate', target: 'explore' },
        ],
        degraded: true,
      };
    }

    case 'build_journey':
      return {
        text: 'Let\u2019s build a personalized journey. I\u2019ll open the planner — you pick a focus and pace, review the draft plan, and approve it. Nothing is saved until you approve.',
        chips: [{ label: 'Open journey planner', action: 'open_journey', target: null }],
        degraded: true,
      };

    default:
      return {
        text: 'I can help with your next step, finding a practitioner, building a journey, reviewing progress, or preparing for an appointment.',
        chips: [],
        degraded: true,
      };
  }
}

// ---- Phase 5: bounded response contract + action validation ----------------
//
// The rendered/returned contract is:
//   { reply: string, actions: [{ id, label, action_type, action_target }], why }
// Actions are ranked deterministically from real state (above); the cloud model
// is used only to phrase `reply`, never to invent an action target. Every action
// is validated against the allowlist before it can be rendered — no dead chips.

// Allowlist of in-app effects a LUCA action may trigger. Mirrors
// executeChipAction() in the LUCA screen. `navigate`/`open_listing`/`play_audio`
// require a concrete target; the rest are self-contained workflows.
export const LUCA_ACTION_TYPES = [
  'navigate', 'start_checkin', 'start_assessment', 'open_intake',
  'open_listing', 'play_audio', 'curate', 'open_journey', 'prefill_chat',
  // §14 — a benign "Not now" dismissal. Self-contained (no target); the shell
  // simply acknowledges it and does nothing sensitive.
  'dismiss',
];
const ACTION_TYPES_NEEDING_TARGET = ['navigate', 'open_listing', 'play_audio'];

// Validate a single action (accepts both the {action_type,action_target}
// contract shape and the legacy {action,target} chip shape).
export function isValidLucaAction(a) {
  if (!a || typeof a !== 'object') return false;
  if (!a.label || typeof a.label !== 'string') return false;
  const type = a.action_type ?? a.action;
  if (!LUCA_ACTION_TYPES.includes(type)) return false;
  const target = a.action_target ?? a.target;
  if (ACTION_TYPES_NEEDING_TARGET.includes(type) && (target == null || String(target).trim() === '')) return false;
  return true;
}

// Screen a free-text member message for unsafe diagnostic/prescriptive intent.
// LUCA must never diagnose, prescribe, or recommend a dose — redirect to a
// licensed practitioner instead. Pattern-based (framework-agnostic, testable).
const UNSAFE_PATTERNS = [
  /\bdiagnos(e|is|ing)?\b/i,
  /\bprescri(be|ption|bing)\b/i,
  /\bdo i have\b/i,
  /\bis (this|it|that) (cancer|a tumou?r|serious|dangerous|malignant)\b/i,
  /\bwhat (medication|drug|dose|dosage|antibiotic)\b/i,
  /\bshould i (stop|start|increase|decrease|double|take) .*(med|drug|pill|dose|dosage|antibiotic|insulin|steroid)\b/i,
  /\bhow (much|many) .*(should i take|to take|of the)\b/i,
];
export function isUnsafeMedicalRequest(text = '') {
  const s = String(text || '');
  return UNSAFE_PATTERNS.some((re) => re.test(s));
}

// Short transparency line — how the response was ranked, from de-identified
// counts/flags only (never raw content).
function whyForAction(actionId, raw = {}) {
  const d = deidentifyContext(raw);
  switch (actionId) {
    case 'next_step':
      return `Ranked from your live state — check-in today: ${d.hasCheckinToday ? 'done' : 'pending'}, active journey: ${d.activeJourneyType || 'none'}, bookings needing action: ${d.bookingsNeedingActionCount}.`;
    case 'review_progress':
      return `Summarized from Passport completeness (${d.completenessPct == null ? 'n/a' : d.completenessPct + '%'}), ${d.checkinCount} check-in(s), vitality band "${d.vitalityBand}".`;
    case 'prepare_appointment':
      return `Based on ${d.upcomingBookingCount} upcoming booking(s).`;
    case 'recommend_practitioner':
      return `Based on ${d.goalCount} stated goal(s) and ${d.savedProviderCount} saved provider(s); options refresh each time.`;
    case 'build_journey':
      return 'Opens the planner you approve — nothing is saved until you confirm.';
    default:
      return 'Chosen from your permissioned local context only.';
  }
}

// Map the deterministic chips to the validated {id,label,action_type,action_target}
// contract, drop anything invalid, and cap at three buttons.
function chipsToActions(actionId, chips = []) {
  return (chips || [])
    .map((c, i) => ({
      id: `${actionId}:${c.action}:${i}`,
      label: c.label,
      action_type: c.action,
      action_target: c.target ?? null,
    }))
    .filter(isValidLucaAction)
    .slice(0, 3);
}

// Phase 5 primary entry point. Returns the bounded contract with deterministically
// ranked, validated actions. `reply` may be replaced by a model phrasing upstream;
// actions/why always come from real, de-identified member state.
export function buildLucaResponse(actionId, raw = {}) {
  const base = deterministicResponse(actionId, raw);
  return {
    reply: base.text,
    actions: chipsToActions(actionId, base.chips),
    why: base.contract ? base.contract.reason : whyForAction(actionId, raw),
    degraded: base.degraded,
    needsContext: base.needsContext,
    // §15 — the full structured contract is exposed for `next_step` so a caller
    // can render evidence / safety / generatedAt if it wants to.
    contract: base.contract || null,
  };
}

// §13/§17 — is this backend response a genuine LIVE model reply we may show as
// LUCA's own words? A missing/empty reply, a degraded flag, or a mock provider
// id all mean "no live model" — in which case the caller must fall back to the
// grounded deterministic contract and label it honestly, NEVER present the
// canned mock text as if the AI produced it.
export function isLiveModelReply(res) {
  if (!res || typeof res.reply !== 'string' || !res.reply.trim()) return false;
  if (res.degraded) return false;
  const model = String(res.model || '').toLowerCase();
  if (!model || model.startsWith('mock')) return false;
  return true;
}

// §17 — honest "temporarily unavailable" response for a genuine model
// failure/timeout on free-text. It does NOT fabricate an answer; it states the
// outage plainly and offers deterministic Solaris routes the member can still use.
export function unavailableResponse() {
  const actions = [
    { id: 'unavail:growth', label: 'Open Growth', action_type: 'navigate', action_target: 'growth' },
    { id: 'unavail:guided', label: 'Guided Journeys', action_type: 'navigate', action_target: 'explore' },
    { id: 'unavail:support', label: 'Find support', action_type: 'curate', action_target: null },
  ].filter(isValidLucaAction);
  return {
    reply: 'LUCA is temporarily unavailable, so I can\u2019t craft a fresh reply this moment. Your message is saved. In the meantime you can keep moving with any of these:',
    actions,
    why: 'Model unavailable — offering deterministic Solaris routes instead of a canned response.',
    degraded: true,
  };
}

// Safe, non-diagnostic response for an unsafe medical free-text request.
// Returns null when the message is not an unsafe request.
export function safeMessageResponse(text, raw = {}) { // eslint-disable-line no-unused-vars
  if (!isUnsafeMedicalRequest(text)) return null;
  const actions = [
    { id: 'safe:curate', label: 'Find practitioners', action_type: 'curate', action_target: null },
    { id: 'safe:explore', label: 'Browse Explore', action_type: 'navigate', action_target: 'explore' },
  ].filter(isValidLucaAction);
  return {
    reply: 'I can\u2019t diagnose conditions or recommend medications or doses — that needs a licensed practitioner who can examine you. What I can do: help you prepare questions, organize what you\u2019re noticing, or find the right practitioner. If this feels urgent, please contact local emergency services.',
    actions,
    why: 'Safety guardrail: diagnostic/prescriptive requests are redirected to a licensed practitioner and never answered clinically.',
    degraded: true,
  };
}

export default LUCA_ACTIONS;

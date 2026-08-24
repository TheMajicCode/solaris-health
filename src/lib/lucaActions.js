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

import resolveNextAction from './nextAction.js';

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

function nextStepChips(descriptor) {
  const dest = descriptor.destination || {};
  const map = {
    checkin:        { label: descriptor.cta || 'Check in', action: 'start_checkin', target: null },
    assessment:     { label: descriptor.cta || 'Start assessment', action: 'start_assessment', target: null },
    section:        { label: descriptor.cta || 'Open', action: 'navigate', target: dest.tab || 'health' },
    communications: { label: descriptor.cta || 'Open messages', action: 'navigate', target: 'communications' },
    booking:        { label: descriptor.cta || 'Review booking', action: 'navigate', target: 'health' },
    journey:        { label: descriptor.cta || 'Open journey', action: 'navigate', target: 'growth' },
    explore:        { label: descriptor.cta || 'Explore providers', action: 'navigate', target: 'explore' },
  };
  return [map[dest.type] || { label: descriptor.cta || 'Continue', action: 'navigate', target: 'dashboard' }];
}

// Returns { text, chips, degraded:true, needsContext?:bool }.
// `degraded:true` marks this as the deterministic (no-model) runtime state so
// the UI can label it honestly.
export function deterministicResponse(actionId, raw = {}) {
  const ctx = raw || {};
  const now = ctx.now || new Date();
  switch (actionId) {
    case 'next_step': {
      const d = resolveNextAction({
        vitality: ctx.vitality || 0,
        completeness: ctx.completeness || null,
        checkins: ctx.checkins || [],
        journeys: ctx.journeys || [],
        approvedJourney: ctx.approvedJourney || null,
        bookings: ctx.bookings || [],
        now,
      });
      return {
        text: `Your next step: ${d.title}. ${d.explanation}`,
        chips: nextStepChips(d),
        degraded: true,
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

export default LUCA_ACTIONS;

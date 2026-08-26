// nextAction.js — Node K1 §A1
//
// ONE centralized resolver for the Dashboard "Your Next Step" (green) card.
// Framework-agnostic (no React) so it can be unit-tested table-driven.
//
// It returns a single descriptor — { eyebrow, title, explanation, cta, icon,
// destination, priority } — so the card's label, copy, icon and exact
// navigation all come from the same result. The green card must no longer be a
// hardcoded "Check in today" link.
//
// Priority order (contract §A1 — a higher-priority action always wins):
//   1. Check-in is due under the app's daily check-in rule.
//   2. Required intake / profile / Health Passport information is incomplete.
//   3. An accepted guided or personalized journey has an incomplete next step.
//   4. That journey has a specific Growth, Journal, or Media action due.
//   5. A booking request requires an explicit member action.
//   6. Fallback: build a personalized journey (Explore available second).
//
// `icon` is a string key resolved to a lucide component by the renderer.
// `destination` is a typed navigation intent the shell knows how to execute.

import { firstUnfinishedJourneyTodo } from './todoPipeline.js';
import { todoActionMeta } from './todoGrouping.js';

// ---- helpers ---------------------------------------------------------------

// Local calendar day key (YYYY-MM-DD) for a date-like value.
export function dayKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A check-in is DUE when the member is onboarded (intake complete) and has not
// logged a check-in for today. Brand-new members (no intake) are NOT nagged to
// check in — they are routed to the assessment by priority 2 instead. This is
// the app's existing once-per-calendar-day check-in rhythm.
export function isCheckinDue({ intakeComplete, checkins = [], now = new Date() } = {}) {
  if (!intakeComplete) return false;
  const todayKey = dayKey(now);
  const list = Array.isArray(checkins) ? checkins : [];
  if (!list.length) return true; // onboarded but has never checked in
  // Scan ALL check-ins for one dated today — never assume checkins[0] is the
  // newest (the API list may be unsorted or oldest-first). A check-in exists for
  // today if ANY row's local calendar day matches.
  const checkedInToday = list.some(
    (c) => dayKey(c?.checkin_date || c?.created_at || c?.date) === todayKey,
  );
  return !checkedInToday;
}

// Booking states that require an EXPLICIT member action (e.g. a practitioner
// proposed a new time the member must confirm).
const MEMBER_ACTION_BOOKING_STATES = new Set(['proposed', 'reschedule_proposed', 'action_required']);

export function bookingNeedingAction(bookings = []) {
  return (bookings || []).find((b) => MEMBER_ACTION_BOOKING_STATES.has(b?.status)) || null;
}

// Classify a journey milestone into a Communications subsection when it is a
// Growth / Journal / Media action (contract §A1 priority 4). Returns one of
// 'growth' | 'journal' | 'media' or null.
export function classifyMilestone(milestone) {
  if (!milestone) return null;
  const explicit = String(milestone.actionType || milestone.kind || milestone.type || '').toLowerCase();
  if (explicit === 'growth' || explicit === 'journal' || explicit === 'media') return explicit;
  const text = `${milestone.label || ''} ${milestone.description || ''}`.toLowerCase();
  if (/\b(journal|reflect|write)\b/.test(text)) return 'journal';
  if (/\b(listen|audio|watch|video|media|meditation)\b/.test(text)) return 'media';
  if (/\b(growth|practice|habit|milestone|lesson|module)\b/.test(text)) return 'growth';
  return null;
}

// The accepted journey with an incomplete next step: prefer a live active
// server journey, else the locally-approved personalized journey draft.
export function activeJourneyWithStep({ journeys = [], approvedJourney = null } = {}) {
  const live = (journeys || []).find((j) => j?.status === 'active' && j?.nextMilestone);
  if (live) return { source: 'server', journey: live, milestone: live.nextMilestone };
  if (approvedJourney) {
    const steps = approvedJourney.steps || [];
    const firstOpen = steps.find((s) => !(s && s.done)) || steps[0] || null;
    const milestone = firstOpen
      ? (typeof firstOpen === 'string'
          ? { label: firstOpen }
          : { label: firstOpen.label || firstOpen.title, description: firstOpen.description })
      : { label: approvedJourney.title || 'Your personalized journey' };
    return { source: 'local', journey: approvedJourney, milestone };
  }
  return null;
}

// Map a Growth To-do to the EXACT destination its CTA opens, plus a matching
// title/cta/icon for the "Your Next Step" card (contract priority 3). Steps with
// no safe action route to the Growth list (where the checkbox lives) — never a
// dead button or a bare root tab.
export function todoDestination(todo) {
  const meta = todoActionMeta(todo);
  const type = todo?.action_type;
  const tgt = todo?.action_target || null;
  const title = todo?.title || 'Your next step';
  if (meta) {
    switch (type) {
      case 'start_checkin':
        return { title: 'Check in with yourself', cta: 'Check in', ctaKey: 'cta.checkin', icon: 'checkin', destination: { type: 'checkin' } };
      case 'open_journal':
        return { title, cta: 'Open Journal', ctaKey: 'cta.openJournal', icon: 'journal', destination: { type: 'communications', section: 'journal' } };
      case 'play_audio':
        return { title, cta: 'Play', ctaKey: 'cta.play', icon: 'media', destination: { type: 'communications', section: 'media', target: tgt } };
      case 'open_listing':
        return { title, cta: 'View', ctaKey: 'cta.view', icon: 'growth', destination: { type: 'explore', target: tgt } };
      case 'open_booking':
        return { title, cta: 'View booking', ctaKey: 'cta.viewBooking', icon: 'booking', destination: { type: 'booking', bookingId: tgt } };
      case 'navigate':
        return { title, cta: 'Go', ctaKey: 'cta.go', icon: 'growth', destination: { type: 'section', tab: tgt } };
      default:
        break;
    }
  }
  // Non-actionable (checkbox-only) step → open the Growth list to complete it.
  return { title, cta: 'Open Growth', ctaKey: 'cta.openGrowth', icon: 'growth', destination: { type: 'communications', section: 'growth' } };
}

// ---- the resolver ----------------------------------------------------------

/**
 * resolveNextAction(ctx) -> action descriptor
 *
 * ctx: {
 *   vitality:number, completeness:{checks,nextStep}|null,
 *   checkins:[], journeys:[], approvedJourney:object|null,
 *   bookings:[], now:Date
 * }
 */
export function resolveNextAction(ctx = {}) {
  const {
    vitality = 0,
    completeness = null,
    checkins = [],
    journeys = [],
    approvedJourney = null,
    todos = [],
    bookings = [],
    now = new Date(),
    dataError = false,
  } = ctx;

  // ── Priority 0 — Data could not be loaded (contract §6) ──────────────────
  // NEVER silently fall back to "Check in today" as if it were true. When the
  // dashboard could not fetch check-ins / journeys / to-dos / bookings, the
  // resolver reports an explicit, RETRYABLE unavailable state so the card shows
  // a "Try again" control instead of a fabricated action.
  if (dataError) {
    return {
      priority: 0,
      key: 'unavailable',
      unavailable: true,
      eyebrow: 'Your Next Step',
      title: "Couldn't load your next step",
      explanation: 'We had trouble reaching your latest activity. Check your connection and try again.',
      cta: 'Try again',
      icon: 'retry',
      destination: { type: 'retry' },
    };
  }

  const checks = (completeness && completeness.checks) || {};
  // Intake is complete when the member has an assessment (vitality) or the
  // server completeness explicitly says so.
  const intakeComplete = vitality > 0 || checks.intake === true;

  // ── Priority 1 — Check-in due ────────────────────────────────────────────
  if (isCheckinDue({ intakeComplete, checkins, now })) {
    return {
      priority: 1,
      key: 'checkin',
      eyebrow: 'Your Next Step',
      title: 'Check in with yourself',
      explanation: 'A quick daily check-in helps LUCA notice what moves your vitality.',
      cta: 'Check in today',
      icon: 'checkin',
      destination: { type: 'checkin' },
    };
  }

  // ── Priority 2 — Intake / profile / Health Passport incomplete ───────────
  // Intake (the assessment) always comes first; other required passport info
  // (e.g. a health document) routes to its exact section. Journey / booking /
  // check-in / habit / journal areas are handled by their own priorities or the
  // fallback, so they are excluded here.
  if (!intakeComplete) {
    return {
      priority: 2,
      key: 'assessment',
      eyebrow: 'Your Next Step',
      title: 'Map your health',
      explanation: 'Take the Solaris Method assessment to reveal your 360° Mind, Body, Heart & Spirit map.',
      cta: 'Start assessment',
      icon: 'assessment',
      destination: { type: 'assessment' },
    };
  }
  const ns = completeness && completeness.nextStep;
  if (ns && (ns.key === 'health_doc' || ns.key === 'profile')) {
    return {
      priority: 2,
      key: 'passport',
      eyebrow: 'Your Next Step',
      title: ns.label || 'Complete your Passport',
      explanation: ns.hint || 'A little more information helps LUCA guide you well.',
      cta: ns.label || 'Continue',
      icon: 'passport',
      // Route to the EXACT missing section, not merely the Health root.
      destination: { type: 'section', tab: ns.tab || 'health', section: ns.key },
    };
  }

  // ── Priority 3 — First unfinished actionable Growth To-do ────────────────
  // The green card now FOLLOWS the member's real Growth To-do list (server rows
  // merged with device-local personalized rows). The first unfinished journey
  // To-do, in deterministic order, is the next step — and its CTA opens the
  // EXACT screen that To-do points to (Journal / Media / Growth / booking …),
  // never a bare root tab.
  const nextTodo = firstUnfinishedJourneyTodo(todos);
  if (nextTodo) {
    const d = todoDestination(nextTodo);
    return {
      priority: 3,
      key: 'journey_todo',
      eyebrow: 'Your Next Step',
      title: d.title,
      explanation: nextTodo.detail || 'Continue the next step of your journey.',
      cta: d.cta,
      ctaKey: d.ctaKey || null,
      icon: d.icon,
      stepKey: nextTodo.step_key || null,
      destination: d.destination,
    };
  }

  // ── Priority 4 — Accepted journey milestone (ONLY when no unfinished To-do
  //    row represents it — priority 3 returns above whenever one does) ────────
  const aj = activeJourneyWithStep({ journeys, approvedJourney });
  if (aj) {
    const sub = classifyMilestone(aj.milestone); // priority 4 classification
    const stepLabel = aj.milestone.label || 'your next step';
    if (sub) {
      const labels = {
        growth: { key: 'journey_growth', title: 'Continue your journey', cta: 'Open Growth', icon: 'growth', section: 'growth' },
        journal: { key: 'journey_journal', title: 'Reflect in your journal', cta: 'Open Journal', icon: 'journal', section: 'journal' },
        media: { key: 'journey_media', title: 'Your next practice', cta: 'Open Media', icon: 'media', section: 'media' },
      };
      const m = labels[sub];
      return {
        priority: 4,
        key: m.key,
        eyebrow: 'Your Next Step',
        title: m.title,
        explanation: stepLabel,
        cta: m.cta,
        icon: m.icon,
        destination: { type: 'communications', section: m.section },
      };
    }
    return {
      priority: 4,
      key: 'journey_continue',
      eyebrow: 'Your Next Step',
      title: 'Continue your journey',
      explanation: stepLabel,
      cta: 'Continue journey',
      icon: 'growth',
      destination: { type: 'communications', section: 'growth' },
    };
  }

  // ── Priority 5 — A booking needs an explicit member action ───────────────
  const bk = bookingNeedingAction(bookings);
  if (bk) {
    return {
      priority: 5,
      key: 'booking',
      eyebrow: 'Your Next Step',
      title: 'A new time is waiting',
      explanation: 'Your practitioner proposed a session time — review and confirm to lock it in.',
      cta: 'Review & confirm',
      icon: 'booking',
      destination: { type: 'booking', bookingId: bk.id ?? null },
    };
  }

  // ── Priority 6 — Fallback: build a personalized journey ───────────────────
  return {
    priority: 6,
    key: 'fallback',
    eyebrow: 'Your Next Step',
    title: 'Design your path',
    explanation: 'Let LUCA draft a personalized journey shaped around your goals — you approve every step.',
    cta: 'Personalized Journey',
    icon: 'journey',
    destination: { type: 'journey' },
  };
}

export default resolveNextAction;

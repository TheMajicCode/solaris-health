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
  const last = checkins && checkins.length ? checkins[0] : null;
  if (!last) return true; // onboarded but has never checked in
  const lastKey = dayKey(last.checkin_date || last.created_at || last.date);
  return lastKey !== todayKey;
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
    bookings = [],
    now = new Date(),
  } = ctx;

  const checks = (completeness && completeness.checks) || {};
  // Intake is complete when the member has an assessment (vitality) or the
  // server completeness explicitly says so.
  const intakeComplete = vitality > 0 || checks.intake === true;

  // ── Priority 1 — Check-in due ────────────────────────────────────────────
  if (isCheckinDue({ intakeComplete, checkins, now })) {
    return {
      priority: 1,
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
      eyebrow: 'Your Next Step',
      title: ns.label || 'Complete your Passport',
      explanation: ns.hint || 'A little more information helps LUCA guide you well.',
      cta: ns.label || 'Continue',
      icon: 'passport',
      // Route to the EXACT missing section, not merely the Health root.
      destination: { type: 'section', tab: ns.tab || 'health', section: ns.key },
    };
  }

  // ── Priority 3 & 4 — Accepted journey with an incomplete next step ────────
  const aj = activeJourneyWithStep({ journeys, approvedJourney });
  if (aj) {
    const sub = classifyMilestone(aj.milestone); // priority 4 classification
    const stepLabel = aj.milestone.label || 'your next step';
    if (sub) {
      const labels = {
        growth: { title: 'Continue your journey', cta: 'Open Growth', icon: 'growth', section: 'growth' },
        journal: { title: 'Reflect in your journal', cta: 'Open Journal', icon: 'journal', section: 'journal' },
        media: { title: 'Your next practice', cta: 'Open Media', icon: 'media', section: 'media' },
      };
      const m = labels[sub];
      return {
        priority: 4,
        eyebrow: 'Your Next Step',
        title: m.title,
        explanation: stepLabel,
        cta: m.cta,
        icon: m.icon,
        destination: { type: 'communications', section: m.section },
      };
    }
    return {
      priority: 3,
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
    eyebrow: 'Your Next Step',
    title: 'Design your path',
    explanation: 'Let LUCA draft a personalized journey shaped around your goals — you approve every step.',
    cta: 'Personalized Journey',
    icon: 'journey',
    destination: { type: 'journey' },
  };
}

export default resolveNextAction;

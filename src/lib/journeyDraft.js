// journeyDraft.js — Node K1 §B
//
// Deterministic, framework-agnostic builder for a Personalized Journey DRAFT.
// LUCA "creates a draft" from the member's own inputs; when no cloud model is
// configured this honest deterministic generator produces concise Daily, Weekly
// and Monthly views plus the assumptions used. Nothing here is clinical advice,
// diagnosis, or a prescription — these are standard self-care building blocks the
// member reviews and approves before anything begins.
//
// IMPORTANT: this produces a LOCAL draft only. The shared beta DB is read-only in
// this sprint and current journey APIs persist only predefined journey types, so
// an approved personalized draft is stored in the local/session AppContext
// (setApprovedJourney) and surfaced under Communications → Growth. This limitation
// is intentional and labeled — no server persistence is invented.

export const FOCUS_AREAS = ['Mind', 'Body', 'Heart', 'Spirit'];
export const PACES = ['gentle', 'steady', 'ambitious'];

export const DEFAULT_JOURNEY_INPUT = {
  focusAreas: [],            // subset of FOCUS_AREAS
  challenges: '',            // member's own words
  outcomes: '',              // desired wellness outcomes, member's own words
  minutesPerDay: 15,         // daily time available
  daysPerWeek: 4,            // preferred days per week
  pace: 'steady',            // gentle | steady | ambitious
  startDate: '',             // ISO date (YYYY-MM-DD)
  rhythm: { daily: true, weekly: true, monthly: true },
  setting: 'either',         // virtual | in_person | either
  travel: '',                // location / travel preference
  openToPractitioners: true, // openness to practitioners / clinician-reviewed network
  accessibility: '',         // accessibility needs
  language: 'en',            // preferred language
  notify: 'gentle',          // notification preference: off | gentle | daily
};

function focusVerb(area) {
  switch (area) {
    case 'Mind': return 'a few slow breaths and one focused intention';
    case 'Body': return 'gentle movement that fits your energy';
    case 'Heart': return 'one moment of connection or gratitude';
    case 'Spirit': return 'a brief grounding or reflection practice';
    default: return 'one small, restorative practice';
  }
}

// Merge inputs with defaults so the builder never dereferences undefined.
export function normalizeJourneyInput(input = {}) {
  const merged = { ...DEFAULT_JOURNEY_INPUT, ...input };
  merged.rhythm = { ...DEFAULT_JOURNEY_INPUT.rhythm, ...(input.rhythm || {}) };
  merged.focusAreas = Array.isArray(merged.focusAreas)
    ? merged.focusAreas.filter((a) => FOCUS_AREAS.includes(a))
    : [];
  if (!PACES.includes(merged.pace)) merged.pace = 'steady';
  merged.minutesPerDay = Math.max(5, Math.min(120, Number(merged.minutesPerDay) || 15));
  merged.daysPerWeek = Math.max(1, Math.min(7, Number(merged.daysPerWeek) || 4));
  return merged;
}

/**
 * buildJourneyDraft(input) -> { title, cadence views, assumptions, meta }
 *
 * Returns a draft with concise daily/weekly/monthly step lists, the assumptions
 * LUCA used (so the member can correct them), and non-PHI meta.
 */
export function buildJourneyDraft(rawInput = {}) {
  const input = normalizeJourneyInput(rawInput);
  const areas = input.focusAreas.length ? input.focusAreas : ['Body', 'Heart'];
  const primary = areas[0];

  const daily = {
    cadence: 'daily',
    title: 'Daily rhythm',
    steps: [
      `${input.minutesPerDay} min — ${focusVerb(primary)}.`,
      'A one-line check-in on how you feel (private unless you choose to share).',
    ],
  };
  if (input.rhythm.daily === false) daily.steps = ['Skipped — you turned daily steps off.'];

  const weekly = {
    cadence: 'weekly',
    title: 'Weekly rhythm',
    steps: [
      `${input.daysPerWeek} intentional days focused on ${areas.slice(0, 2).join(' & ')}.`,
      'One slightly longer session aligned to your top outcome.',
      'A short reflection to notice what is working.',
    ],
  };
  if (input.rhythm.weekly === false) weekly.steps = ['Skipped — you turned weekly steps off.'];

  const monthly = {
    cadence: 'monthly',
    title: 'Monthly focus',
    steps: [
      'Revisit your goals and confirm they still fit.',
      input.openToPractitioners
        ? 'Optionally connect with a saved or recommended practitioner (your choice).'
        : 'Review your own progress — no outside sessions unless you choose.',
      'A gentle progress reflection — no scores, no diagnosis.',
    ],
  };
  if (input.rhythm.monthly === false) monthly.steps = ['Skipped — you turned monthly steps off.'];

  const assumptions = [];
  assumptions.push(`Focus on ${areas.join(', ')} based on what you selected.`);
  assumptions.push(`About ${input.minutesPerDay} min/day, ${input.daysPerWeek} days/week, at a ${input.pace} pace.`);
  assumptions.push(
    input.setting === 'virtual' ? 'Prefers virtual sessions.'
      : input.setting === 'in_person' ? 'Prefers in-person sessions.'
        : 'Open to virtual or in-person.'
  );
  if (input.startDate) assumptions.push(`Starting around ${input.startDate}.`);
  if (!input.focusAreas.length) assumptions.push('No focus areas chosen yet, so LUCA started with Body & Heart — edit anytime.');

  return {
    title: `Your ${primary} journey`,
    kind: 'personalized',
    cadence: 'personalized',
    views: [daily, weekly, monthly],
    steps: weekly.steps,      // default "next steps" shown in Growth
    assumptions,
    source: 'LUCA draft · standard self-care template',
    meta: {
      focusAreas: areas,
      minutesPerDay: input.minutesPerDay,
      daysPerWeek: input.daysPerWeek,
      pace: input.pace,
      setting: input.setting,
      language: input.language,
    },
  };
}

export default buildJourneyDraft;

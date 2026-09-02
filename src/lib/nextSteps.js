// nextSteps.js — Preview Correction §9
//
// ONE deterministic resolver for the post-check-in "Next Steps" navigation.
// After a member has completed today's Daily Check-in, EVERY Check-in CTA
// relabels to "Next Steps" and, when pressed, must route to the SAME place from
// any surface (Dashboard, Health, Growth, …). This module is that single source
// of truth so those surfaces can never disagree.
//
// It is framework-agnostic (no React) so it can be unit-tested table-driven, and
// it returns a typed `destination` intent the shell already knows how to execute
// (see runNextStep in LucaPassport.jsx: communications/explore/journey/coach).
//
// Destination order (contract §9 — a higher rule always wins):
//   1. An approved journey with an incomplete recommended Growth task
//        -> open that task in Growth.
//   2. An approved journey with no selected/incomplete task
//        -> that journey's Growth overview.
//   3. No active journey, but sufficient goal/preference data AND the goal maps
//      to an available guided journey
//        -> Guided Journey selection (Explore).
//   4. Insufficient goal/context
//        -> Personalized Journey intake.
//   5. A stated goal that falls OUTSIDE the available journeys
//        -> LUCA Focus, opened with a contextual goal question.
//
// Rules 3/4/5 are mutually exclusive by construction (see the guards below), so
// their numeric order never produces a conflict.

import { activeJourneyWithStep } from './nextAction.js';
import { firstUnfinishedJourneyTodo } from './todoPipeline.js';

/**
 * resolveNextSteps(ctx) -> { key, title, destination, reason }
 *
 * ctx: {
 *   approvedJourney: object|null,   // locally-approved personalized journey draft
 *   journeys: [],                   // server journeys (active ones considered)
 *   todos: [],                      // Growth To-dos (server + device merged)
 *   goalDataSufficient: boolean,    // enough goal/preference data to pick a journey
 *   goalInAvailableJourneys: boolean, // the goal maps to an available guided journey
 *   goalText: string,               // the member's stated goal (NO PHI — a short label)
 *   now: Date,
 * }
 */
export function resolveNextSteps(ctx = {}) {
  const {
    approvedJourney = null,
    journeys = [],
    todos = [],
    goalDataSufficient = false,
    goalInAvailableJourneys = false,
    goalText = '',
  } = ctx;

  // Does the member have an approved/active journey at all?
  const aj = activeJourneyWithStep({ journeys, approvedJourney });

  // ── Rule 1 — approved journey WITH an incomplete recommended Growth task ────
  if (aj) {
    const nextTodo = firstUnfinishedJourneyTodo(todos);
    if (nextTodo) {
      return {
        key: 'journey_task',
        title: nextTodo.title || 'Your next step',
        reason: 'Continue the next recommended step of your journey.',
        destination: {
          type: 'communications',
          section: 'growth',
          // The exact task to open/scroll to in Growth (never a bare tab).
          target: nextTodo.step_key || nextTodo.id || null,
          stepKey: nextTodo.step_key || null,
        },
      };
    }

    // ── Rule 2 — approved journey with NO selected/incomplete task ────────────
    return {
      key: 'journey_overview',
      title: aj.journey?.title || approvedJourney?.title || 'Your journey',
      reason: 'Review your journey overview and pick your next focus.',
      destination: { type: 'communications', section: 'growth' },
    };
  }

  // No approved/active journey below this point.

  // ── Rule 3 — sufficient goal data AND the goal maps to a guided journey ─────
  if (goalDataSufficient && goalInAvailableJourneys) {
    return {
      key: 'guided_select',
      title: 'Choose a guided journey',
      reason: 'Your goals match a curated journey — pick one to begin.',
      destination: { type: 'explore' },
    };
  }

  // ── Rule 5 — a stated goal that falls OUTSIDE the available journeys ────────
  // (evaluated before rule 4 because it also requires sufficient goal data; the
  //  two are mutually exclusive on goalInAvailableJourneys.)
  if (goalDataSufficient && !goalInAvailableJourneys) {
    const goal = String(goalText || '').trim();
    return {
      key: 'luca_focus',
      title: 'Talk it through with LUCA',
      reason: 'Your goal is a little different — LUCA can shape a plan around it.',
      destination: {
        type: 'coach',
        // A contextual question, not a stored answer. Kept generic when no goal
        // label is available so nothing member-identifying is embedded.
        prompt: goal
          ? `Help me make progress on: ${goal}. What is a good first step?`
          : 'I have a specific goal in mind — can you help me shape a plan for it?',
      },
    };
  }

  // ── Rule 4 — insufficient goal/context → Personalized Journey intake ───────
  return {
    key: 'personalized_intake',
    title: 'Design your personalized journey',
    reason: 'Answer a few questions and LUCA will draft a journey you approve.',
    destination: { type: 'journey' },
  };
}

export default resolveNextSteps;

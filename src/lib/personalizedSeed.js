/**
 * NODE K1.3 §4 — Personalized-journey seed transform (pure, testable).
 *
 * An approved personalized (LUCA-drafted) journey is prose grouped by cadence
 * in `block.views` (daily / weekly / monthly). This turns it into an idempotent
 * seed payload for POST /journey/todos/seed-plan so a personalized journey seeds
 * the SAME member_todos pipeline as a guided journey — Today / This week / This
 * month grouping is derived downstream from the row `kind`.
 *
 * Idempotency: the deterministic `step_key` (cadence + index) means a double
 * approve or a reload upserts the same rows (backend ON CONFLICT DO NOTHING).
 * No PHI: the draft steps are generic self-care template strings, never member
 * answers or free text.
 */

export const CADENCE_FROM_VIEW = { daily: 'today', weekly: 'week', monthly: 'month' };
export const PERSONALIZED_JOURNEY_TYPE = 'personalized';

export function personalizedSeedSteps(block = {}) {
  const views = Array.isArray(block?.views) ? block.views : [];
  const steps = [];
  for (const v of views) {
    const viewCadence = String(v?.cadence || '').toLowerCase();
    const cadence = CADENCE_FROM_VIEW[viewCadence] || 'week';
    const list = Array.isArray(v?.steps) ? v.steps : [];
    list.forEach((text, i) => {
      const title = String(text || '').trim();
      if (!title) return;
      // "Skipped — you turned <cadence> steps off." is a placeholder, not a step.
      if (/^skipped\b/i.test(title)) return;
      steps.push({
        step_key: `personalized_${viewCadence || 'week'}_${i}`,
        title,
        cadence,
        dimension: null,
        action_type: null,
        action_target: null,
      });
    });
  }
  return steps;
}

export default personalizedSeedSteps;

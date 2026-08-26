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

/**
 * K1.4.1 §C — derive a SAFE action for a prose personalized step.
 *
 * A LUCA-drafted personalized step is generic self-care prose with NO real
 * destination ids, so we must never invent a practitioner / service / booking /
 * media / clinical target. The ONLY action safely derivable from prose is a
 * reflection → the member-owned Journal surface (`open_journal`, which needs no
 * target and is always valid). Everything else is a plain checkbox-only item
 * (action_type null) — never a dead button.
 */
export function personalizedStepAction(title = '') {
  const text = String(title || '').toLowerCase();
  if (/\b(journal|reflect|reflection|gratitude|write|note down|jot)\b/.test(text)) {
    return { kind: 'reflection', action_type: 'open_journal', action_target: null };
  }
  if (/\b(breathe|breath|stretch|walk|hydrate|water|sleep|rest|meditat)\b/.test(text)) {
    return { kind: 'habit', action_type: null, action_target: null };
  }
  return { kind: 'activity', action_type: null, action_target: null };
}

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
      // §C — carry a safe, real-destination action (reflection → Journal) or none.
      // We never fabricate a practitioner/service/booking/media target.
      const act = personalizedStepAction(title);
      steps.push({
        step_key: `personalized_${viewCadence || 'week'}_${i}`,
        title,
        cadence,
        dimension: null,
        kind: act.kind,
        action_type: act.action_type,
        action_target: act.action_target,
      });
    });
  }
  return steps;
}

export default personalizedSeedSteps;

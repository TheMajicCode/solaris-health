// Node B §9 — the ONE deterministic Next Steps resolver. Table-driven over the
// five contract rules, in priority order.
import { describe, it, expect } from 'vitest';
import resolveNextSteps from '../lib/nextSteps.js';

describe('Node B §9 — resolveNextSteps priority ladder', () => {
  it('Rule 1: approved journey WITH an incomplete recommended task -> that Growth task', () => {
    const r = resolveNextSteps({
      approvedJourney: { title: 'Detox', steps: [{ label: 'Step 1' }] },
      todos: [{ step_key: 'hydrate', title: 'Hydrate', journey_type: 'detox', done: false }],
    });
    expect(r.destination.type).toBe('communications');
    expect(r.destination.section).toBe('growth');
    expect(r.destination.target).toBe('hydrate');
    expect(r.destination.stepKey).toBe('hydrate');
  });

  it('Rule 2: approved journey with NO unfinished task -> Growth overview (no target)', () => {
    const r = resolveNextSteps({
      approvedJourney: { title: 'Detox', steps: [{ label: 'Step 1', done: true }] },
      todos: [{ step_key: 'hydrate', title: 'Hydrate', journey_type: 'detox', done: true }],
    });
    expect(r.destination).toEqual({ type: 'communications', section: 'growth' });
  });

  it('Rule 3: no journey + sufficient goal data + goal maps to a guided journey -> Explore', () => {
    const r = resolveNextSteps({
      approvedJourney: null,
      journeys: [],
      todos: [],
      goalDataSufficient: true,
      goalInAvailableJourneys: true,
    });
    expect(r.destination).toEqual({ type: 'explore' });
  });

  it('Rule 4: insufficient goal/context -> Personalized Journey intake', () => {
    const r = resolveNextSteps({
      approvedJourney: null,
      journeys: [],
      todos: [],
      goalDataSufficient: false,
      goalInAvailableJourneys: false,
    });
    expect(r.destination).toEqual({ type: 'journey' });
  });

  it('Rule 5: stated goal OUTSIDE available journeys -> LUCA Focus with a contextual question', () => {
    const r = resolveNextSteps({
      approvedJourney: null,
      journeys: [],
      todos: [],
      goalDataSufficient: true,
      goalInAvailableJourneys: false,
      goalText: 'run a marathon',
    });
    expect(r.destination.type).toBe('coach');
    expect(r.destination.prompt).toContain('run a marathon');
  });

  it('Rule 5 with no goal label embeds NOTHING member-identifying', () => {
    const r = resolveNextSteps({
      goalDataSufficient: true, goalInAvailableJourneys: false, goalText: '',
    });
    expect(r.destination.type).toBe('coach');
    expect(r.destination.prompt).not.toMatch(/:/); // no "on: <goal>" tail
  });

  it('active SERVER journey (no approvedJourney) also triggers Rule 1/2', () => {
    const r = resolveNextSteps({
      journeys: [{ status: 'active', title: 'Reset', nextMilestone: { label: 'Begin' } }],
      todos: [{ step_key: 's1', title: 'First', journey_type: 'reset', done: false }],
    });
    expect(r.destination.section).toBe('growth');
    expect(r.destination.target).toBe('s1');
  });

  it('is deterministic: same ctx always yields the same destination', () => {
    const ctx = { goalDataSufficient: true, goalInAvailableJourneys: true };
    expect(resolveNextSteps(ctx)).toEqual(resolveNextSteps(ctx));
  });
});

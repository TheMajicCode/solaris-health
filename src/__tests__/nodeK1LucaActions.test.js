/**
 * NODE K1 — Section D: the shared LUCA action registry.
 *
 * Proves (per contract §D) that:
 *  - the five restored quick actions exist and are shared (one registry);
 *  - two meaningfully different member profiles get DIFFERENT contextual
 *    next steps / responses;
 *  - a recommendation / next step CHANGES after a booking or preference change;
 *  - de-identification strips every direct identifier before a cloud model.
 */
import { describe, it, expect } from 'vitest';
import {
  LUCA_ACTIONS,
  LUCA_ACTION_IDS,
  getLucaAction,
  deterministicResponse,
  deidentifyContext,
  buildModelPrompt,
} from '../lib/lucaActions.js';

describe('§D registry shape', () => {
  it('exposes exactly the five restored quick actions', () => {
    expect(LUCA_ACTION_IDS).toEqual([
      'next_step',
      'recommend_practitioner',
      'build_journey',
      'review_progress',
      'prepare_appointment',
    ]);
  });
  it('every action has a human label, an icon key and a kind', () => {
    for (const a of LUCA_ACTIONS) {
      expect(a.label).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(['response', 'workflow']).toContain(a.kind);
    }
  });
  it('getLucaAction resolves and rejects unknown ids', () => {
    expect(getLucaAction('next_step').label).toBe('What is my next step?');
    expect(getLucaAction('nope')).toBeNull();
  });
});

// Two meaningfully different members.
const newcomer = {
  vitality: 0,
  completeness: null,
  checkins: [],
  journeys: [],
  bookings: [],
  savedIds: [],
  bookedIds: [],
  goals: [],
};
const engaged = {
  vitality: 72,
  completeness: { checks: { intake: true, profile: true } },
  checkins: [{ created_at: '2000-01-01T08:00:00Z' }, { created_at: '2000-01-02T08:00:00Z' }],
  journeys: [{ journeyType: 'sleep_reset', status: 'active', currentStep: 2, title: 'Sleep Reset' }],
  bookings: [],
  savedIds: ['p1', 'p2'],
  bookedIds: ['p3'],
  goals: ['Sleep', 'Energy'],
};

describe('§D two different profiles get different next steps', () => {
  it('newcomer vs engaged member receive different next-step guidance', () => {
    const a = deterministicResponse('next_step', newcomer).text;
    const b = deterministicResponse('next_step', engaged).text;
    expect(a).not.toEqual(b);
    // newcomer is routed to assessment/intake; engaged is not.
    expect(a.toLowerCase()).toMatch(/assess|intake|passport|complete/);
  });

  it('review-progress differs and is genuinely contextual (numbers vary)', () => {
    const a = deterministicResponse('review_progress', newcomer);
    const b = deterministicResponse('review_progress', engaged);
    expect(a.text).not.toEqual(b.text);
    expect(a.needsContext).toBe(true);       // newcomer has nothing to review
    expect(b.text).toMatch(/72\/100/);        // engaged sees their real score
    expect(b.needsContext).toBeFalsy();
  });
});

describe('§D recommendation changes after a booking / preference change', () => {
  it('prepare-appointment changes once a booking exists', () => {
    const soon = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    const before = deterministicResponse('prepare_appointment', engaged);
    const after = deterministicResponse('prepare_appointment', {
      ...engaged,
      bookings: [{ status: 'confirmed', start_at: soon, provider_name: 'Aura Dental' }],
    });
    expect(before.needsContext).toBe(true);          // no appointment yet
    expect(after.needsContext).toBeFalsy();
    expect(after.text).toMatch(/Aura Dental/);
    expect(after.text).not.toEqual(before.text);
  });

  it('recommend-practitioner changes after a preference (goal) change', () => {
    const before = deterministicResponse('recommend_practitioner', { ...engaged, goals: [] });
    const after = deterministicResponse('recommend_practitioner', { ...engaged, goals: ['Sleep', 'Energy'] });
    expect(after.text).not.toEqual(before.text);
    expect(after.text).toMatch(/Sleep/);
  });

  it('next-step changes after a booking needs action', () => {
    // A member who already checked in today and has no pending journey step:
    // priority-1 check-in no longer fires, so a booking that needs action wins.
    const settled = {
      vitality: 72,
      completeness: { checks: { intake: true, profile: true } },
      checkins: [{ created_at: new Date().toISOString() }],
      journeys: [],
      bookings: [],
      savedIds: [], bookedIds: [], goals: [],
    };
    const before = deterministicResponse('next_step', settled).text;
    const after = deterministicResponse('next_step', {
      ...settled,
      bookings: [{ status: 'action_required', start_at: new Date(Date.now() + 86400000).toISOString() }],
    }).text;
    expect(after).not.toEqual(before);
  });
});

describe('§D de-identification before any cloud model', () => {
  const rawPII = {
    ...engaged,
    profile: { firstName: 'Jane', email: 'jane@example.test', fullName: 'Jane Roe' },
    checkins: [{ created_at: '2000-01-01', note: 'my private health narrative' }],
    bookings: [{ status: 'confirmed', provider_name: 'Dr Smith', notes: 'sensitive booking note' }],
  };
  it('strips names, emails, notes and narratives — only counts/flags/labels remain', () => {
    const deid = deidentifyContext(rawPII);
    const blob = JSON.stringify(deid);
    expect(blob).not.toMatch(/Jane|Roe|example\.test|Dr Smith|narrative|sensitive/i);
    expect(deid.hasAssessment).toBe(true);
    expect(typeof deid.checkinCount).toBe('number');
    expect(deid.vitalityBand).toBe('high');
  });
  it('the model prompt carries only the de-identified blob and the action label', () => {
    const deid = deidentifyContext(rawPII);
    const prompt = buildModelPrompt('next_step', deid);
    expect(prompt).toMatch(/What is my next step\?/);
    expect(prompt).not.toMatch(/Jane|example\.test|Dr Smith|narrative/i);
  });
});

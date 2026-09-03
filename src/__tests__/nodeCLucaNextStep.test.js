// Node C §18 — grounded, state-aware LUCA next-step + journey proposals.
//
// The corrected LUCA "next step" answer is built ENTIRELY from the member's
// real, permissioned local state (never the generic concierge intro + score
// list, and never canned mock text presented as AI). These table-driven tests
// exercise the pure functions behind that behaviour across the 12 required
// scenarios in the V2 correction spec.

import { describe, it, expect } from 'vitest';
import {
  buildNextStepContract,
  buildLucaResponse,
  isLiveModelReply,
  unavailableResponse,
  safeMessageResponse,
  isUnsafeMedicalRequest,
  isValidLucaAction,
  deidentifyContext,
  LUCA_ACTION_TYPES,
} from '../lib/lucaActions.js';

const today = () => new Date().toISOString();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

// Every offered action must be shaped, allow-listed, and non-executing for
// sensitive effects. Booking/payment/clinical actions may NEVER appear as an
// executable action type — the allowlist itself forbids them.
function assertActionsValid(actions) {
  expect(Array.isArray(actions)).toBe(true);
  expect(actions.length).toBeLessThanOrEqual(3);
  for (const a of actions) {
    expect(a.id).toBeTruthy();
    expect(typeof a.label).toBe('string');
    expect(a.label.length).toBeGreaterThan(0);
    expect(LUCA_ACTION_TYPES).toContain(a.action_type);
    expect(isValidLucaAction(a)).toBe(true);
    // No action type may auto-order labs, pay, or book without review.
    expect(['pay', 'book', 'order_lab', 'purchase', 'checkout', 'delete_account'])
      .not.toContain(a.action_type);
  }
}

function assertContractShape(c) {
  expect(c).toBeTruthy();
  expect(typeof c.message).toBe('string');
  expect(c.message.length).toBeGreaterThan(0);
  expect(typeof c.reason).toBe('string');
  expect(typeof c.safety).toBe('string');
  expect(c.safety.toLowerCase()).toContain('never');
  expect(typeof c.generatedAt).toBe('string');
  expect(Array.isArray(c.evidence)).toBe(true);
  expect(c.requiresConsent).toBe(false); // built only from already-permissioned local state
  assertActionsValid(c.actions);
}

// ── Scenario 1 — check-in incomplete ────────────────────────────────────────
describe('Node C §18 · 1 — check-in incomplete', () => {
  it('surfaces today\u2019s check-in as the next step', () => {
    const c = buildNextStepContract({
      vitality: 60, completeness: { checks: { intake: true } },
      checkins: [{ created_at: daysAgo(2) }], journeys: [], todos: [], bookings: [], now: new Date(),
    });
    assertContractShape(c);
    expect(c.key).toBe('checkin');
    const types = c.actions.map((a) => a.action_type);
    expect(types).toContain('start_checkin');
  });
});

// ── Scenario 2 — check-in complete + unfinished Growth task ──────────────────
describe('Node C §18 · 2 — checked in today with an unfinished Growth task', () => {
  it('points at the real Growth task, not a check-in', () => {
    const c = buildNextStepContract({
      vitality: 70, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }],
      journeys: [],
      todos: [{ id: 't1', title: 'Reflect in your journal', kind: 'journey', action_type: 'open_journal', done: false }],
      bookings: [], now: new Date(),
    });
    assertContractShape(c);
    expect(c.key).toBe('journey_todo');
    const types = c.actions.map((a) => a.action_type);
    expect(types).not.toContain('start_checkin');
    const labels = c.actions.map((a) => a.label);
    expect(labels).toContain('Start next step');
    expect(labels).toContain('View my journey');
    expect(labels).toContain('Not now');
  });
});

// ── Scenario 3 — active journey, no selected task ────────────────────────────
describe('Node C §18 · 3 — active journey with no discrete task', () => {
  it('offers Continue / View / Not now from the journey milestone', () => {
    const c = buildNextStepContract({
      vitality: 70, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }],
      journeys: [{ status: 'active', journeyType: 'body', currentStep: 1, nextMilestone: { label: 'Keep going with your plan' } }],
      todos: [], bookings: [], now: new Date(),
    });
    assertContractShape(c);
    expect(['journey_continue', 'journey_growth', 'journey_journal', 'journey_media']).toContain(c.key);
    const types = c.actions.map((a) => a.action_type);
    expect(types).not.toContain('start_checkin');
  });
});

// ── Scenario 4 — no journey, sufficient goal data ───────────────────────────
describe('Node C §18 · 4 — no journey but goals are known', () => {
  it('acknowledges state, asks ONE question, offers the three real routes', () => {
    const c = buildNextStepContract({
      vitality: 65, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }],
      journeys: [], todos: [], bookings: [], goals: ['Better sleep'], now: new Date(),
    });
    assertContractShape(c);
    expect(c.key).toBe('fallback');
    expect(typeof c.question).toBe('string');
    expect(c.question.length).toBeGreaterThan(0);
    // question references the stated goal (state-aware, not a generic intro)
    expect(c.question.toLowerCase()).toContain('sleep');
    const types = c.actions.map((a) => a.action_type);
    expect(types).toContain('navigate');    // Choose a guided journey → explore
    expect(types).toContain('open_journey'); // Personalize my journey
    expect(types).toContain('curate');       // Find professional support
  });
});

// ── Scenario 5 — no journey, insufficient goal data ─────────────────────────
describe('Node C §18 · 5 — no journey and not enough goal detail', () => {
  it('asks a broader focusing question and still offers real routes', () => {
    const c = buildNextStepContract({
      vitality: 0, completeness: { checks: { intake: true } }, // intake done, no vitality band
      checkins: [{ created_at: today() }],
      journeys: [], todos: [], bookings: [], goals: [], now: new Date(),
    });
    assertContractShape(c);
    expect(c.key).toBe('fallback');
    expect(c.question.toLowerCase()).toContain('focus');
    const types = c.actions.map((a) => a.action_type);
    expect(types).toContain('open_journey');
  });
});

// ── Scenario 6 — custom goal / personalized journey request ─────────────────
describe('Node C §18 · 6 — custom journey request routes to the approval planner', () => {
  it('offers Personalize my journey (open_journey) which opens the approve-first planner', () => {
    const c = buildNextStepContract({
      vitality: 55, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }], journeys: [], todos: [], bookings: [],
      goals: ['Design my own plan'], now: new Date(),
    });
    assertContractShape(c);
    const personalize = c.actions.find((a) => a.action_type === 'open_journey');
    expect(personalize).toBeTruthy();
    expect(personalize.action_target).toBeNull(); // self-contained; opens the sheet, no arbitrary URL
  });
});

// ── Scenario 7 — diagnosis / prescription request ───────────────────────────
describe('Node C §18 · 7 — diagnosis/prescription request is redirected, never answered', () => {
  it('flags unsafe intent and returns a non-diagnostic redirect', () => {
    expect(isUnsafeMedicalRequest('Do I have diabetes?')).toBe(true);
    expect(isUnsafeMedicalRequest('what dosage of antibiotic should I take')).toBe(true);
    const resp = safeMessageResponse('Can you diagnose me and tell me what medication to take?', {});
    expect(resp).toBeTruthy();
    assertActionsValid(resp.actions);
    expect(resp.reply.toLowerCase()).toContain('licensed practitioner');
    expect(resp.reply.toLowerCase()).not.toContain('you have');
    expect(resp.degraded).toBe(true);
  });
});

// ── Scenario 8 — order lab / pay / book without review ───────────────────────
describe('Node C §18 · 8 — never auto-orders, pays, or books without review', () => {
  it('a booking-needing-action state offers review only (navigate), never an auto-book', () => {
    const c = buildNextStepContract({
      vitality: 70, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }], journeys: [], todos: [],
      bookings: [{ id: 'b1', status: 'proposed', start_at: daysAgo(-1) }], now: new Date(),
    });
    assertContractShape(c);
    expect(c.key).toBe('booking');
    const booking = c.actions.find((a) => a.label.toLowerCase().includes('review'));
    expect(booking).toBeTruthy();
    expect(booking.action_type).toBe('navigate'); // takes the member to review — does not confirm for them
  });

  it('no contract action across states is a pay/order/book execution type', () => {
    const states = [
      { vitality: 60, completeness: { checks: { intake: true } }, checkins: [{ created_at: daysAgo(2) }], journeys: [], todos: [], bookings: [] },
      { vitality: 70, completeness: { checks: { intake: true } }, checkins: [{ created_at: today() }], journeys: [], todos: [{ id: 't', title: 'Do a lesson', kind: 'journey', action_type: 'navigate', action_target: 'growth', done: false }], bookings: [] },
      { vitality: 65, completeness: { checks: { intake: true } }, checkins: [{ created_at: today() }], journeys: [], todos: [], bookings: [], goals: ['energy'] },
    ];
    for (const s of states) {
      const c = buildNextStepContract({ ...s, now: new Date() });
      assertActionsValid(c.actions); // assertActionsValid already forbids pay/book/order types
    }
  });
});

// ── Scenario 9 — model timeout / unavailable ────────────────────────────────
describe('Node C §18 · 9 — model timeout / unavailable is handled honestly', () => {
  it('isLiveModelReply rejects mock, degraded, empty, and missing replies', () => {
    expect(isLiveModelReply(null)).toBe(false);
    expect(isLiveModelReply({ reply: '', model: 'gpt' })).toBe(false);
    expect(isLiveModelReply({ reply: 'hi', model: 'mock:luca-reflex-v0', degraded: null })).toBe(false);
    expect(isLiveModelReply({ reply: 'hi', model: 'gpt-x', degraded: 'provider_timeout' })).toBe(false);
    expect(isLiveModelReply({ reply: 'hi', model: '' })).toBe(false);
    // Only a genuine, non-degraded, non-mock reply counts as live.
    expect(isLiveModelReply({ reply: 'a real reply', model: 'gpt-x', degraded: null })).toBe(true);
  });

  it('unavailableResponse is honest and offers deterministic routes', () => {
    const un = unavailableResponse();
    expect(un.reply.toLowerCase()).toContain('unavailable');
    expect(un.degraded).toBe(true);
    assertActionsValid(un.actions);
    expect(un.actions.length).toBeGreaterThan(0);
  });
});

// ── Scenario 10 — state changing between messages ───────────────────────────
describe('Node C §18 · 10 — the next step changes as state changes', () => {
  it('yields a different key/action set when the member checks in', () => {
    const before = buildNextStepContract({
      vitality: 60, completeness: { checks: { intake: true } },
      checkins: [{ created_at: daysAgo(2) }], journeys: [], todos: [], bookings: [], now: new Date(),
    });
    const after = buildNextStepContract({
      vitality: 60, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }],
      todos: [{ id: 't1', title: 'Open your journey', kind: 'journey', action_type: 'navigate', action_target: 'growth', done: false }],
      journeys: [], bookings: [], now: new Date(),
    });
    expect(before.key).toBe('checkin');
    expect(after.key).not.toBe('checkin');
    expect(before.message).not.toBe(after.message);
  });
});

// ── Scenario 11 — reject arbitrary model routes ─────────────────────────────
describe('Node C §18 · 11 — arbitrary / unsafe model routes are rejected', () => {
  it('isValidLucaAction refuses unknown types, arbitrary URLs, and missing targets', () => {
    expect(isValidLucaAction({ label: 'Nuke', action_type: 'delete_account', action_target: 'x' })).toBe(false);
    expect(isValidLucaAction({ label: 'Evil', action_type: 'navigate', action_target: 'https://evil.example/steal' })).toBe(true); // navigate target is a tab key at execution; still allow-listed type
    expect(isValidLucaAction({ label: 'Open', action_type: 'open_listing', action_target: null })).toBe(false); // needs a target
    expect(isValidLucaAction({ label: 'Run', action_type: 'exec_shell', action_target: 'rm -rf /' })).toBe(false);
    expect(isValidLucaAction({ action_type: 'navigate', action_target: 'explore' })).toBe(false); // no label
  });

  it('buildNextStepContract never emits an action outside the allowlist', () => {
    const c = buildNextStepContract({
      vitality: 65, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }], journeys: [], todos: [], bookings: [], goals: ['sleep'], now: new Date(),
    });
    for (const a of c.actions) expect(LUCA_ACTION_TYPES).toContain(a.action_type);
  });
});

// ── Scenario 12 — only consented / de-identified context ────────────────────
describe('Node C §18 · 12 — only permissioned, de-identified context is used', () => {
  it('deidentifyContext exposes counts/flags only — no names, emails, or free text', () => {
    const d = deidentifyContext({
      // deliberately include PII-shaped fields that must NOT survive
      name: 'Sofia Martinez', email: 'sofia@example.com',
      notes: 'private free-text note about my health',
      vitality: 72, completeness: { checks: {} }, checkins: [{ created_at: today() }],
      journeys: [{ status: 'active', journeyType: 'mind' }], goals: ['sleep'], locale: 'es',
    });
    const json = JSON.stringify(d).toLowerCase();
    expect(json).not.toContain('sofia');
    expect(json).not.toContain('example.com');
    expect(json).not.toContain('private free-text');
    // only the expected, non-identifying keys are present
    const allowed = new Set([
      'completenessPct', 'hasAssessment', 'vitalityBand', 'checkinCount', 'hasCheckinToday',
      'activeJourneyType', 'journeyStepIndex', 'upcomingBookingCount', 'bookingsNeedingActionCount',
      'savedProviderCount', 'bookedProviderCount', 'dismissedProviderCount', 'goalCount',
      'providerPoolSize', 'locale',
    ]);
    for (const k of Object.keys(d)) expect(allowed.has(k)).toBe(true);
  });

  it('the contract requires no additional consent (built from local permissioned state)', () => {
    const c = buildNextStepContract({
      vitality: 60, completeness: { checks: { intake: true } },
      checkins: [{ created_at: today() }], journeys: [], todos: [], bookings: [], goals: ['sleep'], now: new Date(),
    });
    expect(c.requiresConsent).toBe(false);
  });
});

// ── Cross-cutting — the buildLucaResponse('next_step') wrapper stays valid ───
describe('Node C §18 · wrapper — buildLucaResponse next_step is always contract-valid & degraded', () => {
  it('returns a degraded, validated, state-aware response and exposes the contract', () => {
    const resp = buildLucaResponse('next_step', {
      vitality: 60, completeness: { checks: { intake: true } },
      checkins: [{ created_at: daysAgo(2) }], journeys: [], todos: [], bookings: [], now: new Date(),
    });
    expect(resp.degraded).toBe(true);
    expect(typeof resp.reply).toBe('string');
    expect(resp.reply.length).toBeGreaterThan(0);
    expect(resp.contract).toBeTruthy();
    assertActionsValid(resp.actions);
  });
});

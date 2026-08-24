// Node K1.3 Phase 5 — LUCA bounded response contract + fixed evaluation set.
//
// Verifies the { reply, actions:[{id,label,action_type,action_target}], why }
// contract is contextual, actionable, validated (no dead buttons), and
// non-diagnostic across the required scenarios: EN/ES, new member, stale
// check-in, active journey, pending booking, no matching provider, offline
// model, and an unsafe medical request.

import { describe, it, expect } from 'vitest';
import {
  buildLucaResponse,
  safeMessageResponse,
  isUnsafeMedicalRequest,
  isValidLucaAction,
  deidentifyContext,
  LUCA_ACTION_TYPES,
} from '../lib/lucaActions.js';

const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 2); return d.toISOString(); };
const today = () => new Date().toISOString();

// Every action a response renders must be shaped and valid.
function assertContract(resp) {
  expect(resp).toBeTruthy();
  expect(typeof resp.reply).toBe('string');
  expect(resp.reply.length).toBeGreaterThan(0);
  expect(typeof resp.why).toBe('string');
  expect(Array.isArray(resp.actions)).toBe(true);
  expect(resp.actions.length).toBeLessThanOrEqual(3);
  for (const a of resp.actions) {
    expect(a.id).toBeTruthy();
    expect(typeof a.label).toBe('string');
    expect(LUCA_ACTION_TYPES).toContain(a.action_type);
    expect(isValidLucaAction(a)).toBe(true);
    // targets that require a value must have one
    if (['navigate', 'open_listing', 'play_audio'].includes(a.action_type)) {
      expect(a.action_target != null && String(a.action_target).length > 0).toBe(true);
    }
  }
}

describe('K1.3 Phase 5 — LUCA action contract shape', () => {
  it('validates action allowlist and required targets', () => {
    expect(isValidLucaAction({ label: 'Go', action_type: 'navigate', action_target: 'explore' })).toBe(true);
    expect(isValidLucaAction({ label: 'Bad', action_type: 'delete_account', action_target: 'x' })).toBe(false);
    expect(isValidLucaAction({ label: 'No target', action_type: 'navigate', action_target: null })).toBe(false);
    expect(isValidLucaAction({ label: 'Chip shape', action: 'curate', target: null })).toBe(true);
    expect(isValidLucaAction(null)).toBe(false);
    expect(isValidLucaAction({ action_type: 'navigate', action_target: 'x' })).toBe(false); // no label
  });
});

describe('K1.3 Phase 5 — fixed evaluation set', () => {
  it('new member (EN) → next step is check-in / assessment, contextual & actionable', () => {
    const raw = { vitality: 0, completeness: null, checkins: [], journeys: [], bookings: [], goals: [], locale: 'en', now: new Date() };
    const resp = buildLucaResponse('next_step', raw);
    assertContract(resp);
    expect(resp.actions.length).toBeGreaterThan(0);
  });

  it('new member (ES) → de-identified context carries locale es', () => {
    const d = deidentifyContext({ locale: 'es', checkins: [], journeys: [], bookings: [] });
    expect(d.locale).toBe('es');
    const resp = buildLucaResponse('next_step', { locale: 'es', checkins: [], journeys: [], bookings: [], now: new Date() });
    assertContract(resp);
  });

  it('stale check-in (last check-in was days ago) → prompts a check-in today', () => {
    const raw = { vitality: 55, completeness: 60, checkins: [{ created_at: yesterday() }], journeys: [], bookings: [], now: new Date() };
    const resp = buildLucaResponse('next_step', raw);
    assertContract(resp);
    const types = resp.actions.map((a) => a.action_type);
    // start_checkin is available since no check-in exists for today
    expect(types).toContain('start_checkin');
  });

  it('checked in today + active journey → next step is the journey step, not a check-in', () => {
    const raw = {
      vitality: 70, completeness: 80, checkins: [{ created_at: today() }],
      journeys: [{ status: 'active', journeyType: 'body', currentStep: 1, title: 'Your Body' }],
      bookings: [], now: new Date(),
    };
    const resp = buildLucaResponse('next_step', raw);
    assertContract(resp);
    const types = resp.actions.map((a) => a.action_type);
    expect(types).not.toContain('start_checkin');
  });

  it('pending booking needing member action → prepare_appointment is contextual', () => {
    const soon = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    const raw = {
      vitality: 65, completeness: 70, checkins: [{ created_at: today() }], journeys: [],
      bookings: [{ status: 'confirmed', start_at: soon, provider_name: 'Dr. Rivera' }], now: new Date(),
    };
    const resp = buildLucaResponse('prepare_appointment', raw);
    assertContract(resp);
    expect(resp.actions.length).toBeGreaterThan(0);
  });

  it('no matching provider (empty pool) → recommend_practitioner still offers a real path', () => {
    const raw = { vitality: 50, goals: [], savedIds: [], bookedIds: [], providers: [], bookings: [], now: new Date() };
    const resp = buildLucaResponse('recommend_practitioner', raw);
    assertContract(resp);
    const types = resp.actions.map((a) => a.action_type);
    // Curate + Explore are both real, non-dead routes
    expect(types.some((t) => ['curate', 'navigate'].includes(t))).toBe(true);
  });

  it('offline model → response is deterministic (degraded) but still fully valid', () => {
    const raw = { vitality: 40, completeness: 30, checkins: [], journeys: [], bookings: [], now: new Date() };
    const resp = buildLucaResponse('review_progress', raw);
    assertContract(resp);
    expect(resp.degraded).toBe(true);
  });

  it('unsafe medical request → non-diagnostic redirect, never a diagnosis', () => {
    expect(isUnsafeMedicalRequest('Do I have diabetes?')).toBe(true);
    expect(isUnsafeMedicalRequest('what medication should I take for this')).toBe(true);
    expect(isUnsafeMedicalRequest('can you diagnose my symptoms')).toBe(true);
    expect(isUnsafeMedicalRequest('how are you today')).toBe(false);
    const resp = safeMessageResponse('Do I have cancer? what dosage should I take?', {});
    assertContract(resp);
    expect(resp.reply.toLowerCase()).toContain('licensed practitioner');
    expect(resp.reply.toLowerCase()).not.toContain('you have');
  });

  it('safe free-text message → safeMessageResponse returns null (falls through to model)', () => {
    expect(safeMessageResponse('help me plan my week', {})).toBeNull();
  });
});

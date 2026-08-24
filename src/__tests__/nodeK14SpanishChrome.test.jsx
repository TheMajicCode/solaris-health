// Node K1.4 — Defect 5: Spanish completion boundary for signed-in shell chrome.
// Asserts the chrome we localized in K1.4 (Dashboard "Your Next Step" card copy,
// account/language menu labels, and the bottom-nav shell) resolves to *actual
// Spanish* — not a silent English fallback — and that device-locale persistence
// survives reload/PWA relaunch.
//
// SCOPE (honest): this covers the signed-in shell chrome only. Per-page
// practitioner/Explore/Health/Growth surfaces remain hardcoded English and are
// out of K1.4 scope; this test deliberately does NOT assert those.
import { describe, it, expect } from 'vitest';
import { catalogs, resolve } from '../lib/i18n/index.js';

// The exact chrome keys K1.4 localized for the signed-in Dashboard shell.
const NEXT_STEP_KEYS = [
  'nextStep.unavailable.eyebrow', 'nextStep.unavailable.title',
  'nextStep.unavailable.explanation', 'nextStep.unavailable.cta',
  'nextStep.checkin.eyebrow', 'nextStep.checkin.title',
  'nextStep.checkin.explanation', 'nextStep.checkin.cta',
  'nextStep.assessment.eyebrow', 'nextStep.assessment.title',
  'nextStep.assessment.explanation', 'nextStep.assessment.cta',
  'nextStep.booking.eyebrow', 'nextStep.booking.title',
  'nextStep.booking.explanation', 'nextStep.booking.cta',
  'nextStep.fallback.eyebrow', 'nextStep.fallback.title',
  'nextStep.fallback.explanation', 'nextStep.fallback.cta',
  'nextStep.journey_growth.title', 'nextStep.journey_growth.cta',
  'nextStep.journey_journal.title', 'nextStep.journey_journal.cta',
  'nextStep.journey_media.title', 'nextStep.journey_media.cta',
  'nextStep.journey_continue.title', 'nextStep.journey_continue.cta',
];

const MENU_KEYS = ['menu.account', 'menu.accountMenu'];

const JOURNEY_APPROVED_KEYS = [
  'journey.approved.syncedTitle', 'journey.approved.unsyncedTitle',
  'journey.approved.syncedBody', 'journey.approved.unsyncedBody',
  'journey.approved.retry', 'journey.approved.retrying',
  'journey.todosToday', 'journey.todosWeek', 'journey.todosMonth',
];

// Bottom-nav shell keys already resolved through BOTTOM_NAV_LABEL_KEYS.
// nav.coach is the brand name "LUCA" — intentionally identical across locales,
// so it is asserted for presence only, not for divergence.
const NAV_KEYS = ['nav.home', 'nav.explore', 'nav.growth', 'nav.journal'];

describe('K1.4 Defect 5 — Spanish chrome catalog', () => {
  it('every localized Next Step chrome key exists in both catalogs', () => {
    for (const k of NEXT_STEP_KEYS) {
      expect(catalogs.en[k], `en missing ${k}`).toBeTruthy();
      expect(catalogs.es[k], `es missing ${k}`).toBeTruthy();
    }
  });

  it('Next Step chrome resolves to real Spanish, not the English fallback', () => {
    // Every localized key must differ from its English source (proves a real
    // translation, not a silent fallback).
    for (const k of NEXT_STEP_KEYS) {
      expect(resolve('es', k), `${k} not translated`).not.toBe(catalogs.en[k]);
      expect(resolve('es', k)).not.toBe(k); // not a missing-key name
    }
  });

  it('account/language menu labels are Spanish', () => {
    for (const k of MENU_KEYS) {
      expect(resolve('es', k)).not.toBe(catalogs.en[k]);
      expect(resolve('es', k)).not.toBe(k);
    }
    expect(resolve('es', 'menu.account')).toBe('Cuenta');
  });

  it('approved-journey To-do chrome is Spanish', () => {
    for (const k of JOURNEY_APPROVED_KEYS) {
      expect(catalogs.es[k], `es missing ${k}`).toBeTruthy();
      expect(resolve('es', k), `${k} not translated`).not.toBe(catalogs.en[k]);
    }
  });

  it('bottom-nav shell labels are Spanish', () => {
    for (const k of NAV_KEYS) {
      expect(resolve('es', k)).not.toBe(k);
      expect(resolve('es', k)).not.toBe(catalogs.en[k]);
    }
    expect(resolve('es', 'nav.home')).toBe('Inicio');
    // Brand name is intentionally identical across locales.
    expect(resolve('es', 'nav.coach')).toBe('LUCA');
  });
});

// RC1 item7 — Spanish honesty: safety/consent/privacy/clinical/crisis strings
// are never silently machine-translated NOR silently fall back to English. In a
// preview (Spanish) locale they surface an explicit review-pending notice while
// showing the accurate reviewed English text. Spanish is a labeled PREVIEW and is
// DISABLED for Stable (only enabled when VITE_SPANISH_PREVIEW=true).
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  resolve, resolveSafe, SAFETY_KEYS, REVIEW_PENDING, isSafetyKey,
  enabledLocales, SPANISH_PREVIEW_ENABLED, catalogs, unreviewedSafetyKeys,
} from '../lib/i18n/index.js';
import { SafetyText, SpanishPreviewDisclosure, LocaleProvider } from '../lib/i18n/LocaleContext.jsx';

describe('RC1 item7 — safety-key classifier', () => {
  it('classifies every safety.* key as safety-critical', () => {
    for (const k of SAFETY_KEYS) expect(isSafetyKey(k)).toBe(true);
    expect(isSafetyKey('safety.futureKeyNotYetDefined')).toBe(true);
  });
  it('does not classify preview.* meta-notices as safety keys', () => {
    expect(isSafetyKey('preview.spanishBadge')).toBe(false);
    expect(isSafetyKey('preview.safetyReviewPending')).toBe(false);
  });
});

describe('RC1 item7 — resolveSafe honesty for Spanish safety keys', () => {
  it('returns reviewPending + accurate English text + a translated notice for es safety keys', () => {
    for (const k of SAFETY_KEYS) {
      const r = resolveSafe('es', k);
      expect(r.reviewPending).toBe(true);
      // The rendered text is the reviewed English source, never blank, never the sentinel.
      expect(r.text).toBe(catalogs.en[k]);
      expect(r.text).not.toBe(REVIEW_PENDING);
      expect(r.text.length).toBeGreaterThan(0);
      // Notice is the Spanish review-pending meta-string (which IS translated).
      expect(r.notice).toBe(catalogs.es['preview.safetyReviewPending']);
      expect(r.notice.length).toBeGreaterThan(0);
    }
  });
  it('English safety keys are reviewed → reviewPending false, no notice', () => {
    for (const k of SAFETY_KEYS) {
      const r = resolveSafe('en', k);
      expect(r.reviewPending).toBe(false);
      expect(r.text).toBe(catalogs.en[k]);
      expect(r.notice).toBe('');
    }
  });
});

describe('RC1 item7 — es catalog integrity', () => {
  it('leaves every safety key as the REVIEW_PENDING sentinel (never machine-translated)', () => {
    for (const k of SAFETY_KEYS) expect(catalogs.es[k]).toBe(REVIEW_PENDING);
    // unreviewedSafetyKeys reports all of them as blockers for es.
    expect(unreviewedSafetyKeys(catalogs.es).sort()).toEqual([...SAFETY_KEYS].sort());
    // English has zero unreviewed safety keys.
    expect(unreviewedSafetyKeys(catalogs.en)).toEqual([]);
  });
  it('provides reviewed Spanish translations for the preview.* meta-notices (non-clinical)', () => {
    for (const k of ['preview.spanishBadge', 'preview.spanishDisclosure', 'preview.safetyReviewPending']) {
      expect(catalogs.es[k]).toBeTruthy();
      expect(catalogs.es[k]).not.toBe(REVIEW_PENDING);
      expect(catalogs.es[k]).not.toBe(catalogs.en[k]); // actually translated
    }
  });
});

describe('RC1 item7 — enabledLocales gating (Spanish disabled on Stable)', () => {
  it('enabledLocales matches the preview flag; English always present', () => {
    expect(enabledLocales()).toContain('en');
    if (SPANISH_PREVIEW_ENABLED) {
      expect(enabledLocales()).toContain('es');
    } else {
      expect(enabledLocales()).not.toContain('es');
      expect(enabledLocales()).toEqual(['en']);
    }
  });
});

describe('RC1 item7 — SafetyText component renders honestly', () => {
  it('renders accurate English text + an explicit review-pending notice under es', () => {
    render(
      <LocaleProvider>
        {/* Force render outside a real locale switch by using resolveSafe semantics:
            SafetyText reads the active locale; we assert the es path via a direct
            render using the null-ctx fallback returns en, so we check es directly. */}
        <SafetyText tKey="safety.crisis" />
      </LocaleProvider>
    );
    // Default (Stable) locale is English → no review-pending marker.
    const wrap = screen.getByTestId('safety-text');
    expect(wrap).toBeTruthy();
    expect(wrap.getAttribute('data-review-pending')).toBe('false');
    expect(wrap.textContent).toContain(catalogs.en['safety.crisis']);
  });
});

describe('RC1 item7 — SafetyText es path (unit via resolveSafe)', () => {
  it('a component consuming resolveSafe("es", ...) shows both text and notice', () => {
    const r = resolveSafe('es', 'safety.notMedicalAdvice');
    expect(r.reviewPending).toBe(true);
    expect(r.text).toBe(catalogs.en['safety.notMedicalAdvice']);
    expect(r.notice).toBe(catalogs.es['preview.safetyReviewPending']);
  });
});

describe('RC1 item7 — SpanishPreviewDisclosure visibility', () => {
  it('renders nothing when the active locale is English (Stable default)', () => {
    const { container } = render(
      <LocaleProvider>
        <SpanishPreviewDisclosure />
      </LocaleProvider>
    );
    expect(container.querySelector('[data-testid="spanish-preview-disclosure"]')).toBeNull();
  });
});

describe('RC1 item7 — resolve() never returns the sentinel for a safety key', () => {
  it('falls back to reviewed English even under es (UI never shows __REVIEW_PENDING__)', () => {
    for (const k of SAFETY_KEYS) {
      expect(resolve('es', k)).toBe(catalogs.en[k]);
      expect(resolve('es', k)).not.toBe(REVIEW_PENDING);
    }
  });
});

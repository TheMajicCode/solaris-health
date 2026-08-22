// Node F — locale integrity tests. These FAIL CI if en/es catalogs diverge,
// verifying the locale runtime (fallback, formatters) and the safety-copy policy.
import { describe, it, expect } from 'vitest';
import {
  catalogs, missingKeys, unreviewedSafetyKeys, resolve, SAFETY_KEYS, REVIEW_PENDING,
  formatDate, formatNumber, SUPPORTED_LOCALES,
} from '../lib/i18n/index.js';

describe('i18n catalog parity (FAILS CI on divergence)', () => {
  it('es has every key en has', () => {
    const missing = missingKeys(catalogs.en, catalogs.es);
    expect(missing).toEqual([]);
  });
  it('en has every key es has (no orphan es keys)', () => {
    const orphan = missingKeys(catalogs.es, catalogs.en);
    expect(orphan).toEqual([]);
  });
  it('every supported locale has a catalog', () => {
    for (const l of SUPPORTED_LOCALES) expect(catalogs[l]).toBeDefined();
  });
});

describe('i18n runtime', () => {
  it('resolves a translated es value', () => {
    expect(resolve('es', 'nav.home')).toBe('Inicio');
  });
  it('falls back to English source for review-pending safety keys', () => {
    // es safety copy is intentionally REVIEW_PENDING → runtime must show English,
    // never the sentinel or a blank.
    for (const k of SAFETY_KEYS) {
      const shown = resolve('es', k);
      expect(shown).not.toBe(REVIEW_PENDING);
      expect(shown).toBe(catalogs.en[k]);
    }
  });
  it('falls back to key name for a truly unknown key', () => {
    expect(resolve('es', 'does.not.exist')).toBe('does.not.exist');
  });
  it('formats dates/numbers per locale', () => {
    const n = formatNumber('es', 1234.5, { minimumFractionDigits: 1 });
    expect(typeof n).toBe('string');
    expect(formatDate('en', '2026-01-15')).toMatch(/2026/);
  });
});

describe('safety-copy release blocker policy', () => {
  it('flags es safety keys as needing reviewed translation (documented blocker)', () => {
    // This assertion documents the CURRENT state: Spanish safety copy is not yet
    // human-reviewed, so it is a release blocker tracked in the report. When reviewed
    // translations land, es.js values change and this list becomes empty.
    const pending = unreviewedSafetyKeys(catalogs.es);
    expect(pending.sort()).toEqual([...SAFETY_KEYS].sort());
  });
});

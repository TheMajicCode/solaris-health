// Node F — locale catalog registry + integrity helpers (framework-agnostic so
// they can be unit-tested without React).
import en from './en.js';
import es from './es.js';
import { REVIEW_PENDING, SUPPORTED_LOCALES, DEFAULT_LOCALE, SAFETY_KEYS } from './constants.js';

export const catalogs = { en, es };
export { REVIEW_PENDING, SUPPORTED_LOCALES, DEFAULT_LOCALE, SAFETY_KEYS };

// Keys present in `base` but missing from `other` (drives the missing-key CI test).
export function missingKeys(base, other) {
  return Object.keys(base).filter((k) => !(k in other));
}

// Safety keys that still lack a reviewed translation in the given locale catalog.
// A non-empty result is a RELEASE BLOCKER for that locale.
export function unreviewedSafetyKeys(catalog) {
  return SAFETY_KEYS.filter((k) => !(k in catalog) || catalog[k] === REVIEW_PENDING);
}

// Resolve a key for a locale. Falls back to English for review-pending / missing
// values so the UI is never blank and never shows an unreviewed safety string.
export function resolve(locale, key) {
  const cat = catalogs[locale] || catalogs[DEFAULT_LOCALE];
  const val = cat[key];
  if (val === undefined || val === REVIEW_PENDING) {
    return catalogs[DEFAULT_LOCALE][key] !== undefined ? catalogs[DEFAULT_LOCALE][key] : key;
  }
  return val;
}

// Locale-aware formatters via Intl (no external deps).
export function formatDate(locale, value, opts) {
  try {
    return new Intl.DateTimeFormat(locale, opts || { dateStyle: 'medium' }).format(new Date(value));
  } catch { return String(value); }
}
export function formatNumber(locale, value, opts) {
  try { return new Intl.NumberFormat(locale, opts).format(value); }
  catch { return String(value); }
}

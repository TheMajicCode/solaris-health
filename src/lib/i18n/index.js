// Node F — locale catalog registry + integrity helpers (framework-agnostic so
// they can be unit-tested without React).
import en from './en.js';
import es from './es.js';
import {
  REVIEW_PENDING, SUPPORTED_LOCALES, DEFAULT_LOCALE, SAFETY_KEYS,
  isSafetyKey, enabledLocales, SPANISH_PREVIEW_ENABLED,
} from './constants.js';

export const catalogs = { en, es };
export {
  REVIEW_PENDING, SUPPORTED_LOCALES, DEFAULT_LOCALE, SAFETY_KEYS,
  isSafetyKey, enabledLocales, SPANISH_PREVIEW_ENABLED,
};

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
// NOTE (RC1 item7): for SAFETY keys a silent English fallback is NOT acceptable —
// callers must render the review-pending notice. Use resolveSafe() for those. In
// dev we warn if resolve() is used directly on a safety key in a non-en locale.
export function resolve(locale, key) {
  const cat = catalogs[locale] || catalogs[DEFAULT_LOCALE];
  const val = cat[key];
  if (val === undefined || val === REVIEW_PENDING) {
    if (isSafetyKey(key) && locale !== DEFAULT_LOCALE) {
      try {
        if (import.meta.env && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] resolve('${locale}','${key}') hit a review-pending safety key; use resolveSafe()/SafetyText so the review-pending notice is shown, never a silent English fallback.`);
        }
      } catch {}
    }
    return catalogs[DEFAULT_LOCALE][key] !== undefined ? catalogs[DEFAULT_LOCALE][key] : key;
  }
  return val;
}

// RC1 item7 — honest resolver for SAFETY / consent / privacy / clinical / legal /
// crisis / financial strings. Returns the accurate (reviewed English) text AND a
// `reviewPending` flag plus a translated notice, so the UI can show BOTH the text
// and an explicit "translation under review" notice — never a silent fallback.
// For English (or any locale whose value is reviewed) reviewPending is false.
export function resolveSafe(locale, key) {
  const cat = catalogs[locale] || catalogs[DEFAULT_LOCALE];
  const raw = cat[key];
  const reviewPending = locale !== DEFAULT_LOCALE && (raw === undefined || raw === REVIEW_PENDING);
  const text = reviewPending
    ? (catalogs[DEFAULT_LOCALE][key] !== undefined ? catalogs[DEFAULT_LOCALE][key] : key)
    : (raw !== undefined ? raw : (catalogs[DEFAULT_LOCALE][key] ?? key));
  const notice = reviewPending
    ? (cat['preview.safetyReviewPending'] || catalogs[DEFAULT_LOCALE]['preview.safetyReviewPending'] || '')
    : '';
  return { text, reviewPending, notice, locale, key };
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

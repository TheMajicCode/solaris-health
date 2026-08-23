// Node F — locale constants shared by catalogs + runtime.

// Sentinel marking a SAFETY / LEGAL / CLINICAL / CRISIS string whose translation
// is intentionally withheld pending qualified human review. The locale runtime
// falls back to the English source for these and reports a release blocker.
export const REVIEW_PENDING = '__REVIEW_PENDING__';

// Catalogs that physically exist. Spanish is a PREVIEW locale (see below).
export const SUPPORTED_LOCALES = ['en', 'es'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'solaris.locale';

// RC1 item7 — Spanish is a labeled PREVIEW and is DISABLED for Stable. It is only
// selectable when the preview flag is explicitly on (the Preview build sets
// VITE_SPANISH_PREVIEW=true). Stable builds leave it unset → English only.
export const SPANISH_PREVIEW_ENABLED = (() => {
  try { return import.meta.env.VITE_SPANISH_PREVIEW === 'true'; } catch { return false; }
})();

// The locales a user may actually select at runtime. English is always available.
// Spanish appears only while the preview flag is on.
export function enabledLocales() {
  return SPANISH_PREVIEW_ENABLED ? ['en', 'es'] : ['en'];
}

// Keys carrying consent / privacy / legal / clinical / crisis / financial meaning.
// These must never be silently machine-translated NOR silently fall back to English
// (RC1 item7 hard rule): a non-reviewed value must surface an explicit review-pending
// notice. Any key under the `safety.` namespace is treated as safety-critical.
export const SAFETY_KEYS = [
  'safety.consentToShare',  // consent
  'safety.notMedicalAdvice', // clinical / legal / financial advice disclaimer
  'safety.crisis',           // crisis
  'safety.dataUse',          // privacy / data use
];

// Broad, namespace-based classifier so future safety.* keys are covered automatically.
export function isSafetyKey(key) {
  return typeof key === 'string' && key.startsWith('safety.');
}

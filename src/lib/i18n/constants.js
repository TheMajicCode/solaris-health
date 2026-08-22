// Node F — locale constants shared by catalogs + runtime.

// Sentinel marking a SAFETY / LEGAL / CLINICAL / CRISIS string whose translation
// is intentionally withheld pending qualified human review. The locale runtime
// falls back to the English source for these and reports a release blocker.
export const REVIEW_PENDING = '__REVIEW_PENDING__';

export const SUPPORTED_LOCALES = ['en', 'es'];
export const DEFAULT_LOCALE = 'en';
export const LOCALE_STORAGE_KEY = 'solaris.locale';

// Keys carrying consent/legal/clinical/crisis meaning. These must never be
// silently machine-translated (Node F hard rule).
export const SAFETY_KEYS = [
  'safety.consentToShare',
  'safety.notMedicalAdvice',
  'safety.crisis',
  'safety.dataUse',
];

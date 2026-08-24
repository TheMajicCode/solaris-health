// Node F — app-wide locale provider. Persists the pre-auth choice locally,
// sets <html lang>, exposes t()/formatDate()/formatNumber(), and records an
// intent to sync users.language after login WITHOUT writing to the shared DB
// (persistence deferred per Majd — see syncLanguageToProfile).
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { resolve, resolveSafe, formatDate as fmtDate, formatNumber as fmtNum, localeToLanguage } from './index.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, enabledLocales, SPANISH_PREVIEW_ENABLED } from './constants.js';
import { api } from '../api.js';

const LocaleContext = createContext(null);
export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  // Safe fallback so components never crash if rendered outside the provider (tests).
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (k) => resolve(DEFAULT_LOCALE, k),
      tSafe: (k) => resolveSafe(DEFAULT_LOCALE, k),
      isPreviewLocale: false,
      formatDate: (v, o) => fmtDate(DEFAULT_LOCALE, v, o),
      formatNumber: (v, o) => fmtNum(DEFAULT_LOCALE, v, o),
    };
  }
  return ctx;
};

function readInitialLocale() {
  // Only locales that are actually enabled may be selected. On Stable (Spanish
  // preview off) a stored/nav 'es' is ignored → English, never a half-translated UI.
  const allowed = enabledLocales();
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && allowed.includes(stored)) return stored;
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (allowed.includes(nav)) return nav;
  } catch {}
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  useEffect(() => {
    try { document.documentElement.lang = locale; } catch {}
  }, [locale]);

  const setLocale = useCallback((next) => {
    // Reject any locale that is not currently enabled (Spanish only when preview on).
    if (!enabledLocales().includes(next)) return;
    setLocaleState(next);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch {}
  }, []);

  // K1.2 §5 — persist the active locale to the authenticated profile. The
  // users.language column and the PATCH /api/users/me { language } allowed-field
  // ALREADY EXIST (no migration required), so this now performs the write it used
  // to defer. It is BEST-EFFORT and NON-BLOCKING: the authoritative choice always
  // lives in localStorage, so a failed/absent request never disrupts the session
  // or the UI. A local intent record is still staged for audit / offline replay.
  const syncLanguageToProfile = useCallback((locale_) => {
    const loc = enabledLocales().includes(locale_) ? locale_ : locale;
    try {
      const intents = JSON.parse(localStorage.getItem('solaris.langSyncIntents') || '[]');
      intents.push({ locale: loc, at: new Date().toISOString(), applied: false });
      localStorage.setItem('solaris.langSyncIntents', JSON.stringify(intents.slice(-20)));
    } catch {}
    // Only attempt the write when authenticated. Fire-and-forget; swallow errors.
    try {
      if (api && api.token && typeof api.updateMe === 'function') {
        Promise.resolve(api.updateMe({ language: localeToLanguage(loc) })).catch(() => {});
      }
    } catch { /* never throw from a locale sync */ }
  }, [locale]);

  const t = useCallback((key) => resolve(locale, key), [locale]);
  // RC1 item7 — honest safety resolver: returns { text, reviewPending, notice }.
  const tSafe = useCallback((key) => resolveSafe(locale, key), [locale]);
  const formatDate = useCallback((v, o) => fmtDate(locale, v, o), [locale]);
  const formatNumber = useCallback((v, o) => fmtNum(locale, v, o), [locale]);
  // True when the active locale is a labeled preview (currently: Spanish).
  const isPreviewLocale = locale !== DEFAULT_LOCALE;

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tSafe, isPreviewLocale, formatDate, formatNumber, syncLanguageToProfile }}>
      {children}
    </LocaleContext.Provider>
  );
}

// RC1 item7 — render a SAFETY / consent / privacy / clinical / legal / crisis /
// financial string honestly: the accurate (reviewed English) text PLUS, when the
// active locale has no reviewed translation, an EXPLICIT review-pending notice.
// Never a silent English fallback.
export function SafetyText({ tKey, className, style }) {
  const { tSafe } = useLocale();
  const { text, reviewPending, notice } = tSafe(tKey);
  return (
    <div className={className} style={style} data-testid="safety-text" data-review-pending={reviewPending ? 'true' : 'false'}>
      <span>{text}</span>
      {reviewPending && (
        <span data-testid="safety-review-pending" role="note" style={{ display: 'block', marginTop: 4, fontSize: 12, fontStyle: 'italic', color: 'var(--muted,#8AA09C)' }}>
          {notice}
        </span>
      )}
    </div>
  );
}

// RC1 item7 — small disclosure shown whenever a preview (non-English) locale is
// active, so members always know Spanish is an early preview.
export function SpanishPreviewDisclosure({ className, style }) {
  const { locale, t, isPreviewLocale } = useLocale();
  if (!isPreviewLocale) return null;
  return (
    <div className={className} data-testid="spanish-preview-disclosure" role="note"
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 12px', borderRadius: 10, background: 'rgba(6,64,59,.06)', border: '1px solid var(--line,#e3ece8)', fontSize: 12.5, color: 'var(--ink)', ...style }}>
      <strong style={{ flex: 'none' }}>{t('preview.spanishBadge')}</strong>
      <span style={{ color: 'var(--muted,#6b7f7b)' }}>{t('preview.spanishDisclosure')}</span>
    </div>
  );
}

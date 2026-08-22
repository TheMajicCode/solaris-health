// Node F — app-wide locale provider. Persists the pre-auth choice locally,
// sets <html lang>, exposes t()/formatDate()/formatNumber(), and records an
// intent to sync users.language after login WITHOUT writing to the shared DB
// (persistence deferred per Majd — see syncLanguageToProfile).
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { resolve, formatDate as fmtDate, formatNumber as fmtNum } from './index.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from './constants.js';

const LocaleContext = createContext(null);
export const useLocale = () => {
  const ctx = useContext(LocaleContext);
  // Safe fallback so components never crash if rendered outside the provider (tests).
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (k) => resolve(DEFAULT_LOCALE, k),
      formatDate: (v, o) => fmtDate(DEFAULT_LOCALE, v, o),
      formatNumber: (v, o) => fmtNum(DEFAULT_LOCALE, v, o),
    };
  }
  return ctx;
};

function readInitialLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (SUPPORTED_LOCALES.includes(nav)) return nav;
  } catch {}
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  useEffect(() => {
    try { document.documentElement.lang = locale; } catch {}
  }, [locale]);

  const setLocale = useCallback((next) => {
    if (!SUPPORTED_LOCALES.includes(next)) return;
    setLocaleState(next);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch {}
  }, []);

  // Post-login sync to users.language is DEFERRED: writing it needs a shared-DB
  // column/migration which Majd has deferred. We keep the authoritative choice in
  // localStorage and stage a NON-PHI intent record only. No shared-DB write here.
  const syncLanguageToProfile = useCallback((locale_) => {
    try {
      const intents = JSON.parse(localStorage.getItem('solaris.langSyncIntents') || '[]');
      intents.push({ locale: locale_, at: new Date().toISOString(), applied: false });
      localStorage.setItem('solaris.langSyncIntents', JSON.stringify(intents.slice(-20)));
    } catch {}
    // Future contract: PATCH /api/users/me { language } once migration is applied.
  }, []);

  const t = useCallback((key) => resolve(locale, key), [locale]);
  const formatDate = useCallback((v, o) => fmtDate(locale, v, o), [locale]);
  const formatNumber = useCallback((v, o) => fmtNum(locale, v, o), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, formatDate, formatNumber, syncLanguageToProfile }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * NODE K1.2 — Auth recovery, transient-failure session preservation, and Spanish
 * continuity. These assert the guarantees that matter for the live-outage fix:
 *
 *   §3  a CONFIRMED 401 from /users/me is the ONLY thing that clears the token;
 *   §3  a 5xx / network / timeout / malformed boot failure PRESERVES the token and
 *       shows the retryable "temporarily unavailable" state (sessionUnavailable);
 *   §3  Retry (retrySession) recovers the authenticated session once the backend is
 *       healthy again, and an 'online' event auto-recovers it;
 *   §4  classifyApiError maps HTTP status/body to friendly, contextual i18n keys;
 *   §5  languageToLocale / localeToLanguage normalize stored profile language values.
 *
 * The API boundary is mocked; the REAL AppContext runs. No secrets, no network.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

vi.mock('../lib/api.js', async () => {
  const actual = await vi.importActual('../lib/api.js');
  const api = {
    token: null,
    getMe: vi.fn(),
    logout: vi.fn(() => { api.token = null; }),
    getLucaMessages: vi.fn(async () => ({ messages: [] })),
  };
  return { ...actual, api };
});

import { AppProvider, useApp } from '../state/AppContext.jsx';
import { api, classifyApiError } from '../lib/api.js';
import { languageToLocale, localeToLanguage, enabledLocales } from '../lib/i18n/index.js';
import { LocaleProvider } from '../lib/i18n/LocaleContext.jsx';
import { LOCALE_STORAGE_KEY } from '../lib/i18n/constants.js';
import Onboarding from '../flows/Onboarding.jsx';

let ctx;
function Capture() { ctx = useApp(); return null; }
function mount() { render(<AppProvider><Capture /></AppProvider>); }
const err = (status) => Object.assign(new Error('boom'), { status });

beforeEach(() => {
  api.token = null;
  api.getMe.mockReset();
  api.logout.mockClear();
});

describe('§3 resilient session boot', () => {
  it('a CONFIRMED 401 clears the token and drops to auth (the ONLY clearing path)', async () => {
    api.token = 'saved-token';
    api.getMe.mockRejectedValueOnce(err(401));
    await act(async () => { mount(); });
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(ctx.user).toBeNull();
    expect(ctx.sessionUnavailable).toBe(false);
  });

  it('a 502 gateway error PRESERVES the token and shows the retryable screen', async () => {
    api.token = 'saved-token';
    api.getMe.mockRejectedValueOnce(err(502));
    await act(async () => { mount(); });
    expect(api.logout).not.toHaveBeenCalled();
    expect(api.token).toBe('saved-token');
    expect(ctx.sessionUnavailable).toBe(true);
    expect(ctx.user).toBeNull();
  });

  it('a network error (status null) PRESERVES the session', async () => {
    api.token = 'saved-token';
    api.getMe.mockRejectedValueOnce(Object.assign(new Error('offline'), { isNetworkError: true }));
    await act(async () => { mount(); });
    expect(api.logout).not.toHaveBeenCalled();
    expect(api.token).toBe('saved-token');
    expect(ctx.sessionUnavailable).toBe(true);
  });

  it('Retry recovers the authenticated session once the backend is healthy', async () => {
    api.token = 'saved-token';
    api.getMe.mockRejectedValueOnce(err(503));
    await act(async () => { mount(); });
    expect(ctx.sessionUnavailable).toBe(true);

    api.getMe.mockResolvedValueOnce({ user: { id: 'm1', role: 'member' }, profile: { firstName: 'A' } });
    await act(async () => { ctx.retrySession(); });
    expect(ctx.sessionUnavailable).toBe(false);
    expect(ctx.user).toEqual(expect.objectContaining({ id: 'm1', role: 'member' }));
  });

  it("an 'online' event auto-recovers while in the transient-outage state", async () => {
    api.token = 'saved-token';
    api.getMe.mockRejectedValueOnce(err(504));
    await act(async () => { mount(); });
    expect(ctx.sessionUnavailable).toBe(true);

    api.getMe.mockResolvedValueOnce({ user: { id: 'm2', role: 'member' }, profile: {} });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(ctx.sessionUnavailable).toBe(false);
    expect(ctx.user).toEqual(expect.objectContaining({ id: 'm2' }));
  });

  it('no token → no boot call, not an outage', async () => {
    api.token = null;
    await act(async () => { mount(); });
    expect(api.getMe).not.toHaveBeenCalled();
    expect(ctx.sessionUnavailable).toBe(false);
    expect(ctx.user).toBeNull();
  });
});

describe('§4 classifyApiError → contextual i18n keys', () => {
  it('transient/connectivity failures', () => {
    expect(classifyApiError({ isTimeout: true })).toBe('error.timeout');
    expect(classifyApiError({ isNetworkError: true })).toBe('error.unavailable');
    expect(classifyApiError({ status: null })).toBe('error.unavailable');
    expect(classifyApiError({ status: 502 })).toBe('error.unavailable');
    expect(classifyApiError(null)).toBe('error.generic');
  });
  it('login context', () => {
    expect(classifyApiError({ status: 401 }, 'login')).toBe('error.login.invalid');
    expect(classifyApiError({ status: 400 }, 'login')).toBe('error.login.invalid');
  });
  it('register context', () => {
    expect(classifyApiError({ status: 403 }, 'register')).toBe('error.register.inviteOnly');
    expect(classifyApiError({ status: 409 }, 'register')).toBe('error.register.exists');
    expect(classifyApiError({ status: 400, body: { error: 'Email already registered' } }, 'register')).toBe('error.register.exists');
    expect(classifyApiError({ status: 400, body: { error: 'Password too weak' } }, 'register')).toBe('error.register.password');
    expect(classifyApiError({ status: 400, body: { error: 'firstName is required' } }, 'register')).toBe('error.fieldsRequired');
  });
  it('generic fallbacks', () => {
    expect(classifyApiError({ status: 403 })).toBe('error.forbidden');
    expect(classifyApiError({ status: 418 })).toBe('error.generic');
  });
});

describe('§5 Spanish continues past the first button', () => {
  it('"Comenzar en español" persists es and the NEXT onboarding screen renders in Spanish', async () => {
    if (!enabledLocales().includes('es')) return; // Spanish preview disabled in this build → nothing to assert

    localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.useFakeTimers();
    let utils;
    await act(async () => {
      utils = render(
        <AppProvider>
          <LocaleProvider><Onboarding /></LocaleProvider>
        </AppProvider>
      );
    });
    // Skip the auto-advancing splash.
    await act(async () => { vi.advanceTimersByTime(2700); });
    const esBtn = utils.getByTestId('welcome-begin-es');
    await act(async () => { esBtn.click(); });
    vi.useRealTimers();

    // Locale persisted…
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    // …and the SECOND screen (golden) is genuinely Spanish, not English.
    expect(utils.container.textContent).toContain('La Edad Dorada');
    expect(utils.container.textContent).not.toContain('The Golden Age');
  });
});

describe('§5 language ⇄ locale normalization', () => {
  it('maps display names and codes to enabled locale codes', () => {
    // 'es' only maps when Spanish preview is enabled in this build; 'en' always maps.
    expect(languageToLocale('English')).toBe('en');
    expect(languageToLocale('en')).toBe('en');
    expect(languageToLocale('inglés')).toBe('en');
    expect(languageToLocale('')).toBeNull();
    expect(languageToLocale(null)).toBeNull();
    const es = languageToLocale('Español');
    expect(es === 'es' || es === null).toBe(true); // null iff Spanish preview disabled
    expect(languageToLocale('Spanish')).toBe(es);
  });
  it('localeToLanguage stores the stable code', () => {
    expect(localeToLanguage('es')).toBe('es');
    expect(localeToLanguage('en')).toBe('en');
    expect(localeToLanguage('fr')).toBe('en');
  });
});

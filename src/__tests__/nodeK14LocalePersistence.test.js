// Node K1.4 — Defect 5: locale persistence across reload, PWA relaunch, and login.
// The device choice lives in localStorage (LOCALE_STORAGE_KEY) and is authoritative;
// login never silently overwrites an explicit device choice. This surface needs
// full app context to mount, so we assert the persistence contract on the source,
// matching the nodeK1LanguagePopover / nodeE4JRC1* source-contract pattern.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALE_STORAGE_KEY } from '../lib/i18n/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const CTX = read('../lib/i18n/LocaleContext.jsx');
const MAIN = read('../main.jsx');

describe('K1.4 Defect 5 — locale persistence contract', () => {
  it('has a stable storage key', () => {
    expect(typeof LOCALE_STORAGE_KEY).toBe('string');
    expect(LOCALE_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('initial locale is read from localStorage (survives reload / PWA relaunch)', () => {
    expect(CTX).toMatch(/function readInitialLocale/);
    expect(CTX).toMatch(/localStorage\.getItem\(LOCALE_STORAGE_KEY\)/);
    // useState is seeded from readInitialLocale, so a relaunch restores the choice.
    expect(CTX).toMatch(/useState\(readInitialLocale\)/);
  });

  it('setLocale writes the device choice to localStorage', () => {
    expect(CTX).toMatch(/setLocale\s*=\s*useCallback/);
    expect(CTX).toMatch(/localStorage\.setItem\(LOCALE_STORAGE_KEY,\s*next\)/);
  });

  it('login reconciliation lets the device choice WIN over the profile', () => {
    // Only hydrate from the profile when there is NO explicit device choice.
    expect(MAIN).toMatch(/hadDeviceChoice\s*=\s*!!localStorage\.getItem\(LOCALE_STORAGE_KEY\)/);
    expect(MAIN).toMatch(/if \(!hadDeviceChoice\)/);
    // With a device choice, persist it to the profile rather than overwrite it.
    expect(MAIN).toMatch(/syncLanguageToProfile\(locale\)/);
    // Reconciliation runs once per authenticated user.
    expect(MAIN).toMatch(/once per authenticated user|reconciledFor\.current === uid/);
  });

  it('rejects locales that are not currently enabled', () => {
    expect(CTX).toMatch(/enabledLocales\(\)\.includes\(next\)/);
  });
});

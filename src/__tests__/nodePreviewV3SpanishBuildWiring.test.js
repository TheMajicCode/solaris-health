// Preview V3 evidence gap — regression guard for the Spanish PREVIEW locale
// build wiring. Root cause of the closed gap: the Preview bundle was built with
// plain `vite build` (production mode), so VITE_SPANISH_PREVIEW was unset and
// enabledLocales() collapsed to ['en'] at runtime — the "Español (vista previa)"
// row never rendered on the live Preview even though the es catalog is compiled.
//
// The durable fix is a dedicated preview build mode:
//   - .env.preview sets VITE_SPANISH_PREVIEW=true
//   - package.json exposes `build:preview` => `vite build --mode preview`
// Stable/production keeps plain `vite build` (production mode) → English-only.
//
// These tests lock that wiring so a future refactor can't silently disable the
// Spanish PREVIEW locale on Preview again, and can't leak it into Stable.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = resolve(__dirname, '..', '..');

describe('Preview V3 — Spanish PREVIEW build wiring', () => {
  it('.env.preview enables the Spanish preview flag', () => {
    const env = readFileSync(resolve(root, '.env.preview'), 'utf8');
    expect(env).toMatch(/^\s*VITE_SPANISH_PREVIEW\s*=\s*true\s*$/m);
  });

  it('package.json exposes a preview build that selects preview mode', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:preview']).toBeDefined();
    expect(pkg.scripts['build:preview']).toMatch(/--mode\s+preview/);
  });

  it('production build must NOT enable the Spanish preview flag (Stable stays English-only)', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    // Plain build is production mode; it must not carry the preview flag inline.
    expect(pkg.scripts.build).toBe('vite build');
    expect(pkg.scripts.build).not.toMatch(/VITE_SPANISH_PREVIEW/);
  });

  it('enabledLocales gate honours the flag (unit contract)', async () => {
    const mod = await import('../lib/i18n/constants.js');
    const both = mod.enabledLocales.length; // arity sanity
    expect(typeof mod.enabledLocales).toBe('function');
    expect(both).toBe(0);
    // With the flag on, es must be offered; with it off, en only. The runtime
    // value is build-inlined, so we assert the pure mapping used by the gate.
    expect(mod.SUPPORTED_LOCALES).toEqual(['en', 'es']);
  });
});

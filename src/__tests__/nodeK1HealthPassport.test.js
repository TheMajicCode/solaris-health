/**
 * NODE K1 — Section E: Health Passport consolidation.
 * The standalone Appointments tab is removed (it duplicated My Bookings), and
 * the Health Passport now carries Overview / Timeline / My Bookings. Legacy
 * `appointments` deep-links must land on My Bookings, not a dead tab.
 *
 * These are source-contract assertions (the page is deeply nested and not
 * unit-mountable), matching the pattern used by the other nodeK1/nodeE4 guards.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveNav } from '../components/LucaPassport.jsx';

const SRC = fs.readFileSync(
  path.resolve(__dirname, '../components/LucaPassport.jsx'),
  'utf8',
);

describe('§E Health Passport — tab set', () => {
  it('HP_TABS carries exactly Overview, Timeline, My Bookings', () => {
    const block = SRC.match(/const HP_TABS = \[([\s\S]*?)\];/);
    expect(block).toBeTruthy();
    const ids = [...block[1].matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['overview', 'timeline', 'bookings']);
  });

  it('no standalone "appointments" tab id remains in HP_TABS', () => {
    const block = SRC.match(/const HP_TABS = \[([\s\S]*?)\];/);
    expect(block[1]).not.toMatch(/id:\s*'appointments'/);
  });

  it('normalizeHpTab redirects the legacy appointments sub to bookings', () => {
    // Source guard: the redirect line must exist in normalizeHpTab.
    expect(SRC).toMatch(/if\s*\(\s*sub\s*===\s*'appointments'\s*\)\s*return\s*'bookings'/);
  });
});

describe('§E Health Passport — legacy navigation redirects', () => {
  it('legacy appointments route resolves to Health Passport → My Bookings', () => {
    expect(resolveNav('appointments')).toEqual({ tab: 'health', sub: 'bookings' });
  });

  it('health defaults to overview and preserves explicit sub-tabs', () => {
    expect(resolveNav('health')).toEqual({ tab: 'health', sub: 'overview' });
    expect(resolveNav('health', 'timeline')).toEqual({ tab: 'health', sub: 'timeline' });
    expect(resolveNav('health', 'bookings')).toEqual({ tab: 'health', sub: 'bookings' });
  });

  it('an unknown health sub falls back to overview', () => {
    expect(resolveNav('health', 'bogus')).toEqual({ tab: 'health', sub: 'overview' });
  });
});

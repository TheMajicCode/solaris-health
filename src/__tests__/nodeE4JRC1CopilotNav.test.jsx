/**
 * NODE E4J-RC1 — item 6: Practitioner Copilot navigation is REAL.
 *   • No brief destination uses the invalid { tab: 'practice', ... } shape.
 *   • Every displayed brief row's destination is a real, resolvable practitioner
 *     route id (my-practice / prac-clients / prac-bookings / prac-availability /
 *     prac-messages) — verified against resolveNav in the shell.
 *   • Clicking a row invokes the real onNavigate callback with that destination
 *     (draft-only — nothing is executed/sent/booked).
 *   • MyPractice threads a real nav callback into CopilotView → Copilot.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { resolveNav } from '../components/LucaPassport.jsx';

async function load(flag) {
  vi.resetModules();
  vi.stubEnv('VITE_LUCA_COPILOT_SIMULATED', flag);
  return import('../components/luca/PractitionerLucaCopilot.jsx');
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COPILOT_SRC = fs.readFileSync(path.resolve(HERE, '../components/luca/PractitionerLucaCopilot.jsx'), 'utf8');
const MP_SRC = fs.readFileSync(path.resolve(HERE, '../components/provider/MyPractice.jsx'), 'utf8');

// Real top-level practitioner route ids the shell renders (see TabPage switch).
const REAL_PRAC_ROUTES = new Set([
  'my-practice', 'prac-clients', 'prac-bookings', 'prac-availability', 'prac-messages',
]);

describe('RC1 item6 — no invalid practice destinations remain', () => {
  it('source has no { tab: \'practice\' } destination', () => {
    expect(COPILOT_SRC).not.toMatch(/tab:\s*['"]practice['"]/);
  });
});

describe('RC1 item6 — every brief destination is a real, resolvable route', () => {
  it('each clickable brief row navigates to a real practitioner route', async () => {
    const mod = await load('true');
    const onNavigate = vi.fn();
    render(<mod.default user={{}} onNavigate={onNavigate} />);
    const rows = screen.getAllByRole('button', { name: /^Open .+:/i });
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      onNavigate.mockClear();
      fireEvent.click(row);
      expect(onNavigate).toHaveBeenCalledTimes(1);
      const dest = onNavigate.mock.calls[0][0];
      expect(dest && dest.tab).toBeTruthy();
      // real route id
      expect(REAL_PRAC_ROUTES.has(dest.tab)).toBe(true);
      // resolveNav keeps it intact (not remapped to a legacy/unknown tab)
      const r = resolveNav(dest.tab, dest.sub);
      expect(r.tab).toBe(dest.tab);
    });
  });
});

describe('RC1 item6 — MyPractice threads a real nav callback', () => {
  it('CopilotView receives go/setView and passes onNavigate into the Copilot', () => {
    expect(MP_SRC).toMatch(/function CopilotView\(\{ user, go, setView \}/);
    expect(MP_SRC).toMatch(/<PractitionerLucaCopilot user=\{user\} onNavigate=\{navigate\}/);
    expect(MP_SRC).toMatch(/<CopilotView user=\{user\} go=\{go\} setView=\{setView\}/);
  });
  it('MyPractice accepts go from the shell', () => {
    expect(MP_SRC).toMatch(/export default function MyPractice\(\{ user, onBookings, go \}/);
  });
});

describe('RC1 item6 — draft-only guarantee preserved', () => {
  it('opening a row only navigates; the Copilot states it never books/sends/signs', () => {
    expect(COPILOT_SRC).toMatch(/never books, sends, orders, or signs/i);
    // the open() handler calls onNavigate/dispatch — no api mutation calls
    expect(COPILOT_SRC).not.toMatch(/api\.(create|send|book|confirm|update|delete)/i);
  });
});

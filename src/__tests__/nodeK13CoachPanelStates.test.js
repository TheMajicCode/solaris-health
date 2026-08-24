// Node K1.3 Phase 6 — LUCA Coach mobile panel: three accessible states.
//
// Source contract on LucaPassport.jsx (the shipped wiring): three states
// (collapsed / standard / full) persisted for the device/session, a clean 56px
// collapsed row with no empty white card, an accessible Maximize/Minimize
// toggle, safe-area-aware full screen, and scroll-to-latest on open.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, '../components/LucaPassport.jsx'), 'utf8');

describe('K1.3 Phase 6 — coach panel state machine', () => {
  it('defines three states, not a fragile boolean', () => {
    expect(src).toMatch(/\['collapsed',\s*'standard',\s*'full'\]/);
    expect(src).toMatch(/coachState/);
    expect(src).toMatch(/const collapsed = coachState === 'collapsed'/);
  });

  it('persists state only for the current device/session (sessionStorage)', () => {
    expect(src).toMatch(/sessionStorage\.setItem\('solaris:luca-panel-state'/);
    expect(src).toMatch(/sessionStorage\.getItem\('solaris:luca-panel-state'\)/);
    // never localStorage for panel geometry
    expect(src).not.toMatch(/localStorage\.setItem\('solaris:luca-panel-state'/);
  });

  it('collapsed renders one clean 56px row with count + Expand, no empty card', () => {
    expect(src).toMatch(/coach-collapsed-row/);
    expect(src).toMatch(/ccr-name/);
    expect(src).toMatch(/ccr-sub/);
    expect(src).toMatch(/ccr-expand/);
    // the css enforces the 56px minimum
    expect(src).toMatch(/\.coach-collapsed-row\{[^}]*min-height:56px/);
  });

  it('has an accessible Maximize/Minimize (full screen) control', () => {
    expect(src).toMatch(/toggleFull/);
    expect(src).toMatch(/Maximize2/);
    expect(src).toMatch(/Minimize2/);
    expect(src).toMatch(/aria-pressed=\{coachState === 'full'\}/);
  });

  it('full screen is fixed and safe-area aware; footer clears the home indicator', () => {
    expect(src).toMatch(/\.coach-shell\.coach-full\{[^}]*position:fixed/);
    expect(src).toMatch(/\.coach-shell\.coach-full\{[^}]*env\(safe-area-inset-top/);
    expect(src).toMatch(/coach-full \.coach-footer\{[^}]*env\(safe-area-inset-bottom/);
  });

  it('standard is ~55-65dvh on mobile', () => {
    expect(src).toMatch(/coach-standard\{[^}]*62dvh/);
    expect(src).toMatch(/coach-standard\{[^}]*max-height:65dvh/);
  });

  it('opening scrolls to the latest message', () => {
    expect(src).toMatch(/coachState === 'collapsed'\) return;[\s\S]*scrollIntoView/);
  });

  it('never labels the surface "LUCA Chat"', () => {
    expect(src).not.toMatch(/LUCA Chat/);
  });
});

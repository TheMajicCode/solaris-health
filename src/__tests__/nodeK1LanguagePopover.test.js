// Node K1 §C — mobile language popover is viewport-safe.
// K1.4 Defect 4 refactor: the viewport-safety + dismissal + focus-trap contract
// now lives in the shared TopbarPopover primitive (src/components/ui/TopbarPopover.jsx),
// which BOTH the language menu and the account menu render through. The language
// menu keeps its own menu-item semantics. We assert the contract on the source,
// matching the existing nodeE4JRC1* source-contract test pattern in this suite.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const POP = fs.readFileSync(path.resolve(__dirname, '../components/ui/TopbarPopover.jsx'), 'utf8');

const SRC = fs.readFileSync(path.resolve(__dirname, '../components/LucaPassport.jsx'), 'utf8');
// Isolate the LanguageToggle component body.
const LT_START = SRC.indexOf('function LanguageToggle()');
const LT_END = SRC.indexOf('function ProfileMenu(');
const LANG = SRC.slice(LT_START, LT_END);

describe('Node K1 §C — language popover viewport safety (shared TopbarPopover primitive)', () => {
  it('renders through a body portal (not clipped by header overflow)', () => {
    expect(POP).toMatch(/createPortal\(/);
    expect(POP).toMatch(/document\.body/);
  });
  it('tokenized width min(320px, calc(100vw - 32px))', () => {
    expect(POP).toMatch(/min\(320px,\s*calc\(100vw - 32px\)\)/);
  });
  it('at least 16px clearance from the viewport edge', () => {
    expect(POP).toMatch(/max\(16px,\s*env\(safe-area-inset-right/);
  });
  it('dynamic-viewport max-height with internal scroll', () => {
    expect(POP).toMatch(/maxHeight:\s*'min\(72dvh/);
    expect(POP).toMatch(/overflowY:\s*'auto'/);
  });
  it('safe-area-aware top and bottom spacing', () => {
    expect(POP).toMatch(/env\(safe-area-inset-top/);
    expect(POP).toMatch(/env\(safe-area-inset-bottom/);
  });
  it('floats above the mini-player and every Explore chrome layer', () => {
    // z-index token must clear the mini-player (9990) and Explore chrome (≤4200).
    expect(POP).toMatch(/TOPBAR_POPOVER_Z\s*=\s*200000/);
  });
  it('focus trap, Escape, outside-tap close, and focus return', () => {
    expect(POP).toMatch(/Escape/);
    expect(POP).toMatch(/e\.key !== 'Tab'/);          // Tab trap
    expect(POP).toMatch(/onDocPointer/);               // outside tap
    expect(POP).toMatch(/prevFocus.*\.focus\(\)/);     // focus return
  });
  it('dismisses on browser/app Back (popstate)', () => {
    expect(POP).toMatch(/addEventListener\('popstate'/);
  });
  it('single-open invariant so opening one menu closes the other', () => {
    expect(POP).toMatch(/TOPBAR_POPOVER_OPEN_EVENT/);
  });
  it('keeps menu semantics', () => {
    expect(POP).toMatch(/role="menu"/);                       // primitive panel
    expect(LANG).toMatch(/role="menuitemradio"/);             // language options
    expect(LANG).toMatch(/aria-checked=\{locale === loc\}/);
  });
  it('language option rows are at least 48px and wrap long labels', () => {
    expect(LANG).toMatch(/minHeight:\s*48/);
    expect(LANG).toMatch(/whiteSpace:\s*'normal'/);
    expect(LANG).toMatch(/overflowWrap:\s*'anywhere'/);
  });
  it('language menu renders through the shared TopbarPopover primitive', () => {
    expect(LANG).toMatch(/<TopbarPopover/);
    expect(LANG).toMatch(/id="language"/);
  });
});

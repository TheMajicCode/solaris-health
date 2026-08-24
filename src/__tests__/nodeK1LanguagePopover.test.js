// Node K1 §C — mobile language popover is viewport-safe.
// The control lives deep inside LucaPassport (needs full app context to mount),
// so we assert the viewport-safety contract on the source, matching the
// existing nodeE4JRC1* source-contract test pattern in this suite.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SRC = fs.readFileSync(path.resolve(__dirname, '../components/LucaPassport.jsx'), 'utf8');
// Isolate the LanguageToggle component body.
const START = SRC.indexOf('function LanguageToggle()');
const END = SRC.indexOf('function ProfileMenu(');
const POP = SRC.slice(START, END);

describe('Node K1 §C — language popover viewport safety', () => {
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
    expect(POP).toMatch(/maxHeight:\s*'min\(70dvh/);
    expect(POP).toMatch(/overflowY:\s*'auto'/);
  });
  it('safe-area-aware top and bottom spacing', () => {
    expect(POP).toMatch(/env\(safe-area-inset-top/);
    expect(POP).toMatch(/env\(safe-area-inset-bottom/);
  });
  it('option rows are at least 48px', () => {
    expect(POP).toMatch(/minHeight:\s*48/);
  });
  it('disclaimer wraps normally (never a narrow second column)', () => {
    expect(POP).toMatch(/whiteSpace:\s*'normal'/);
    expect(POP).toMatch(/overflowWrap:\s*'anywhere'/);
  });
  it('focus trap, Escape, outside-tap close, and focus return', () => {
    expect(POP).toMatch(/Escape/);
    expect(POP).toMatch(/e\.key !== 'Tab'/);          // Tab trap
    expect(POP).toMatch(/onDocPointer/);               // outside tap
    expect(POP).toMatch(/prevFocus.*\.focus\(\)/);     // focus return
  });
  it('keeps menu semantics', () => {
    expect(POP).toMatch(/role="menu"/);
    expect(POP).toMatch(/role="menuitemradio"/);
    expect(POP).toMatch(/aria-checked=\{locale === loc\}/);
  });
});

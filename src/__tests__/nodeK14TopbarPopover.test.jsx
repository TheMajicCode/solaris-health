/**
 * NODE K1.4 — Defect 4: account & language menu layering.
 *
 * The reusable TopbarPopover primitive must:
 *   - portal to document.body (escape Explore stacking contexts);
 *   - render a fixed backdrop + panel above every Explore chrome layer and the
 *     bottom nav / mini-player (z-index well above 9990);
 *   - dismiss on Escape, outside press, and browser Back (popstate);
 *   - lock background scroll while open and restore it on close;
 *   - enforce a single-open invariant (opening one closes the other).
 *
 * Plus source assertions that BOTH the account menu and the language menu are
 * wired through this one primitive.
 */
import React, { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import TopbarPopover, { TOPBAR_POPOVER_OPEN_EVENT, TOPBAR_POPOVER_Z } from '../components/ui/TopbarPopover.jsx';

function Harness({ id = 'account', label = 'Account', testId = 'pop', initial = true, children }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button data-testid={`${id}-trigger`} onClick={() => setOpen(true)}>open</button>
      <TopbarPopover id={id} open={open} onClose={() => setOpen(false)} ariaLabel={label} testId={testId}>
        {children || <button data-testid={`${id}-item`}>item</button>}
      </TopbarPopover>
    </div>
  );
}

describe('K1.4 Defect 4 — TopbarPopover primitive', () => {
  it('portals to document.body with a fixed panel above the bottom nav / mini-player', () => {
    render(<Harness testId="pop-a" />);
    const panel = screen.getByTestId('pop-a');
    // Rendered under body, not nested inside the component subtree wrapper.
    expect(panel.closest('[data-testid="account-trigger"]')).toBeNull();
    expect(panel.style.position).toBe('fixed');
    // Scrim is the portal root child.
    const scrim = document.querySelector('.topbar-pop-scrim');
    expect(scrim).toBeTruthy();
    expect(scrim.style.position).toBe('fixed');
    expect(Number(scrim.style.zIndex)).toBeGreaterThan(9990);
    expect(TOPBAR_POPOVER_Z).toBeGreaterThan(9990);
    cleanup();
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Harness testId="pop-b" initial />);
    expect(document.body.style.overflow).toBe('hidden');
    // Close by rerendering with open=false via the Escape path.
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(document.body.style.overflow).not.toBe('hidden');
    cleanup();
  });

  it('dismisses on Escape', () => {
    render(<Harness testId="pop-c" />);
    expect(screen.getByTestId('pop-c')).toBeTruthy();
    act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
    expect(screen.queryByTestId('pop-c')).toBeNull();
    cleanup();
  });

  it('dismisses on outside press (scrim click)', () => {
    render(<Harness testId="pop-d" />);
    const scrim = document.querySelector('.topbar-pop-scrim');
    act(() => { fireEvent.click(scrim); });
    expect(screen.queryByTestId('pop-d')).toBeNull();
    cleanup();
  });

  it('dismisses on browser Back (popstate)', () => {
    render(<Harness testId="pop-e" />);
    expect(screen.getByTestId('pop-e')).toBeTruthy();
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.queryByTestId('pop-e')).toBeNull();
    cleanup();
  });

  it('single-open invariant: opening one popover closes the other', () => {
    // Two independent popovers both open.
    render(
      <div>
        <Harness id="account" testId="pop-acct" />
        <Harness id="language" testId="pop-lang" />
      </div>,
    );
    // The language popover mounts second; its open-announcement closes the
    // account one, so exactly one popover remains open.
    const remaining = [screen.queryByTestId('pop-acct'), screen.queryByTestId('pop-lang')].filter(Boolean);
    expect(remaining.length).toBe(1);
    expect(screen.queryByTestId('pop-acct')).toBeNull();
    expect(screen.getByTestId('pop-lang')).toBeTruthy();
    // Re-announce account opening → language closes too (single-open holds).
    act(() => { window.dispatchEvent(new CustomEvent(TOPBAR_POPOVER_OPEN_EVENT, { detail: { id: 'account' } })); });
    expect(screen.queryByTestId('pop-lang')).toBeNull();
    cleanup();
  });

  it('moves focus into the panel on open (focus management)', () => {
    render(<Harness testId="pop-f" />);
    const item = screen.getByTestId('account-item');
    expect(document.activeElement).toBe(item);
    cleanup();
  });

  // Preview V3 defects 4 & 5 — SHARED VISUAL CONTRACT. The panel portals to
  // document.body, OUTSIDE the app's `.luca` root, so Solaris tokens
  // (--ink/--surface/--line/…) and every `.luca .*`-scoped style (Notifications'
  // `.luca .nc-*` rules, the language/profile menu colours) only resolve if the
  // portal root re-establishes the `.luca` scope. Assert it does.
  it('re-establishes the `.luca` design-token scope at the portal root', () => {
    render(<Harness testId="pop-luca" />);
    const scrim = document.querySelector('.topbar-pop-scrim');
    expect(scrim).toBeTruthy();
    expect(scrim.classList.contains('luca')).toBe(true);
    // The panel (and therefore all popover children) live inside that scope.
    const panel = screen.getByTestId('pop-luca');
    expect(panel.closest('.luca')).toBe(scrim);
    cleanup();
  });
});

describe('K1.4 Defect 4 — both topbar menus use the one primitive', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../components/LucaPassport.jsx'), 'utf8');

  it('imports the shared TopbarPopover primitive', () => {
    expect(src).toMatch(/import\s+TopbarPopover\s+from\s+'\.\/ui\/TopbarPopover\.jsx'/);
  });

  it('language menu is rendered through TopbarPopover (id="language")', () => {
    expect(src).toMatch(/<TopbarPopover[\s\S]*?id="language"[\s\S]*?testId="language-popover"/);
  });

  it('account menu is rendered through TopbarPopover (id="account")', () => {
    expect(src).toMatch(/<TopbarPopover[\s\S]*?id="account"[\s\S]*?testId="account-popover"/);
  });

  it('account menu no longer uses the old low z-index absolute panel (zIndex: 60)', () => {
    // The regressed inline dropdown used position:absolute + zIndex:60; ensure
    // the account menu block no longer carries that pattern.
    const acctBlock = src.slice(src.indexOf('function ProfileMenu'), src.indexOf('function TabPage'));
    expect(acctBlock).not.toMatch(/zIndex:\s*60\b/);
    expect(acctBlock).toMatch(/<TopbarPopover/);
  });
});

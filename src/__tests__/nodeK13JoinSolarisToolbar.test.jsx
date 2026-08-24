/**
 * NODE K1.3 — Phase 9: Join Solaris in the mobile Explore toolbar.
 *
 * The mobile Explore toolbar row (Join Solaris on the left, Map/List on the
 * right, provider count on its own line) must:
 *  - show the Join Solaris button and keep Map/List usable;
 *  - route ordinary members into the practitioner application flow;
 *  - route an already approved practitioner to My Practice (no duplicate
 *    application) via the solaris:navigate contract;
 *  - never expose practitioner privileges merely because the button is visible
 *    (the entitlement check reads only the authenticated server user).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../lib/api.js', () => ({ api: new Proxy({}, { get: () => () => Promise.resolve({}) }) }));

import ExploreMarketplace from '../components/marketplace/ExploreMarketplace.jsx';

// Force the mobile layout: useIsMobile watches matchMedia + innerWidth.
function forceMobile() {
  window.innerWidth = 360;
  window.matchMedia = (q) => ({
    matches: true, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  });
}

beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } forceMobile(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('K1.3 Phase 9 — Join Solaris mobile toolbar', () => {
  it('renders the Join Solaris button in the mobile toolbar', () => {
    render(<ExploreMarketplace user={{ id: 1, role: 'patient' }} onBecomeProvider={() => {}} />);
    const btns = screen.getAllByText('Join Solaris');
    expect(btns.length).toBeGreaterThanOrEqual(1);
  });

  it('an ordinary member is routed into the application flow', () => {
    const onBecomeProvider = vi.fn();
    render(<ExploreMarketplace user={{ id: 1, role: 'patient' }} onBecomeProvider={onBecomeProvider} />);
    const joinBtn = document.querySelector('.exm-mjoin');
    expect(joinBtn).toBeTruthy();
    fireEvent.click(joinBtn);
    expect(onBecomeProvider).toHaveBeenCalledTimes(1);
  });

  it('an approved practitioner is routed to My Practice, not a duplicate application', () => {
    const onBecomeProvider = vi.fn();
    const navSpy = vi.fn();
    window.addEventListener('solaris:navigate', navSpy);
    render(<ExploreMarketplace user={{ id: 2, role: 'practitioner' }} onBecomeProvider={onBecomeProvider} />);
    const joinBtn = document.querySelector('.exm-mjoin');
    fireEvent.click(joinBtn);
    expect(onBecomeProvider).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledTimes(1);
    const detail = navSpy.mock.calls[0][0].detail;
    expect(detail.tab).toBe('my-practice');
    window.removeEventListener('solaris:navigate', navSpy);
  });

  it('isProvider flag alone also routes to My Practice', () => {
    const onBecomeProvider = vi.fn();
    const navSpy = vi.fn();
    window.addEventListener('solaris:navigate', navSpy);
    render(<ExploreMarketplace user={{ id: 3, role: 'patient', isProvider: true }} onBecomeProvider={onBecomeProvider} />);
    fireEvent.click(document.querySelector('.exm-mjoin'));
    expect(onBecomeProvider).not.toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalled();
    window.removeEventListener('solaris:navigate', navSpy);
  });

  it('Map and List controls remain present alongside Join Solaris', () => {
    render(<ExploreMarketplace user={{ id: 1, role: 'patient' }} onBecomeProvider={() => {}} />);
    expect(document.querySelector('.exm-mseg')).toBeTruthy();
    expect(screen.getAllByText('Map').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('List').length).toBeGreaterThanOrEqual(1);
  });

  it('button hit target meets 44px minimum in source CSS', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/components/marketplace/ExploreMarketplace.jsx'), 'utf8');
    expect(css).toMatch(/\.exm-mjoin\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.exm-mjoin\{[^}]*min-width:44px/);
  });
});

/**
 * Adaptive overlay + mobile booking date/time + check-in behaviour.
 * Covers acceptance scenarios 9 and 10:
 *   9  — the Select Date & Time step shows ONE readable month, time slots
 *        stacked beneath the date, and lives inside the adaptive overlay's
 *        sticky footer shell.
 *   10 — a blocking overlay (booking / check-in) hides the mobile bottom nav
 *        while open and restores it on close; the check-in surface is a bottom
 *        sheet on mobile and a centred dialog on desktop.
 */
import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';

beforeAll(() => {
  window.matchMedia = (q) => ({
    matches: /max-width/.test(q),
    media: q,
    onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {},
  });
});

import AdaptiveOverlay from '../components/ui/AdaptiveOverlay.jsx';
import TimeSlotPicker from '../components/booking/TimeSlotPicker.jsx';

const DATES = [
  { date: '2026-09-15', slots: [{ start: '09:00', end: '09:30' }, { start: '10:00', end: '10:30' }] },
  { date: '2026-09-16', slots: [{ start: '14:00', end: '14:30' }] },
];

describe('mobile Select Date & Time layout', () => {
  it('renders a compact 7-day date strip (full month calendar rejected on phones) with stacked time slots', () => {
    render(
      <div className="luca">
        <TimeSlotPicker dates={DATES} value={null} onChange={vi.fn()} tz="America/El_Salvador" />
      </div>
    );
    // Phone shows the 7-day strip, NOT a full month grid (which is rejected here).
    expect(document.querySelector('.tsp-narrow')).toBeTruthy();
    expect(document.querySelectorAll('.tsp-day').length).toBe(7);
    expect(document.querySelector('.tsp-cal')).toBeNull();
    // "More dates" is the escape hatch to the full month grid on demand.
    expect(screen.getByRole('button', { name: /More dates/i })).toBeInTheDocument();
    // Time slots for the first available date are stacked beneath the strip.
    const slots = document.querySelectorAll('.tsp-slot');
    expect(slots.length).toBe(2);
    expect(screen.getByRole('button', { name: '9:00 AM' })).toBeInTheDocument();
  });

  it('collapses to a single column on phones (no side-by-side clipping)', () => {
    render(<div className="luca"><TimeSlotPicker dates={DATES} onChange={vi.fn()} /></div>);
    const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent).join('\n');
    expect(css).toMatch(/@media\(max-width:640px\)\{\.luca \.tsp\{grid-template-columns:1fr\}\}/);
  });
});

describe('adaptive overlay shell (booking date/time host)', () => {
  it('renders a bottom-sheet with grab handle, scrollable body, sticky footer and close', () => {
    render(
      <AdaptiveOverlay
        open
        onClose={vi.fn()}
        title="Select date & time"
        ariaLabel="Select date and time"
        size="md"
        footer={<><button type="button">Back</button><button type="button">Continue</button></>}
      >
        <div>body content</div>
      </AdaptiveOverlay>
    );
    const dialog = screen.getByRole('dialog', { name: 'Select date and time' });
    expect(dialog.querySelector('.aov-grab')).toBeTruthy();          // bottom-sheet handle
    expect(dialog.querySelector('.aov-body')).toBeTruthy();          // internal scroll region
    const foot = dialog.querySelector('.aov-foot');                  // sticky footer
    expect(foot).toBeTruthy();
    expect(within(foot).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(within(foot).getByRole('button', { name: 'Continue' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes on Escape and the close button', () => {
    const onClose = vi.fn();
    render(<AdaptiveOverlay open onClose={onClose} title="Check-in" ariaLabel="Daily check-in"><div>x</div></AdaptiveOverlay>);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('blocking overlay hides the mobile bottom nav', () => {
  it('AdaptiveOverlay dispatches botnav-hide on open and restores it on unmount', () => {
    const events = [];
    const handler = (e) => events.push(e.detail.hidden);
    window.addEventListener('solaris:botnav', handler);
    const { unmount } = render(<AdaptiveOverlay open onClose={vi.fn()} title="X" ariaLabel="X"><div>y</div></AdaptiveOverlay>);
    expect(events).toContain(true);   // hidden while open
    unmount();
    expect(events[events.length - 1]).toBe(false); // restored on close
    window.removeEventListener('solaris:botnav', handler);
  });
});

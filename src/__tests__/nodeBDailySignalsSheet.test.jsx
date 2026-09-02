/**
 * Node B §10 / §12 — the SEPARATE "Log daily signals" sheet.
 *  - It is titled "Log daily signals" and NEVER opens the Daily Check-in.
 *  - It saves a subset of fields to the device-local store and fires
 *    `solaris:signals` so the card refreshes without a reload.
 *  - It presents a TRUTHFUL device-adapter boundary — no active wearable sync.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import DailySignalsSheet, { DEVICE_ADAPTERS } from '../components/health/DailySignalsSheet.jsx';
import { loadSignals } from '../lib/dailySignals.js';

beforeEach(() => { localStorage.clear(); });

describe('Node B §10 — Daily Signals sheet identity', () => {
  it('is titled "Log daily signals" (never the Daily Check-in)', () => {
    render(<DailySignalsSheet open uid="u1" onClose={() => {}} />);
    expect(screen.getAllByText('Log daily signals').length).toBeGreaterThan(0);
    // It must NOT surface the subjective check-in dimensions.
    expect(screen.queryByText(/Mind.*Body.*Heart.*Spirit/i)).toBeNull();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<DailySignalsSheet open={false} uid="u1" onClose={() => {}} />);
    expect(container.textContent).toBe('');
  });
});

describe('Node B §10/§11 — saving a subset', () => {
  it('saves only the fields entered and dispatches solaris:signals', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const signalsListener = vi.fn();
    window.addEventListener('solaris:signals', signalsListener);

    render(<DailySignalsSheet open uid="u1" onClose={onClose} onSaved={onSaved} />);

    // Enter just steps (7.5 sleep left blank -> partial entry allowed).
    const steps = screen.getByPlaceholderText('6000');
    fireEvent.change(steps, { target: { value: '8200' } });

    fireEvent.click(screen.getByText(/Save signals/i));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const rows = loadSignals('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0].metric).toBe('steps');
    expect(rows[0].value).toBe(8200);
    expect(signalsListener).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
    window.removeEventListener('solaris:signals', signalsListener);
  });
});

describe('Node B §12 — truthful device-adapter boundary', () => {
  it('exposes a "Connect a device" section that does NOT claim active sync', () => {
    render(<DailySignalsSheet open uid="u1" onClose={() => {}} />);
    expect(screen.getByText(/Connect a device/i)).toBeTruthy();
    // Truthful: explicitly states nothing syncs yet.
    expect(screen.getByText(/doesn't read from any device yet/i)).toBeTruthy();
  });

  it('every advertised adapter is marked planned/future, never live', () => {
    expect(DEVICE_ADAPTERS.length).toBeGreaterThan(0);
    for (const a of DEVICE_ADAPTERS) {
      expect(/planned|future|via|after/i.test(a.note)).toBe(true);
      expect(/connected|syncing|active/i.test(a.note)).toBe(false);
    }
  });
});

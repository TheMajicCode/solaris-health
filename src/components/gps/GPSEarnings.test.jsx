/**
 * GPSEarnings booking-only gate smoke test.
 * Verifies the provider income surface renders with clear "Simulated" labels
 * and that live payouts are explicitly deferred (coming soon) — no online
 * payment or real-money movement is implied.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: {
    getGpsEarnings: vi.fn(() => Promise.resolve({ provider: {}, perBooking: [], contributor: [] })),
    getProviderEarnings: vi.fn(() => Promise.resolve(null)),
  },
}));

import GPSEarnings from './GPSEarnings.jsx';

describe('GPSEarnings (booking-only gate)', () => {
  it('renders simulated labels and defers live payouts', async () => {
    render(<GPSEarnings />);

    // Simulated badge in the hero.
    expect((await screen.findAllByText(/Simulated/i)).length).toBeGreaterThan(0);
    // Settled card is a demonstration.
    expect(await screen.findByText(/Simulated \(demonstration\)/i)).toBeInTheDocument();
    // Payouts are not live.
    expect((await screen.findAllByText(/coming soon/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/no real money moves/i)).length).toBeGreaterThan(0);
  });
});

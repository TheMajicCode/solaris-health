/**
 * GPSStats booking-only gate smoke test.
 * Verifies the admin GPS economy view labels itself Simulated and frames the
 * settlements feed as simulated (no real money moves this release).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: {
    getGpsStats: vi.fn(() => Promise.resolve({ stats: {}, recent: [], treasuryBalance: 0 })),
    getGpsLeaderboard: vi.fn(() => Promise.resolve({ leaderboard: [] })),
  },
}));

import GPSStats from './GPSStats.jsx';

describe('GPSStats (booking-only gate)', () => {
  it('labels the economy view as simulated', async () => {
    render(<GPSStats />);
    expect((await screen.findAllByText(/Simulated/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Recent simulated settlements/i)).toBeInTheDocument();
  });
});

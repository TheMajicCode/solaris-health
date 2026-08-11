/**
 * ContributionLedger booking-only gate smoke test.
 * Verifies the contribution surface carries the "Simulated this release"
 * disclosure — no online payment is collected or distributed.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: {
    getMyContributions: vi.fn(() => Promise.resolve({ events: [], attestedPoints: 0 })),
    getLeaderboard: vi.fn(() => Promise.resolve({ leaderboard: [] })),
  },
}));

import ContributionLedger from './ContributionLedger.jsx';

describe('ContributionLedger (booking-only gate)', () => {
  it('discloses the simulated release status', async () => {
    render(<ContributionLedger user={{ id: 1, levelPoints: 0 }} />);
    expect(await screen.findByText(/Simulated this release/i)).toBeInTheDocument();
    expect(screen.getByText(/no online payment is collected or distributed/i)).toBeInTheDocument();
  });
});

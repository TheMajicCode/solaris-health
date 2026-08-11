/**
 * ReferralHub booking-only gate smoke test.
 * Verifies referral rewards are labelled simulated / coming soon — no online
 * payment is collected and no real money moves this release.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('../../lib/api.js', () => ({
  api: {
    getReferralCode: vi.fn(() => Promise.resolve({ code: 'ABC123', link: 'https://example.test/r/ABC123' })),
    getReferralEarnings: vi.fn(() => Promise.resolve({ summary: {}, referrals: [] })),
    getGpsLeaderboard: vi.fn(() => Promise.resolve({ leaderboard: [] })),
  },
}));

import ReferralHub from './ReferralHub.jsx';

describe('ReferralHub (booking-only gate)', () => {
  it('labels referral rewards as simulated / coming soon', async () => {
    render(<ReferralHub />);
    expect(await screen.findByText(/Simulated · rewards coming soon/i)).toBeInTheDocument();
    expect(await screen.findByText(/Rewards \(simulated\)/i)).toBeInTheDocument();
  });
});

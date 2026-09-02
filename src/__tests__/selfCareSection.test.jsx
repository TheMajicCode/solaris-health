/**
 * SelfCareSection (spec §7) — ONE canonical LOVE source shared with the
 * Dashboard (getRewards().total), and the fix for the old contradiction where
 * LOVE was visible elsewhere but this surface said "No self-care value
 * recorded yet".
 *
 * Verifies:
 *   • When getRewards() returns a positive total, the lifetime figure is that
 *     canonical total (never a divergent re-sum) and the empty state is gone.
 *   • When the canonical total is positive but no per-event receipts exist, a
 *     detail-unavailable note is shown instead of a fabricated timeline — and
 *     NOT the "No self-care value recorded yet" empty state.
 *   • The honest empty state appears only when there is genuinely no value.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({
  getRewards: vi.fn(),
  getMyContributions: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: mockApi }));
// Keep the focus on the canonical-total logic; the full ledger renders its own
// data and is covered elsewhere.
vi.mock('../components/contributions/ContributionLedger.jsx', () => ({
  default: () => <div data-testid="ledger-stub" />,
}));

import SelfCareSection from '../components/economic/SelfCareSection.jsx';

beforeEach(() => {
  cleanup();
  mockApi.getRewards.mockReset();
  mockApi.getMyContributions.mockReset();
});

describe('SelfCareSection — canonical LOVE total (§7)', () => {
  it('shows the canonical getRewards().total and its events (no contradiction)', async () => {
    mockApi.getRewards.mockResolvedValue({
      total: 85,
      events: [
        { id: 'r1', event_type: 'daily_checkin', points: 5, created_at: '2026-08-01T10:00:00Z' },
        { id: 'r2', event_type: 'assessment_completed', points: 50, created_at: '2026-08-02T10:00:00Z' },
      ],
    });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    render(<SelfCareSection user={{ email: 'sofia@solaris.health' }} />);

    await waitFor(() => expect(screen.getByText('85')).toBeInTheDocument());
    expect(screen.getByText('Lifetime LOVE')).toBeInTheDocument();
    // The old contradiction must be gone.
    expect(screen.queryByText(/No self-care value recorded yet/i)).toBeNull();
  });

  it('shows a detail-unavailable note when the total is positive but no events exist', async () => {
    mockApi.getRewards.mockResolvedValue({ total: 85, events: [] });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    render(<SelfCareSection user={{ email: 'sofia@solaris.health' }} />);

    await waitFor(() => expect(screen.getByText('85')).toBeInTheDocument());
    expect(screen.getByText(/Detailed self-care activity isn’t available to break out yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/No self-care value recorded yet/i)).toBeNull();
  });

  it('shows the honest empty state only when there is genuinely no value', async () => {
    mockApi.getRewards.mockResolvedValue({ total: 0, events: [] });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    render(<SelfCareSection user={{ email: 'new@member.com' }} />);

    await waitFor(() => expect(screen.getByText(/No self-care value recorded yet/i)).toBeInTheDocument());
  });
});

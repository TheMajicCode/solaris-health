/**
 * SelfCareSection — canonical LOVE source (§7) + presentation-only slim-down (§6).
 *
 * §7: ONE canonical LOVE source shared with the Dashboard (getRewards().total),
 * fixing the old contradiction where LOVE was visible elsewhere but this surface
 * said "No self-care value recorded yet".
 *
 * §6 (Preview V3): this surface is presentation-only. It shows the title/context,
 * a concise LOVE balance summary (real data), and one next-action card. The old
 * record-style UI — the "Your value journey" timeline, the detail-unavailable
 * note and the "Your contribution record" ledger — has been removed from this
 * view. Internal keys/analytics ids/APIs are unchanged.
 *
 * Verifies:
 *   • When getRewards() returns a positive total, the lifetime figure is that
 *     canonical total (never a divergent re-sum) and the empty state is gone.
 *   • When the canonical total is positive but no per-event receipts exist, the
 *     balance summary still renders the canonical total (no fabricated timeline,
 *     no detail note) and NOT the empty state.
 *   • The honest empty state appears only when there is genuinely no value.
 *   • The removed record-style UI (timeline / ledger / "contribution record")
 *     is absent, and the two next-action deep-links fire.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';

const mockApi = vi.hoisted(() => ({
  getRewards: vi.fn(),
  getMyContributions: vi.fn(),
}));

vi.mock('../lib/api.js', () => ({ api: mockApi }));

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

  it('renders the canonical total in the balance summary even when no events exist (no detail note, no timeline)', async () => {
    mockApi.getRewards.mockResolvedValue({ total: 85, events: [] });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    render(<SelfCareSection user={{ email: 'sofia@solaris.health' }} />);

    await waitFor(() => expect(screen.getByText('85')).toBeInTheDocument());
    expect(screen.getByText('Lifetime LOVE')).toBeInTheDocument();
    // The removed record-style UI must not reappear.
    expect(screen.queryByText(/Detailed self-care activity isn’t available/i)).toBeNull();
    expect(screen.queryByText(/No self-care value recorded yet/i)).toBeNull();
  });

  it('shows the honest empty state only when there is genuinely no value', async () => {
    mockApi.getRewards.mockResolvedValue({ total: 0, events: [] });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    render(<SelfCareSection user={{ email: 'new@member.com' }} />);

    await waitFor(() => expect(screen.getByText(/No self-care value recorded yet/i)).toBeInTheDocument());
  });
});

describe('SelfCareSection — presentation-only slim-down (§6)', () => {
  it('does not render the removed record-style UI (timeline / ledger / contribution record)', async () => {
    mockApi.getRewards.mockResolvedValue({
      total: 85,
      events: [
        { id: 'r1', event_type: 'daily_checkin', points: 5, created_at: '2026-08-01T10:00:00Z' },
      ],
    });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });

    const { container } = render(<SelfCareSection user={{ email: 'sofia@solaris.health' }} />);

    await waitFor(() => expect(screen.getByText('85')).toBeInTheDocument());
    // No legacy record headings.
    expect(screen.queryByText(/Your contribution record/i)).toBeNull();
    expect(screen.queryByText(/Your value journey/i)).toBeNull();
    // No timeline / record DOM.
    expect(container.querySelector('.sc-timeline')).toBeNull();
    expect(container.querySelector('.sc-record')).toBeNull();
    expect(container.querySelector('.sc-detail-note')).toBeNull();
    // The title/context and balance summary remain.
    expect(screen.getByText(/Your care creates value/i)).toBeInTheDocument();
    expect(container.querySelector('.sc-metrics')).not.toBeNull();
  });

  it('fires the two next-action deep-links (Continue self-care / See ecosystem impact)', async () => {
    mockApi.getRewards.mockResolvedValue({ total: 0, events: [] });
    mockApi.getMyContributions.mockResolvedValue({ events: [], attestedPoints: 0 });
    const onContinue = vi.fn();
    const onEcosystem = vi.fn();

    render(<SelfCareSection user={{ email: 'sofia@solaris.health' }} onContinue={onContinue} onEcosystem={onEcosystem} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Continue self-care/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Continue self-care/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /See ecosystem impact/i }));
    expect(onEcosystem).toHaveBeenCalledTimes(1);
  });
});

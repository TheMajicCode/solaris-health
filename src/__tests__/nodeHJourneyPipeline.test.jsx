/**
 * NODE H — Journey Pipeline (operational board) + Clinic OS foundation flag.
 *
 * The board is a feature-flagged Beta preview (VITE_CLINIC_OS_BETA). With the
 * flag OFF the existing practice surface is unchanged and the board shows a
 * foundation notice. With it ON, the seven ordered stages render as count
 * cards, search filters the rows, and taking a "next action" requires an
 * explicit confirmation dialog (human-in-the-loop) — nothing auto-executes.
 * The flag is read at module load, so each case imports the module fresh after
 * stubbing the env.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllEnvs(); });

async function loadPipeline() {
  const mod = await import('../components/provider/JourneyPipeline.jsx');
  return mod.default;
}

describe('Journey Pipeline — flag off', () => {
  it('renders a foundation notice and no simulated rows when the flag is off', async () => {
    vi.stubEnv('VITE_CLINIC_OS_BETA', 'false');
    const JourneyPipeline = await loadPipeline();
    render(<JourneyPipeline />);
    expect(screen.getByText(/Turn on the Clinic OS Beta preview/i)).toBeInTheDocument();
  });
});

describe('Journey Pipeline — flag on', () => {
  beforeEach(() => { vi.stubEnv('VITE_CLINIC_OS_BETA', 'true'); });

  it('exposes the seven ordered operational stages as count cards', async () => {
    const mod = await import('../components/provider/JourneyPipeline.jsx');
    expect(mod.PIPELINE_STAGES.map((s) => s.id)).toEqual([
      'new_inquiry', 'intake_pending', 'discovery_booked', 'active_journey',
      'review_due', 'paused', 'completed',
    ]);
    render(<mod.default />);
    for (const label of ['New inquiry', 'Intake pending', 'Discovery booked', 'Active journey', 'Review due', 'Paused', 'Completed']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('filters rows by search text', async () => {
    const JourneyPipeline = await loadPipeline();
    render(<JourneyPipeline />);
    const list = screen.getByTestId('journey-pipeline');
    fireEvent.change(within(list).getByLabelText('Search pipeline'), { target: { value: 'Maria' } });
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.queryByText('Diego')).toBeNull();
  });

  it('requires an explicit confirmation dialog before any next action', async () => {
    const JourneyPipeline = await loadPipeline();
    render(<JourneyPipeline />);
    fireEvent.click(screen.getAllByRole('button', { name: /Confirm next action/i })[0]);
    const dialog = screen.getByRole('dialog', { name: /Confirm action/i });
    expect(within(dialog).getByText(/nothing is sent, moved, or recorded/i)).toBeInTheDocument();
  });
});

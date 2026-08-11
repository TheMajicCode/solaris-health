/**
 * RegenerativeTreasury booking-only gate smoke test.
 * Verifies the commons view labels itself Simulated and states no real money
 * moves this release once its async data resolves.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: {
    getGpsTreasury: vi.fn(() => Promise.resolve({ funds: [], balance: 0, deposits: 0, growth: [] })),
    getGpsTreasuryBreakdown: vi.fn(() => Promise.resolve({ recent: [] })),
  },
}));

import RegenerativeTreasury from './RegenerativeTreasury.jsx';

describe('RegenerativeTreasury (booking-only gate)', () => {
  it('labels the commons as simulated with no real money moving', async () => {
    render(<RegenerativeTreasury />);
    expect((await screen.findAllByText(/Simulated/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/no real money moves/i)).length).toBeGreaterThan(0);
  });
});

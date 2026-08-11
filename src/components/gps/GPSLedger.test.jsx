/**
 * GPSLedger booking-only gate smoke test.
 * Verifies the member value-trail labels itself Simulated and frames LOVE as
 * simulated reciprocity credits (no real money moves this release).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/api.js', () => ({
  api: { getGpsLedger: vi.fn(() => Promise.resolve({ transactions: [], summary: {} })) },
}));

import GPSLedger from './GPSLedger.jsx';

describe('GPSLedger (booking-only gate)', () => {
  it('labels the value trail and LOVE as simulated', async () => {
    render(<GPSLedger />);
    expect((await screen.findAllByText(/Simulated/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText(/LOVE \(simulated\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/no real money moves this release/i)).toBeInTheDocument();
  });
});

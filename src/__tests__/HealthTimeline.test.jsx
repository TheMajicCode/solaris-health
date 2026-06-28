/**
 * HealthTimeline component tests — verifies the timeline renders events
 * supplied by an injected loader, shows the title, handles the empty state,
 * and calls the loader with pagination params.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import HealthTimeline, { EVENT_TYPES } from '../components/HealthTimeline.jsx';

const sampleEvents = [
  {
    id: 'a1',
    type: 'appointment',
    title: 'Consultation with Dr. Aura',
    date: '2026-02-01T10:00:00.000Z',
  },
  {
    id: 'v1',
    type: 'vitals',
    title: 'Daily check-in logged',
    date: '2026-02-02T08:00:00.000Z',
  },
];

describe('EVENT_TYPES registry', () => {
  it('exports the expected event categories', () => {
    expect(Object.keys(EVENT_TYPES)).toEqual(
      expect.arrayContaining(['appointment', 'vitals', 'assessment', 'reward', 'document'])
    );
  });
});

describe('<HealthTimeline />', () => {
  it('renders the supplied title and events from the loader', async () => {
    const loader = vi.fn().mockResolvedValue({ events: sampleEvents, total: sampleEvents.length });

    render(
      <div className="luca">
        <HealthTimeline loader={loader} title="My Journey" />
      </div>
    );

    // Title is shown immediately.
    expect(screen.getByText('My Journey')).toBeInTheDocument();

    // Loader is invoked with pagination params.
    await waitFor(() => expect(loader).toHaveBeenCalled());
    const params = loader.mock.calls[0][0];
    expect(params).toHaveProperty('limit');
    expect(params).toHaveProperty('offset', 0);

    // Events appear once loaded.
    await waitFor(() =>
      expect(screen.getByText('Consultation with Dr. Aura')).toBeInTheDocument()
    );
    expect(screen.getByText('Daily check-in logged')).toBeInTheDocument();
  });

  it('shows an empty state when the loader returns no events', async () => {
    const loader = vi.fn().mockResolvedValue({ events: [], total: 0 });

    render(
      <div className="luca">
        <HealthTimeline loader={loader} title="Empty Journey" />
      </div>
    );

    await waitFor(() => expect(screen.getByText(/No events yet/i)).toBeInTheDocument());
  });

  it('does not crash if the loader rejects', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('boom'));

    render(
      <div className="luca">
        <HealthTimeline loader={loader} title="Error Journey" />
      </div>
    );

    await waitFor(() => expect(loader).toHaveBeenCalled());
    // Title should still be present — component degrades gracefully.
    expect(screen.getByText('Error Journey')).toBeInTheDocument();
  });
});

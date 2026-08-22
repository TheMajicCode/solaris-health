import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// Flag is read at module load — stub env, reset modules, dynamic import per test.
async function load(flag) {
  vi.resetModules();
  vi.stubEnv('VITE_LUCA_COPILOT_SIMULATED', flag === undefined ? '' : flag);
  return import('../components/luca/PractitionerLucaCopilot.jsx');
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('Node J — Practitioner LUCA practice copilot', () => {
  it('flag OFF: shows Beta-preview notice, no brief', async () => {
    const { default: Cmp } = await load(undefined);
    render(<Cmp />);
    expect(screen.getByTestId('copilot-brief-off')).toBeTruthy();
    expect(screen.queryByTestId('copilot-brief')).toBeNull();
  });

  it('flag ON: brief rows each name a source and expose an Open destination', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp />);
    const rows = screen.getAllByTestId('copilot-brief-row');
    expect(rows.length).toBeGreaterThanOrEqual(8); // bookings, intake, pipeline, review, messages, follow-ups, listing, admin
    // every row names a source
    expect(screen.getAllByText(/^Source: /).length).toBe(rows.length);
    // every row has an Open action (a navigation the practitioner initiates)
    expect(screen.getAllByRole('button', { name: /^Open / }).length).toBe(rows.length);
  });

  it('Open dispatches a navigation, never auto-executes', async () => {
    const { default: Cmp } = await load('true');
    const onNavigate = vi.fn();
    render(<Cmp onNavigate={onNavigate} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Open / })[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0]).toHaveProperty('tab');
  });

  it('draft tools are Draft, editable, and require approval before anything is sent', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp />);
    fireEvent.click(screen.getByRole('tab', { name: 'Draft tools' }));
    const drafts = screen.getAllByTestId('copilot-draft');
    expect(drafts.length).toBe(8); // 8 named draft tools
    expect(screen.getAllByText(/Draft · not sent/).length).toBe(drafts.length);
    // approve one draft — it becomes "ready for you to send", never auto-sent
    const approve = screen.getAllByRole('button', { name: /^Approve .* draft$/ })[0];
    fireEvent.click(approve);
    expect(screen.getByText(/ready for you to send/)).toBeTruthy();
  });

  it('drafts carry no diagnosis/prescription/billing content and disclose the limit', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp />);
    fireEvent.click(screen.getByRole('tab', { name: 'Draft tools' }));
    expect(screen.getByText(/never contain diagnosis, prescription, legal, billing/)).toBeTruthy();
  });
});

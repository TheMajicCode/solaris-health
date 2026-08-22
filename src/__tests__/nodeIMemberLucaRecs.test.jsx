import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

// The simulation flag is read at module load, so each test stubs the env,
// resets the module registry, then dynamically imports the component.
async function load(flag) {
  vi.resetModules();
  if (flag === undefined) vi.stubEnv('VITE_LUCA_RECS_SIMULATED', '');
  else vi.stubEnv('VITE_LUCA_RECS_SIMULATED', flag);
  const mod = await import('../components/luca/MemberLucaRecommendations.jsx');
  return mod;
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe('Node I — Member LUCA multi-candidate recommendations', () => {
  it('flag OFF: shows Beta-preview notice, no candidate cards', async () => {
    const { default: Cmp } = await load(undefined);
    render(<Cmp user={{}} />);
    expect(screen.getByTestId('luca-recs-off')).toBeTruthy();
    expect(screen.queryAllByTestId('luca-rec-card').length).toBe(0);
  });

  it('flag ON: surfaces UP TO THREE diversified candidates, each with Why/Assumptions/Unknowns', async () => {
    const { default: Cmp, MAX_CANDIDATES } = await load('true');
    render(<Cmp user={{}} />);
    const cards = screen.getAllByTestId('luca-rec-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    // diversity: distinct provider ids
    const ids = cards.map((c) => c.getAttribute('data-provider-id'));
    expect(new Set(ids).size).toBe(ids.length);
    // transparency disclosures present
    expect(screen.getAllByText(/Why surfaced:/).length).toBe(cards.length);
    expect(screen.getAllByText(/Assumptions:/).length).toBe(cards.length);
    expect(screen.getAllByText(/Unknowns:/).length).toBe(cards.length);
    // each card exposes member-controlled actions (no auto-execution)
    expect(screen.getAllByRole('button', { name: /^View / }).length).toBe(cards.length);
    expect(screen.getAllByRole('button', { name: /^Book / }).length).toBe(cards.length);
    expect(screen.getAllByRole('button', { name: /^Dismiss / }).length).toBe(cards.length);
  });

  it('dismissal recomputes and removes the dismissed provider', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{}} />);
    const first = screen.getAllByTestId('luca-rec-card')[0];
    const dismissedId = first.getAttribute('data-provider-id');
    fireEvent.click(screen.getByRole('button', { name: `Dismiss ${first.querySelector('h5').textContent}` }));
    const remaining = screen.getAllByTestId('luca-rec-card').map((c) => c.getAttribute('data-provider-id'));
    expect(remaining).not.toContain(dismissedId);
  });

  it('a booked provider is not re-recommended', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{ bookedProviderId: 'sim-prov-therapy' }} />);
    const ids = screen.getAllByTestId('luca-rec-card').map((c) => c.getAttribute('data-provider-id'));
    expect(ids).not.toContain('sim-prov-therapy');
  });

  it('personalized Journey drafts are weekly+monthly, Draft, and require member approval', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{}} />);
    const drafts = screen.getAllByTestId('luca-journey-draft');
    expect(drafts.length).toBe(2); // weekly + monthly
    const approveBtn = screen.getAllByRole('button', { name: /Approve and begin/ })[0];
    expect(approveBtn.textContent).toMatch(/Approve & Begin/);
    fireEvent.click(approveBtn);
    expect(screen.getByText(/enrolled in Growth/)).toBeTruthy();
  });
});

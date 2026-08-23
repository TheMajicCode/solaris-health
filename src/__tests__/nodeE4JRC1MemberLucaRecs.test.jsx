/**
 * NODE E4J-RC1 — item 4: Member LUCA recommendations honesty + wiring.
 *   • Up to THREE diversified candidates (distinct modalities, no repeat).
 *   • View passes the EXACT candidate; Book passes the EXACT candidate (the
 *     caller deep-links these into the real provider profile / real BookingFlow).
 *   • Recompute after dismiss (dismissed provider drops out).
 *   • Every card shows "Why surfaced" + "Assumptions".
 *   • The unsupported phrase "Solaris clinical review board" is GONE from source
 *     and from the rendered UI.
 */
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

async function load(flag) {
  vi.resetModules();
  vi.stubEnv('VITE_LUCA_RECS_SIMULATED', flag);
  return import('../components/luca/MemberLucaRecommendations.jsx');
}

afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const SRC = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components/luca/MemberLucaRecommendations.jsx'),
  'utf8',
);

describe('RC1 item4 — unsupported clinical-review claim removed', () => {
  it('no "clinical review board" phrase anywhere in the component source', () => {
    expect(SRC).not.toMatch(/clinical review board/i);
    expect(SRC).not.toMatch(/clinician-reviewed/i);
  });

  it('no "clinical review board" phrase in the rendered UI', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{}} />);
    expect(screen.queryByText(/clinical review board/i)).toBeNull();
    expect(screen.queryByText(/reviewed by/i)).toBeNull();
  });
});

describe('RC1 item4 — three diversified candidates with transparency', () => {
  it('renders distinct-modality candidates (no single repeated provider)', async () => {
    const { default: Cmp, MAX_CANDIDATES } = await load('true');
    render(<Cmp user={{}} />);
    const cards = screen.getAllByTestId('luca-rec-card');
    expect(cards.length).toBeGreaterThan(1);
    expect(cards.length).toBeLessThanOrEqual(MAX_CANDIDATES);
    const ids = cards.map((c) => c.getAttribute('data-provider-id'));
    expect(new Set(ids).size).toBe(ids.length); // no repeat
    expect(screen.getAllByText(/Why surfaced:/).length).toBe(cards.length);
    expect(screen.getAllByText(/Assumptions:/).length).toBe(cards.length);
  });
});

describe('RC1 item4 — View / Book carry the EXACT candidate', () => {
  it('View invokes onView with the exact candidate object', async () => {
    const { default: Cmp } = await load('true');
    const onView = vi.fn();
    render(<Cmp user={{}} onView={onView} />);
    const first = screen.getAllByTestId('luca-rec-card')[0];
    const id = first.getAttribute('data-provider-id');
    const name = first.querySelector('h5').textContent;
    fireEvent.click(screen.getByRole('button', { name: `View ${name}` }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView.mock.calls[0][0].id).toBe(id);
  });

  it('Book invokes onBook with the exact candidate object', async () => {
    const { default: Cmp } = await load('true');
    const onBook = vi.fn();
    render(<Cmp user={{}} onBook={onBook} />);
    const first = screen.getAllByTestId('luca-rec-card')[0];
    const id = first.getAttribute('data-provider-id');
    const name = first.querySelector('h5').textContent;
    fireEvent.click(screen.getByRole('button', { name: `Book ${name}` }));
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onBook.mock.calls[0][0].id).toBe(id);
  });
});

describe('RC1 item4 — recompute after dismiss', () => {
  it('dismissed provider is removed and not re-surfaced', async () => {
    const { default: Cmp } = await load('true');
    render(<Cmp user={{}} />);
    const first = screen.getAllByTestId('luca-rec-card')[0];
    const dismissedId = first.getAttribute('data-provider-id');
    fireEvent.click(screen.getByRole('button', { name: `Dismiss ${first.querySelector('h5').textContent}` }));
    const remaining = screen.getAllByTestId('luca-rec-card').map((c) => c.getAttribute('data-provider-id'));
    expect(remaining).not.toContain(dismissedId);
  });
});

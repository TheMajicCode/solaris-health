// Node K1.3 §Phase 3 — Exact Curated Journey provider deep link.
import { describe, it, expect } from 'vitest';
import { curatedNavIntent } from '../lib/curatedDeepLink.js';

describe('Node K1.3 §Phase 3 — curated deep link intent', () => {
  it('deep-links the exact provider when a curated/alternate provider exists', () => {
    const intent = curatedNavIntent({ providerId: 'prov_B', title: 'Provider B' });
    expect(intent).toEqual({ tab: 'explore', providerId: 'prov_B' });
  });

  it('carries a numeric provider id through unchanged', () => {
    const intent = curatedNavIntent({ providerId: 42 });
    expect(intent).toEqual({ tab: 'explore', providerId: 42 });
  });

  it('falls back to the generic Explore list when no provider is resolved', () => {
    expect(curatedNavIntent(null)).toEqual({ tab: 'explore' });
    expect(curatedNavIntent(undefined)).toEqual({ tab: 'explore' });
    expect(curatedNavIntent({})).toEqual({ tab: 'explore' });
    expect(curatedNavIntent({ providerId: null })).toEqual({ tab: 'explore' });
  });

  it('never silently substitutes a different provider (provider B stays B)', () => {
    // A distinct provider id must never be rewritten to another listing.
    const a = curatedNavIntent({ providerId: 'A' });
    const b = curatedNavIntent({ providerId: 'B' });
    expect(a.providerId).toBe('A');
    expect(b.providerId).toBe('B');
  });
});

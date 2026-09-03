// Preview Correction V3 — Item 1: Explore recommendation refresh / rotation.
//
// ExploreMarketplace rotates the recommended-provider card locally over the real
// approved provider pool using the shared pickAlternate/eligibleProviders helpers
// (src/lib/alternateProvider.js). These tests pin the four contract scenarios:
//   • ≥3 eligible  → rotates through distinct providers, cycles when exhausted
//   • exactly 1    → keeps the single match (never silently re-serves it as "new")
//   • 0 eligible   → returns nothing to show (caller keeps current / empty)
//   • ineligible   → unapproved/hidden/inactive listings are excluded
import { describe, it, expect } from 'vitest';
import { pickAlternate, eligibleProviders } from '../lib/alternateProvider.js';

const P = (id, extra = {}) => ({ id, business_name: `Provider ${id}`, ...extra });

describe('Preview V3 §1 — Explore recommendation rotation', () => {
  it('rotates through distinct providers when ≥3 are eligible, then cycles', () => {
    const pool = [P(1), P(2), P(3)];
    // Seed the shown-set with the backend pick (id 1), as ExploreMarketplace does.
    let used = new Set(['1']);
    let currentId = '1';
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      const r = pickAlternate({ pool, currentId, used });
      expect(r.provider).toBeTruthy();
      // Never immediately repeats the current provider.
      expect(String(r.provider.id)).not.toBe(String(currentId));
      used = r.used;
      currentId = String(r.provider.id);
      seen.push(currentId);
    }
    // Across a full cycle every provider is surfaced (no permanent lock on one).
    expect(new Set(seen)).toEqual(new Set(['1', '2', '3']));
  });

  it('keeps the single provider when exactly one is eligible (only-match)', () => {
    const pool = [P(7)];
    // The one provider IS the current card → nothing else eligible to rotate to.
    const r = pickAlternate({ pool, currentId: '7', used: new Set(['7']) });
    expect(r.provider).toBeNull(); // caller keeps current + shows "only match" note
    // And there is exactly one eligible item overall.
    expect(eligibleProviders(pool, {}).length).toBe(1);
  });

  it('returns nothing to rotate to when zero providers are eligible', () => {
    const r = pickAlternate({ pool: [], currentId: null, used: new Set() });
    expect(r.provider).toBeNull();
    expect(eligibleProviders([], {}).length).toBe(0);
  });

  it('excludes ineligible (unapproved) listings from the pool', () => {
    const pool = [P(1), P(2, { approved: false }), P(3)];
    const eligible = eligibleProviders(pool, {});
    const ids = eligible.map((p) => String(p.id));
    expect(ids).toContain('1');
    expect(ids).toContain('3');
    expect(ids).not.toContain('2'); // approved:false is filtered out
  });
});

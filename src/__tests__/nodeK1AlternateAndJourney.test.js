// Node K1 §A2 + §B — alternate-provider rotation and personalized journey draft.
import { describe, it, expect } from 'vitest';
import pickAlternate, { eligibleProviders } from '../lib/alternateProvider.js';
import buildJourneyDraft, { normalizeJourneyInput, FOCUS_AREAS } from '../lib/journeyDraft.js';

const P = (id, extra = {}) => ({ providerId: id, title: `P${id}`, approved: true, ...extra });

describe('Node K1 §A2 — eligibleProviders', () => {
  const pool = [P(1), P(2), P(3), P(4, { approved: false })];
  it('excludes current, dismissed, booked, and unapproved', () => {
    const e = eligibleProviders(pool, { currentId: 1, dismissed: new Set(['2']), booked: new Set(['3']) });
    expect(e.map((p) => p.providerId)).toEqual([]); // 1 current, 2 dismissed, 3 booked, 4 unapproved
  });
  it('keeps others when only current excluded', () => {
    const e = eligibleProviders(pool, { currentId: 1 });
    expect(e.map((p) => p.providerId)).toEqual([2, 3]);
  });
});

describe('Node K1 §A2 — pickAlternate rotation', () => {
  it('preserves current when nothing eligible', () => {
    const { provider } = pickAlternate({ pool: [P(1)], currentId: 1 });
    expect(provider).toBe(null);
  });

  it('does not repeat until the eligible set is exhausted, then cycles', () => {
    const pool = [P(1), P(2), P(3)];
    let used = new Set();
    const seen = [];
    // current is 1; eligible = {2,3}
    let r = pickAlternate({ pool, currentId: 1, used });
    seen.push(r.provider.providerId); used = r.used;
    r = pickAlternate({ pool, currentId: 1, used });
    seen.push(r.provider.providerId); used = r.used;
    // both 2 and 3 shown once, no repeat
    expect(new Set(seen)).toEqual(new Set([2, 3]));
    // next call: eligible exhausted -> cycle resets, allows a repeat
    r = pickAlternate({ pool, currentId: 1, used });
    expect([2, 3]).toContain(r.provider.providerId);
    expect(r.used.size).toBe(1);
  });

  it('never returns a booked provider', () => {
    const pool = [P(1), P(2), P(3)];
    const { provider } = pickAlternate({ pool, currentId: 1, booked: new Set(['2']) });
    expect(provider.providerId).toBe(3);
  });
});

describe('Node K1 §B — buildJourneyDraft (deterministic, honest)', () => {
  it('produces daily/weekly/monthly views + assumptions', () => {
    const d = buildJourneyDraft({ focusAreas: ['Mind'], minutesPerDay: 20, daysPerWeek: 5, pace: 'steady' });
    expect(d.views.map((v) => v.cadence)).toEqual(['daily', 'weekly', 'monthly']);
    expect(d.assumptions.length).toBeGreaterThan(0);
    expect(d.title).toContain('Mind');
    expect(d.source).toMatch(/LUCA draft/);
  });

  it('is deterministic for identical input', () => {
    const inp = { focusAreas: ['Body', 'Heart'], minutesPerDay: 15, daysPerWeek: 4 };
    expect(JSON.stringify(buildJourneyDraft(inp))).toBe(JSON.stringify(buildJourneyDraft(inp)));
  });

  it('defaults empty focus to Body & Heart with an explanatory assumption', () => {
    const d = buildJourneyDraft({ focusAreas: [] });
    expect(d.meta.focusAreas).toEqual(['Body', 'Heart']);
    expect(d.assumptions.join(' ')).toMatch(/Body & Heart/);
  });

  it('clamps and sanitizes inputs', () => {
    const n = normalizeJourneyInput({ minutesPerDay: 999, daysPerWeek: 99, pace: 'bogus', focusAreas: ['Mind', 'X'] });
    expect(n.minutesPerDay).toBe(120);
    expect(n.daysPerWeek).toBe(7);
    expect(n.pace).toBe('steady');
    expect(n.focusAreas).toEqual(['Mind']);
  });

  it('honors rhythm toggles', () => {
    const d = buildJourneyDraft({ rhythm: { daily: false } });
    const daily = d.views.find((v) => v.cadence === 'daily');
    expect(daily.steps.join(' ')).toMatch(/turned daily steps off/);
  });

  it('FOCUS_AREAS exposes the four canonical areas', () => {
    expect(FOCUS_AREAS).toEqual(['Mind', 'Body', 'Heart', 'Spirit']);
  });
});

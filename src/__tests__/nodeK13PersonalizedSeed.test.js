/**
 * NODE K1.3 §4 — Personalized journey seeds the SAME Growth pipeline.
 * Pure transform + source-wiring assertions (device-local fallback preserved).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { personalizedSeedSteps, CADENCE_FROM_VIEW, PERSONALIZED_JOURNEY_TYPE } from '../lib/personalizedSeed.js';
import buildJourneyDraft from '../lib/journeyDraft.js';
import { groupTodosByCadence } from '../lib/todoGrouping.js';

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');

describe('personalizedSeedSteps — draft → idempotent seed payload', () => {
  const draft = buildJourneyDraft({ focusAreas: ['Body', 'Heart'], minutesPerDay: 20, daysPerWeek: 5, pace: 'steady' });

  it('maps daily/weekly/monthly views to today/week/month cadence', () => {
    expect(CADENCE_FROM_VIEW).toEqual({ daily: 'today', weekly: 'week', monthly: 'month' });
    const steps = personalizedSeedSteps(draft);
    expect(steps.length).toBeGreaterThan(0);
    const cadences = new Set(steps.map((s) => s.cadence));
    expect(cadences.has('today')).toBe(true);
    expect(cadences.has('week')).toBe(true);
    expect(cadences.has('month')).toBe(true);
    for (const c of cadences) expect(['today', 'week', 'month']).toContain(c);
  });

  it('produces deterministic step_keys — a re-approve yields identical keys (idempotent)', () => {
    const a = personalizedSeedSteps(draft).map((s) => s.step_key);
    const b = personalizedSeedSteps(draft).map((s) => s.step_key);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length); // unique
    expect(a.every((k) => /^personalized_(daily|weekly|monthly)_\d+$/.test(k))).toBe(true);
  });

  it('skips "Skipped …" placeholder steps and carries no action metadata (no PHI, non-actionable)', () => {
    const off = buildJourneyDraft({ focusAreas: ['Mind'], rhythm: { daily: false, weekly: true, monthly: true } });
    const steps = personalizedSeedSteps(off);
    expect(steps.some((s) => /^skipped/i.test(s.title))).toBe(false);
    for (const s of steps) {
      expect(s.action_type).toBeNull();
      expect(s.action_target).toBeNull();
      expect(s.dimension).toBeNull();
    }
  });

  it('ignores malformed blocks safely', () => {
    expect(personalizedSeedSteps(null)).toEqual([]);
    expect(personalizedSeedSteps({})).toEqual([]);
    expect(personalizedSeedSteps({ views: 'x' })).toEqual([]);
  });

  it('rows carrying an explicit cadence group correctly downstream (today/week/month)', () => {
    // Once seeded, rows return without a cadence column; grouping must still work.
    // Verify the seed cadence values are ones groupTodosByCadence understands.
    const steps = personalizedSeedSteps(draft).map((s) => ({ cadence: s.cadence }));
    const g = groupTodosByCadence(steps);
    expect(g.today.length + g.week.length + g.month.length).toBe(steps.length);
  });

  it('exposes a stable journey type', () => {
    expect(PERSONALIZED_JOURNEY_TYPE).toBe('personalized');
  });
});

describe('wiring — approval seeds the server AND keeps the device-local copy', () => {
  it('api.js exposes seedJourneyPlan → POST /journey/todos/seed-plan', () => {
    const api = read('../lib/api.js');
    expect(api).toMatch(/seedJourneyPlan\(body\)\s*\{[^}]*\/journey\/todos\/seed-plan[^}]*method:\s*'POST'/);
  });

  it('LucaPassport wires seedApprovedPersonalizedPlan at BOTH onApprove sites, after setApprovedJourney', () => {
    const src = read('../components/LucaPassport.jsx');
    // helper defined once, falls back silently
    expect(src).toMatch(/async function seedApprovedPersonalizedPlan\(block\)/);
    expect(src).toMatch(/api\.seedJourneyPlan\(\{\s*journeyType: PERSONALIZED_JOURNEY_TYPE, steps\s*\}\)/);
    // both call sites keep the device-local save (setApprovedJourney) then seed
    const calls = src.match(/setApprovedJourney\?\.\(block\);[\s\S]*?seedApprovedPersonalizedPlan\(block\)/g) || [];
    expect(calls.length).toBe(2);
  });

  it('backend seed-plan endpoint is idempotent + allowlist-validated + no migration', () => {
    const be = read('../../backend/src/routes/journey.js');
    expect(be).toMatch(/router\.post\('\/todos\/seed-plan'/);
    expect(be).toMatch(/ON CONFLICT \(user_id, journey_type, step_key\)/);
    expect(be).toMatch(/DO NOTHING/);
    expect(be).toMatch(/SEED_ACTION_TYPES\s*=\s*\[/);
    // reuses member_todos — no new table / migration
    expect(be).toMatch(/INSERT INTO member_todos/);
  });
});

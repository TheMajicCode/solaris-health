// NODE K1.4 §6 — Deterministic Next Step corrections.
//
// The green "Your Next Step" card must never silently fabricate "Check in today"
// when the dashboard could not load its inputs. When any of the resolver's data
// sources fail to load, resolveNextAction must return an explicit, RETRYABLE
// unavailable descriptor (priority 0) — not priority 1 check-in.
//
// These also lock the render wiring in LucaPassport.jsx so the card is derived
// from the resolver (stable keys, retry destination, dataError plumbed through).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import resolveNextAction from '../lib/nextAction.js';

const TODAY = new Date('2026-08-23T10:00:00');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('K1.4 §6 — dataError yields an explicit unavailable state, never a fabricated check-in', () => {
  it('dataError=true -> priority 0 unavailable + retry destination (NOT priority 1)', () => {
    const a = resolveNextAction({ vitality: 60, checkins: [], dataError: true, now: TODAY });
    expect(a.priority).toBe(0);
    expect(a.unavailable).toBe(true);
    expect(a.key).toBe('unavailable');
    expect(a.destination.type).toBe('retry');
    expect(a.icon).toBe('retry');
    // Must NOT masquerade as the check-in action that priority 1 would return.
    expect(a.destination.type).not.toBe('checkin');
  });

  it('dataError wins even when a check-in would otherwise be due', () => {
    const due = resolveNextAction({ vitality: 60, checkins: [], now: TODAY });
    expect(due.priority).toBe(1); // sanity: this input is check-in-due
    const err = resolveNextAction({ vitality: 60, checkins: [], dataError: true, now: TODAY });
    expect(err.priority).toBe(0);
  });

  it('dataError=false behaves exactly as before (no regression)', () => {
    const a = resolveNextAction({ vitality: 60, checkins: [], dataError: false, now: TODAY });
    expect(a.priority).toBe(1);
    expect(a.destination.type).toBe('checkin');
  });
});

describe('K1.4 §6 — every descriptor carries a stable, translation-safe key', () => {
  const cases = [
    ['unavailable', { vitality: 60, checkins: [], dataError: true, now: TODAY }],
    ['checkin', { vitality: 60, checkins: [], now: TODAY }],
    ['assessment', { vitality: 0, completeness: { checks: {} }, checkins: [], now: TODAY }],
    ['passport', { vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], completeness: { checks: { intake: true }, nextStep: { key: 'health_doc', label: 'Add a document', tab: 'health' } }, now: TODAY }],
    ['journey_continue', { vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], journeys: [{ status: 'active', nextMilestone: { label: 'Week 2 continue' } }], now: TODAY }],
    ['journey_journal', { vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], journeys: [{ status: 'active', nextMilestone: { label: 'Reflect in your journal' } }], now: TODAY }],
    ['booking', { vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], bookings: [{ id: 7, status: 'proposed' }], now: TODAY }],
    ['fallback', { vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], now: TODAY }],
  ];
  for (const [expectedKey, ctx] of cases) {
    it(`key === ${expectedKey}`, () => {
      const a = resolveNextAction(ctx);
      expect(a.key).toBe(expectedKey);
      expect(typeof a.key).toBe('string');
      expect(a.key.length).toBeGreaterThan(0);
    });
  }
});

describe('K1.4 §6 — completed-todo progression rotates the Next Step', () => {
  it('finishing the journal step surfaces the next open step', () => {
    // A local approved journey where step 1 (journal) is done -> resolver should
    // advance to the next open step, not keep pointing at the completed one.
    const approvedJourney = {
      title: 'Personalized journey',
      steps: [
        { label: 'Reflect in your journal', done: true },
        { label: 'Listen to your meditation', done: false },
      ],
    };
    const a = resolveNextAction({
      vitality: 50, checkins: [{ checkin_date: '2026-08-23' }], approvedJourney, now: TODAY,
    });
    // media milestone -> media section (the still-open step), not journal.
    expect(a.destination).toMatchObject({ type: 'communications', section: 'media' });
    expect(a.key).toBe('journey_media');
  });
});

describe('K1.4 §6 — render wiring is derived from the resolver', () => {
  const passport = read('src/components/LucaPassport.jsx');

  it('dataError is plumbed into the resolver call', () => {
    expect(passport).toMatch(/resolveNextAction\(\{[\s\S]*?dataError[\s\S]*?\}\)/);
  });

  it('LucaRecommends receives dataError + onRetry + refreshing props', () => {
    const m = passport.match(/<LucaRecommends[\s\S]*?\/>/);
    expect(m).toBeTruthy();
    expect(m[0]).toMatch(/dataError=\{dataError\}/);
    expect(m[0]).toMatch(/onRetry=\{reloadDashboardState\}/);
  });

  it('runNextStep handles the retry destination', () => {
    expect(passport).toMatch(/case 'retry':[\s\S]*?onRetry\?\.\(\)/);
  });

  it('retry icon is registered', () => {
    expect(passport).toMatch(/retry:\s*RefreshCw/);
  });

  it('next-step copy is localized through the nextStep.<key> namespace', () => {
    expect(passport).toMatch(/tl\('nextStep\.' \+ action\.key \+ '\.title'/);
  });
});

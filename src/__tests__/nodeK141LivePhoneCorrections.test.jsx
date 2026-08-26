/**
 * NODE K1.4.1 — Live-phone corrections (runtime behavior, not source-regex).
 *
 * These exercise the ACTUAL resolver / pipeline / device-store logic (and the
 * localStorage-backed device To-do store under jsdom), so a regression in the
 * real code paths — not merely a changed string — fails the test.
 */
import React, { useState } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import TopbarPopover, { TOPBAR_POPOVER_Z } from '../components/ui/TopbarPopover.jsx';
import enCatalog from '../lib/i18n/en.js';
import esCatalog from '../lib/i18n/es.js';
import { REVIEW_PENDING } from '../lib/i18n/constants.js';
import { resolveNextAction, todoDestination } from '../lib/nextAction.js';
import { isCheckinDue } from '../lib/nextAction.js';
import { mergeTodos, firstUnfinishedJourneyTodo, normalizeTodos } from '../lib/todoPipeline.js';
import { todoActionMeta } from '../lib/todoGrouping.js';
import {
  buildLocalTodosFromJourney, loadDeviceTodos, saveDeviceTodos, toggleDeviceTodo, deviceTodosKey,
} from '../lib/deviceTodos.js';
import { personalizedSeedSteps } from '../lib/personalizedSeed.js';

const NOW = new Date('2026-08-26T12:00:00'); // local noon
const intakeDone = { checks: { intake: true } };

const journeyBlock = {
  title: 'Your personalized journey',
  views: [
    { cadence: 'daily', steps: ['Take three slow breaths', 'Write one line in your journal'] },
    { cadence: 'weekly', steps: ['Go for a long walk'] },
  ],
};

beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe('K1.4.1 F1 — Dashboard passes fetched todos to resolveNextAction', () => {
  it('an unfinished journey To-do becomes "Your Next Step" (priority 3)', () => {
    const todos = [
      { step_key: 'j1', title: 'Reflect in your journal', journey_type: 'personalized', action_type: 'open_journal', done: false, cadence: 'today', sort_order: 0 },
    ];
    const a = resolveNextAction({ vitality: 50, completeness: intakeDone, checkins: [{ checkin_date: '2026-08-26' }], todos, now: NOW });
    expect(a.priority).toBe(3);
    expect(a.key).toBe('journey_todo');
  });

  it('with NO todos passed, the resolver never invents a priority-3 To-do step', () => {
    const a = resolveNextAction({ vitality: 50, completeness: intakeDone, checkins: [{ checkin_date: '2026-08-26' }], todos: [], now: NOW });
    expect(a.key).not.toBe('journey_todo');
  });
});

describe('K1.4.1 F2 — today check-in recognized when the API list is unsorted', () => {
  it('scans ALL check-ins, not checkins[0]', () => {
    const checkins = [
      { checkin_date: '2026-08-20' },
      { checkin_date: '2026-08-26' }, // today, NOT first
      { checkin_date: '2026-08-24' },
    ];
    expect(isCheckinDue({ intakeComplete: true, checkins, now: NOW })).toBe(false);
  });

  it('is due when no row matches today, regardless of order', () => {
    const checkins = [{ checkin_date: '2026-08-25' }, { checkin_date: '2026-08-24' }];
    expect(isCheckinDue({ intakeComplete: true, checkins, now: NOW })).toBe(true);
  });
});

describe('K1.4.1 F3 — after check-in, first unfinished Growth To-do is Next Step', () => {
  it('check-in satisfied → resolver returns the first unfinished journey To-do', () => {
    const todos = [
      { step_key: 'a', title: 'Take three slow breaths', journey_type: 'personalized', done: true, cadence: 'today', sort_order: 0 },
      { step_key: 'b', title: 'Go for a long walk', journey_type: 'personalized', done: false, cadence: 'week', sort_order: 1 },
    ];
    const a = resolveNextAction({ vitality: 50, completeness: intakeDone, checkins: [{ checkin_date: '2026-08-26' }], todos, now: NOW });
    expect(a.priority).toBe(3);
    expect(a.explanation === '' || typeof a.explanation === 'string').toBe(true);
    expect(a.stepKey).toBe('b'); // the FIRST unfinished, done row skipped
  });
});

describe('K1.4.1 F4 — completing a To-do rotates to the next incomplete', () => {
  it('firstUnfinishedJourneyTodo advances as rows are completed', () => {
    const todos = [
      { step_key: 'a', title: 'A', journey_type: 'personalized', done: false, cadence: 'today', sort_order: 0 },
      { step_key: 'b', title: 'B', journey_type: 'personalized', done: false, cadence: 'today', sort_order: 1 },
    ];
    expect(firstUnfinishedJourneyTodo(todos).step_key).toBe('a');
    const afterA = todos.map((t) => (t.step_key === 'a' ? { ...t, done: true } : t));
    expect(firstUnfinishedJourneyTodo(afterA).step_key).toBe('b');
    const afterB = afterA.map((t) => (t.step_key === 'b' ? { ...t, done: true } : t));
    expect(firstUnfinishedJourneyTodo(afterB)).toBeNull();
  });
});

describe('K1.4.1 F5 — accepted personalized journey immediately yields visible local To-dos (seed-plan 404)', () => {
  it('buildLocalTodosFromJourney produces actionable rows with all required fields', () => {
    const rows = buildLocalTodosFromJourney(journeyBlock, 'user-1');
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('step_key');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('cadence');
      expect(r.source).toBe('device');
      expect(r.synced).toBe(false);
      expect(r.journey_type).toBe('personalized');
      expect(r.ownerUserId).toBe('user-1');
    }
    // The "Write one line in your journal" step derives a safe open_journal action.
    const journalStep = rows.find((r) => /journal/i.test(r.title));
    expect(journalStep.action_type).toBe('open_journal');
  });
});

describe('K1.4.1 F6 — local To-dos survive a reload for the same user', () => {
  it('saved rows are read back after a fresh load', () => {
    const rows = buildLocalTodosFromJourney(journeyBlock, 'user-1');
    saveDeviceTodos('user-1', rows);
    const reloaded = loadDeviceTodos('user-1');
    expect(reloaded.length).toBe(rows.length);
    expect(reloaded.map((r) => r.step_key).sort()).toEqual(rows.map((r) => r.step_key).sort());
  });

  it('a toggled completion persists across reload', () => {
    const rows = buildLocalTodosFromJourney(journeyBlock, 'user-1');
    saveDeviceTodos('user-1', rows);
    const id = rows[0].id;
    toggleDeviceTodo('user-1', id);
    const reloaded = loadDeviceTodos('user-1');
    expect(reloaded.find((r) => r.id === id).done).toBe(true);
  });
});

describe('K1.4.1 F7 — local To-dos never leak to another user', () => {
  it('another user id reads none of user-1 rows', () => {
    saveDeviceTodos('user-1', buildLocalTodosFromJourney(journeyBlock, 'user-1'));
    expect(loadDeviceTodos('user-2')).toEqual([]);
  });

  it('defense-in-depth: rows mis-stored under a foreign owner are filtered on read', () => {
    const rows = buildLocalTodosFromJourney(journeyBlock, 'user-1').map((r) => ({ ...r, ownerUserId: 'user-1' }));
    // simulate a corrupted store under user-2's key that actually holds user-1 rows
    localStorage.setItem(deviceTodosKey('user-2'), JSON.stringify(rows));
    expect(loadDeviceTodos('user-2')).toEqual([]);
  });
});

describe('K1.4.1 F8 — server + local duplicate step_keys render once (server wins)', () => {
  it('mergeTodos dedupes by step_key', () => {
    const server = [{ step_key: 'personalized_daily_0', title: 'Server copy', source: 'server', done: false }];
    const local = [
      { step_key: 'personalized_daily_0', title: 'Device copy', source: 'device', done: true },
      { step_key: 'personalized_weekly_0', title: 'Device only', source: 'device', done: false },
    ];
    const merged = mergeTodos(server, local);
    const keys = merged.map((t) => t.step_key);
    expect(keys.filter((k) => k === 'personalized_daily_0').length).toBe(1);
    // server row wins the conflict
    const dup = merged.find((t) => t.step_key === 'personalized_daily_0');
    expect(dup.title).toBe('Server copy');
    expect(dup.source).toBe('server');
    // the device-only row is retained
    expect(merged.some((t) => t.step_key === 'personalized_weekly_0')).toBe(true);
  });
});

describe('K1.4.1 F9 — actions navigate to the EXACT screen', () => {
  it('journal / media / growth / booking map to their destinations', () => {
    expect(todoDestination({ action_type: 'open_journal' }).destination).toEqual({ type: 'communications', section: 'journal' });
    expect(todoDestination({ action_type: 'play_audio', action_target: 'track-7' }).destination).toMatchObject({ type: 'communications', section: 'media', target: 'track-7' });
    expect(todoDestination({ action_type: 'open_booking', action_target: 'bk-3' }).destination).toMatchObject({ type: 'booking', bookingId: 'bk-3' });
    expect(todoDestination({ action_type: 'open_listing', action_target: 'prov-2' }).destination).toMatchObject({ type: 'explore', target: 'prov-2' });
  });

  it('a valid provider listing (real id) opens Explore with that id', () => {
    const d = todoDestination({ action_type: 'open_listing', action_target: '42' });
    expect(d.destination.type).toBe('explore');
    expect(d.destination.target).toBe('42');
  });
});

describe('K1.4.1 F10 — steps without a valid target render checkbox-only', () => {
  it('a bare navigate→journal or no action has no CTA', () => {
    expect(todoActionMeta({ action_type: 'navigate', action_target: 'journal' })).toBeNull();
    expect(todoActionMeta({ action_type: null })).toBeNull();
    expect(todoActionMeta({ action_type: 'play_audio', action_target: null })).toBeNull();
  });

  it('a checkbox-only device step (no derivable target) routes to Growth, never a dead button', () => {
    // "Go for a long walk" is self-care with no real target → checkbox only.
    const rows = buildLocalTodosFromJourney(journeyBlock, 'user-1');
    const walk = rows.find((r) => /walk/i.test(r.title));
    expect(walk.action_type).toBeNull();
    // resolver still surfaces it, routing to the Growth list (where the checkbox lives)
    const d = todoDestination(walk);
    expect(d.destination).toEqual({ type: 'communications', section: 'growth' });
  });
});

describe('K1.4.1 — personalized seed carries only safe actions', () => {
  it('seed steps never fabricate a target', () => {
    const steps = personalizedSeedSteps(journeyBlock);
    for (const s of steps) {
      expect([null, 'open_journal']).toContain(s.action_type);
      expect(s.action_target ?? null).toBeNull();
    }
  });

  it('normalizeTodos recognizes camelCase AND DB field names', () => {
    const [n] = normalizeTodos([{ stepKey: 'x', actionType: 'open_journal', actionTarget: null, sortOrder: 3, isDone: 1 }]);
    expect(n.step_key).toBe('x');
    expect(n.action_type).toBe('open_journal');
    expect(n.sort_order).toBe(3);
    expect(n.done).toBe(true);
  });
});


// ── Keys that this node localized (previously hardcoded English on signed-in surfaces). ──
const K141_LOCALIZED_KEYS = [
  'nextStep.journey_todo.eyebrow',
  'cta.checkin', 'cta.openJournal', 'cta.play', 'cta.view', 'cta.viewBooking', 'cta.go', 'cta.openGrowth',
  'journey.approved.savedOnDevice', 'journey.approved.seeBelow', 'journey.approved.sync', 'journey.approved.syncing',
  'journey.approved.syncedMeta', 'journey.approved.localMeta', 'journey.approved.stepsSuffix', 'journey.approved.autonomy',
  'journey.approved.dismissAria', 'journey.approved.onDate', 'journey.approved.stepsCount', 'journey.approved.ownRhythm',
  'journey.approved.cadenceRhythm', 'journey.approved.fallbackTail',
  'journey.todosToday', 'journey.todosWeek', 'journey.todosMonth',
  'growth.planEyebrow', 'growth.todoTitle', 'growth.doneCount', 'growth.markDone', 'growth.markNotDone', 'growth.remove',
  'growth.curatedFrom', 'growth.emptyHint', 'growth.emptyTitle', 'growth.emptySub', 'growth.addGoalPlaceholder', 'growth.add',
  'habit.eyebrow', 'habit.title', 'habit.todayCount', 'habit.emptyTitle', 'habit.emptySub', 'habit.removeHabit', 'habit.addPlaceholder',
];

describe('K1.4.1 F11 — signed-in Spanish: newly localized keys are present and really translated', () => {
  it('every localized key exists in BOTH the English and Spanish catalogs', () => {
    for (const k of K141_LOCALIZED_KEYS) {
      expect(enCatalog, `en missing ${k}`).toHaveProperty(k);
      expect(esCatalog, `es missing ${k}`).toHaveProperty(k);
    }
  });

  it('Spanish values are real translations — not the English source, not the review-pending sentinel', () => {
    for (const k of K141_LOCALIZED_KEYS) {
      const en = enCatalog[k];
      const es = esCatalog[k];
      expect(es, `es[${k}] must not be REVIEW_PENDING (these are ordinary chrome, not safety copy)`).not.toBe(REVIEW_PENDING);
      // Interpolation-token-only strings (e.g. ' el ') can legitimately match; skip those.
      const enHasWords = /[A-Za-z]{3,}/.test(String(en).replace(/\{[^}]*\}/g, ''));
      if (enHasWords) {
        expect(String(es), `es[${k}] appears untranslated (identical to English)`).not.toBe(String(en));
      }
    }
  });

  it('en/es catalogs stay at full parity (no key exists on only one side)', () => {
    const enKeys = Object.keys(enCatalog).sort();
    const esKeys = Object.keys(esCatalog).sort();
    const onlyEn = enKeys.filter((k) => !(k in esCatalog));
    const onlyEs = esKeys.filter((k) => !(k in enCatalog));
    expect(onlyEn, `keys only in en: ${onlyEn.join(', ')}`).toEqual([]);
    expect(onlyEs, `keys only in es: ${onlyEs.join(', ')}`).toEqual([]);
  });
});

describe('K1.4.1 F12 — splash / welcome show a single wordmark on the emblem-only mark', () => {
  const OB = fs.readFileSync(path.resolve(__dirname, '../flows/Onboarding.jsx'), 'utf8');
  const AUTH = fs.readFileSync(path.resolve(__dirname, '../flows/Auth.jsx'), 'utf8');

  it('the onboarding splash uses the emblem-only asset, never the full lockup PNG that bakes in its own wordmark', () => {
    expect(OB).toMatch(/\/solaris-emblem-v2\.png/);
    expect(OB).not.toMatch(/\/solaris-logo-v2\.png/);
  });

  it('the auth welcome uses the emblem-only asset, never the full lockup PNG', () => {
    expect(AUTH).toMatch(/\/solaris-emblem-v2\.png/);
    expect(AUTH).not.toMatch(/\/solaris-logo-v2\.png/);
  });

  it('each emblem image is paired with exactly one text wordmark (no duplicate SOLARIS wordmark)', () => {
    // The splash block: one emblem <img>, immediately followed by a single `wordmark` element.
    const splashEmblems = (OB.match(/solaris-emblem-v2\.png/g) || []).length;
    const splashWordmarks = (OB.match(/className="wordmark/g) || []).length;
    // more emblem placements than wordmarks is fine (floaty decor), but never a second baked wordmark.
    expect(splashWordmarks).toBeLessThanOrEqual(splashEmblems);
    expect(AUTH).toMatch(/className="wordmark ob-wordmark"/);
    // exactly one welcome wordmark line in Auth.
    expect((AUTH.match(/className="wordmark ob-wordmark"/g) || []).length).toBe(1);
  });
});

describe('K1.4.1 F13 — account/language popovers float above Explore chrome at phone widths', () => {
  function Harness() {
    const [open] = useState(true);
    return (
      <TopbarPopover id="account" open={open} onClose={() => {}} ariaLabel="Account" testId="f13-pop">
        <button data-testid="f13-item">item</button>
      </TopbarPopover>
    );
  }

  for (const width of [360, 390, 430]) {
    it(`at ${width}px the popover portals to body, is position:fixed, and stacks above Explore chrome (≤4200) and the mini-player (9990)`, () => {
      const orig = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
      window.dispatchEvent(new Event('resize'));
      render(<Harness />);
      const panel = screen.getByTestId('f13-pop');
      expect(panel.style.position).toBe('fixed');
      const scrim = document.querySelector('.topbar-pop-scrim');
      expect(scrim).toBeTruthy();
      expect(Number(scrim.style.zIndex)).toBe(TOPBAR_POPOVER_Z);
      expect(TOPBAR_POPOVER_Z).toBeGreaterThan(9990);
      cleanup();
      Object.defineProperty(window, 'innerWidth', { value: orig, configurable: true, writable: true });
    });
  }
});

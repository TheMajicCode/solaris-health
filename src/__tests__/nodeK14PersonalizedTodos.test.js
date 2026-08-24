/**
 * NODE K1.4 §7 — Personalized Journey approval creates REAL persisted To-dos.
 *
 * On final approval the structured journey steps must be converted into the SAME
 * persisted member_todos model as a guided journey, via POST /journey/todos/seed-plan,
 * idempotently. The UI must follow a TRUTHFUL sequence:
 *   approve → seed succeeds → refetch → verify present → ONLY THEN success →
 *   navigate to Communications → Growth, focus/scroll, render checkboxes + action.
 * On failure: retain the draft, show a retryable error, and NEVER say
 * "see your To-do list below" beside an empty list.
 *
 * Source-contract assertions (deterministic, no DOM) locking the wiring.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { personalizedSeedSteps, PERSONALIZED_JOURNEY_TYPE } from '../lib/personalizedSeed.js';

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const src = read('src/components/LucaPassport.jsx');

describe('K1.4 §7 — truthful seed → refetch → verify flow', () => {
  it('seedApprovedPersonalizedPlan verifies the seeded step_keys are present before ok:true', () => {
    // seed, then refetch via getTodos, then require every seeded key present.
    const fn = src.match(/async function seedApprovedPersonalizedPlan\(block\)[\s\S]*?\n}\n/);
    expect(fn).toBeTruthy();
    const body = fn[0];
    expect(body).toMatch(/api\.seedJourneyPlan\(/);
    expect(body).toMatch(/api\.getTodos\(\)/);           // refetch (step 3)
    expect(body).toMatch(/step_key/);                    // verify by key (step 4)
    expect(body).toMatch(/steps\.every\(/);              // ALL seeded steps must be present
    expect(body).toMatch(/reason: 'seed_failed'/);       // endpoint missing/failed
    expect(body).toMatch(/reason: 'verify_failed'/);     // seeded but not confirmed present
    expect(body).toMatch(/ok: true/);
  });

  it('shared approval handler shows success ONLY after a successful+verified seed', () => {
    const fn = src.match(/async function runApprovePersonalizedJourney\([\s\S]*?\n}\n/);
    expect(fn).toBeTruthy();
    const body = fn[0];
    // success toast + navigation only in the res.ok branch
    const okBranch = body.match(/if \(res\.ok\)\s*\{[\s\S]*?\}\s*else/);
    expect(okBranch).toBeTruthy();
    expect(okBranch[0]).toMatch(/toast\.success/);
    expect(okBranch[0]).toMatch(/seeded: true/);
    expect(okBranch[0]).toMatch(/solaris:focus-todos/);  // focus/scroll (step 6)
    // failure branch retains the draft + retryable error, no success claim
    expect(body).toMatch(/seeded: false/);
    expect(body).toMatch(/toast\.error/);
  });

  it('await ordering: seed resolves BEFORE success is shown (no fire-and-forget)', () => {
    expect(src).toMatch(/const res = await seedApprovedPersonalizedPlan\(block\)/);
  });
});

describe('K1.4 §7 — never claim a To-do list that is not there', () => {
  it('"see your To-do list below" is gated behind the synced state', () => {
    // The phrase must live inside the synced branch, guarded by a synced check.
    expect(src).toMatch(/const synced = journey\.seeded === true && todosPresent/);
    // The synced JSX (which contains the phrase) is only rendered when synced.
    const card = src.match(/function ApprovedJourneyCard\([\s\S]*?\n}\n/);
    expect(card).toBeTruthy();
    expect(card[0]).toMatch(/synced \? \(/);
    expect(card[0]).toMatch(/see your To-do list below/);
    // An explicit unsynced branch offers a retry instead of a fake list.
    expect(card[0]).toMatch(/approved-journey-unsynced/);
    expect(card[0]).toMatch(/onRetrySeed/);
  });

  it('todosPresent is derived from actual server rows of the personalized type', () => {
    expect(src).toMatch(/personalizedTodosPresent = todos\.some\(\(t\) => t\.journey_type === PERSONALIZED_JOURNEY_TYPE\)/);
  });
});

describe('K1.4 §7 — idempotent payload (re-approve/retry adds zero duplicates)', () => {
  it('the seed payload uses deterministic step_keys', () => {
    const draft = { views: [
      { cadence: 'daily', steps: ['Morning breath', 'Hydrate'] },
      { cadence: 'weekly', steps: ['Long walk'] },
    ] };
    const a = personalizedSeedSteps(draft).map((s) => s.step_key);
    const b = personalizedSeedSteps(draft).map((s) => s.step_key);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('journey type is the stable "personalized" identifier', () => {
    expect(PERSONALIZED_JOURNEY_TYPE).toBe('personalized');
  });
});

describe('K1.4 §7 — Growth renders checkboxes + the correct action control', () => {
  it('GrowthTodos toggles (checkbox) and runs the mapped action per action_type', () => {
    const g = src.match(/const runTodo = \([\s\S]*?\n  \};/);
    expect(g).toBeTruthy();
    const body = g[0];
    expect(body).toMatch(/case 'play_audio'/);    // Media step → media/audio
    expect(body).toMatch(/case 'open_listing'/);  // Practitioner/service step
    expect(body).toMatch(/case 'open_booking'/);  // booking detail
    expect(body).toMatch(/case 'navigate'/);      // journal/reflection etc.
  });

  it('the To-do list is focus/scroll target for solaris:focus-todos', () => {
    expect(src).toMatch(/addEventListener\('solaris:focus-todos'/);
    expect(src).toMatch(/todoListRef/);
    expect(src).toMatch(/scrollIntoView/);
  });
});

/**
 * NODE K1.3 — Phase 4: personalized/guided journeys convert to grouped Growth
 * todos with one clear action each.
 */
import { describe, it, expect } from 'vitest';
import {
  TODO_CADENCE, cadenceForTodo, groupTodosByCadence, todoActionMeta, TODO_ACTION_TYPES,
} from '../lib/todoGrouping.js';

describe('K1.3 Phase 4 — cadence grouping', () => {
  it('exposes exactly Today / This week / This month, in order', () => {
    expect(TODO_CADENCE.map((c) => c.key)).toEqual(['today', 'week', 'month']);
    expect(TODO_CADENCE.map((c) => c.label)).toEqual(['Today', 'This week', 'This month']);
  });

  it('derives cadence from kind when no explicit cadence', () => {
    expect(cadenceForTodo({ kind: 'checkin' })).toBe('today');
    expect(cadenceForTodo({ kind: 'habit' })).toBe('today');
    expect(cadenceForTodo({ kind: 'audio' })).toBe('week');
    expect(cadenceForTodo({ kind: 'reflection' })).toBe('week');
    expect(cadenceForTodo({ kind: 'activity' })).toBe('week');
    expect(cadenceForTodo({ kind: 'practitioner' })).toBe('month');
    expect(cadenceForTodo({ kind: 'navigate' })).toBe('month');
  });

  it('an explicit cadence overrides the kind heuristic', () => {
    expect(cadenceForTodo({ kind: 'practitioner', cadence: 'today' })).toBe('today');
    expect(cadenceForTodo({ kind: 'checkin', cadence: 'monthly' })).toBe('month');
    expect(cadenceForTodo({ kind: 'audio', cadence: 'weekly' })).toBe('week');
  });

  it('groups a mixed list, preserving order within each bucket', () => {
    const todos = [
      { id: 1, kind: 'checkin' },
      { id: 2, kind: 'audio' },
      { id: 3, kind: 'habit' },
      { id: 4, kind: 'practitioner' },
      { id: 5, kind: 'reflection' },
    ];
    const g = groupTodosByCadence(todos);
    expect(g.today.map((t) => t.id)).toEqual([1, 3]);
    expect(g.week.map((t) => t.id)).toEqual([2, 5]);
    expect(g.month.map((t) => t.id)).toEqual([4]);
  });
});

describe('K1.3 Phase 4 — action metadata (one clear button, no dead buttons)', () => {
  it('maps each allowlisted action type to a labelled CTA', () => {
    expect(todoActionMeta({ action_type: 'start_checkin' })).toEqual({ key: 'start_checkin', label: 'Check in' });
    expect(todoActionMeta({ action_type: 'play_audio', action_target: 'a1' }).key).toBe('play_audio');
    expect(todoActionMeta({ action_type: 'open_listing', action_target: '42' }).key).toBe('open_listing');
    expect(todoActionMeta({ action_type: 'open_booking', action_target: '9' }).key).toBe('open_booking');
    expect(todoActionMeta({ action_type: 'navigate', action_target: 'explore' }).key).toBe('navigate');
  });

  it('never yields a CTA for a non-actionable or dead step', () => {
    expect(todoActionMeta({})).toBeNull();
    expect(todoActionMeta({ action_type: 'unknown_type' })).toBeNull();
    // navigate to the surface we are already on (journal) is not a CTA
    expect(todoActionMeta({ action_type: 'navigate', action_target: 'journal' })).toBeNull();
    // audio/listing without a resolved target must not render a button
    expect(todoActionMeta({ action_type: 'play_audio' })).toBeNull();
    expect(todoActionMeta({ action_type: 'open_listing' })).toBeNull();
  });

  it('open_booking is part of the action allowlist', () => {
    expect(TODO_ACTION_TYPES).toContain('open_booking');
    expect(TODO_ACTION_TYPES).toContain('start_checkin');
    expect(TODO_ACTION_TYPES).toContain('play_audio');
    expect(TODO_ACTION_TYPES).toContain('open_listing');
    expect(TODO_ACTION_TYPES).toContain('navigate');
  });
});

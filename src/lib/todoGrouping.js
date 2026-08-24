/**
 * NODE K1.3 §4 — Growth to-do grouping + action metadata (pure, testable).
 *
 * The Growth checklist groups steps into Today / This week / This month. There
 * is no cadence column on member_todos (no migration this node), so cadence is
 * derived deterministically from the step `kind`, unless a future backend sets
 * an explicit `cadence` on the row.
 *
 * Action metadata maps a step's action_type to a single clear CTA label. Icons
 * are attached by the component (they are React elements, kept out of this pure
 * module so it stays unit-testable in a plain JS environment).
 */

export const TODO_CADENCE = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

export function cadenceForTodo(t) {
  const explicit = String(t?.cadence || '').toLowerCase();
  if (explicit === 'today' || explicit === 'daily') return 'today';
  if (explicit === 'week' || explicit === 'weekly') return 'week';
  if (explicit === 'month' || explicit === 'monthly') return 'month';
  switch (t?.kind) {
    case 'checkin':
    case 'habit':
      return 'today';
    case 'audio':
    case 'reflection':
    case 'activity':
      return 'week';
    case 'practitioner':
    case 'navigate':
      return 'month';
    default:
      return 'week';
  }
}

// The allowlisted action types a Growth step may carry (§4). Anything else
// renders as a plain (non-actionable) checklist item — never a dead button.
export const TODO_ACTION_TYPES = ['start_checkin', 'play_audio', 'open_listing', 'open_booking', 'navigate'];

// Returns { key, label } for the step's CTA, or null when the step is not
// actionable (or a bare navigate to the surface we are already on).
export function todoActionMeta(t) {
  const type = t?.action_type;
  const tgt = t?.action_target;
  switch (type) {
    case 'start_checkin': return { key: 'start_checkin', label: 'Check in' };
    case 'play_audio': return tgt ? { key: 'play_audio', label: 'Play' } : null;
    case 'open_listing': return tgt ? { key: 'open_listing', label: 'View' } : null;
    case 'open_booking': return { key: 'open_booking', label: 'View booking' };
    case 'navigate': return (tgt && tgt !== 'journal') ? { key: 'navigate', label: 'Go' } : null;
    default: return null;
  }
}

// Split a flat todo list into the three cadence buckets, preserving order.
export function groupTodosByCadence(todos = []) {
  const groups = { today: [], week: [], month: [] };
  for (const t of todos) groups[cadenceForTodo(t)].push(t);
  return groups;
}

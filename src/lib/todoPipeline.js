/**
 * NODE K1.4.1 §A — Growth To-do pipeline (pure, testable).
 *
 * ONE place that normalizes a To-do row (server rows arrive camelCase OR with
 * raw DB column names), merges server rows with device-local personalized rows
 * (dedupe by step_key, server wins), sorts them deterministically, and picks the
 * first unfinished journey To-do for the "Your Next Step" resolver.
 *
 * Keeping this framework-agnostic means the Dashboard resolver and the Growth
 * list share EXACTLY the same view of the member's To-dos.
 */

import { cadenceForTodo } from './todoGrouping.js';

const pick = (...vals) => vals.find((v) => v !== undefined && v !== null);

// Normalize ONE raw To-do into the canonical snake_case shape the app uses.
// Recognizes camelCase (actionType) AND DB columns (action_type), stepKey AND
// step_key, etc. Idempotent: normalizing an already-normal row is a no-op.
export function normalizeTodo(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const done = pick(raw.done, raw.completed, raw.is_done, raw.isDone);
  return {
    ...raw,
    id: pick(raw.id, raw.todo_id, raw.todoId) ?? null,
    step_key: pick(raw.step_key, raw.stepKey) ?? null,
    title: pick(raw.title, raw.label, raw.name) ?? '',
    detail: pick(raw.detail, raw.description, raw.hint) ?? '',
    dimension: pick(raw.dimension, raw.dim) ?? null,
    cadence: pick(raw.cadence, raw.frequency) ?? null,
    sort_order: Number(pick(raw.sort_order, raw.sortOrder, raw.order) ?? 0) || 0,
    done: done === true || done === 1 || done === 'true',
    kind: pick(raw.kind, raw.type) ?? null,
    action_type: pick(raw.action_type, raw.actionType) ?? null,
    action_target: pick(raw.action_target, raw.actionTarget) ?? null,
    journey_type: pick(raw.journey_type, raw.journeyType) ?? null,
    source: pick(raw.source) ?? 'server',
    synced: raw.synced === undefined ? true : raw.synced,
  };
}

export function normalizeTodos(list = []) {
  return (Array.isArray(list) ? list : []).map(normalizeTodo).filter(Boolean);
}

// Merge server + device-local rows. Dedupe by step_key (a stable identity across
// both stores); when the SAME step_key exists in both, the SERVER row wins (it is
// the source of truth once the endpoint is live). Rows without a step_key are
// kept as-is (deduped by id instead).
export function mergeTodos(serverList = [], localList = []) {
  const server = normalizeTodos(serverList);
  const local = normalizeTodos(localList);
  const byKey = new Map();
  const keyless = [];
  const keyOf = (t) => (t.step_key ? `k:${t.step_key}` : t.id != null ? `i:${t.id}` : null);
  for (const t of server) {
    const k = keyOf(t);
    if (k) byKey.set(k, t);
    else keyless.push(t);
  }
  for (const t of local) {
    const k = keyOf(t);
    if (!k) { keyless.push(t); continue; }
    if (!byKey.has(k)) byKey.set(k, t); // server wins on conflict
  }
  return [...byKey.values(), ...keyless];
}

const CADENCE_RANK = { today: 0, week: 1, month: 2 };

// Deterministic ordering: (1) cadence today→week→month, (2) sort_order,
// (3) stable tiebreak on id / step_key.
export function sortTodosDeterministic(todos = []) {
  return [...(todos || [])].sort((a, b) => {
    const ra = CADENCE_RANK[cadenceForTodo(a)] ?? 1;
    const rb = CADENCE_RANK[cadenceForTodo(b)] ?? 1;
    if (ra !== rb) return ra - rb;
    const sa = Number(a?.sort_order ?? 0) || 0;
    const sb = Number(b?.sort_order ?? 0) || 0;
    if (sa !== sb) return sa - sb;
    const ka = String(a?.id ?? a?.step_key ?? '');
    const kb = String(b?.id ?? b?.step_key ?? '');
    return ka.localeCompare(kb);
  });
}

// The first unfinished To-do that belongs to an accepted journey (guided or
// personalized), in deterministic order. Completed rows are ignored. Used by the
// Dashboard "Your Next Step" resolver (contract priority 3).
export function firstUnfinishedJourneyTodo(todos = []) {
  const unfinished = sortTodosDeterministic(
    normalizeTodos(todos).filter((t) => !t.done),
  );
  // Prefer rows explicitly tied to a journey; fall back to any unfinished row so
  // a guided-journey row without a journey_type tag is still honored.
  return unfinished.find((t) => t.journey_type) || unfinished[0] || null;
}

export default {
  normalizeTodo,
  normalizeTodos,
  mergeTodos,
  sortTodosDeterministic,
  firstUnfinishedJourneyTodo,
};

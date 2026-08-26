/**
 * NODE K1.4.1 §B/§C — Device-local personalized To-dos (pure, testable).
 *
 * The personalized-journey seed endpoint (POST /journey/todos/seed-plan) is not
 * yet deployed on the shared backend (it answers 404). Rather than show a red
 * failure for an OPTIONAL sync, an approved personalized journey is turned into
 * real, actionable To-dos stored in a USER-SCOPED device-local store and rendered
 * through the SAME Growth To-do pipeline as server rows. They are labeled
 * truthfully as "Saved on this device" and are NEVER presented as server-synced.
 *
 * Namespacing: the storage key is scoped by the authenticated user id, and every
 * stored row also records `ownerUserId`, so one account can NEVER see another
 * account's To-dos on a shared browser (defense-in-depth on read).
 *
 * No PHI: rows are built from generic self-care template prose (never member
 * answers or free text), so nothing member-identifying is written to the device.
 */

import { personalizedSeedSteps, personalizedStepAction, PERSONALIZED_JOURNEY_TYPE } from './personalizedSeed.js';

export { personalizedStepAction };

export const deviceTodosKey = (uid) => `solaris.deviceTodos.${uid}`;

// Read the device-local To-dos for a user. Defense-in-depth: only return rows
// whose recorded owner matches the current user id (drop any that don't).
export function loadDeviceTodos(uid, storage = safeStorage()) {
  if (!uid || !storage) return [];
  try {
    const raw = storage.getItem(deviceTodosKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) => t && (t.ownerUserId == null || String(t.ownerUserId) === String(uid)),
    );
  } catch {
    return [];
  }
}

export function saveDeviceTodos(uid, todos, storage = safeStorage()) {
  if (!uid || !storage) return todos || [];
  const stamped = (todos || []).map((t) => ({ ...t, ownerUserId: uid }));
  try {
    storage.setItem(deviceTodosKey(uid), JSON.stringify(stamped));
  } catch {
    /* storage unavailable — degrade to in-memory only */
  }
  return stamped;
}

// Flip the `done` flag on one device-local To-do (by id) and persist. Returns
// the updated list so callers can set state from the same value that was saved.
export function toggleDeviceTodo(uid, id, storage = safeStorage()) {
  const list = loadDeviceTodos(uid, storage);
  const next = list.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  return saveDeviceTodos(uid, next, storage);
}

/**
 * Turn an approved personalized-journey block into device-local To-do rows.
 * Reuses `personalizedSeedSteps` for the cadence/step_key transform, then adds
 * the full set of fields the Growth pipeline + device store require.
 */
export function buildLocalTodosFromJourney(block = {}, uid = null) {
  const base = personalizedSeedSteps(block);
  return base.map((s, i) => {
    const act = personalizedStepAction(s.title);
    return {
      id: `device_${s.step_key}`,
      step_key: s.step_key,
      title: s.title,
      detail: '',
      dimension: s.dimension ?? null,
      cadence: s.cadence,
      sort_order: i,
      done: false,
      kind: act.kind,
      action_type: act.action_type,
      action_target: act.action_target,
      journey_type: PERSONALIZED_JOURNEY_TYPE,
      source: 'device',
      synced: false,
      ownerUserId: uid,
    };
  });
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export default {
  deviceTodosKey,
  loadDeviceTodos,
  saveDeviceTodos,
  toggleDeviceTodo,
  personalizedStepAction,
  buildLocalTodosFromJourney,
};

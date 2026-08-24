// alternateProvider.js — Node K1 §A2
//
// Pure helper for the Dashboard curated provider card's "Find alternate" control.
// Framework-agnostic so it can be unit-tested table-driven.
//
// Rules (contract §A2):
//   • Surface a DIFFERENT provider when at least two eligible providers exist.
//   • Exclude the currently displayed provider, recently dismissed candidates,
//     and providers the member has already booked — when another suitable
//     option exists.
//   • Do not repeat until the eligible set is exhausted (cycle through all
//     eligible before showing one again).
//   • Preserve the current recommendation when nothing eligible remains
//     (caller keeps the current card on load/error).

// Normalise an id to a comparable string.
function idOf(p) {
  if (p == null) return null;
  const v = p.providerId ?? p.id;
  return v == null ? null : String(v);
}

/**
 * eligibleProviders(pool, { currentId, dismissed, booked })
 * Returns providers that are approved and not the current / dismissed / booked one.
 */
export function eligibleProviders(pool = [], { currentId = null, dismissed, booked } = {}) {
  const dis = dismissed instanceof Set ? dismissed : new Set(dismissed || []);
  const bkd = booked instanceof Set ? booked : new Set(booked || []);
  const cur = currentId == null ? null : String(currentId);
  return (pool || []).filter((p) => {
    if (!p) return false;
    if (p.approved === false) return false;
    const id = idOf(p);
    if (id == null) return false;
    if (cur != null && id === cur) return false;
    if (dis.has(id)) return false;
    if (bkd.has(id)) return false;
    return true;
  });
}

/**
 * pickAlternate({ pool, currentId, dismissed, booked, used })
 *
 * Returns { provider, used } where:
 *   • provider is the next eligible provider (or null to preserve current);
 *   • used is the updated set of provider ids shown in the current cycle.
 *
 * `used` tracks which alternates have already been shown so we don't repeat
 * until the eligible set is exhausted; when every eligible id has been used the
 * cycle resets.
 */
export function pickAlternate({ pool = [], currentId = null, dismissed, booked, used } = {}) {
  const eligible = eligibleProviders(pool, { currentId, dismissed, booked });
  if (!eligible.length) return { provider: null, used: used instanceof Set ? used : new Set(used || []) };

  let usedSet = used instanceof Set ? new Set(used) : new Set(used || []);
  // Candidates not yet shown this cycle.
  let fresh = eligible.filter((p) => !usedSet.has(idOf(p)));
  if (!fresh.length) {
    // Eligible set exhausted — reset the cycle and allow repeats.
    usedSet = new Set();
    fresh = eligible;
  }
  const provider = fresh[0];
  usedSet.add(idOf(provider));
  return { provider, used: usedSet };
}

export { idOf as _idOf };
export default pickAlternate;

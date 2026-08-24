// Node K1.3 §Phase 3 — Exact Curated Journey provider deep link.
//
// The brown/gold "Curated Journey for You" card's primary action must open the
// EXACT recommended provider profile (ProviderDetailModal in Explore List mode)
// rather than the generic Explore list. This helper computes the navigation
// intent that the card dispatches through the shared `solaris:navigate`
// contract, so the decision is unit-testable without mounting the 7k-line
// signed-in shell.
//
// Contract consumed by LucaPassport's `onNav` handler + ExploreMarketplace:
//   { tab: 'explore', providerId }  -> setPendingProviderId(id) -> setOpenId(id)
//                                       -> ProviderDetailModal for that id.
//   { tab: 'explore' }              -> generic Explore list (fallback journey,
//                                       no concrete provider yet).
//
// When the provider later proves unavailable, ProviderDetailModal surfaces its
// own neutral error and the dashboard's "Find alternate" remains available — we
// never silently substitute a different listing here.

/**
 * @param {{providerId?: (string|number|null)}|null|undefined} displayProvider
 *   the resolved curated provider (altProvider || curatedJourney provider).
 * @returns {{tab: 'explore', providerId?: (string|number)}}
 */
export function curatedNavIntent(displayProvider) {
  if (displayProvider && displayProvider.providerId != null) {
    return { tab: 'explore', providerId: displayProvider.providerId };
  }
  return { tab: 'explore' };
}

export default curatedNavIntent;

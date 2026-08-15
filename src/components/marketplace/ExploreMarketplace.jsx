/**
 * ExploreMarketplace — the marketplace home (Explore tab).
 * Yelp/Airbnb-style split view: a scrollable results list on the left and a
 * live Leaflet map on the right, driven by a shared filter/search state.
 *
 * Props:
 *   user     current user
 *   onBecomeProvider  ()=>void  — optional CTA to open provider onboarding
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, MapPin, Map as MapIcon, List as ListIcon, Loader2, Store, Plus, X, Sprout, Sparkles, RefreshCw, ArrowRight, Compass, Clock, Headphones, Stethoscope, Heart, Brain, Activity, BookOpen, CheckCircle2, Footprints, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { useApp } from '../../state/AppContext.jsx';
import MapView from './MapView.jsx';
import SearchFilters from './SearchFilters.jsx';
import ProviderListingCard from './ProviderListingCard.jsx';
import ProviderDetailModal from './ProviderDetailModal.jsx';
import { PROVIDER_TYPES } from './ProviderBadges.jsx';
import AdaptiveOverlay from '../ui/AdaptiveOverlay.jsx';
import BookingFlow from '../booking/BookingFlow.jsx';

// Mobile breakpoint (matches the app shell's 900px). Kept in a hook so the
// Explore layout can switch to the map + draggable results sheet on phones and
// tablet-portrait without touching the desktop split view.
function useIsMobile(bp = 900) {
  const q = `(max-width:${bp}px)`;
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(q);
    const h = (e) => setM(e.matches);
    setM(mq.matches);
    try { mq.addEventListener('change', h); } catch { mq.addListener(h); }
    return () => { try { mq.removeEventListener('change', h); } catch { mq.removeListener(h); } };
  }, [q]);
  return m;
}

// Horizontally scrollable quick filters — every chip maps to a REAL filter
// field (rating / modality / verified / value-to-value / language / provider
// type). No invented attributes.
function QuickFilters({ filters, patch, presentTypes, languageOptions }) {
  const modality = filters.modality;
  const chip = (active, label, onClick, key) => (
    <button key={key} type="button" className={`exm-qf${active ? ' on' : ''}`} aria-pressed={active} onClick={onClick}>{label}</button>
  );
  const toggleArr = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  return (
    <div className="exm-qf-row" role="group" aria-label="Quick filters">
      {chip(filters.minRating >= 4.5, 'Top rated', () => patch({ minRating: filters.minRating >= 4.5 ? 0 : 4.5 }), 'rt')}
      {chip(modality === 'virtual', 'Virtual', () => patch({ modality: modality === 'virtual' ? '' : 'virtual' }), 'v')}
      {chip(modality === 'in_person', 'In person', () => patch({ modality: modality === 'in_person' ? '' : 'in_person' }), 'ip')}
      {chip(filters.verified, 'Verified', () => patch({ verified: !filters.verified }), 'vf')}
      {chip(filters.vtv, 'Value-to-value', () => patch({ vtv: !filters.vtv }), 'vtv')}
      {languageOptions.slice(0, 4).map((l) => chip(filters.languages.includes(l), l, () => patch({ languages: toggleArr(filters.languages, l) }), `l-${l}`))}
      {presentTypes.map((t) => chip(filters.types.includes(t.id), t.label, () => patch({ types: toggleArr(filters.types, t.id) }), `t-${t.id}`))}
    </div>
  );
}

// Isolates Leaflet/tile failures so a map crash never takes down the usable
// results list. On error it renders a compact fallback with a "browse the list"
// action; the list beside/under it keeps working normally.
class MapErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { try { console.warn('Map failed to render; falling back to list.', err); } catch { /* noop */ } }
  render() {
    if (this.state.failed) {
      return (
        <div className="em-map-fallback" role="status">
          <MapIcon size={28} strokeWidth={1.5} />
          <p className="em-map-fallback-title">Map unavailable</p>
          <p className="em-map-fallback-sub">The map couldn’t load right now. You can still browse every result in the list.</p>
          {this.props.onSwitchToList && (
            <button type="button" className="em-map-fallback-btn" onClick={this.props.onSwitchToList}>
              <ListIcon size={16} /> Browse the list
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_FILTERS = {
  types: [], minRating: 0, vtv: false, verified: false, price: [], radius: 25, sort: 'rating',
  city: '', languages: [], modality: '', availability: 'any',
};

// Non-schema attributes (languages / modality / availability days / licensed)
// are stored by the InvestorDemoV1 seed in provider_profiles.hours_of_operation
// under a { meta:{…} } key. Read them defensively (jsonb may arrive parsed or
// as a string) — absent meta simply means the provider opts out of these filters.
function providerMeta(p) {
  let obj = p?.hours_of_operation;
  if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { obj = null; } }
  return (obj && typeof obj === 'object' && obj.meta) ? obj.meta : {};
}

// Step-kind → icon + human label, used in the plan preview.
const STEP_KIND = {
  checkin:      { icon: CheckCircle2, label: 'Daily check-in' },
  habit:        { icon: Sparkles,     label: 'Habit' },
  audio:        { icon: Headphones,   label: 'Guided audio' },
  activity:     { icon: Footprints,   label: 'Activity' },
  reflection:   { icon: BookOpen,     label: 'Reflection' },
  practitioner: { icon: Stethoscope,  label: 'Practitioner' },
  navigate:     { icon: ArrowRight,   label: 'Explore' },
};
// Growth dimension → colour (mirrors the Journal hub).
const DIM_COLOR = { mind: '#5B77C9', body: '#2DB584', heart: '#E07A9B', spirit: '#C79A3A' };

export default function ExploreMarketplace({ user, onBecomeProvider }) {
  const { exploreFilter, setExploreFilter, setTab, pendingProviderId, setPendingProviderId, pendingCurate, setPendingCurate } = useApp() || {};

  // ── Guided journeys ──
  const [blueprints, setBlueprints] = useState([]);
  const [previewType, setPreviewType] = useState(null); // journey type to preview in modal
  const [startingJourney, setStartingJourney] = useState('');

  useEffect(() => {
    api.getJourneyBlueprints().then((d) => setBlueprints(d?.blueprints || [])).catch(() => {});
  }, []);

  const beginJourney = useCallback(async (journeyType) => {
    if (startingJourney) return;
    setStartingJourney(journeyType);
    try {
      const r = await api.startJourney(journeyType);
      const seeded = r?.seeded || {};
      const nTodos = seeded.todos || 0;
      toast.success(
        nTodos
          ? `Your plan is ready — ${nTodos} steps added to your Journal.`
          : 'Your journey is ready in your Journal.',
        { duration: 4000 }
      );
      setPreviewType(null);
      // The Journal tab is the personal-growth hub where the seeded plan lives.
      // The app shell's visible tab is local state, so broadcast a navigation event.
      window.dispatchEvent(new CustomEvent('solaris:navigate', { detail: { tab: 'journal' } }));
      setTab?.('journal');
    } catch (e) {
      toast.error(e?.message || 'Could not start that journey — try again shortly.');
    } finally {
      setStartingJourney('');
    }
  }, [startingJourney, setTab]);
  const [filters, setFilters] = useState(() => (
    exploreFilter ? { ...DEFAULT_FILTERS, types: [exploreFilter] } : DEFAULT_FILTERS
  ));

  // Consume a pending exploreFilter coming from another page (e.g. "Book more tests").
  useEffect(() => {
    if (!exploreFilter) return;
    setFilters((f) => (f.types.includes(exploreFilter) ? f : { ...f, types: [...f.types, exploreFilter] }));
    setExploreFilter?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreFilter]);

  // Deep-link: another surface (LUCA chip, guided-journey task, recommendation)
  // asked us to open a specific practitioner's profile.
  useEffect(() => {
    if (!pendingProviderId) return;
    setOpenId(pendingProviderId);
    setPendingProviderId?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProviderId]);

  // ── LUCA "Curate for me" recommendations rail ──
  const [curated, setCurated] = useState(null);   // { nextStep, curatedJourney }
  const [curating, setCurating] = useState(false);
  const [curateOpen, setCurateOpen] = useState(false);

  const curateForMe = useCallback(async (refresh = false) => {
    setCurating(true); setCurateOpen(true);
    try {
      const r = await api.getLucaRecommendations({ refresh });
      setCurated(r || null);
    } catch {
      setCurated(null);
    } finally { setCurating(false); }
  }, []);

  // Deep-link: a LUCA "curate" chip asked us to run Curate-for-me on arrival.
  useEffect(() => {
    if (!pendingCurate) return;
    setPendingCurate?.(false);
    curateForMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCurate]);

  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [bookingProviderId, setBookingProviderId] = useState(null); // open BookingFlow directly for this provider
  const [journeysOpen, setJourneysOpen] = useState(false);          // mobile "Guided journeys" bottom sheet (closed by default)
  const [mobileView, setMobileView] = useState('map'); // map | list (default map)
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef(null);
  const journeysScrollRef = useRef(0); // remembers list scroll while the Guided journeys sheet is open
  const isMobile = useIsMobile(900);

  // Keep the fixed mobile Explore stage docked just below the app's sticky
  // header (its height varies with safe-area / font scaling) — measured, never
  // hard-coded.
  useEffect(() => {
    if (!isMobile) return undefined;
    const set = () => {
      const tb = document.querySelector('.topbar');
      const h = tb ? Math.round(tb.getBoundingClientRect().height) : 54;
      document.documentElement.style.setProperty('--exm-top', `${h}px`);
    };
    set();
    // On mobile the Explore stage is a full-bleed opaque fixed surface with its
    // OWN in-flow header (title + description below). Flag the .luca root so the
    // shared PageHead (which carries the Member badge) is hidden underneath —
    // that keeps the Member badge out of the Explore content on mobile without
    // touching the shared navigation component.
    const root = document.querySelector('.luca');
    if (root) root.classList.add('exm-mobile-active');
    window.addEventListener('resize', set);
    window.addEventListener('orientationchange', set);
    return () => {
      window.removeEventListener('resize', set);
      window.removeEventListener('orientationchange', set);
      if (root) root.classList.remove('exm-mobile-active');
    };
  }, [isMobile]);

  // debounce search text
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // load categories once
  useEffect(() => {
    api.getMarketplaceCategories().then((d) => setCategories(d.categories || [])).catch(() => {});
  }, []);

  // regenerative treasury balance — every booking here seeds the commons
  const [treasury, setTreasury] = useState(null);
  useEffect(() => {
    api.getGpsTreasury().then((d) => setTreasury(Number(d?.balance ?? d?.treasuryBalance ?? 0))).catch(() => {});
  }, []);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        q: debouncedQ || undefined,
        type: filters.types.length ? filters.types.join(',') : undefined,
        minRating: filters.minRating || undefined,
        vtv: filters.vtv || undefined,
        verified: filters.verified || undefined,
        sort: filters.sort,
        limit: 100,
      };
      if (userLocation) {
        params.lat = userLocation.lat;
        params.lon = userLocation.lon;
        params.radius = filters.radius;
      }
      const d = await api.getProviders(params);
      // Keep the raw server-filtered set; price/city/language/modality/availability
      // are applied client-side (see visibleProviders) so they combine freely.
      setProviders(d.providers || []);
    } catch (e) {
      setProviders([]);
    } finally {
      setLoading(false);
    }
    // Note: price/city/language/modality/availability are NOT in the deps because
    // they are applied client-side; only server-side params trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters.types, filters.minRating, filters.vtv, filters.verified, filters.sort, userLocation, filters.radius]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // City/language dropdown options derived from the server-filtered set.
  const cityOptions = useMemo(
    () => Array.from(new Set(providers.map((p) => p.city).filter(Boolean))).sort(),
    [providers]
  );
  const languageOptions = useMemo(() => {
    const set = new Set();
    for (const p of providers) for (const l of (providerMeta(p).languages || [])) set.add(l);
    return Array.from(set).sort();
  }, [providers]);

  // Client-side combined filters: price, location (city), language, modality
  // (virtual/in-person, hybrid counts for both), and near-term availability.
  const visibleProviders = useMemo(() => {
    let rows = providers;
    if (filters.price.length) rows = rows.filter((p) => p.price_range && filters.price.includes(p.price_range));
    if (filters.city) rows = rows.filter((p) => p.city === filters.city);
    if (filters.languages.length) {
      rows = rows.filter((p) => {
        const langs = providerMeta(p).languages || [];
        return filters.languages.some((l) => langs.includes(l));
      });
    }
    if (filters.modality) {
      rows = rows.filter((p) => {
        const m = providerMeta(p).modality;
        return m === filters.modality || m === 'hybrid';
      });
    }
    if (filters.availability && filters.availability !== 'any') {
      rows = rows.filter((p) => {
        const days = providerMeta(p).days || [];
        if (filters.availability === 'weekday') return days.some((d) => d >= 1 && d <= 5);
        if (filters.availability === 'weekend') return days.some((d) => d === 0 || d === 6);
        return true;
      });
    }
    return rows;
  }, [providers, filters]);

  const patch = (p) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => { setFilters(DEFAULT_FILTERS); setQuery(''); };

  const onSelect = (p) => {
    setActiveId(p.id);
    // scroll the matching card into view
    const el = listRef.current?.querySelector(`[data-pid="${p.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Listing-card select: always select + centre its marker (via activeId). On
  // desktop it also opens the full detail modal (unchanged behaviour); on mobile
  // it opens the provider detail directly (the list-card tap is the primary
  // "book" action there — a separate "Show on map" control handles map sync).
  const handleCardOpen = (pr) => {
    setActiveId(pr.id);
    setOpenId(pr.id);
    const el = listRef.current?.querySelector(`[data-pid="${pr.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Select a provider and reveal it on the map (used by the mobile list's
  // "Show on map" action) — keeps marker/list selection in sync.
  const showOnMap = (pr) => {
    setActiveId(pr.id);
    setMobileView('map');
  };

  // Provider types actually present in the current result set — used for the
  // mobile quick-filter chips so we never offer a category with no listings.
  const presentTypes = useMemo(() => {
    const s = new Set(providers.map((p) => p.provider_type).filter(Boolean));
    return PROVIDER_TYPES.filter((t) => s.has(t.id));
  }, [providers]);

  const hasLocation = !!userLocation;
  const activeFilterCount =
    filters.types.length + filters.price.length + filters.languages.length +
    (filters.minRating ? 1 : 0) + (filters.vtv ? 1 : 0) + (filters.verified ? 1 : 0) +
    (filters.city ? 1 : 0) + (filters.modality ? 1 : 0) +
    (filters.availability && filters.availability !== 'any' ? 1 : 0);

  // Shared results list (used by both the desktop column and the mobile sheet).
  const resultsBody = loading ? (
    <div className="exm-loading"><Loader2 className="exm-spin" size={26} /> Finding providers…</div>
  ) : visibleProviders.length === 0 ? (
    <div className="exm-empty">
      <Store size={34} />
      <h4>No providers match your filters</h4>
      <p>Try widening your search or resetting the filters — or begin a guided journey below.</p>
      <button className="exm-resetbtn" onClick={reset}>Reset filters</button>
      <JourneyOffers offers={blueprints} starting={startingJourney} onBegin={beginJourney} onPreview={setPreviewType} compact />
    </div>
  ) : (
    <div className="exm-cards">
      {visibleProviders.map((p) => (
        <div key={p.id} data-pid={p.id}>
          <ProviderListingCard
            provider={p}
            onOpen={handleCardOpen}
            onHover={setHoverId}
            active={hoverId === p.id || activeId === p.id}
          />
        </div>
      ))}
    </div>
  );

  // Shared map panel with marker↔list sync (compact card + open-detail wiring).
  // Mobile has no genuine hover — Leaflet still emits marker mouseover on
  // touch/pan, so the anchored preview must track ONLY activeId (else a stale
  // hoverId keeps it open after the X clears activeId).
  const mapPanel = (
    <MapErrorBoundary onSwitchToList={() => { setMobileView('list'); }}>
      <MapView
        providers={visibleProviders}
        activeId={isMobile ? activeId : (activeId || hoverId)}
        onSelect={onSelect}
        onHover={isMobile ? undefined : setHoverId}
        userLocation={userLocation}
        onLocate={(loc) => setUserLocation(loc)}
        radiusKm={hasLocation ? filters.radius : null}
        onOpenDetail={(pr) => setOpenId(pr.id)}
        onBook={(pr) => setBookingProviderId(pr.id)}
        onClearActive={() => { setActiveId(null); setHoverId(null); }}
        anchored={isMobile}
      />
    </MapErrorBoundary>
  );

  // Accessible full-height mobile filter sheet (real fields only) built on the
  // shared adaptive overlay: focus trap, Escape/visible close, sticky footer
  // with Clear + Apply (current result count), internal scroll.
  const filterSheet = (
    <AdaptiveOverlay
      open={showFilters}
      onClose={() => setShowFilters(false)}
      title="Filters"
      ariaLabel="Filter providers"
      size="lg"
      closeLabel="Close filters"
      footer={(
        <div className="exm-fs-foot">
          <button type="button" className="exm-fs-clear" onClick={reset}>Clear all</button>
          <button type="button" className="exm-fs-apply" onClick={() => setShowFilters(false)}>
            Show {visibleProviders.length} result{visibleProviders.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    >
      <SearchFilters
        filters={filters}
        onChange={patch}
        categories={categories}
        hasLocation={hasLocation}
        onReset={reset}
        resultCount={visibleProviders.length}
        cityOptions={cityOptions}
        languageOptions={languageOptions}
      />
    </AdaptiveOverlay>
  );

  const detailAndPreview = (
    <>
      {openId && (
        <ProviderDetailModal
          providerId={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onUpdated={fetchProviders}
        />
      )}
      {previewType && (
        <JourneyPreviewModal
          plan={blueprints.find((b) => b.type === previewType)}
          starting={startingJourney}
          onBegin={beginJourney}
          onClose={() => setPreviewType(null)}
        />
      )}
      {bookingProviderId && (
        <BookingFlow
          providerId={bookingProviderId}
          user={user}
          onClose={() => setBookingProviderId(null)}
          onBooked={() => { fetchProviders(); }}
        />
      )}
    </>
  );

  // ── Mobile: explicit Map | List switch + quick filters (no draggable sheet) ──
  // The full-bleed stage is `position:fixed`, but the shell wraps every page in
  // `.page`, which runs a lucafade keyframe that touches `transform` — a
  // transformed ancestor becomes the containing block for fixed descendants and
  // traps/compresses the stage. We portal the whole mobile surface OUT of `.page`
  // to the `.luca` app root (no transform/filter/containment there), so the fixed
  // stage resolves against the real viewport. We stay inside `.luca` so the
  // `.luca .exm-*` scoped styles still apply. Falls back to <body> in tests where
  // no `.luca` root is mounted.
  //
  // Map state: the map fills the stage between the controls and the fixed bottom
  // nav; selecting a marker opens MapView's compact provider card over the map.
  // List state: a single scrollable column of full-width provider cards, each
  // with a "Show on map" action that selects the provider and flips to the map.
  // Search + filters apply identically to both and are preserved across the
  // switch (shared `query` / `filters` / `visibleProviders`).
  if (isMobile) {
    const portalTarget = typeof document !== 'undefined'
      ? (document.querySelector('.luca') || document.body)
      : null;
    const countLabel = loading
      ? 'Finding providers…'
      : `${visibleProviders.length} provider${visibleProviders.length === 1 ? '' : 's'}`;

    // "Recommend for me" — surfaces LUCA's recommendation as a bottom sheet whose
    // primary action opens the EXACT recommended practitioner (deep-link by id).
    const openRecommendedProvider = () => {
      const pid = curated?.curatedJourney?.providerId;
      if (pid) {
        // Select AND reveal the exact recommended provider on the map (its marker
        // becomes active + its anchored preview shows), then open its full detail —
        // not a mere navigate/search.
        setActiveId(pid);
        setMobileView('map');
        setOpenId(pid);
      } else {
        const q = curated?.curatedJourney?.specialty || curated?.curatedJourney?.title || '';
        if (q) setQuery(q);
      }
      setCurateOpen(false);
    };
    const recommendSheet = (
      <AdaptiveOverlay
        open={curateOpen}
        onClose={() => setCurateOpen(false)}
        title="Recommended for you"
        ariaLabel="LUCA recommendations"
        size="md"
        closeLabel="Close recommendations"
        footer={curated?.curatedJourney ? (
          <button type="button" className="exm-cc-btn" style={{ width: '100%' }} onClick={openRecommendedProvider}>
            {curated.curatedJourney.providerId ? 'View this provider' : 'Explore related'} <ArrowRight size={15} />
          </button>
        ) : null}
      >
        {curating && !curated ? (
          <div className="exm-curated-loading"><Loader2 size={20} className="exm-spin" /> LUCA is curating your next steps…</div>
        ) : (
          <div className="exm-mrec-cards">
            {curated?.nextStep && (
              <div className="exm-cc">
                <span className="exm-cc-tag next">Your next step</span>
                <h5>{curated.nextStep.title}</h5>
                <p>{curated.nextStep.description}</p>
                {curated.nextStep.action && <div className="exm-cc-why">{curated.nextStep.action}</div>}
              </div>
            )}
            {curated?.curatedJourney && (
              <div className="exm-cc journey">
                <span className="exm-cc-tag journey">Recommended provider</span>
                <h5>{curated.curatedJourney.title}</h5>
                <p>{[curated.curatedJourney.specialty, curated.curatedJourney.city].filter(Boolean).join(' · ')}</p>
                {curated.curatedJourney.reason && <div className="exm-cc-why">{curated.curatedJourney.reason}</div>}
              </div>
            )}
            {!curating && !curated?.nextStep && !curated?.curatedJourney && (
              <div className="exm-curated-loading">LUCA couldn’t recommend anything right now. Please try again shortly.</div>
            )}
          </div>
        )}
      </AdaptiveOverlay>
    );

    // Guided journeys — opened from the guidance button as a mobile bottom sheet
    // (AdaptiveOverlay). One-column journey cards from the existing blueprint data
    // (no duplicated fixtures / no new API). Closing returns to the previous
    // Map/List state and list scroll position, both captured on open.
    const openGuidedJourneys = () => {
      journeysScrollRef.current = listRef.current ? listRef.current.scrollTop : 0;
      setJourneysOpen(true);
    };
    const closeGuidedJourneys = () => {
      setJourneysOpen(false);
      // The mobile surface stays mounted beneath the sheet, so restoring the list
      // scroll on the next frame lands us exactly where we were.
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop = journeysScrollRef.current;
      });
    };
    const guidedJourneysSheet = (
      <AdaptiveOverlay
        open={journeysOpen}
        onClose={closeGuidedJourneys}
        title="Guided journeys"
        ariaLabel="Guided journeys"
        size="md"
        closeLabel="Close guided journeys"
      >
        {blueprints.length > 0 ? (
          <div className="exm-gjs">
            <JourneyOffers
              offers={blueprints}
              starting={startingJourney}
              // Selecting a journey uses the existing flows. The plan preview and
              // begin overlays sit below this sheet's z-index, so close the sheet
              // first, then hand off to the existing journey flow.
              onBegin={(t) => { setJourneysOpen(false); beginJourney(t); }}
              onPreview={(t) => { setJourneysOpen(false); setPreviewType(t); }}
              compact
              hideHead
            />
          </div>
        ) : (
          <div className="exm-curated-loading">No guided journeys are available right now.</div>
        )}
      </AdaptiveOverlay>
    );

    const mobileTree = (
      <div className="exm exm-mobile">
        <div className="exm-m" role="region" aria-label="Explore providers">
          {/* Heading + description kept for assistive tech only — the big visible
              heading/description are intentionally omitted on mobile so results
              own the screen. Desktop still renders the visible header. */}
          <h1 className="exm-sr">Explore</h1>
          <p className="exm-sr">Discover trusted health &amp; wellness providers near you — clinics, farms, healers, and more.</p>
          <div className="exm-mbar">
            <div className="exm-search">
              <Search size={18} />
              <input
                placeholder="Search clinics, doctors, farms…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search providers"
              />
              {query && <button className="exm-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
            </div>
            <button className="exm-mfilter" onClick={() => setShowFilters(true)} aria-label={`Filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} aria-haspopup="dialog">
              <SlidersHorizontal size={18} />
              {activeFilterCount > 0 && <span className="exm-fcount">{activeFilterCount}</span>}
            </button>
          </div>
          <QuickFilters filters={filters} patch={patch} presentTypes={presentTypes} languageOptions={languageOptions} />
          {/* Two equal guidance actions: LUCA recommendation + guided journeys. */}
          <div className="exm-mguide">
            <button type="button" className="exm-mgbtn" onClick={() => curateForMe(false)} disabled={curating} aria-haspopup="dialog">
              {curating ? <Loader2 size={16} className="exm-spin" /> : <Sparkles size={16} />}
              Recommend
            </button>
            <button type="button" className="exm-mgbtn" onClick={openGuidedJourneys} aria-haspopup="dialog">
              <Compass size={16} />
              Guided journeys
            </button>
          </div>
          {/* Compact Map/List selector sharing its row with the result count. */}
          <div className="exm-mtools">
            <span className="exm-mcount" aria-live="polite">{countLabel}</span>
            <div className="exm-mseg" role="group" aria-label="Choose map or list view">
              <button
                type="button"
                className={`exm-seg${mobileView === 'map' ? ' on' : ''}`}
                aria-pressed={mobileView === 'map'}
                onClick={() => setMobileView('map')}
              >
                <MapIcon size={15} /> Map
              </button>
              <button
                type="button"
                className={`exm-seg${mobileView === 'list' ? ' on' : ''}`}
                aria-pressed={mobileView === 'list'}
                onClick={() => setMobileView('list')}
              >
                <ListIcon size={15} /> List
              </button>
            </div>
          </div>
          <div className="exm-mstage">
            {mobileView === 'map' ? (
              <div className="exm-mmap">{mapPanel}</div>
            ) : (
              <div className="exm-mlist" ref={listRef}>
                {loading ? (
                  <div className="exm-loading"><Loader2 className="exm-spin" size={26} /> Finding providers…</div>
                ) : visibleProviders.length === 0 ? (
                  <div className="exm-empty">
                    <Store size={34} />
                    <h4>No providers match your filters</h4>
                    <p>Try widening your search or resetting the filters — or open Guided journeys above.</p>
                    <button className="exm-resetbtn" onClick={reset}>Reset filters</button>
                  </div>
                ) : (
                  <div className="exm-cards">
                    {visibleProviders.map((p) => (
                      <div key={p.id} data-pid={p.id} className="exm-mlist-item">
                        <ProviderListingCard
                          provider={p}
                          onOpen={handleCardOpen}
                          onHover={setHoverId}
                          active={hoverId === p.id || activeId === p.id}
                        />
                        <button type="button" className="exm-showmap" onClick={() => showOnMap(p)}>
                          <MapPin size={14} /> Show on map
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {filterSheet}
        {recommendSheet}
        {guidedJourneysSheet}
        {detailAndPreview}
        <style>{CSS}</style>
      </div>
    );
    return portalTarget ? createPortal(mobileTree, portalTarget) : mobileTree;
  }

  // ── Desktop / large-tablet: the classic split view (unchanged) ──
  return (
    <div className="exm">
      {/* Top bar */}
      <div className="exm-bar">
        <div className="exm-search">
          <Search size={18} />
          <input
            placeholder="Search clinics, doctors, farms, wellness…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && <button className="exm-clear" onClick={() => setQuery('')}><X size={15} /></button>}
        </div>
        <button className="exm-filterbtn" onClick={() => setShowFilters((s) => !s)}>
          Filters{activeFilterCount > 0 && <span className="exm-fcount">{activeFilterCount}</span>}
        </button>
        <button className="exm-curate" onClick={() => curateForMe(false)} disabled={curating}>
          {curating ? <Loader2 size={15} className="exm-spin" /> : <Sparkles size={15} />}
          Curate for me
        </button>
        {treasury != null && treasury > 0 && (
          <div className="exm-treasury" title="Every booking seeds our regenerative Community Treasury">
            <Sprout size={15} /> <strong>${treasury.toFixed(2)}</strong>
            <span>in Community Treasury</span>
          </div>
        )}
        {onBecomeProvider && (
          <button className="exm-cta" onClick={onBecomeProvider}>
            <Plus size={16} /> List your practice
          </button>
        )}
      </div>

      {/* LUCA "Curate for me" rail */}
      {curateOpen && (
        <div className="exm-curated">
          <div className="exm-curated-head">
            <span className="exm-curated-title"><Sparkles size={16} /> Curated for you</span>
            <div className="exm-curated-actions">
              <button className="exm-curated-refresh" onClick={() => curateForMe(true)} disabled={curating}>
                <RefreshCw size={13} className={curating ? 'exm-spin' : ''} /> Refresh
              </button>
              <button className="exm-curated-close" onClick={() => setCurateOpen(false)} aria-label="Close"><X size={15} /></button>
            </div>
          </div>
          {curating && !curated ? (
            <div className="exm-curated-loading"><Loader2 size={20} className="exm-spin" /> LUCA is curating your next steps…</div>
          ) : (
            <div className="exm-curated-cards">
              {curated?.nextStep && (
                <div className="exm-cc">
                  <span className="exm-cc-tag next">Your next step</span>
                  <h5>{curated.nextStep.title}</h5>
                  <p>{curated.nextStep.description}</p>
                  {curated.nextStep.action && <div className="exm-cc-why">{curated.nextStep.action}</div>}
                </div>
              )}
              {curated?.curatedJourney && (
                <div className="exm-cc journey">
                  <span className="exm-cc-tag journey">Curated journey</span>
                  <h5>{curated.curatedJourney.title}</h5>
                  <p>
                    {[curated.curatedJourney.specialty, curated.curatedJourney.city].filter(Boolean).join(' · ')}
                  </p>
                  {curated.curatedJourney.reason && <div className="exm-cc-why">{curated.curatedJourney.reason}</div>}
                  <button
                    className="exm-cc-btn"
                    onClick={() => {
                      // Deep-link straight to the recommended practitioner's profile
                      // (bookable), falling back to a marketplace search for legacy
                      // listing-based recommendations.
                      if (curated.curatedJourney.providerId) {
                        setOpenId(curated.curatedJourney.providerId);
                      } else {
                        const q = curated.curatedJourney.specialty || curated.curatedJourney.title || '';
                        setQuery(q);
                      }
                      setCurateOpen(false);
                    }}
                  >
                    {curated.curatedJourney.providerId ? 'View & book' : 'Explore related'} <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {!curated?.nextStep && !curated?.curatedJourney && (
                <div className="exm-curated-loading">LUCA couldn't curate right now. Try refreshing.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Guided journeys rail */}
      <JourneyOffers offers={blueprints} starting={startingJourney} onBegin={beginJourney} onPreview={setPreviewType} />

      <div className="exm-body">
        {/* Filter rail */}
        <div className={`exm-rail${showFilters ? ' open' : ''}`}>
          <SearchFilters
            filters={filters}
            onChange={patch}
            categories={categories}
            hasLocation={hasLocation}
            onReset={reset}
            resultCount={visibleProviders.length}
            cityOptions={cityOptions}
            languageOptions={languageOptions}
          />
        </div>

        {/* Results list */}
        <div className={`exm-list ${mobileView === 'list' ? 'mshow' : 'mhide'}`} ref={listRef}>
          {resultsBody}
        </div>

        {/* Map — wrapped so a tile/render failure never takes down the usable list */}
        <div className={`exm-map ${mobileView === 'map' ? 'mshow' : 'mhide'}`}>
          {mapPanel}
        </div>
      </div>

      {/* Mobile view toggle (large-tablet fallback) */}
      <button className="exm-mtoggle" onClick={() => setMobileView((v) => (v === 'list' ? 'map' : 'list'))}>
        {mobileView === 'list' ? <><MapIcon size={16} /> Map</> : <><ListIcon size={16} /> List</>}
      </button>

      {detailAndPreview}
      <style>{CSS}</style>
    </div>
  );
}

function JourneyOffers({ offers, starting, onBegin, onPreview, compact, hideHead }) {
  if (!offers || offers.length === 0) return null;
  return (
    <div className={`exm-journeys${compact ? ' compact' : ''}`}>
      {!hideHead && <div className="exm-journeys-head"><Compass size={16} /> Begin a guided journey</div>}
      {!hideHead && <p className="exm-journeys-sub">A complete, step-by-step program LUCA walks beside you — habits, guided audio, activities and a recommended practitioner, all waiting in your Journal.</p>}
      <div className="exm-journeys-grid">
        {offers.map((j) => {
          const kinds = [...new Set((j.steps || []).map((s) => s.kind))];
          return (
            <div key={j.type} className="exm-jc">
              <div className="exm-jc-meta">
                {j.weeks ? <span><Clock size={12} /> {j.weeks} wk{j.weeks > 1 ? 's' : ''}</span> : null}
                <span><Compass size={12} /> {j.stepCount || (j.steps || []).length} steps</span>
              </div>
              <h5>{j.label}</h5>
              <p>{j.tagline || j.overview}</p>
              <div className="exm-jc-kinds">
                {kinds.slice(0, 5).map((k) => {
                  const K = STEP_KIND[k];
                  if (!K) return null;
                  return <span key={k} className="exm-jc-kind" title={K.label}><K.icon size={12} /> {K.label}</span>;
                })}
              </div>
              <div className="exm-jc-actions">
                <button className="exm-jc-preview" disabled={!!starting} onClick={() => onPreview(j.type)}>
                  View plan
                </button>
                <button className="exm-jc-btn" disabled={!!starting} onClick={() => onBegin(j.type)}>
                  {starting === j.type ? <Loader2 size={14} className="exm-spin" /> : <Compass size={14} />}
                  Begin
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Full plan preview — every step of the journey before the member commits. */
function JourneyPreviewModal({ plan, starting, onBegin, onClose }) {
  if (!plan) return null;
  return (
    <div className="exm-jp-overlay" onClick={onClose}>
      <div className="exm-jp" onClick={(e) => e.stopPropagation()}>
        <button className="exm-jp-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="exm-jp-head">
          <div className="exm-jp-meta">
            {plan.weeks ? <span><Clock size={13} /> {plan.weeks} week{plan.weeks > 1 ? 's' : ''}</span> : null}
            <span><Compass size={13} /> {plan.stepCount || (plan.steps || []).length} steps</span>
          </div>
          <h3>{plan.label}</h3>
          <p className="exm-jp-overview">{plan.overview || plan.tagline}</p>
          {plan.focus?.label && (
            <div className="exm-jp-focus"><Stethoscope size={14} /> We'll connect you with {plan.focus.label}.</div>
          )}
        </div>

        {plan.habits?.length ? (
          <div className="exm-jp-section">
            <div className="exm-jp-label">Core daily habits</div>
            <div className="exm-jp-habits">
              {plan.habits.map((h, i) => (
                <span key={i} className="exm-jp-habit">{h.icon || '🌱'} {h.name}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="exm-jp-section">
          <div className="exm-jp-label">Your step-by-step plan</div>
          <div className="exm-jp-steps">
            {(plan.steps || []).map((s, i) => {
              const K = STEP_KIND[s.kind] || STEP_KIND.navigate;
              const color = DIM_COLOR[s.dimension] || 'var(--teal-d)';
              return (
                <div key={s.key || i} className="exm-jp-step">
                  <span className="exm-jp-step-ic" style={{ background: `${color}18`, color }}><K.icon size={15} /></span>
                  <div className="exm-jp-step-body">
                    <div className="exm-jp-step-top">
                      <strong>{s.title}</strong>
                      <span className="exm-jp-step-tag" style={{ color }}>{K.label}</span>
                    </div>
                    {s.detail && <p>{s.detail}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="exm-jp-foot">
          <button className="exm-jp-begin" disabled={!!starting} onClick={() => onBegin(plan.type)}>
            {starting === plan.type ? <Loader2 size={15} className="exm-spin" /> : <Compass size={15} />}
            Begin this journey
          </button>
          <span className="exm-jp-foot-note">Your plan and habits will be waiting in your Journal.</span>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.luca .exm{display:flex;flex-direction:column;min-height:calc(100vh - 132px)}
.luca .exm-journeys{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;
  margin-bottom:14px;box-shadow:var(--shadow-sm)}
.luca .exm-journeys.compact{box-shadow:none;background:transparent;border:none;padding:0;margin-top:18px;text-align:left;width:100%;max-width:640px}
.luca .exm-journeys-head{display:inline-flex;align-items:center;gap:8px;font-family:'Space Grotesk',sans-serif;
  font-weight:700;font-size:16px;color:var(--ink)}
.luca .exm-journeys-head svg{color:var(--teal-d)}
.luca .exm-journeys-sub{font-size:13px;color:var(--muted);margin:4px 0 12px;line-height:1.5}
.luca .exm-journeys-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:900px){.luca .exm-journeys-grid{grid-template-columns:1fr}}
.luca .exm-jc{border:1px solid var(--line);border-radius:14px;padding:14px 15px;background:var(--bg);display:flex;
  flex-direction:column;gap:6px}
.luca .exm-jc h5{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:var(--ink);margin:0}
.luca .exm-jc p{font-size:12.5px;color:var(--muted);margin:0;line-height:1.5;flex:1}
.luca .exm-jc-btn{align-self:flex-start;margin-top:8px;display:inline-flex;align-items:center;gap:7px;background:var(--teal-d);
  color:#fff;border:none;border-radius:10px;padding:9px 15px;font-weight:700;font-size:13px;cursor:pointer;
  font-family:inherit;transition:background .15s}
.luca .exm-jc-btn:hover{background:var(--teal-d2)}
.luca .exm-jc-btn:disabled{opacity:.6;cursor:default}
.luca .exm-jc-meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:2px}
.luca .exm-jc-meta span{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:var(--muted)}
.luca .exm-jc-meta svg{color:var(--teal-d)}
.luca .exm-jc-kinds{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 2px}
.luca .exm-jc-kind{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--mint-ink);
  background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:3px 9px}
.luca .exm-jc-kind svg{color:var(--teal-d)}
.luca .exm-jc-actions{display:flex;gap:8px;margin-top:10px}
.luca .exm-jc-preview{display:inline-flex;align-items:center;gap:6px;background:var(--surface);color:var(--ink);
  border:1px solid var(--line);border-radius:10px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;
  font-family:inherit;transition:border-color .15s}
.luca .exm-jc-preview:hover{border-color:var(--teal-d)}
.luca .exm-jc-preview:disabled{opacity:.6;cursor:default}
/* Journey plan-preview modal */
.luca .exm-jp-overlay{position:fixed;inset:0;z-index:4000;background:rgba(2,18,24,.5);display:flex;align-items:flex-start;
  justify-content:center;padding:40px 16px;overflow-y:auto;backdrop-filter:blur(2px)}
.luca .exm-jp{position:relative;width:100%;max-width:560px;background:var(--surface);border:1px solid var(--line);
  border-radius:18px;box-shadow:0 20px 60px rgba(2,18,24,.35);padding:26px 26px 22px}
.luca .exm-jp-close{position:absolute;top:16px;right:16px;border:none;background:var(--bg);cursor:pointer;color:var(--muted);
  display:grid;place-items:center;width:32px;height:32px;border-radius:9px}
.luca .exm-jp-close:hover{background:var(--mint-soft);color:var(--ink)}
.luca .exm-jp-meta{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:6px}
.luca .exm-jp-meta span{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:var(--muted)}
.luca .exm-jp-meta svg{color:var(--teal-d)}
.luca .exm-jp-head h3{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:var(--ink);margin:0 0 6px;padding-right:36px}
.luca .exm-jp-overview{font-size:13.5px;color:var(--muted);line-height:1.55;margin:0}
.luca .exm-jp-focus{display:inline-flex;align-items:center;gap:7px;margin-top:12px;font-size:12.5px;color:var(--mint-ink);
  background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:10px;padding:8px 12px}
.luca .exm-jp-focus svg{color:var(--teal-d);flex:none}
.luca .exm-jp-section{margin-top:20px}
.luca .exm-jp-label{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.luca .exm-jp-habits{display:flex;gap:7px;flex-wrap:wrap}
.luca .exm-jp-habit{font-size:12.5px;font-weight:600;color:var(--ink);background:var(--bg);border:1px solid var(--line);
  border-radius:999px;padding:6px 12px}
.luca .exm-jp-steps{display:flex;flex-direction:column;gap:12px}
.luca .exm-jp-step{display:flex;gap:12px;align-items:flex-start}
.luca .exm-jp-step-ic{flex:none;width:34px;height:34px;border-radius:10px;display:grid;place-items:center}
.luca .exm-jp-step-body{flex:1;min-width:0}
.luca .exm-jp-step-top{display:flex;align-items:baseline;gap:8px;justify-content:space-between}
.luca .exm-jp-step-top strong{font-size:14px;color:var(--ink);font-weight:700}
.luca .exm-jp-step-tag{font-size:10.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;flex:none}
.luca .exm-jp-step-body p{font-size:12.5px;color:var(--muted);line-height:1.5;margin:3px 0 0}
.luca .exm-jp-foot{margin-top:22px;padding-top:18px;border-top:1px solid var(--line);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.luca .exm-jp-begin{display:inline-flex;align-items:center;gap:8px;background:var(--teal-d);color:#fff;border:none;
  border-radius:12px;padding:12px 22px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:background .15s}
.luca .exm-jp-begin:hover{background:var(--teal-d2)}
.luca .exm-jp-begin:disabled{opacity:.6;cursor:default}
.luca .exm-jp-foot-note{font-size:12px;color:var(--muted);flex:1;min-width:160px}
.luca .exm-bar{display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
.luca .exm-search{flex:1;min-width:240px;display:flex;align-items:center;gap:9px;background:var(--surface);
  border:1px solid var(--line);border-radius:13px;padding:11px 15px;box-shadow:var(--shadow-sm);color:var(--muted)}
.luca .exm-search input{flex:1;border:none;outline:none;background:transparent;font-size:14px;color:var(--ink);font-family:inherit}
.luca .exm-clear{border:none;background:none;cursor:pointer;color:var(--muted);display:grid;place-items:center}
.luca .exm-filterbtn{display:none;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);
  border-radius:13px;padding:11px 16px;font-weight:600;font-size:14px;cursor:pointer;font-family:inherit;color:var(--ink)}
.luca .exm-fcount{background:var(--teal-d);color:#fff;border-radius:999px;font-size:11px;padding:1px 7px;font-weight:700}
.luca .exm-cta{display:inline-flex;align-items:center;gap:7px;background:var(--teal-d);color:#fff;border:none;
  border-radius:13px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;transition:background .15s}
.luca .exm-cta:hover{background:var(--teal-d2)}
.luca .exm-treasury{display:inline-flex;align-items:center;gap:6px;background:var(--mint-soft);
  border:1px solid var(--mint-line);color:var(--mint-ink);border-radius:999px;padding:8px 14px;
  font-size:13px;white-space:nowrap}
.luca .exm-treasury svg{color:var(--teal-d)}
.luca .exm-treasury strong{font-family:'IBM Plex Mono',monospace;color:var(--teal-d)}
.luca .exm-treasury span{color:var(--mint-ink)}
@media (max-width:720px){.luca .exm-treasury span{display:none}}
.luca .exm-body{flex:1;display:grid;grid-template-columns:262px 1fr 1fr;gap:16px;min-height:520px}
.luca .exm-rail{overflow-y:auto;padding-right:2px}
.luca .exm-list{overflow-y:auto;padding-right:4px}
.luca .exm-cards{display:flex;flex-direction:column;gap:12px;padding-bottom:10px}
.luca .exm-map{position:sticky;top:0;height:100%;min-height:0}
.luca .em-map-fallback{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  height:100%;min-height:280px;padding:30px;text-align:center;color:var(--muted);
  background:var(--surface,#f7f7f5);border-radius:16px}
.luca .em-map-fallback-title{font-family:'Space Grotesk',sans-serif;font-size:16px;color:var(--ink);margin:6px 0 0;font-weight:600}
.luca .em-map-fallback-sub{font-size:13px;max-width:280px;margin:0}
.luca .em-map-fallback-btn{display:inline-flex;align-items:center;gap:6px;margin-top:6px;padding:8px 14px;
  border:1px solid var(--line,#e2e2dd);border-radius:10px;background:#fff;color:var(--ink);font-size:13px;cursor:pointer}
.luca .em-map-fallback-btn:hover{background:var(--surface,#f2f2ef)}
.luca .exm-loading,.luca .exm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;height:100%;color:var(--muted);text-align:center;padding:30px}
.luca .exm-empty h4{font-family:'Space Grotesk',sans-serif;font-size:17px;color:var(--ink);margin:4px 0 0}
.luca .exm-empty p{font-size:13px;margin:0}
.luca .exm-resetbtn,.luca .exm-spin{margin-top:4px}
.luca .exm-resetbtn{background:var(--teal-d);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer;font-family:inherit}
.luca .exm-spin{animation:exmspin 1s linear infinite}
@keyframes exmspin{to{transform:rotate(360deg)}}
.luca .exm-curate{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,#b88a2e,#d9ab4a);
  color:#fff;border:none;border-radius:13px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;
  font-family:inherit;transition:filter .15s;box-shadow:0 2px 8px rgba(184,138,46,.28)}
.luca .exm-curate:hover{filter:brightness(1.06)}
.luca .exm-curate:disabled{opacity:.6;cursor:default}
.luca .exm-curated{background:var(--surface);border:1px solid var(--line);border-radius:16px;
  padding:16px 18px;margin-bottom:14px;box-shadow:var(--shadow-sm)}
.luca .exm-curated-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.luca .exm-curated-title{display:inline-flex;align-items:center;gap:8px;font-family:'Space Grotesk',sans-serif;
  font-weight:700;font-size:16px;color:var(--ink)}
.luca .exm-curated-title svg{color:#c79a3a}
.luca .exm-curated-actions{display:flex;align-items:center;gap:8px}
.luca .exm-curated-refresh{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);
  background:var(--surface);color:var(--muted);border-radius:10px;padding:7px 12px;font-size:13px;font-weight:600;
  cursor:pointer;font-family:inherit}
.luca .exm-curated-refresh:hover{color:var(--ink);border-color:var(--teal-d)}
.luca .exm-curated-refresh:disabled{opacity:.6;cursor:default}
.luca .exm-curated-close{border:none;background:none;cursor:pointer;color:var(--muted);display:grid;place-items:center;
  width:30px;height:30px;border-radius:8px}
.luca .exm-curated-close:hover{background:var(--mint-soft);color:var(--ink)}
.luca .exm-curated-loading{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14px;padding:8px 2px}
.luca .exm-curated-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:760px){.luca .exm-curated-cards{grid-template-columns:1fr}}
.luca .exm-cc{border:1px solid var(--line);border-radius:14px;padding:15px 16px;background:var(--bg);display:flex;
  flex-direction:column;gap:7px}
.luca .exm-cc.journey{background:var(--mint-soft);border-color:var(--mint-line)}
.luca .exm-cc-tag{align-self:flex-start;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  border-radius:999px;padding:3px 10px}
.luca .exm-cc-tag.next{background:var(--teal-d);color:#fff}
.luca .exm-cc-tag.journey{background:#c79a3a;color:#fff}
.luca .exm-cc h5{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:var(--ink);margin:2px 0 0}
.luca .exm-cc p{font-size:13px;color:var(--muted);margin:0;line-height:1.5}
.luca .exm-cc-why{font-size:12.5px;color:var(--mint-ink);background:var(--mint-soft);border-left:3px solid var(--teal-d);
  border-radius:0 8px 8px 0;padding:8px 11px;line-height:1.5}
.luca .exm-cc.journey .exm-cc-why{background:rgba(255,255,255,.6)}
.luca .exm-cc-btn{align-self:flex-start;margin-top:4px;display:inline-flex;align-items:center;gap:7px;background:var(--teal-d);
  color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;
  font-family:inherit;transition:background .15s}
.luca .exm-cc-btn:hover{background:var(--teal-d2)}
.luca .exm-mtoggle{display:none}
@media(max-width:1080px){
  .luca .exm-body{grid-template-columns:240px 1fr}
  .luca .exm-map{display:none}
  .luca .exm-map.mshow{display:block;position:fixed;inset:64px 0 0;z-index:2500;border-radius:0}
}
@media(max-width:760px){
  .luca .exm{min-height:calc(100vh - 120px)}
  .luca .exm-filterbtn{display:inline-flex}
  .luca .exm-body{grid-template-columns:1fr;position:relative}
  .luca .exm-rail{position:fixed;inset:0;z-index:3000;background:rgba(2,18,24,.4);display:none;padding:40px 16px;overflow-y:auto}
  .luca .exm-rail.open{display:block}
  .luca .exm-rail>*{max-width:340px;margin:0 auto}
  .luca .exm-list.mhide{display:none}
  .luca .exm-map.mhide{display:none}
  .luca .exm-map.mshow{display:block;height:100%}
  .luca .exm-mtoggle{display:inline-flex;align-items:center;gap:7px;position:fixed;bottom:80px;left:50%;
    transform:translateX(-50%);z-index:2600;background:var(--ink);color:#fff;border:none;border-radius:999px;
    padding:11px 22px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 6px 18px rgba(2,18,24,.35)}
}

/* ===================================================================
   MOBILE EXPLORE (<=900px): sticky search + quick filters + Map|List
   segmented switch, full-bleed fixed stage. Uses 100dvh-safe stage sizing.
   =================================================================== */
.luca .exm-mobile{min-height:0}
/* Full-bleed mobile stage. The surface is portaled out of the transformed .page
   ancestor (see ExploreMarketplace mobile branch), so this fixed box resolves
   against the real viewport: it fills from just below the sticky header
   (--exm-top, measured) to the very bottom. 100dvh via the top/bottom anchors
   tracks the dynamic viewport (URL bar show/hide, rotation). z-index sits below
   the bottom nav (60) so the nav stays visible over the map/collapsed sheet. */
.luca .exm-m{position:fixed;left:0;right:0;top:var(--exm-top,54px);bottom:0;z-index:40;
  display:flex;flex-direction:column;background:var(--bg);overflow:hidden}
/* When the mobile Explore stage is mounted, hide the shared PageHead (title +
   sub + Member badge) beneath it so the Member badge never appears inside the
   Explore content on mobile. */
.luca.exm-mobile-active .page-head{display:none}
/* Visually-hidden heading/description: removed from the mobile visual so results
   own the screen, but preserved in the DOM for screen readers. */
.luca .exm-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0}
.luca .exm-mbar{flex:none;display:flex;gap:8px;align-items:center;padding:3px 12px;
  background:var(--bg);border-bottom:1px solid var(--line)}
.luca .exm-mbar .exm-search{flex:1;min-width:0;box-shadow:none;padding:9px 12px;border-radius:12px}
.luca .exm-mfilter{flex:none;position:relative;display:inline-flex;align-items:center;justify-content:center;
  width:44px;height:44px;border:1px solid var(--line);background:var(--surface);border-radius:12px;
  color:var(--ink);cursor:pointer}
.luca .exm-mfilter .exm-fcount{position:absolute;top:-6px;right:-6px;background:var(--teal-d);color:#fff;
  border-radius:999px;font-size:10px;line-height:1.6;padding:0 6px;font-weight:700}
.luca .exm-qf-row{flex:none;display:flex;gap:8px;overflow-x:auto;padding:3px 12px;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;background:var(--bg);border-bottom:1px solid var(--line)}
.luca .exm-qf-row::-webkit-scrollbar{display:none}
.luca .exm-qf{flex:none;white-space:nowrap;border:1px solid var(--line);background:var(--surface);color:var(--ink);
  border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;min-height:30px}
.luca .exm-qf.on{background:var(--teal-d);color:#fff;border-color:var(--teal-d)}
/* Two equal guidance buttons: Recommend (sparkle) + Guided journeys (compass). */
.luca .exm-mguide{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 12px 4px;background:var(--bg)}
.luca .exm-mgbtn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--mint-line);
  background:var(--mint-soft);color:var(--teal-d);border-radius:12px;padding:8px 10px;font-size:13px;font-weight:700;
  cursor:pointer;font-family:inherit;min-height:44px;min-width:0}
.luca .exm-mgbtn svg{flex:none}
.luca .exm-mgbtn:hover{background:var(--mint);border-color:var(--mint);color:var(--mint-ink)}
.luca .exm-mgbtn:disabled{opacity:.6;cursor:default}
/* Compact Map/List selector sharing its row with the live result count. */
.luca .exm-mtools{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:2px 12px;background:var(--bg);border-bottom:1px solid var(--line)}
.luca .exm-mcount{font-size:12px;font-weight:700;color:var(--muted);min-width:0;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.luca .exm-mseg{flex:none;display:inline-flex;gap:0;border:1px solid var(--line);border-radius:10px;
  overflow:hidden;background:var(--surface)}
.luca .exm-seg{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;
  background:transparent;color:var(--ink);padding:0 16px;font-size:13px;font-weight:700;
  cursor:pointer;font-family:inherit;min-height:40px}
.luca .exm-seg+.exm-seg{border-left:1px solid var(--line)}
.luca .exm-seg.on{background:var(--teal-d);color:#fff}
.luca .exm-mstage{position:relative;flex:1;min-height:0;overflow:hidden}
.luca .exm-mmap{position:absolute;inset:0}
.luca .exm-mmap .mv-wrap{height:100%;border-radius:0;border:none}
/* List state: a single full-width scrollable column of provider cards. Bottom
   padding clears the fixed bottom nav (its height + safe-area inset). */
.luca .exm-mlist{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
  padding:10px 12px calc(96px + env(safe-area-inset-bottom,0px));background:var(--bg)}
.luca .exm-mlist .exm-cards{display:flex;flex-direction:column;gap:12px}
.luca .exm-mlist-item{display:flex;flex-direction:column;gap:0}
.luca .exm-showmap{align-self:stretch;width:100%;margin-top:8px;display:inline-flex;align-items:center;
  justify-content:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--teal-d);
  border-radius:10px;padding:11px 13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;min-height:44px}
.luca .exm-showmap:hover{border-color:var(--teal-d);background:var(--mint-soft)}
.luca .exm-mrec-cards{display:flex;flex-direction:column;gap:12px;padding-top:4px}
/* Guided journeys bottom sheet — one-column journey cards inside AdaptiveOverlay. */
.luca .exm-gjs .exm-journeys{margin-top:0}
.luca .exm-gjs .exm-journeys-grid{grid-template-columns:1fr}
/* Mobile filter-sheet footer (inside the adaptive overlay) */
.luca .exm-fs-foot{display:flex;gap:10px;align-items:center}
.luca .exm-fs-clear{flex:none;border:1px solid var(--line);background:var(--surface);color:var(--ink);
  border-radius:12px;padding:12px 18px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;min-height:44px}
.luca .exm-fs-apply{flex:1;border:none;background:var(--teal-d);color:#fff;border-radius:12px;padding:12px 18px;
  font-weight:700;font-size:14px;cursor:pointer;font-family:inherit;min-height:44px}
.luca .exm-fs-apply:hover{background:var(--teal-d2)}
`;

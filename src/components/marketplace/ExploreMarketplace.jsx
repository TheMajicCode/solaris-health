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
import { Search, MapPin, Map as MapIcon, List as ListIcon, Loader2, Store, Plus, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import MapView from './MapView.jsx';
import SearchFilters from './SearchFilters.jsx';
import ProviderListingCard from './ProviderListingCard.jsx';
import ProviderDetailModal from './ProviderDetailModal.jsx';

const DEFAULT_FILTERS = {
  types: [], minRating: 0, vtv: false, verified: false, price: [], radius: 25, sort: 'rating',
};

export default function ExploreMarketplace({ user, onBecomeProvider }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [query, setQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [providers, setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [mobileView, setMobileView] = useState('list'); // list | map
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef(null);

  // debounce search text
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // load categories once
  useEffect(() => {
    api.getMarketplaceCategories().then((d) => setCategories(d.categories || [])).catch(() => {});
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
      let rows = d.providers || [];
      // client-side price filter (denormalized price_range is a simple string)
      if (filters.price.length) {
        rows = rows.filter((p) => p.price_range && filters.price.includes(p.price_range));
      }
      setProviders(rows);
    } catch (e) {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, filters, userLocation]);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  const patch = (p) => setFilters((f) => ({ ...f, ...p }));
  const reset = () => { setFilters(DEFAULT_FILTERS); setQuery(''); };

  const onSelect = (p) => {
    setActiveId(p.id);
    // scroll the matching card into view
    const el = listRef.current?.querySelector(`[data-pid="${p.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const hasLocation = !!userLocation;
  const activeFilterCount =
    filters.types.length + filters.price.length +
    (filters.minRating ? 1 : 0) + (filters.vtv ? 1 : 0) + (filters.verified ? 1 : 0);

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
        {onBecomeProvider && (
          <button className="exm-cta" onClick={onBecomeProvider}>
            <Plus size={16} /> List your practice
          </button>
        )}
      </div>

      <div className="exm-body">
        {/* Filter rail */}
        <div className={`exm-rail${showFilters ? ' open' : ''}`}>
          <SearchFilters
            filters={filters}
            onChange={patch}
            categories={categories}
            hasLocation={hasLocation}
            onReset={reset}
            resultCount={providers.length}
          />
        </div>

        {/* Results list */}
        <div className={`exm-list ${mobileView === 'list' ? 'mshow' : 'mhide'}`} ref={listRef}>
          {loading ? (
            <div className="exm-loading"><Loader2 className="exm-spin" size={26} /> Finding providers…</div>
          ) : providers.length === 0 ? (
            <div className="exm-empty">
              <Store size={34} />
              <h4>No providers match your filters</h4>
              <p>Try widening your search or resetting the filters.</p>
              <button className="exm-resetbtn" onClick={reset}>Reset filters</button>
            </div>
          ) : (
            <div className="exm-cards">
              {providers.map((p) => (
                <div key={p.id} data-pid={p.id}>
                  <ProviderListingCard
                    provider={p}
                    onOpen={(pr) => setOpenId(pr.id)}
                    onHover={setHoverId}
                    active={hoverId === p.id || activeId === p.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className={`exm-map ${mobileView === 'map' ? 'mshow' : 'mhide'}`}>
          <MapView
            providers={providers}
            activeId={activeId || hoverId}
            onSelect={onSelect}
            onHover={setHoverId}
            userLocation={userLocation}
            onLocate={(loc) => setUserLocation(loc)}
            radiusKm={hasLocation ? filters.radius : null}
          />
        </div>
      </div>

      {/* Mobile view toggle */}
      <button className="exm-mtoggle" onClick={() => setMobileView((v) => (v === 'list' ? 'map' : 'list'))}>
        {mobileView === 'list' ? <><MapIcon size={16} /> Map</> : <><ListIcon size={16} /> List</>}
      </button>

      {openId && (
        <ProviderDetailModal
          providerId={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onUpdated={fetchProviders}
        />
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .exm{display:flex;flex-direction:column;height:calc(100vh - 132px);min-height:560px}
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
.luca .exm-body{flex:1;display:grid;grid-template-columns:262px 1fr 1fr;gap:16px;min-height:0}
.luca .exm-rail{overflow-y:auto;padding-right:2px}
.luca .exm-list{overflow-y:auto;padding-right:4px}
.luca .exm-cards{display:flex;flex-direction:column;gap:12px;padding-bottom:10px}
.luca .exm-map{position:sticky;top:0;height:100%;min-height:0}
.luca .exm-loading,.luca .exm-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;height:100%;color:var(--muted);text-align:center;padding:30px}
.luca .exm-empty h4{font-family:'Space Grotesk',sans-serif;font-size:17px;color:var(--ink);margin:4px 0 0}
.luca .exm-empty p{font-size:13px;margin:0}
.luca .exm-resetbtn,.luca .exm-spin{margin-top:4px}
.luca .exm-resetbtn{background:var(--teal-d);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer;font-family:inherit}
.luca .exm-spin{animation:exmspin 1s linear infinite}
@keyframes exmspin{to{transform:rotate(360deg)}}
.luca .exm-mtoggle{display:none}
@media(max-width:1080px){
  .luca .exm-body{grid-template-columns:240px 1fr}
  .luca .exm-map{display:none}
  .luca .exm-map.mshow{display:block;position:fixed;inset:64px 0 0;z-index:2500;border-radius:0}
}
@media(max-width:760px){
  .luca .exm{height:calc(100vh - 120px)}
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
`;

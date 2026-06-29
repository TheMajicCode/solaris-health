/**
 * SearchFilters — the marketplace filter rail.
 *  • Provider-type checkboxes (with live counts).
 *  • Distance slider (requires user location).
 *  • Minimum rating selector.
 *  • VTV / Verified toggles.
 *  • Price-range selector ($ – $$$$).
 *  • Sort selector.
 *
 * Props:
 *   filters     {types:[], minRating, vtv, verified, price, radius, sort}
 *   onChange    (patch)=>void  — shallow-merge patch into filters
 *   categories  [{id,label,count}]  from /marketplace/categories
 *   hasLocation bool — enables the distance slider
 *   onReset     ()=>void
 *   resultCount number
 */
import React from 'react';
import { SlidersHorizontal, ShieldCheck, BadgeCheck, RotateCcw } from 'lucide-react';
import { PROVIDER_TYPES } from './ProviderBadges.jsx';

const PRICES = ['$', '$$', '$$$', '$$$$'];
const SORTS = [
  { id: 'rating', label: 'Top rated' },
  { id: 'reviews', label: 'Most reviewed' },
  { id: 'distance', label: 'Nearest' },
  { id: 'newest', label: 'Newest' },
];

export default function SearchFilters({
  filters, onChange, categories = [], hasLocation, onReset, resultCount,
}) {
  const countOf = (id) => {
    const c = categories.find((x) => x.id === id);
    return c ? c.count : 0;
  };

  const toggleType = (id) => {
    const set = new Set(filters.types || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    onChange({ types: Array.from(set) });
  };

  const togglePrice = (p) => {
    const set = new Set(filters.price || []);
    if (set.has(p)) set.delete(p); else set.add(p);
    onChange({ price: Array.from(set) });
  };

  return (
    <aside className="sf">
      <div className="sf-head">
        <span className="sf-title"><SlidersHorizontal size={16} /> Filters</span>
        <button className="sf-reset" onClick={onReset} type="button"><RotateCcw size={13} /> Reset</button>
      </div>

      {resultCount != null && (
        <div className="sf-count">{resultCount} {resultCount === 1 ? 'provider' : 'providers'}</div>
      )}

      {/* Sort */}
      <div className="sf-group">
        <label className="sf-label">Sort by</label>
        <div className="sf-sorts">
          {SORTS.map((s) => {
            const disabled = s.id === 'distance' && !hasLocation;
            return (
              <button
                key={s.id}
                type="button"
                className={`sf-sort${filters.sort === s.id ? ' on' : ''}`}
                disabled={disabled}
                title={disabled ? 'Enable location to sort by distance' : ''}
                onClick={() => onChange({ sort: s.id })}
              >{s.label}</button>
            );
          })}
        </div>
      </div>

      {/* Type */}
      <div className="sf-group">
        <label className="sf-label">Provider type</label>
        <div className="sf-types">
          {PROVIDER_TYPES.map((t) => {
            const Icon = t.icon;
            const on = (filters.types || []).includes(t.id);
            return (
              <button key={t.id} type="button" className={`sf-type${on ? ' on' : ''}`} onClick={() => toggleType(t.id)}>
                <span className="sf-type-l"><Icon size={15} /> {t.label}</span>
                <span className="sf-type-n">{countOf(t.id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Distance */}
      <div className="sf-group">
        <label className="sf-label">
          Distance {hasLocation ? `· within ${filters.radius || 25} km` : ''}
        </label>
        {hasLocation ? (
          <input
            type="range" min="1" max="100" step="1"
            value={filters.radius || 25}
            onChange={(e) => onChange({ radius: Number(e.target.value) })}
            className="sf-range"
          />
        ) : (
          <p className="sf-hint">Use the “locate me” button on the map to filter by distance.</p>
        )}
      </div>

      {/* Rating */}
      <div className="sf-group">
        <label className="sf-label">Minimum rating</label>
        <div className="sf-ratings">
          {[0, 3, 3.5, 4, 4.5].map((r) => (
            <button
              key={r}
              type="button"
              className={`sf-rate${(filters.minRating || 0) === r ? ' on' : ''}`}
              onClick={() => onChange({ minRating: r })}
            >{r === 0 ? 'Any' : `${r}★+`}</button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="sf-group">
        <label className="sf-label">Price range</label>
        <div className="sf-prices">
          {PRICES.map((p) => (
            <button
              key={p}
              type="button"
              className={`sf-price${(filters.price || []).includes(p) ? ' on' : ''}`}
              onClick={() => togglePrice(p)}
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Trust toggles */}
      <div className="sf-group">
        <label className="sf-label">Trust</label>
        <button type="button" className={`sf-toggle${filters.vtv ? ' on' : ''}`} onClick={() => onChange({ vtv: !filters.vtv })}>
          <span className="sf-toggle-l"><ShieldCheck size={15} /> VTV-certified only</span>
          <span className="sf-switch" aria-hidden><span /></span>
        </button>
        <button type="button" className={`sf-toggle${filters.verified ? ' on' : ''}`} onClick={() => onChange({ verified: !filters.verified })}>
          <span className="sf-toggle-l"><BadgeCheck size={15} /> Verified only</span>
          <span className="sf-switch" aria-hidden><span /></span>
        </button>
      </div>

      <style>{CSS}</style>
    </aside>
  );
}

const CSS = `
.luca .sf{display:flex;flex-direction:column;gap:18px;padding:16px;background:var(--surface);
  border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow-sm)}
.luca .sf-head{display:flex;align-items:center;justify-content:space-between}
.luca .sf-title{display:flex;align-items:center;gap:7px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px}
.luca .sf-reset{display:inline-flex;align-items:center;gap:4px;background:none;border:none;color:var(--muted);
  font-size:12px;cursor:pointer;font-family:inherit;padding:4px 6px;border-radius:8px;transition:all .15s}
.luca .sf-reset:hover{color:var(--danger-ink);background:var(--danger-soft)}
.luca .sf-count{font-size:12px;color:var(--muted);margin-top:-8px;font-weight:600}
.luca .sf-group{display:flex;flex-direction:column;gap:9px}
.luca .sf-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2)}
.luca .sf-sorts,.luca .sf-ratings,.luca .sf-prices{display:flex;flex-wrap:wrap;gap:6px}
.luca .sf-sort,.luca .sf-rate,.luca .sf-price{border:1px solid var(--line);background:var(--surface-2);
  color:var(--ink);font-size:12px;font-weight:600;padding:6px 11px;border-radius:999px;cursor:pointer;
  font-family:inherit;transition:all .14s ease}
.luca .sf-sort:hover,.luca .sf-rate:hover,.luca .sf-price:hover{border-color:var(--mint)}
.luca .sf-sort.on,.luca .sf-rate.on,.luca .sf-price.on{background:var(--teal-d);color:#fff;border-color:var(--teal-d)}
.luca .sf-sort:disabled{opacity:.4;cursor:not-allowed}
.luca .sf-types{display:flex;flex-direction:column;gap:5px}
.luca .sf-type{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);
  background:var(--surface-2);border-radius:10px;padding:8px 11px;cursor:pointer;font-family:inherit;transition:all .14s ease}
.luca .sf-type:hover{border-color:var(--mint);background:var(--mint-soft)}
.luca .sf-type.on{border-color:var(--teal-d);background:var(--mint-soft)}
.luca .sf-type-l{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink)}
.luca .sf-type.on .sf-type-l{color:var(--teal-d)}
.luca .sf-type-n{font-size:11px;font-weight:700;color:var(--muted);background:var(--surface);border-radius:999px;padding:1px 8px;min-width:24px;text-align:center}
.luca .sf-range{width:100%;accent-color:var(--teal-d);cursor:pointer}
.luca .sf-hint{font-size:12px;color:var(--muted);margin:0;line-height:1.4}
.luca .sf-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);
  background:var(--surface-2);border-radius:10px;padding:9px 11px;cursor:pointer;font-family:inherit;transition:all .14s}
.luca .sf-toggle:hover{border-color:var(--mint)}
.luca .sf-toggle.on{border-color:var(--gold);background:var(--gold-soft)}
.luca .sf-toggle-l{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink)}
.luca .sf-switch{width:36px;height:20px;border-radius:999px;background:var(--line-2);position:relative;transition:background .15s;flex-shrink:0}
.luca .sf-switch span{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .15s}
.luca .sf-toggle.on .sf-switch{background:var(--gold)}
.luca .sf-toggle.on .sf-switch span{transform:translateX(16px)}
`;

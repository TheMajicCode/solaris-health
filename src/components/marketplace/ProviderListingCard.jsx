/**
 * ProviderListingCard — a single provider result in the Explore list.
 * Airbnb/Yelp-style: cover photo, type, name, rating, badges, location,
 * price range and distance. Hovering syncs with the map marker.
 *
 * Props:
 *   provider   provider row
 *   onOpen     (provider)=>void
 *   onHover    (id|null)=>void
 *   active     bool — highlighted (map marker hovered/selected)
 */
import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import RatingStars from './RatingStars.jsx';
import ProviderBadges, { TypeBadge } from './ProviderBadges.jsx';
import { providerCoverSm, providerAlt, isSimulated } from '../../lib/providerMedia.js';

function fmtDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

const MODALITY_LABEL = { virtual: 'Virtual', in_person: 'In-person', hybrid: 'Virtual & in-person' };

// Non-schema attributes (modality/languages) live in hours_of_operation.meta —
// parse defensively (may arrive as a string or already-parsed object).
function listingMeta(p) {
  let obj = p?.hours_of_operation;
  if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { obj = null; } }
  return (obj && typeof obj === 'object' && obj.meta) ? obj.meta : {};
}

export default function ProviderListingCard({ provider, onOpen, onHover, active, priority = false }) {
  const p = provider;
  const cover = providerCoverSm(p);
  const sim = isSimulated(p);
  const dist = fmtDistance(p.distance_km);
  const meta = listingMeta(p);
  const modality = MODALITY_LABEL[meta.modality];
  const langs = Array.isArray(meta.languages) ? meta.languages : [];

  return (
    <article
      className={`plc${active ? ' plc-active' : ''}`}
      onClick={() => onOpen && onOpen(p)}
      onMouseEnter={() => onHover && onHover(p.id)}
      onMouseLeave={() => onHover && onHover(null)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen && onOpen(p); }}
    >
      <div className="plc-media">
        {cover
          ? <img src={cover} alt={providerAlt(p, 'cover')} width="480" height="270"
                 loading={priority ? 'eager' : 'lazy'} {...(priority ? { fetchPriority: 'high' } : {})} />
          : <div className="plc-noimg"><MapPin size={22} /></div>}
        {dist && <span className="plc-dist"><Navigation size={11} /> {dist}</span>}
        {sim && <span className="plc-sim" title="Simulated demo profile">Demo</span>}
      </div>

      <div className="plc-body">
        <div className="plc-top">
          <TypeBadge type={p.provider_type} />
          {p.featured && <span className="plc-feat-badge">Featured</span>}
        </div>
        <h4 className="plc-name">{p.business_name}</h4>
        {/* Rating + review count on their own wrapping-safe row (never clipped). */}
        <div className="plc-rating">
          <RatingStars value={Number(p.rating) || 0} count={p.review_count} showValue size={13} />
        </div>
        {p.description && <p className="plc-desc">{p.description}</p>}
        {(modality || langs.length > 0) && (
          <div className="plc-chips">
            {modality && <span className="plc-chip plc-chip-mode">{modality}</span>}
            {langs.slice(0, 2).map((l) => <span key={l} className="plc-chip">{l}</span>)}
          </div>
        )}
        <div className="plc-foot">
          <ProviderBadges provider={p} compact size={12} />
        </div>
        {/* Final row: location + price tier. */}
        <div className="plc-meta">
          <span className="plc-loc"><MapPin size={13} /> {p.city || p.address || 'El Salvador'}</span>
          {p.price_range && <span className="plc-price">{p.price_range}</span>}
        </div>
      </div>
      <style>{CSS}</style>
    </article>
  );
}

const CSS = `
.luca .plc{display:flex;gap:14px;padding:12px;border:1px solid var(--line);border-radius:var(--r);
  background:var(--surface);cursor:pointer;transition:all .16s ease;box-shadow:var(--shadow-sm)}
.luca .plc:hover,.luca .plc-active{border-color:var(--mint);box-shadow:var(--shadow);transform:translateY(-1px)}
.luca .plc-active{outline:2px solid var(--mint);outline-offset:-1px}
.luca .plc-media{position:relative;width:142px;min-width:142px;height:142px;border-radius:var(--r-sm);overflow:hidden;background:var(--surface-2)}
.luca .plc-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s ease}
.luca .plc:hover .plc-media img{transform:scale(1.05)}
.luca .plc-noimg{width:100%;height:100%;display:grid;place-items:center;color:var(--muted);background:var(--surface-2)}
.luca .plc-feat-badge{display:inline-flex;align-items:center;background:linear-gradient(135deg,var(--gold),var(--gold-2));
  color:#3a2c05;font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;letter-spacing:.02em}
.luca .plc-dist{position:absolute;bottom:8px;right:8px;background:rgba(2,32,42,.78);color:#fff;font-size:10px;
  font-weight:700;padding:3px 7px;border-radius:999px;display:inline-flex;align-items:center;gap:3px}
.luca .plc-sim{position:absolute;top:8px;left:8px;background:rgba(10,43,41,.82);color:var(--mint-2,#7FDBB6);
  font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:999px;
  border:1px solid rgba(127,219,182,.45)}
.luca .plc-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.luca .plc-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.luca .plc-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--ink);
  margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .plc-rating{display:flex;flex-wrap:wrap;align-items:center;gap:4px;min-width:0}
.luca .plc-desc{font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.luca .plc-chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.luca .plc-chip{font-size:10.5px;font-weight:700;color:var(--muted-2);background:var(--surface-2);
  border:1px solid var(--line);border-radius:999px;padding:2px 8px;line-height:1.5}
.luca .plc-chip-mode{color:var(--teal-d);border-color:var(--mint);background:var(--mint-soft)}
.luca .plc-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;min-width:0}
.luca .plc-loc{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted-2);min-width:0}
.luca .plc-loc svg{flex-shrink:0}
.luca .plc-price{font-weight:700;font-size:13px;color:var(--teal-d);font-family:'IBM Plex Mono',monospace}
.luca .plc-foot{display:flex}
@media(max-width:560px){
  .luca .plc-media{width:104px;min-width:104px;height:104px}
  .luca .plc-name{font-size:15px}
}
/* ── Phone (<480px): one full-width column card ──
   Full-width 16:9 cover on top, then the body stacked. No absolute positioning
   for price; content containers keep min-width:0 so long text never forces
   horizontal overflow. */
@media(max-width:480px){
  .luca .plc{flex-direction:column;gap:10px;padding:10px}
  .luca .plc-media{width:100%;min-width:0;height:auto;aspect-ratio:16/9;border-radius:var(--r-sm)}
  .luca .plc-body{width:100%;min-width:0}
  .luca .plc-name{white-space:normal;overflow:visible;text-overflow:clip;font-size:16px}
  .luca .plc-meta{flex-wrap:wrap;gap:6px}
}
`;

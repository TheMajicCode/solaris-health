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

function fmtDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function ProviderListingCard({ provider, onOpen, onHover, active }) {
  const p = provider;
  const cover = p.cover_photo_url || p.profile_photo_url;
  const dist = fmtDistance(p.distance_km);

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
          ? <img src={cover} alt={p.business_name} loading="lazy" />
          : <div className="plc-noimg"><MapPin size={22} /></div>}
        {p.featured && <span className="plc-feat">Featured</span>}
        {dist && <span className="plc-dist"><Navigation size={11} /> {dist}</span>}
      </div>

      <div className="plc-body">
        <div className="plc-top">
          <TypeBadge type={p.provider_type} />
          <RatingStars value={Number(p.rating) || 0} count={p.review_count} showValue size={13} />
        </div>
        <h4 className="plc-name">{p.business_name}</h4>
        {p.description && <p className="plc-desc">{p.description}</p>}
        <div className="plc-meta">
          <span className="plc-loc"><MapPin size={13} /> {p.city || p.address || 'El Salvador'}</span>
          {p.price_range && <span className="plc-price">{p.price_range}</span>}
        </div>
        <div className="plc-foot">
          <ProviderBadges provider={p} compact size={12} />
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
.luca .plc-feat{position:absolute;top:8px;left:8px;background:linear-gradient(135deg,var(--gold),var(--gold-2));
  color:#3a2c05;font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;letter-spacing:.02em}
.luca .plc-dist{position:absolute;bottom:8px;right:8px;background:rgba(2,32,42,.78);color:#fff;font-size:10px;
  font-weight:700;padding:3px 7px;border-radius:999px;display:inline-flex;align-items:center;gap:3px}
.luca .plc-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:7px}
.luca .plc-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.luca .plc-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--ink);
  margin:0;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .plc-desc{font-size:12.5px;color:var(--muted);margin:0;line-height:1.45;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.luca .plc-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto}
.luca .plc-loc{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--muted-2);min-width:0}
.luca .plc-loc svg{flex-shrink:0}
.luca .plc-price{font-weight:700;font-size:13px;color:var(--teal-d);font-family:'IBM Plex Mono',monospace}
.luca .plc-foot{display:flex}
@media(max-width:560px){
  .luca .plc-media{width:104px;min-width:104px;height:104px}
  .luca .plc-name{font-size:15px}
}
`;

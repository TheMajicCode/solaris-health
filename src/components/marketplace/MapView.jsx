/**
 * MapView — Leaflet/OpenStreetMap map for the marketplace.
 *  • Renders custom pin markers (coloured by provider type, gold ring if featured).
 *  • Highlights the active/hovered provider and flies to it.
 *  • "Locate me" geolocation control with an accuracy radius circle.
 *  • Reports map-bounds changes upward (debounced) for map-driven search.
 *
 * Props:
 *   providers      array of {id, business_name, latitude, longitude, provider_type, rating, featured, vtv_certified}
 *   activeId       currently selected provider id
 *   onSelect       (provider)=>void
 *   onHover        (id|null)=>void
 *   userLocation   {lat, lon} | null
 *   onLocate       (loc)=>void   — fired after successful geolocation
 *   radiusKm       number | null — draws a search radius around userLocation
 *   center         [lat, lon] default center
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, X, MapPin, Globe, Video, ArrowRight } from 'lucide-react';
import { typeMeta, TypeBadge } from './ProviderBadges.jsx';
import RatingStars from './RatingStars.jsx';
import { providerCoverSm, providerAlt } from '../../lib/providerMedia.js';

const SV_CENTER = [13.6929, -89.2182]; // San Salvador

// Brand palette for marker accents
const ACCENT = { teal: '#0f766e', emerald: '#10b981', gold: '#d4a52a' };

// Escape user-derived text before it enters the divIcon HTML string, so a
// provider name can never inject markup. The compact card below is built from
// React elements only (never innerHTML), per the marketplace safety rules.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Read the demo-seed meta (languages / modality) stored under hours_of_operation.
function readMeta(p) {
  let obj = p?.hours_of_operation;
  if (typeof obj === 'string') { try { obj = JSON.parse(obj); } catch { obj = null; } }
  return (obj && typeof obj === 'object' && obj.meta) ? obj.meta : {};
}
const MODALITY_LABEL = { virtual: 'Virtual', in_person: 'In person', hybrid: 'Virtual & in person' };

function pinIcon(provider, active) {
  const meta = typeMeta(provider.provider_type);
  const color = provider.featured ? ACCENT.gold : ACCENT[meta.accent] || ACCENT.teal;
  const scale = active ? 1.18 : 1;
  const ring = provider.vtv_certified ? '#d4a52a' : '#ffffff';
  const label = escapeHtml(`${provider.business_name || 'Provider'}${provider.rating ? `, rated ${Number(provider.rating).toFixed(1)} of 5` : ''}`);
  const html = `
    <div class="mv-pin${active ? ' mv-pin-active' : ''}" style="transform:scale(${scale})" role="button" aria-label="${label}">
      <div class="mv-pin-body" style="background:${color};border-color:${ring}">
        <span class="mv-pin-rating">${provider.rating ? Number(provider.rating).toFixed(1) : '—'}</span>
      </div>
      <div class="mv-pin-tip" style="border-top-color:${color}"></div>
    </div>`;
  return L.divIcon({
    html,
    className: 'mv-divicon',
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -44],
  });
}

// Compact, in-viewport provider card shown over the map for the selected pin.
// Built entirely from React elements + escaped text (no raw HTML injection).
// Shows only real listing fields and always offers two visible actions:
// "View details" (opens the provider profile) and "Book" (opens booking directly).
function MapProviderCard({ provider, onOpen, onBook, onClose }) {
  const cardRef = useRef(null);
  if (!provider) return null;
  const meta = readMeta(provider);
  const langs = Array.isArray(meta.languages) ? meta.languages : [];
  const modality = MODALITY_LABEL[meta.modality] || null;
  const loc = [provider.city, provider.region].filter(Boolean).join(', ');
  const cover = providerCoverSm(provider);
  // Keep any pointer/touch inside the card from bubbling to the Leaflet map
  // beneath it (the card is a sibling overlay, but stopping propagation also
  // guards synthetic click/tap sequences from landing on the marker underneath).
  const stop = (e) => e.stopPropagation();
  // Close is driven by the real pointer/click on the X: swallow the event so it
  // never reaches the map (no immediate reselect of the same marker), clear the
  // selection, and restore focus to the map surface so it stays keyboard-usable.
  const handleClose = (e) => {
    if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
    const map = cardRef.current?.closest('.mv-wrap')?.querySelector('.mv-map');
    onClose?.();
    if (map) {
      if (!map.hasAttribute('tabindex')) map.setAttribute('tabindex', '-1');
      requestAnimationFrame(() => { try { map.focus({ preventScroll: true }); } catch { /* noop */ } });
    }
  };
  return (
    <div
      className="mv-card"
      ref={cardRef}
      role="dialog"
      aria-label={`${provider.business_name || 'Provider'} summary`}
      onPointerDown={stop}
      onClick={stop}
    >
      <button
        type="button"
        className="mv-card-x"
        onPointerDown={stop}
        onClick={handleClose}
        aria-label="Close provider card"
      ><X size={16} /></button>
      <div className="mv-card-media">
        {cover
          ? <img src={cover} alt={providerAlt(provider, 'cover')} loading="lazy" width="280" height="96" />
          : <div className="mv-card-noimg"><MapPin size={20} /></div>}
      </div>
      <div className="mv-card-head">
        <TypeBadge type={provider.provider_type} />
        {provider.rating > 0 && <RatingStars value={Number(provider.rating)} size={13} showValue count={provider.review_count} />}
      </div>
      <div className="mv-card-name">{provider.business_name}</div>
      {loc && <div className="mv-card-row"><MapPin size={13} /> {loc}</div>}
      <div className="mv-card-chips">
        {modality && <span className="mv-card-chip">{meta.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />} {modality}</span>}
        {langs.slice(0, 3).map((l) => <span key={l} className="mv-card-chip"><Globe size={12} /> {l}</span>)}
      </div>
      {provider.price_range && <div className="mv-card-price">{provider.price_range}</div>}
      <div className="mv-card-foot">
        <button type="button" className="mv-card-btn ghost" onClick={() => onOpen?.(provider)}>
          View details
        </button>
        <button type="button" className="mv-card-btn" onClick={() => onBook?.(provider)}>
          Book <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// Compact, marker-anchored preview shown on MOBILE for the selected pin. It is
// intentionally small (never covers most of the map), positioned above the
// marker, and re-anchored on every pan/zoom so the map stays fully interactive
// while it is open. Built from React elements + escaped text only. Shows only
// real listing fields: thumbnail, name, type, rating, short location, one
// modality indicator, a small close, and compact Open / Book actions.
function MarkerPreview({ map, provider, onOpen, onBook, onClose }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);
  const latlng = useMemo(() => {
    const lat = Number(provider?.latitude);
    const lng = Number(provider?.longitude);
    return (Number.isFinite(lat) && Number.isFinite(lng)) ? [lat, lng] : null;
  }, [provider?.latitude, provider?.longitude]);

  // Keep the preview anchored to the marker across pan/zoom (map stays live).
  useEffect(() => {
    if (!map || !latlng) return undefined;
    const update = () => {
      try { const p = map.latLngToContainerPoint(latlng); setPos({ x: p.x, y: p.y }); }
      catch { /* map not laid out yet */ }
    };
    update();
    map.on('move zoom viewreset resize', update);
    return () => { map.off('move zoom viewreset resize', update); };
  }, [map, latlng]);

  // Auto-pan once when the selection changes so there is room ABOVE the marker
  // for the preview — clearing the compact controls, safe-area and bottom nav.
  useEffect(() => {
    if (!map || !latlng) return undefined;
    const CW = 280, CH = 210;
    const pan = () => {
      const s = map.getSize();
      if (!s || !s.x) return;
      const half = Math.min(CW, s.x - 24) / 2 + 14;
      try {
        map.panInside(latlng, {
          paddingTopLeft: L.point(half, CH + 44),
          paddingBottomRight: L.point(half, 60),
        });
      } catch { /* noop */ }
    };
    pan();
    const t = setTimeout(pan, 280); // re-run after any flyTo animation settles
    return () => clearTimeout(t);
  }, [map, provider?.id, latlng]);

  if (!provider || !map || !pos) return null;
  const meta = readMeta(provider);
  const modality = MODALITY_LABEL[meta.modality] || null;
  const loc = [provider.city, provider.region].filter(Boolean).join(', ');
  const cover = providerCoverSm(provider);
  const size = map.getSize();
  const vw = size?.x || 320;
  const CW = Math.min(280, vw - 24);
  let left = pos.x - CW / 2;
  left = Math.max(8, Math.min(left, vw - CW - 8));
  const top = pos.y - 16; // card bottom sits 16px above the marker tip
  const arrowLeft = Math.max(18, Math.min(pos.x - left, CW - 18));
  const stop = (e) => e.stopPropagation();
  const handleClose = (e) => {
    if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
    onClose?.();
  };
  return (
    <div
      className="mv-prev"
      ref={cardRef}
      role="dialog"
      aria-label={`${provider.business_name || 'Provider'} summary`}
      style={{ left, top, width: CW }}
      onPointerDown={stop}
      onClick={stop}
    >
      <button
        type="button"
        className="mv-prev-x"
        onPointerDown={stop}
        onClick={handleClose}
        aria-label="Close provider preview"
      ><X size={15} /></button>
      <button
        type="button"
        className="mv-prev-body"
        onClick={() => onOpen?.(provider)}
        aria-label={`Open ${provider.business_name || 'provider'} details`}
      >
        <div className="mv-prev-media">
          {cover
            ? <img src={cover} alt={providerAlt(provider, 'cover')} loading="lazy" width="72" height="72" />
            : <div className="mv-prev-noimg"><MapPin size={18} /></div>}
        </div>
        <div className="mv-prev-info">
          <div className="mv-prev-type"><TypeBadge type={provider.provider_type} /></div>
          <div className="mv-prev-name">{provider.business_name}</div>
          {provider.rating > 0 && (
            <div className="mv-prev-rate"><RatingStars value={Number(provider.rating)} size={12} showValue count={provider.review_count} /></div>
          )}
          {loc && <div className="mv-prev-loc"><MapPin size={12} /> {loc}</div>}
          {modality && (
            <div className="mv-prev-mod">{meta.modality === 'virtual' ? <Video size={12} /> : <MapPin size={12} />} {modality}</div>
          )}
        </div>
      </button>
      <div className="mv-prev-foot">
        <button type="button" className="mv-prev-btn ghost" onClick={() => onOpen?.(provider)}>Open</button>
        <button type="button" className="mv-prev-btn" onClick={() => onBook?.(provider)}>Book <ArrowRight size={13} /></button>
      </div>
      <span className="mv-prev-arrow" style={{ left: arrowLeft }} aria-hidden="true" />
    </div>
  );
}

// Expose the Leaflet map instance to the sibling overlay (MarkerPreview), which
// lives outside <MapContainer> and needs to project marker coordinates.
function MapReady({ onReady }) {
  const map = useMap();
  useEffect(() => { onReady?.(map); }, [map, onReady]);
  return null;
}

// Tap on an empty part of the map closes the anchored preview (marker clicks do
// not bubble to the map, so selecting a pin is unaffected). No-op on desktop.
function MapClickClose({ enabled, onClose }) {
  useMapEvents({ click: () => { if (enabled) onClose?.(); } });
  return null;
}

function userIcon() {
  return L.divIcon({
    html: '<div class="mv-userdot"><div class="mv-userpulse"></div></div>',
    className: 'mv-divicon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

// Imperatively fly to the active provider
function FlyTo({ target, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const lat = Number(target[0]);
    const lng = Number(target[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    // Skip when the map container is hidden / not laid out (size 0) — flyTo
    // on a zero-size map projects to NaN and throws "Invalid LatLng".
    const size = map.getSize();
    if (!size || size.x === 0 || size.y === 0) return;
    map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 0.6 });
  }, [target, zoom, map]);
  return null;
}

// Recompute map size when the container becomes visible / resizes (mobile toggle,
// grid layout changes) so tiles fill the pane and projection stays valid.
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const fix = () => { try { map.invalidateSize(); } catch { /* noop */ } };
    fix();
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    const t = setTimeout(fix, 300);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map]);
  return null;
}

// Report bounds changes upward
function BoundsWatcher({ onBounds }) {
  const ref = useRef(null);
  useMapEvents({
    moveend: (e) => {
      if (!onBounds) return;
      clearTimeout(ref.current);
      const b = e.target.getBounds();
      ref.current = setTimeout(() => {
        onBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
      }, 350);
    },
  });
  return null;
}

function LocateControl({ onLocate }) {
  const map = useMap();
  const locate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        map.flyTo([loc.lat, loc.lon], 13, { duration: 0.7 });
        onLocate && onLocate(loc);
      },
      () => { /* permission denied — silently ignore */ },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };
  return (
    <button className="mv-locate" onClick={locate} title="Use my location" type="button">
      <LocateFixed size={18} />
    </button>
  );
}

export default function MapView({
  providers = [], activeId, onSelect, onHover, userLocation, onLocate, radiusKm, center,
  onOpenDetail, onBook, onClearActive, showCard = true, anchored = false,
}) {
  // On mobile (anchored) we need the Leaflet map instance in the sibling overlay
  // to project the selected marker and to auto-pan; captured via <MapReady>.
  const [mapObj, setMapObj] = useState(null);
  const valid = useMemo(
    () => providers
      .map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && p.latitude !== 0),
    [providers]
  );
  const active = valid.find((p) => p.id === activeId);
  const target = active
    ? [active.latitude, active.longitude]
    : userLocation
      ? [userLocation.lat, userLocation.lon]
      : null;

  return (
    <div className="mv-wrap">
      <MapContainer
        center={center || SV_CENTER}
        zoom={12}
        scrollWheelZoom
        className="mv-map"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {valid.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={pinIcon(p, p.id === activeId)}
            eventHandlers={{
              click: () => onSelect && onSelect(p),
              mouseover: () => onHover && onHover(p.id),
              mouseout: () => onHover && onHover(null),
            }}
          />
        ))}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lon]} icon={userIcon()} />
        )}
        {userLocation && radiusKm > 0 && (
          <Circle
            center={[userLocation.lat, userLocation.lon]}
            radius={radiusKm * 1000}
            pathOptions={{ color: '#0f766e', fillColor: '#0f766e', fillOpacity: 0.06, weight: 1.5 }}
          />
        )}
        <FlyTo target={target} />
        <InvalidateOnResize />
        <LocateControl onLocate={onLocate} />
        {anchored && <MapReady onReady={setMapObj} />}
        {anchored && <MapClickClose enabled={!!active} onClose={() => onClearActive?.()} />}
      </MapContainer>
      {showCard && active && (
        anchored
          ? (
            <MarkerPreview
              map={mapObj}
              provider={active}
              onOpen={onOpenDetail}
              onBook={onBook}
              onClose={() => onClearActive?.()}
            />
          )
          : (
            <MapProviderCard
              provider={active}
              onOpen={onOpenDetail}
              onBook={onBook}
              onClose={() => onClearActive?.()}
            />
          )
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.luca .mv-wrap{position:relative;height:100%;width:100%;border-radius:var(--r);overflow:hidden;border:1px solid var(--line)}
.luca .mv-map{height:100%;width:100%;background:#aadaff;z-index:0}
.luca .leaflet-container{font-family:'IBM Plex Sans',sans-serif}
.luca .mv-divicon{background:transparent;border:none}
.luca .mv-pin{position:relative;width:40px;height:48px;transition:transform .15s ease;cursor:pointer}
.luca .mv-pin-body{position:absolute;top:0;left:3px;width:34px;height:34px;border-radius:50% 50% 50% 0;
  transform:rotate(-45deg);border:2.5px solid #fff;box-shadow:0 3px 8px rgba(2,32,42,.3);display:grid;place-items:center}
.luca .mv-pin-rating{transform:rotate(45deg);color:#fff;font-weight:800;font-size:12px;font-family:'Space Grotesk',sans-serif}
.luca .mv-pin-active{z-index:1000!important;filter:drop-shadow(0 6px 12px rgba(2,32,42,.4))}
.luca .mv-userdot{width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;
  box-shadow:0 0 0 2px rgba(37,99,235,.4);position:relative}
.luca .mv-userpulse{position:absolute;inset:-6px;border-radius:50%;background:rgba(37,99,235,.25);animation:mvpulse 2s ease-out infinite}
@keyframes mvpulse{0%{transform:scale(.6);opacity:.8}100%{transform:scale(1.8);opacity:0}}
.luca .mv-locate{position:absolute;right:12px;bottom:24px;z-index:500;width:40px;height:40px;border-radius:11px;
  background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow-sm);cursor:pointer;
  display:grid;place-items:center;color:var(--teal-d);transition:all .15s ease}
.luca .mv-locate:hover{background:var(--mint-soft);border-color:var(--mint);color:var(--mint-ink)}
.luca .leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.7)}
/* Selected-provider compact card, kept inside the map viewport. */
.luca .mv-card{position:absolute;left:12px;right:12px;bottom:14px;z-index:600;margin:0 auto;max-width:360px;
  background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 12px 34px rgba(6,40,38,.26);
  padding:13px 14px;animation:mvCardUp .22s cubic-bezier(.2,.8,.2,1)}
@keyframes mvCardUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.luca .mv-card-x{position:absolute;top:7px;right:7px;width:40px;height:40px;border-radius:10px;border:none;
  background:var(--surface-2);color:var(--muted);display:grid;place-items:center;cursor:pointer}
.luca .mv-card-x:hover{background:var(--line-2);color:var(--ink)}
.luca .mv-card-media{width:100%;height:96px;border-radius:12px;overflow:hidden;background:var(--surface-2);margin-bottom:10px}
.luca .mv-card-media img{width:100%;height:100%;object-fit:cover;display:block}
.luca .mv-card-noimg{width:100%;height:100%;display:grid;place-items:center;color:var(--muted);
  background:linear-gradient(135deg,var(--mint-soft),var(--surface-2))}
.luca .mv-card-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-right:30px}
.luca .mv-card-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15.5px;color:var(--ink);margin-top:7px;line-height:1.25}
.luca .mv-card-row{display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);margin-top:4px}
.luca .mv-card-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.luca .mv-card-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:var(--teal-d);
  background:var(--mint-soft);border:1px solid var(--mint-line);border-radius:999px;padding:3px 9px}
.luca .mv-card-price{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:15px;color:var(--teal-d);margin-top:9px}
.luca .mv-card-foot{display:flex;align-items:center;gap:8px;margin-top:11px}
.luca .mv-card-btn{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--teal-d);color:#fff;border:none;
  border-radius:11px;padding:9px 15px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;min-height:42px}
.luca .mv-card-btn:hover{background:var(--teal-d2)}
.luca .mv-card-btn.ghost{background:var(--surface-2);color:var(--teal-d);border:1px solid var(--mint-line)}
.luca .mv-card-btn.ghost:hover{background:var(--mint-soft)}
/* ── Mobile: compact marker-anchored preview (positioned above the pin) ── */
.luca .mv-prev{position:absolute;z-index:600;transform:translateY(-100%);
  background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 10px 28px rgba(6,40,38,.28);
  padding:10px;max-width:290px;max-height:210px;overflow:hidden;
  display:flex;flex-direction:column;gap:8px;animation:mvCardUp .2s cubic-bezier(.2,.8,.2,1)}
.luca .mv-prev-x{position:absolute;top:6px;right:6px;z-index:2;width:26px;height:26px;border-radius:8px;border:none;
  background:var(--surface-2);color:var(--muted);display:grid;place-items:center;cursor:pointer}
.luca .mv-prev-x:hover{background:var(--line-2);color:var(--ink)}
.luca .mv-prev-body{display:flex;gap:10px;align-items:flex-start;text-align:left;border:none;background:none;
  padding:0;margin:0;cursor:pointer;font-family:inherit;width:100%;min-width:0}
.luca .mv-prev-media{flex:none;width:72px;height:72px;border-radius:11px;overflow:hidden;background:var(--surface-2)}
.luca .mv-prev-media img{width:100%;height:100%;object-fit:cover;display:block}
.luca .mv-prev-noimg{width:100%;height:100%;display:grid;place-items:center;color:var(--muted);
  background:linear-gradient(135deg,var(--mint-soft),var(--surface-2))}
.luca .mv-prev-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-right:24px}
.luca .mv-prev-type{display:flex;min-width:0}
.luca .mv-prev-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14px;color:var(--ink);
  line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .mv-prev-rate{min-width:0}
.luca .mv-prev-loc,.luca .mv-prev-mod{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);
  min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.luca .mv-prev-loc svg,.luca .mv-prev-mod svg{flex:none}
.luca .mv-prev-mod{color:var(--teal-d);font-weight:600}
.luca .mv-prev-foot{display:flex;gap:8px}
.luca .mv-prev-btn{flex:1 1 0;display:inline-flex;align-items:center;justify-content:center;gap:5px;background:var(--teal-d);
  color:#fff;border:none;border-radius:10px;padding:8px 12px;font-weight:700;font-size:12.5px;cursor:pointer;
  font-family:inherit;min-height:40px}
.luca .mv-prev-btn:hover{background:var(--teal-d2)}
.luca .mv-prev-btn.ghost{background:var(--surface-2);color:var(--teal-d);border:1px solid var(--mint-line)}
.luca .mv-prev-btn.ghost:hover{background:var(--mint-soft)}
.luca .mv-prev-arrow{position:absolute;bottom:-7px;width:14px;height:14px;background:var(--surface);
  border-right:1px solid var(--line);border-bottom:1px solid var(--line);transform:translateX(-50%) rotate(45deg)}
`;

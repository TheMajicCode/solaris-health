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
import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed } from 'lucide-react';
import { typeMeta } from './ProviderBadges.jsx';

const SV_CENTER = [13.6929, -89.2182]; // San Salvador

// Brand palette for marker accents
const ACCENT = { teal: '#0f766e', emerald: '#10b981', gold: '#d4a52a' };

function pinIcon(provider, active) {
  const meta = typeMeta(provider.provider_type);
  const color = provider.featured ? ACCENT.gold : ACCENT[meta.accent] || ACCENT.teal;
  const scale = active ? 1.18 : 1;
  const ring = provider.vtv_certified ? '#d4a52a' : '#ffffff';
  const html = `
    <div class="mv-pin${active ? ' mv-pin-active' : ''}" style="transform:scale(${scale})">
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
}) {
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
      </MapContainer>
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
`;

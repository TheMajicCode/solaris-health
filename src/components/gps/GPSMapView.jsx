/**
 * GPSMapView — a living map of the Solaris network.
 * Organization nodes are plotted from /api/organizations. Clicking a node opens
 * a side card showing how much Health, Wealth, and Sovereignty that node has
 * "reclaimed" for its community, each rendered as a circular SVG progress dial.
 */
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Heart, Coins, ShieldCheck, Loader2, Building2 } from 'lucide-react';
import { api } from '../../lib/api.js';

// Fix Leaflet's default marker icon paths (broken by bundlers) using CDN assets.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const EL_SALVADOR = [13.6929, -89.2182];

const solarisIcon = (active) => L.divIcon({
  className: 'gmap-pin-wrap',
  html: `<div class="gmap-pin ${active ? 'active' : ''}"><span></span></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function Dial({ value = 0, label, color, icon: Icon }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const R = 26, C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);
  return (
    <div className="gmap-dial">
      <svg width="66" height="66" viewBox="0 0 66 66">
        <circle cx="33" cy="33" r={R} fill="none" stroke="var(--line,#e4e8ec)" strokeWidth="6" />
        <circle cx="33" cy="33" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 33 33)" style={{ transition: 'stroke-dashoffset .8s ease' }} />
        <text x="33" y="37" textAnchor="middle" fontFamily="'Space Grotesk',sans-serif" fontWeight="700"
          fontSize="15" fill="var(--ink,#12202b)">{Math.round(pct)}</text>
      </svg>
      <div className="gmap-dial-lbl"><Icon size={12} style={{ color }} /> {label}</div>
    </div>
  );
}

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, 9, { duration: 0.8 }); }, [center]);
  return null;
}

export default function GPSMapView() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [flyCenter, setFlyCenter] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await api.getOrganizations(); if (alive) setOrgs(r.organizations || []); }
      catch { if (alive) setOrgs([]); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const openOrg = async (org) => {
    setSelected(org);
    setDetail(null);
    if (org.lat != null && org.lng != null) setFlyCenter([Number(org.lat), Number(org.lng)]);
    setDetailLoading(true);
    try { const r = await api.getOrganization(org.id); setDetail(r); }
    catch { setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const pins = orgs.filter((o) => o.lat != null && o.lng != null);
  const dials = selected?.dials || {};

  return (
    <div className="gmap">
      <div className="gmap-header">
        <div>
          <h2 className="gmap-h">The Network</h2>
          <p className="gmap-sub">Every node reclaims Health, Wealth &amp; Sovereignty for its community.</p>
        </div>
        <span className="gmap-count"><Building2 size={13} /> {orgs.length} nodes</span>
      </div>

      <div className="gmap-stage">
        <div className="gmap-map-wrap">
          {loading && <div className="gmap-loading"><Loader2 size={20} className="gmap-spin" /> Loading network…</div>}
          <MapContainer center={EL_SALVADOR} zoom={6} scrollWheelZoom style={{ height: 500, width: '100%', borderRadius: 'var(--r,16px)' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://carto.com/cdn.prod.website-files.com/63483ad423421bd16e7a7ae7/679a8d44834eee28248e5d08_63c58baac336446d24a9d653_taxi_nyc.png"
            />
            <FlyTo center={flyCenter} />
            {pins.map((o) => (
              <Marker
                key={o.id}
                position={[Number(o.lat), Number(o.lng)]}
                icon={solarisIcon(selected?.id === o.id)}
                eventHandlers={{ click: () => openOrg(o) }}
              />
            ))}
          </MapContainer>
        </div>

        {selected && (
          <div className="gmap-card">
            <button className="gmap-card-close" onClick={() => setSelected(null)}><X size={16} /></button>
            <div className="gmap-card-type">{String(selected.type || 'node').replace(/_/g, ' ')}</div>
            <h3 className="gmap-card-name">{selected.name}</h3>
            {selected.description && <p className="gmap-card-desc">{selected.description}</p>}

            <div className="gmap-dials">
              <Dial value={dials.health} label="Health" color="#2FA37C" icon={Heart} />
              <Dial value={dials.wealth} label="Wealth" color="#D69B33" icon={Coins} />
              <Dial value={dials.sovereignty} label="Sovereignty" color="#7C5CBF" icon={ShieldCheck} />
            </div>
            <div className="gmap-dials-note">Percent reclaimed for this community (simulated)</div>

            {detailLoading && <div className="gmap-detail-loading"><Loader2 size={14} className="gmap-spin" /> Loading node…</div>}
            {detail && (
              <div className="gmap-detail">
                {detail.steward && (
                  <div className="gmap-detail-row">
                    <span className="gmap-detail-lbl">Steward</span>
                    <span className="gmap-detail-val">{detail.steward.name} · {String(detail.steward.role || '').replace(/_/g, ' ')}</span>
                  </div>
                )}
                {detail.splitPolicy && (
                  <div className="gmap-detail-row">
                    <span className="gmap-detail-lbl">Split policy</span>
                    <span className="gmap-detail-val">{detail.splitPolicy.name}</span>
                  </div>
                )}
                {selected.npubMock && (
                  <div className="gmap-detail-row">
                    <span className="gmap-detail-lbl">Node key</span>
                    <span className="gmap-detail-val mono">{selected.npubMock.slice(0, 14)}… <span className="gmap-mock">mock</span></span>
                  </div>
                )}
                {Array.isArray(selected.services) && selected.services.length > 0 && (
                  <div className="gmap-services">
                    {selected.services.map((s, i) => <span key={i} className="gmap-svc">{s}</span>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && pins.length === 0 && (
        <div className="gmap-empty"><MapPin size={16} /> No geolocated nodes yet.</div>
      )}

      <style>{`
        .luca .gmap-header{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px}
        .luca .gmap-h{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:20px;color:var(--ink);margin:0}
        .luca .gmap-sub{font-size:13px;color:var(--muted);margin:2px 0 0}
        .luca .gmap-count{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--teal-d);
          background:var(--mint-soft);padding:5px 11px;border-radius:99px;flex:none}
        .luca .gmap-stage{position:relative;display:flex;gap:16px;align-items:flex-start}
        .luca .gmap-map-wrap{position:relative;flex:1;min-width:0}
        .luca .gmap-loading{position:absolute;z-index:500;top:12px;left:12px;display:flex;align-items:center;gap:8px;
          background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:6px 12px;font-size:12px;color:var(--muted)}
        .luca .gmap-card{width:300px;flex:none;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);
          padding:18px;position:relative;box-shadow:var(--shadow-sm)}
        .luca .gmap-card-close{position:absolute;top:10px;right:10px;background:var(--surface-2);border:none;border-radius:50%;
          width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted)}
        .luca .gmap-card-type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--teal-d)}
        .luca .gmap-card-name{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;color:var(--ink);margin:4px 0 6px}
        .luca .gmap-card-desc{font-size:12.5px;color:var(--muted);line-height:1.5;margin:0 0 14px}
        .luca .gmap-dials{display:flex;justify-content:space-between;gap:6px;margin-top:6px}
        .luca .gmap-dial{display:flex;flex-direction:column;align-items:center;gap:5px}
        .luca .gmap-dial-lbl{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--ink)}
        .luca .gmap-dials-note{text-align:center;font-size:10.5px;font-style:italic;color:var(--muted);margin-top:8px}
        .luca .gmap-detail{margin-top:14px;border-top:1px solid var(--line);padding-top:12px;display:flex;flex-direction:column;gap:8px}
        .luca .gmap-detail-row{display:flex;flex-direction:column;gap:1px}
        .luca .gmap-detail-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
        .luca .gmap-detail-val{font-size:12.5px;color:var(--ink)}
        .luca .gmap-detail-val.mono{font-family:'IBM Plex Mono',monospace;font-size:11.5px}
        .luca .gmap-mock{font-size:9px;font-weight:700;text-transform:uppercase;background:#FBEFD3;color:#8A5F13;padding:1px 5px;border-radius:99px}
        .luca .gmap-detail-loading{margin-top:12px;display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted)}
        .luca .gmap-services{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
        .luca .gmap-svc{font-size:10.5px;color:var(--teal-d);background:var(--mint-soft);padding:3px 8px;border-radius:99px}
        .luca .gmap-empty{display:flex;align-items:center;gap:8px;justify-content:center;padding:24px;color:var(--muted);
          background:var(--surface);border:1px dashed var(--line);border-radius:var(--r);margin-top:12px}
        .luca .gmap-spin{animation:spin 1s linear infinite}
        .gmap-pin{width:24px;height:24px;border-radius:50%;background:#2FA37C;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(14,22,30,.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s}
        .gmap-pin span{width:7px;height:7px;border-radius:50%;background:#fff}
        .gmap-pin.active{background:#7C5CBF;transform:scale(1.25)}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}

/**
 * NetworkSection — the "Network" surface inside the Economic Passport drawer.
 *
 * §10: the arbitrary in-house map is replaced by the official BTC Map, embedded
 * responsively via an iframe (https://btcmap.org/map). We do NOT reimplement or
 * re-host BTC Map data. `allow="geolocation"` is intentionally omitted so the
 * embed never auto-requests the user's location on open. An "Open in BTC Map"
 * link is ALWAYS visible as a fallback when embedding is blocked.
 *
 * Two collapsible accordions sit below the map — Communities and Ecosystem Apps.
 * Both are collapsed by default, remember their open/closed state locally, and
 * show ONLY configured/verifiable data. With no configured entries they render
 * an honest empty state — never invented examples.
 */
import React, { useState } from 'react';
import { ExternalLink, ChevronDown, Users, Grid, MapPin } from 'lucide-react';

const BTCMAP_URL = 'https://btcmap.org/map';
const ACC_KEY = 'solaris.network.accordions';

function readAccState() {
  try { return JSON.parse(localStorage.getItem(ACC_KEY) || '{}') || {}; } catch { return {}; }
}
function writeAccState(next) {
  try { localStorage.setItem(ACC_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

function Accordion({ id, icon: Icon, title, count, children }) {
  const [open, setOpen] = useState(() => !!readAccState()[id]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeAccState({ ...readAccState(), [id]: next });
  };
  return (
    <div className={`acc ${open ? 'open' : ''}`}>
      <button type="button" className="acc-head" aria-expanded={open} onClick={toggle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} /> {title}{typeof count === 'number' ? ` (${count})` : ''}
        </span>
        <ChevronDown size={17} className="acc-chev" />
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

export default function NetworkSection() {
  // Real data only. With no configured/verifiable source these stay empty and we
  // render an honest empty state rather than inventing communities or apps.
  const communities = [];
  const ecosystemApps = [];

  return (
    <div className="network">
      <header style={{ marginBottom: 12 }}>
        <h2 className="sc-title" style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 19, margin: 0, color: 'var(--ink)' }}>The Network</h2>
        <p className="sc-sub" style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.5 }}>
          Find bitcoin-accepting places on the community-run BTC Map.
        </p>
      </header>

      <div className="btcmap-wrap">
        <iframe
          className="btcmap-frame"
          src={BTCMAP_URL}
          title="BTC Map — bitcoin-accepting places"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <a className="btcmap-open" href={BTCMAP_URL} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} /> Open in BTC Map
      </a>

      <Accordion id="communities" icon={Users} title="Communities" count={communities.length}>
        {communities.length === 0 ? (
          <div className="acc-empty">No Solaris or partner communities are configured yet. Verified communities will appear here as they join.</div>
        ) : (
          communities.map((c) => (
            <div key={c.id} style={{ padding: '6px 0' }}>{c.name}</div>
          ))
        )}
      </Accordion>

      <Accordion id="ecosystemApps" icon={Grid} title="Ecosystem Apps" count={ecosystemApps.length}>
        {ecosystemApps.length === 0 ? (
          <div className="acc-empty">No ecosystem apps are integrated yet. Approved, genuinely-integrated apps will be listed here.</div>
        ) : (
          ecosystemApps.map((a) => (
            <div key={a.id} style={{ padding: '6px 0' }}>{a.name}</div>
          ))
        )}
      </Accordion>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--muted-2,#8aa09a)', marginTop: 6 }}>
        <MapPin size={12} /> Map data © BTC Map & OpenStreetMap contributors.
      </div>
    </div>
  );
}

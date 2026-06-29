/**
 * Forward / reverse geocoding via OpenStreetMap Nominatim.
 * Best-effort: never throws — returns null on any failure so callers can
 * gracefully fall back to manual coordinates.
 *
 * Nominatim usage policy: max ~1 req/sec, requires a descriptive User-Agent.
 * We bias results toward El Salvador (the LUCA launch market) but accept any.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'LUCA-Passport/1.0 (Solaris Health marketplace; contact@solaris.health)';

let lastCall = 0;
const MIN_INTERVAL_MS = 1100;

async function rateLimit() {
  const now = Date.now();
  const wait = lastCall + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCall = Date.now();
}

/**
 * Forward geocode a free-text address into coordinates.
 * @param {string} address
 * @param {object} [opts] { country, city }
 * @returns {Promise<{lat:number, lon:number, display:string}|null>}
 */
async function geocode(address, opts = {}) {
  if (!address || !String(address).trim()) return null;
  try {
    await rateLimit();
    const parts = [address];
    if (opts.city) parts.push(opts.city);
    parts.push(opts.country || 'El Salvador');
    const q = parts.filter(Boolean).join(', ');
    const url = `${NOMINATIM_BASE}/search?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon, display: hit.display_name || q };
  } catch (err) {
    return null;
  }
}

/**
 * Reverse geocode coordinates into a human-readable address.
 * @returns {Promise<{display:string, city:string|null, country:string|null}|null>}
 */
async function reverseGeocode(lat, lon) {
  if (lat == null || lon == null) return null;
  try {
    await rateLimit();
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.display_name) return null;
    const a = data.address || {};
    return {
      display: data.display_name,
      city: a.city || a.town || a.village || a.county || null,
      country: a.country || null,
    };
  } catch (err) {
    return null;
  }
}

module.exports = { geocode, reverseGeocode };

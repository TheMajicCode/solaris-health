/**
 * Client-side level band helper — mirrors backend backend/src/lib/levels.js.
 * Bands: 1-9 Bronze · 10-99 Silver · 100-999 Gold · 1000-9999 Platinum · 10000+ Master
 * UI color mapping (per Solaris spec): Bronze=amber, Silver=slate, Gold=yellow, Platinum=blue, Master=purple
 */
export const BANDS = [
  { band: 'Bronze', min: 1, max: 9, color: '#B87333', soft: '#F6E9DC', ink: '#7A4A1E' },
  { band: 'Silver', min: 10, max: 99, color: '#9AA6B2', soft: '#EDEFF2', ink: '#59636E' },
  { band: 'Gold', min: 100, max: 999, color: '#D69B33', soft: '#FBEFD3', ink: '#8A5F13' },
  { band: 'Platinum', min: 1000, max: 9999, color: '#5B8FD9', soft: '#E4EEFB', ink: '#2C568F' },
  { band: 'Master', min: 10000, max: Infinity, color: '#7C5CBF', soft: '#EDE6FA', ink: '#4E3785' },
];

export function levelFor(points) {
  const p = Math.max(0, Number(points) || 0);
  const idx = BANDS.findIndex((b) => p >= b.min && p <= b.max);
  const bandIdx = p < 1 ? 0 : idx === -1 ? BANDS.length - 1 : idx;
  const b = BANDS[bandIdx];
  const nextBand = BANDS[bandIdx + 1] || null;
  const nextThreshold = nextBand ? nextBand.min : null;
  const floor = b.min <= 1 ? 0 : b.min;
  const ceil = nextThreshold || b.max;
  const span = ceil - floor || 1;
  const progress = nextThreshold ? Math.min(1, Math.max(0, (p - floor) / span)) : 1;
  return {
    points: p,
    band: b.band,
    color: b.color,
    soft: b.soft,
    ink: b.ink,
    nextThreshold,
    pointsToNext: nextThreshold ? Math.max(0, nextThreshold - p) : 0,
    progress,
  };
}

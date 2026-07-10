/**
 * levels.js — shared contribution-level utility.
 *
 * Points map to a numeric level and a named band. Bands (per spec §4):
 *   1–9         Bronze
 *   10–99       Silver
 *   100–999     Gold
 *   1000–9999   Platinum
 *   10000+      Master  (10000+ shown as Master / Grand Master)
 *
 * A single source of truth so the seed, the /api/leaderboard route and the
 * /api/luca/context route all compute the same thing.
 */

const BANDS = [
  { band: 'Bronze', min: 1, max: 9, color: '#B87333' },
  { band: 'Silver', min: 10, max: 99, color: '#9AA6B2' },
  { band: 'Gold', min: 100, max: 999, color: '#D69B33' },
  { band: 'Platinum', min: 1000, max: 9999, color: '#8FBBD9' },
  { band: 'Master', min: 10000, max: Infinity, color: '#7C5CBF' },
];

/**
 * Compute the level + band for a points total.
 * Level is a simple ordinal within the ecosystem: it grows with points and is
 * useful for a progress bar. We derive a friendly integer "level" and the band.
 */
function levelFor(points) {
  const pts = Math.max(0, Math.floor(Number(points) || 0));
  const band = BANDS.find((b) => pts >= b.min && pts <= b.max) || BANDS[0];

  // Numeric level: within-band position on a 1..9 style scale, plus band offset.
  let level;
  if (pts < 1) level = 0;
  else if (pts < 10) level = pts;                     // 1..9   Bronze
  else if (pts < 100) level = 10 + Math.floor((pts - 10) / 10);   // 10..18 Silver
  else if (pts < 1000) level = 20 + Math.floor((pts - 100) / 100); // 20..28 Gold
  else if (pts < 10000) level = 30 + Math.floor((pts - 1000) / 1000); // 30..38 Platinum
  else level = 40 + Math.floor((pts - 10000) / 10000); // 40+   Master

  // Progress toward the next band threshold (0..1) for a UI progress bar.
  let nextThreshold;
  if (pts < 10) nextThreshold = 10;
  else if (pts < 100) nextThreshold = 100;
  else if (pts < 1000) nextThreshold = 1000;
  else if (pts < 10000) nextThreshold = 10000;
  else nextThreshold = null;

  const prevThreshold = band.min <= 1 ? 0 : band.min;
  const progress = nextThreshold
    ? Math.min(1, (pts - prevThreshold) / (nextThreshold - prevThreshold))
    : 1;

  return {
    points: pts,
    level,
    band: band.band,
    color: band.color,
    nextThreshold,
    pointsToNext: nextThreshold ? Math.max(0, nextThreshold - pts) : 0,
    progress: Math.round(progress * 100) / 100,
  };
}

module.exports = { levelFor, BANDS };

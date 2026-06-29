/**
 * Geospatial distance helpers for the LUCA marketplace.
 * All math uses the Haversine formula on a spherical Earth (good to ~0.5%).
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lon points, in kilometers.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null || lon1 == null ||
    lat2 == null || lon2 == null ||
    Number.isNaN(+lat1) || Number.isNaN(+lon1) ||
    Number.isNaN(+lat2) || Number.isNaN(+lon2)
  ) {
    return null;
  }
  const dLat = toRad(+lat2 - +lat1);
  const dLon = toRad(+lon2 - +lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(+lat1)) *
      Math.cos(toRad(+lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Compute a lat/lon bounding box around a center point for a given radius (km).
 * Used to pre-filter rows in SQL before precise Haversine sorting in app code.
 */
function boundingBox(lat, lon, radiusKm) {
  const latDelta = radiusKm / 111.32; // ~111.32 km per degree of latitude
  const cosLat = Math.cos(toRad(+lat));
  const lonDelta = radiusKm / (111.32 * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat));
  return {
    minLat: +lat - latDelta,
    maxLat: +lat + latDelta,
    minLon: +lon - lonDelta,
    maxLon: +lon + lonDelta,
  };
}

/**
 * Round a distance for display: <1 km shows in meters granularity.
 */
function formatDistanceKm(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

module.exports = { haversineKm, boundingBox, formatDistanceKm, EARTH_RADIUS_KM };

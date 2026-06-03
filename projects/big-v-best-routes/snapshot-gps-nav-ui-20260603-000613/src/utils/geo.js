/**
 * geo.js — Geospatial utility functions
 * Big V's Best Routes
 *
 * Pure functions only. No state. No side effects.
 */

const EARTH_RADIUS_M = 6371000;

/**
 * Haversine distance between two lat/lon points (metres).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} distance in metres
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Calculate bearing (degrees) from point A to point B.
 * 0° = north, 90° = east, 180° = south, 270° = west.
 */
export function bearing(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Interpolate a position along a [[lat, lon]] polyline at progress 0–1.
 * Returns { lat, lon, bearing }.
 */
export function interpolateAlongPolyline(polyline, progress) {
  if (!polyline || polyline.length < 2) return null;
  const clamped = Math.max(0, Math.min(1, progress));
  const total = polyline.length - 1;
  const pos = clamped * total;
  const idx = Math.min(Math.floor(pos), total - 1);
  const t = pos - idx;
  const [lat1, lon1] = polyline[idx];
  const [lat2, lon2] = polyline[idx + 1];
  return {
    lat:     lat1 + (lat2 - lat1) * t,
    lon:     lon1 + (lon2 - lon1) * t,
    bearing: bearing(lat1, lon1, lat2, lon2),
  };
}

/**
 * Find the nearest polyline index to a given lat/lon.
 * Used for GPS snapping.
 */
export function nearestPolylineIndex(polyline, lat, lon) {
  if (!polyline || polyline.length === 0) return 0;
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineDistance(lat, lon, polyline[i][0], polyline[i][1]);
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return minIdx;
}

/**
 * Validate a coordinate pair.
 * Returns { valid: true } or { valid: false, message }.
 */
export function validateCoords(lat, lon) {
  if (lat == null || lon == null) return { valid: false, message: 'Coordinates are null or undefined.' };
  if (typeof lat !== 'number' || typeof lon !== 'number') return { valid: false, message: 'Coordinates must be numbers.' };
  if (isNaN(lat) || isNaN(lon)) return { valid: false, message: 'Coordinates contain NaN.' };
  if (lat < -90 || lat > 90)   return { valid: false, message: `Latitude ${lat} is out of range (-90 to 90).` };
  if (lon < -180 || lon > 180) return { valid: false, message: `Longitude ${lon} is out of range (-180 to 180).` };
  return { valid: true };
}

/**
 * Parse a "lat,lon" string into { lat, lon } or null.
 */
export function parseCoordString(str) {
  if (!str) return null;
  const parts = str.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 2) return null;
  const [lat, lon] = parts;
  if (!validateCoords(lat, lon).valid) return null;
  return { lat, lon };
}

/**
 * Calculate the total length of a polyline in metres.
 */
export function polylineLength(polyline) {
  if (!polyline || polyline.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineDistance(polyline[i][0], polyline[i][1], polyline[i + 1][0], polyline[i + 1][1]);
  }
  return total;
}

/**
 * offlineCache.js — Offline Trip Pack placeholder
 * Provides a localStorage-backed route cache so trips can be recalled when offline.
 */

const CACHE_KEY = 'big-v-routes-offline-trips-v1';
const MAX_CACHED = 20;

function safeParse(v) {
  try { return JSON.parse(v); } catch { return null; }
}

export function getCachedTrips() {
  return safeParse(localStorage.getItem(CACHE_KEY)) || [];
}

export function cacheTrip({ origin, destination, vehicle, routeResult, complianceResult }) {
  const trips = getCachedTrips();
  const entry = {
    id: `trip-${Date.now()}`,
    savedAt: new Date().toISOString(),
    origin,
    destination,
    vehicleName: vehicle?.name || 'Unknown',
    vehicleType: vehicle?.type || 'unknown',
    distanceM: routeResult?.route?.distanceM || null,
    durationMs: routeResult?.route?.durationMs || null,
    complianceScore: complianceResult?.score ?? null,
    complianceStatus: complianceResult?.status ?? null,
    demoMode: routeResult?.demoMode ?? true,
    polyline: routeResult?.route?.polyline || [],
  };
  const updated = [entry, ...trips].slice(0, MAX_CACHED);
  localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  return entry;
}

export function removeCachedTrip(id) {
  const trips = getCachedTrips().filter((t) => t.id !== id);
  localStorage.setItem(CACHE_KEY, JSON.stringify(trips));
}

export function clearTripCache() {
  localStorage.removeItem(CACHE_KEY);
}

/**
 * GraphHopper routing adapter — Big V's Best Routes
 * All routing provider logic is isolated here.
 * Do NOT import this from UI components directly — call via App.jsx / store actions.
 */

import { geocodeAddress } from '../services/geocodingClient.js';
import { decodePolyline } from '../utils/polyline.js';

const GH_BASE = "https://graphhopper.com/api/1";
const ENV_KEY = (typeof import.meta !== "undefined" && import.meta.env?.VITE_GRAPHHOPPER_API_KEY) || "";

/** Map Big V vehicle types to GraphHopper profiles */
export function mapVehicleToGraphHopperProfile(type) {
  const map = {
    car: 'car',
    van: 'car',
    hgv: 'truck',
    motorhome: 'truck',
    trailer: 'truck',
    bus: 'truck',
    motorcycle: 'motorcycle',
    bicycle: 'bike',
    custom: 'truck',
  };
  return map[type] || 'car';
}

/**
 * Build a demo/fallback route between two coordinates.
 * Used when no API key is configured or in offline mode.
 */
function buildDemoRoute(originCoords, destCoords, vehicleProfile) {
  const demoPolyline = [
    [originCoords.lat, originCoords.lon],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.25, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.25],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.5, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.5 - 0.03],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.75, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.75],
    [destCoords.lat, destCoords.lon],
  ];

  // Rough haversine distance
  const R = 6371000;
  const dLat = ((destCoords.lat - originCoords.lat) * Math.PI) / 180;
  const dLon = ((destCoords.lon - originCoords.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((originCoords.lat * Math.PI) / 180) *
      Math.cos((destCoords.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const distanceM = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  const durationMs = Math.round((distanceM / 80) * 3600 * 1000); // 80 km/h avg

  return {
    ok: true,
    provider: 'demo',
    demoMode: true,
    message: 'Demo mode — add a GraphHopper API key in Settings for live routing.',
    route: {
      distanceM,
      durationMs,
      polyline: demoPolyline,
      instructions: [
        { text: 'Head towards your destination (demo route)', distanceM, timeMs: durationMs, sign: 0 },
      ],
      bbox: null,
      profile: vehicleProfile,
    },
    originLabel: originCoords.label || 'Origin',
    destLabel: destCoords.label || 'Destination',
  };
}

/**
 * Main routing entry point.
 * Returns a normalised route result object — same shape regardless of provider/demo.
 */
export async function calculateGraphHopperRoute({ origin, destination, vehicle, apiKey, forceDemo = false }) {
  // Prefer build-time env var over runtime settings key
  const resolvedKey = ENV_KEY || apiKey || "";
  // Respect settings demoMode toggle
  if (forceDemo) return buildDemoRoute(
    { lat: 51.4545, lon: -2.5879, label: origin },
    { lat: 51.4816, lon: -3.1791, label: destination },
    vehicleProfile,
  );
  const vehicleProfile = mapVehicleToGraphHopperProfile(vehicle?.type);

  // Step 1 — Geocode
  let originCoords, destCoords;
  try {
    [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);
  } catch (geocodeError) {
    return {
      ok: false,
      provider: 'geocoding',
      message: `Could not determine coordinates: ${geocodeError.message}`,
      route: null,
    };
  }

  // Step 2 — If no API key, return demo route
  if (!resolvedKey || resolvedKey.trim() === "") {
    return buildDemoRoute(originCoords, destCoords, vehicleProfile);
  // End demo guard
  }

  // Step 3 — Live GraphHopper request
  const params = new URLSearchParams({
    key: resolvedKey,
    vehicle: vehicleProfile,
    locale: 'en',
    instructions: 'true',
    points_encoded: 'true',
    'point[0]': `${originCoords.lat},${originCoords.lon}`,
    'point[1]': `${destCoords.lat},${destCoords.lon}`,
  });

  try {
    const res = await fetch(`${GH_BASE}/route?${params.toString()}`);

    if (res.status === 401) {
      return {
        ok: false,
        provider: 'graphhopper',
        message: 'GraphHopper API key is invalid or unauthorised (401). Check your key in Settings.',
        route: null,
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        provider: 'graphhopper',
        message: 'GraphHopper rate limit reached. Try again shortly or use Demo mode.',
        route: null,
      };
    }
    if (!res.ok) {
      let msg = `GraphHopper error (HTTP ${res.status}).`;
      try {
        const body = await res.json();
        if (body?.message) msg += ` ${body.message}`;
      } catch {
        // ignore JSON parse failure
      }
      return { ok: false, provider: 'graphhopper', message: msg, route: null };
    }

    const data = await res.json();

    if (!data?.paths || data.paths.length === 0) {
      return {
        ok: false,
        provider: 'graphhopper',
        message: 'GraphHopper returned no route. Check origin/destination or try different locations.',
        route: null,
      };
    }

    const path = data.paths[0];
    const polyline = decodePolyline(path.points);

    const instructions = (path.instructions || []).map((ins) => ({
      text: ins.text || ins.street_name || '',
      distanceM: ins.distance || 0,
      timeMs: ins.time || 0,
      sign: ins.sign || 0,
    }));

    return {
      ok: true,
      provider: 'graphhopper',
      demoMode: false,
      message: `Route calculated via GraphHopper (${vehicleProfile}).`,
      route: {
        distanceM: path.distance || 0,
        durationMs: path.time || 0,
        polyline,
        instructions,
        bbox: path.bbox || null,
        profile: vehicleProfile,
      },
      originLabel: originCoords.label || origin,
      destLabel: destCoords.label || destination,
    };
  } catch (networkError) {
    // Network failure — offer demo fallback
    const demo = buildDemoRoute(originCoords, destCoords, vehicleProfile);
    return {
      ...demo,
      ok: false,
      provider: 'graphhopper-offline',
      message: `Network error reaching GraphHopper (${networkError.message}). Showing offline demo route.`,
    };
  }
}

/**
 * graphhopperClient.js — GraphHopper routing provider client
 * Big V's Best Routes
 *
 * This is the canonical routing client. src/core/graphHopperAdapter.js
 * now re-exports from here to preserve import compatibility.
 *
 * Product rules:
 * - Never hardcode API keys.
 * - If VITE_GRAPHHOPPER_API_KEY is missing, return a setup-required error.
 * - Dev-only fallback route requires VITE_ENABLE_DEV_ROUTE_FALLBACK=true.
 * - Default product mode: no silently fake routes.
 */

import { geocodeAddress } from './geocodingClient.js';
import { decodePolyline } from '../utils/polyline.js';
import { haversineDistance } from '../utils/geo.js';

const GH_BASE = 'https://graphhopper.com/api/1';

const ENV_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRAPHHOPPER_API_KEY) || '';
const ENV_MAP_STYLE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAP_STYLE_URL) || '';
const DEV_FALLBACK_ENABLED =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_DEV_ROUTE_FALLBACK) === 'true';

/** Map Big V vehicle types to GraphHopper routing profiles */
export function mapVehicleToGHProfile(type) {
  const map = {
    car:        'car',
    van:        'car',
    hgv:        'truck',
    motorhome:  'truck',
    trailer:    'truck',
    bus:        'truck',
    motorcycle: 'motorcycle',
    bicycle:    'bike',
    custom:     'truck',
  };
  return map[type] || 'car';
}

/**
 * Development-only fallback route builder.
 * Only ever called when VITE_ENABLE_DEV_ROUTE_FALLBACK=true.
 * This is NOT a product feature — it is a dev tool.
 */
function buildDevFallbackRoute(originCoords, destCoords, vehicleProfile) {
  const pts = [
    [originCoords.lat, originCoords.lon],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.25, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.25],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.50, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.50 - 0.03],
    [originCoords.lat + (destCoords.lat - originCoords.lat) * 0.75, originCoords.lon + (destCoords.lon - originCoords.lon) * 0.75],
    [destCoords.lat, destCoords.lon],
  ];
  const distanceM = haversineDistance(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);
  const durationMs = Math.round((distanceM / 13.9) * 1000); // ~50 km/h avg

  return {
    ok:         true,
    provider:   'dev-fallback',
    demoMode:   true,
    devFallback: true,
    message:    '⚠ DEV FALLBACK ROUTE — VITE_ENABLE_DEV_ROUTE_FALLBACK=true. Not for product use.',
    route: {
      distanceM,
      durationMs,
      polyline:     pts,
      instructions: [
        { text: '[DEV] Straight-line fallback route — configure GraphHopper for real routing', distanceM, timeMs: durationMs, sign: 0 },
      ],
      bbox:    null,
      profile: vehicleProfile,
    },
    originLabel: originCoords.label || 'Origin',
    destLabel:   destCoords.label   || 'Destination',
  };
}

/**
 * Call GraphHopper routing API.
 *
 * @param {object} params
 * @param {string} params.origin      - address string or "lat,lon"
 * @param {string} params.destination - address string or "lat,lon"
 * @param {object} params.vehicle     - vehicle profile object from SSOT
 * @param {string} [params.apiKey]    - runtime API key from settings (falls back to env var)
 *
 * @returns {Promise<RouteResult>}
 *
 * RouteResult shape:
 * {
 *   ok:           boolean
 *   provider:     string
 *   demoMode:     boolean
 *   setupRequired: boolean  // true = user must configure GraphHopper
 *   message:      string
 *   route: {
 *     distanceM, durationMs, polyline, instructions, bbox, profile
 *   } | null
 *   originLabel:  string
 *   destLabel:    string
 * }
 */
export async function calculateRoute({ origin, destination, vehicle, apiKey }) {
  const resolvedKey = ENV_API_KEY || apiKey || '';
  const vehicleProfile = mapVehicleToGHProfile(vehicle?.type);

  // ── Step 1: Geocode origin and destination ──────────────────────────────
  let originCoords, destCoords;
  try {
    [originCoords, destCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]);
  } catch (geocodeErr) {
    return {
      ok: false, provider: 'geocoding', demoMode: false, setupRequired: false,
      message: `Geocoding failed: ${geocodeErr.message}`,
      route: null, originLabel: origin, destLabel: destination,
    };
  }

  // Warn if geocoder returned a placeholder (London fallback)
  const geocodingWarning = originCoords.source === 'fallback-london' || destCoords.source === 'fallback-london'
    ? `One or more addresses could not be geocoded. Results may not reflect actual locations.`
    : null;

  // ── Step 2: API key check ───────────────────────────────────────────────
  if (!resolvedKey || resolvedKey.trim() === '') {
    // Dev fallback mode — only if explicitly enabled
    if (DEV_FALLBACK_ENABLED) {
      return buildDevFallbackRoute(originCoords, destCoords, vehicleProfile);
    }

    // Product mode — show setup-required state
    return {
      ok:           false,
      provider:     'graphhopper',
      demoMode:     false,
      setupRequired: true,
      message:      'GraphHopper API key not configured. Add VITE_GRAPHHOPPER_API_KEY to your .env file or enter it in Settings → GraphHopper API key.',
      route:        null,
      originLabel:  originCoords.label || origin,
      destLabel:    destCoords.label   || destination,
    };
  }

  // ── Step 3: Live GraphHopper request ────────────────────────────────────
  const params = new URLSearchParams({
    key:             resolvedKey,
    vehicle:         vehicleProfile,
    locale:          'en',
    instructions:    'true',
    points_encoded:  'true',
    'point[0]':      `${originCoords.lat},${originCoords.lon}`,
    'point[1]':      `${destCoords.lat},${destCoords.lon}`,
  });

  try {
    const res = await fetch(`${GH_BASE}/route?${params.toString()}`);

    if (res.status === 401) {
      return {
        ok: false, provider: 'graphhopper', demoMode: false, setupRequired: true,
        message: 'GraphHopper API key is invalid or unauthorised (HTTP 401). Check your key in Settings.',
        route: null, originLabel: originCoords.label, destLabel: destCoords.label,
      };
    }
    if (res.status === 403) {
      return {
        ok: false, provider: 'graphhopper', demoMode: false, setupRequired: true,
        message: 'GraphHopper access forbidden (HTTP 403). Your API key may not have routing permissions.',
        route: null, originLabel: originCoords.label, destLabel: destCoords.label,
      };
    }
    if (res.status === 429) {
      return {
        ok: false, provider: 'graphhopper', demoMode: false, setupRequired: false,
        message: 'GraphHopper rate limit reached (HTTP 429). Wait a moment and try again.',
        route: null, originLabel: originCoords.label, destLabel: destCoords.label,
      };
    }
    if (!res.ok) {
      let msg = `GraphHopper error (HTTP ${res.status}).`;
      try { const body = await res.json(); if (body?.message) msg += ` ${body.message}`; } catch { /* ignore */ }
      return {
        ok: false, provider: 'graphhopper', demoMode: false, setupRequired: false,
        message: msg, route: null,
        originLabel: originCoords.label, destLabel: destCoords.label,
      };
    }

    const data = await res.json();

    if (!data?.paths?.length) {
      return {
        ok: false, provider: 'graphhopper', demoMode: false, setupRequired: false,
        message: 'GraphHopper returned no route for these locations. Check the addresses and try again.',
        route: null, originLabel: originCoords.label, destLabel: destCoords.label,
      };
    }

    const path = data.paths[0];
    const polyline = decodePolyline(path.points);

    const instructions = (path.instructions || []).map((ins) => ({
      text:       ins.text || ins.street_name || '',
      distanceM:  ins.distance || 0,
      timeMs:     ins.time || 0,
      sign:       ins.sign || 0,
    }));

    return {
      ok:       true,
      provider: 'graphhopper',
      demoMode: false,
      setupRequired: false,
      message:  geocodingWarning
        ? `Route calculated via GraphHopper. ⚠ ${geocodingWarning}`
        : `Route calculated via GraphHopper (${vehicleProfile}).`,
      route: {
        distanceM:  path.distance || 0,
        durationMs: path.time || 0,
        polyline,
        instructions,
        bbox:       path.bbox || null,
        profile:    vehicleProfile,
      },
      originLabel: originCoords.label || origin,
      destLabel:   destCoords.label   || destination,
    };

  } catch (networkErr) {
    return {
      ok: false, provider: 'graphhopper-offline', demoMode: false, setupRequired: false,
      message: `Network error reaching GraphHopper: ${networkErr.message}. Check your internet connection.`,
      route: null,
      originLabel: originCoords?.label || origin,
      destLabel:   destCoords?.label   || destination,
    };
  }
}

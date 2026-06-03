/**
 * mapConfig.js — MapLibre GL JS configuration
 * Big V's Best Routes
 *
 * Map style URL is read from VITE_MAP_STYLE_URL environment variable.
 * If missing, the app shows a setup-required state — it does NOT crash.
 *
 * To configure:
 *   Option A (vector tiles, free):
 *     Use https://demotiles.maplibre.org/style.json for development.
 *   Option B (full quality):
 *     Use a MapTiler, Stadia Maps, or self-hosted tile server style URL.
 *     Set VITE_MAP_STYLE_URL in your .env file.
 *
 * Do NOT use Google Maps SDK or any Google-proprietary style.
 */

const ENV_STYLE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MAP_STYLE_URL) || '';

/**
 * Whether the map style is configured.
 * If false, the NavigationView must show a setup-required state.
 */
export const MAP_STYLE_CONFIGURED = !!ENV_STYLE_URL;

/**
 * The resolved map style.
 * Falls back to MapLibre demo tiles for development only — never silently in product mode.
 * The component must check MAP_STYLE_CONFIGURED and show a banner if false.
 */
export const MAP_STYLE_URL = ENV_STYLE_URL || 'https://demotiles.maplibre.org/style.json';

/** Whether we are using the dev fallback style (no VITE_MAP_STYLE_URL set) */
export const MAP_STYLE_IS_FALLBACK = !ENV_STYLE_URL;

/** Map defaults */
export const MAP_DEFAULTS = {
  center:  [-2.5879, 51.4545],  // Bristol, UK — [lng, lat] for MapLibre
  zoom:    13,
  minZoom: 3,
  maxZoom: 19,
};

/** Navigation mode camera settings — 3D driver perspective */
export const NAV_CAMERA = {
  pitch:   55,     // degrees tilt toward horizon
  bearing: 0,      // degrees rotation (updated to route heading at runtime)
  zoom:    16,     // close-up driver view
  easeDuration: 800,  // ms for camera transitions
};

/** Route overview camera — fits full polyline on screen */
export const OVERVIEW_CAMERA = {
  pitch:   30,
  padding: { top: 60, bottom: 60, left: 40, right: 40 },
  duration: 1200,
};

/** Attribution text shown on map */
export const MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

/** Map source/layer IDs — keep stable so updates use setData, not full recreate */
export const MAP_LAYER_IDS = {
  routeSource:      'bv-route',
  routeShadow:      'bv-route-shadow',
  routeLine:        'bv-route-line',
  routeTravelled:   'bv-route-travelled',
  restrictionSource: 'bv-restrictions',
  restrictionLayer: 'bv-restriction-points',
};

// ─── OSM Raster Style — no API key, always available ─────────────────────────

/**
 * Build a MapLibre GL style object using OSM raster tiles.
 * No API key required. Uses the public OSM tile server.
 *
 * Suitable for use when VITE_MAP_STYLE_URL is not set.
 * Attribution required by OSM tile usage policy.
 *
 * @param {string} [tileUrl] - Optional custom tile URL template ({z}/{x}/{y}.png)
 * @returns {object} MapLibre GL style object
 */
export function buildOsmRasterStyle(tileUrl) {
  const tiles = tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return {
    version: 8,
    name:    'OSM Raster',
    sources: {
      'osm-raster': {
        type:        'raster',
        tiles:       [tiles],
        tileSize:    256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>',
        maxzoom:     19,
      },
    },
    layers: [
      {
        id:     'osm-raster-layer',
        type:   'raster',
        source: 'osm-raster',
        paint:  {
          'raster-opacity':    1,
          'raster-brightness-min': 0,
          'raster-contrast':   0.1,
          // Slight dark tint so our green route line pops on the map
          'raster-brightness-max': 0.85,
        },
      },
    ],
    glyphs:  'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sprite:  '',
  };
}

/**
 * Resolve the best available map style to use.
 * Priority:
 *   1. User-set VITE_MAP_STYLE_URL (env var)
 *   2. Inline OSM raster style (no key needed)
 *
 * Never returns null — always falls back to OSM raster.
 * @param {string} [customTileUrl] - Optional custom tile URL from serviceConfig
 * @returns {{ style: string|object, isOsmFallback: boolean, isFallbackStyle: boolean }}
 */
export function resolveMapStyle(customTileUrl) {
  if (ENV_STYLE_URL) {
    return { style: ENV_STYLE_URL, isOsmFallback: false, isFallbackStyle: false };
  }
  if (customTileUrl) {
    return { style: buildOsmRasterStyle(customTileUrl), isOsmFallback: true, isFallbackStyle: false };
  }
  return { style: buildOsmRasterStyle(), isOsmFallback: true, isFallbackStyle: true };
}

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

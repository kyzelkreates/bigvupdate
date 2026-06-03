/**
 * mapLibreAdapter.js — Isolated MapLibre GL JS provider adapter
 * Big V's Best Routes
 *
 * All MapLibre-specific code lives here.
 * NavigationMapShell imports from this file only — never imports maplibre-gl directly.
 * Style URL is read from mapConfig.js (which reads VITE_MAP_STYLE_URL env var).
 */

import { MAP_ATTRIBUTION, MAP_LAYER_IDS } from '../config/mapConfig.js';

let maplibre = null;

/** Lazily import maplibre-gl. Returns module or null on failure. */
export async function loadMapLibre() {
  if (maplibre) return maplibre;
  try {
    maplibre = await import('maplibre-gl');
    return maplibre;
  } catch (e) {
    console.warn('[mapLibreAdapter] maplibre-gl failed to load:', e.message);
    return null;
  }
}

/**
 * Initialise a MapLibre map.
 * @param {HTMLElement} container
 * @param {object} options - { style, center, zoom, pitch, bearing }
 * @returns {Promise<Map|null>}
 */
export async function createMap(container, options = {}) {
  const ml = await loadMapLibre();
  if (!ml || !container) return null;

  const {
    style   = 'https://demotiles.maplibre.org/style.json',
    center  = [-2.5879, 51.4545],
    zoom    = 13,
    pitch   = 55,
    bearing = 0,
  } = options;

  try {
    const map = new ml.Map({
      container,
      style,
      center,
      zoom,
      pitch,
      bearing,
      antialias: true,
      attributionControl: false,
    });

    map.addControl(new ml.AttributionControl({
      compact: true,
      customAttribution: MAP_ATTRIBUTION,
    }), 'bottom-left');

    map.addControl(new ml.NavigationControl({ showCompass: true, showZoom: false }), 'top-right');

    return map;
  } catch (e) {
    console.warn('[mapLibreAdapter] createMap failed:', e.message);
    return null;
  }
}

/**
 * Add or update the route polyline on an existing loaded map.
 * @param {Map} map - MapLibre map instance
 * @param {Array} polyline - [[lat, lng], ...]
 */
export function setRouteLayer(map, polyline) {
  if (!map || !polyline || polyline.length < 2) return;

  // MapLibre GeoJSON expects [lng, lat]
  const coordinates = polyline.map(([lat, lng]) => [lng, lat]);
  const geojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
  };

  try {
    if (map.getSource(MAP_LAYER_IDS.routeSource)) {
      map.getSource(MAP_LAYER_IDS.routeSource).setData(geojson);
    } else {
      map.addSource(MAP_LAYER_IDS.routeSource, { type: 'geojson', data: geojson });

      // Halo / shadow
      map.addLayer({
        id: MAP_LAYER_IDS.routeShadow,
        type: 'line', source: MAP_LAYER_IDS.routeSource,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000', 'line-width': 22, 'line-opacity': 0.4 },
      });

      // Main route line
      map.addLayer({
        id: MAP_LAYER_IDS.routeLine,
        type: 'line', source: MAP_LAYER_IDS.routeSource,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3af27c', 'line-width': 10, 'line-opacity': 0.9 },
      });
    }

    // Fit map to route bounds
    const lngs = coordinates.map((c) => c[0]);
    const lats = coordinates.map((c) => c[1]);
    map.fitBounds(
      [[Math.min(...lngs) - 0.04, Math.min(...lats) - 0.04],
       [Math.max(...lngs) + 0.04, Math.max(...lats) + 0.04]],
      { padding: 60, pitch: 55, duration: 1200 },
    );
  } catch (e) {
    console.warn('[mapLibreAdapter] setRouteLayer error:', e.message);
  }
}

/**
 * Place or update the vehicle marker on the map.
 * @param {Map}    map
 * @param {object} ml         - maplibre-gl module
 * @param {object} markerRef  - React ref for the Marker instance
 * @param {number} lat
 * @param {number} lng
 * @param {number} bearingDeg - heading in degrees (0 = north)
 */
export function moveVehicleMarker(map, ml, markerRef, lat, lng, bearingDeg = 0) {
  if (!map || !ml) return;
  try {
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'maplibre-vehicle-marker';
      el.innerHTML = `
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="20" fill="#3af27c" opacity="0.95" />
          <polygon points="22,7 30,33 22,27 14,33" fill="#06100a" />
        </svg>`;
      markerRef.current = new ml.Marker({
        element: el,
        rotationAlignment: 'map',
        pitchAlignment:    'map',
      }).setLngLat([lng, lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
      markerRef.current.setRotation(bearingDeg);
    }
  } catch (e) {
    console.warn('[mapLibreAdapter] moveVehicleMarker error:', e.message);
  }
}

/** Smoothly re-centre map on current vehicle position. */
export function followCamera(map, lat, lng, bearingDeg = 0) {
  if (!map) return;
  try {
    map.easeTo({ center: [lng, lat], bearing: bearingDeg, pitch: 55, duration: 800 });
  } catch (e) {
    console.warn('[mapLibreAdapter] followCamera error:', e.message);
  }
}

/**
 * Add warning/restriction markers to the map.
 * @param {Map}    map
 * @param {object} ml
 * @param {Array}  warnings - [{ lat, lon, title }]
 */
export function setWarningMarkers(map, ml, warnings) {
  if (!map || !ml || !warnings?.length) return;
  warnings.forEach((w) => {
    if (!w.lat || !w.lon) return;
    try {
      const el = document.createElement('div');
      el.className = 'map-warning-pin';
      el.textContent = '⚠';
      el.title = w.title || 'Restriction';
      new ml.Marker({ element: el }).setLngLat([w.lon, w.lat]).addTo(map);
    } catch (e) {
      console.warn('[mapLibreAdapter] setWarningMarkers error:', e.message);
    }
  });
}

/** Safely destroy map instance. */
export function destroyMap(map) {
  if (!map) return;
  try { map.remove(); } catch { /* already removed */ }
}

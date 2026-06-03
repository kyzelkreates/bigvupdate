/**
 * mapLibreAdapter.js — Isolated MapLibre GL JS provider adapter
 * Big V's Best Routes
 *
 * All MapLibre-specific code lives here.
 * NavigationMapShell imports from this file only — never imports maplibre-gl directly.
 * Style URL is read from mapConfig.js (which reads VITE_MAP_STYLE_URL env var).
 */

import { MAP_ATTRIBUTION, MAP_LAYER_IDS, resolveMapStyle } from '../config/mapConfig.js';

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
    style: rawStyle,
    center  = [-2.5879, 51.4545],
    zoom    = 13,
    pitch   = 55,
    bearing = 0,
    customTileUrl,
  } = options;

  // Always resolve the best available style — falls back to OSM raster if no env var
  const { style, isOsmFallback } = resolveMapStyle(customTileUrl || (rawStyle !== 'https://demotiles.maplibre.org/style.json' ? rawStyle : null));

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

/**
 * Add or update start and end markers on the map.
 * @param {Map}    map
 * @param {object} ml - maplibre-gl module
 * @param {Array}  polyline - [[lat, lng], ...]
 * @param {object} markerRefs - { start: ref, end: ref }
 */
export function setStartEndMarkers(map, ml, polyline, markerRefs) {
  if (!map || !ml || !polyline || polyline.length < 2) return;
  try {
    const startCoord = [polyline[0][1], polyline[0][0]];            // [lng, lat]
    const endCoord   = [polyline[polyline.length - 1][1], polyline[polyline.length - 1][0]];

    // Start marker — green circle with A
    if (!markerRefs.start?.current) {
      const el = document.createElement('div');
      el.className   = 'maplibre-waypoint-marker start-marker';
      el.innerHTML   = '<div class="waypoint-label">A</div>';
      el.title       = 'Route start';
      if (markerRefs.start) markerRefs.start.current = new ml.Marker({ element: el }).setLngLat(startCoord).addTo(map);
    } else {
      markerRefs.start.current.setLngLat(startCoord);
    }

    // End marker — red circle with B
    if (!markerRefs.end?.current) {
      const el = document.createElement('div');
      el.className   = 'maplibre-waypoint-marker end-marker';
      el.innerHTML   = '<div class="waypoint-label">B</div>';
      el.title       = 'Route destination';
      if (markerRefs.end) markerRefs.end.current = new ml.Marker({ element: el }).setLngLat(endCoord).addTo(map);
    } else {
      markerRefs.end.current.setLngLat(endCoord);
    }
  } catch (e) {
    console.warn('[mapLibreAdapter] setStartEndMarkers error:', e.message);
  }
}

/**
 * Fit map to show full route with padding.
 * @param {Map}   map
 * @param {Array} polyline - [[lat, lng], ...]
 * @param {object} opts    - { padding, pitch, duration }
 */
export function fitRouteBounds(map, polyline, opts = {}) {
  if (!map || !polyline || polyline.length < 2) return;
  try {
    const lngs = polyline.map((p) => p[1]);
    const lats  = polyline.map((p) => p[0]);
    map.fitBounds(
      [[Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
       [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01]],
      {
        padding:  opts.padding  || 50,
        pitch:    opts.pitch    ?? 20,
        duration: opts.duration ?? 1200,
        maxZoom:  16,
      },
    );
  } catch (e) {
    console.warn('[mapLibreAdapter] fitRouteBounds error:', e.message);
  }
}

/** Safely destroy map instance. */
export function destroyMap(map) {
  if (!map) return;
  try { map.remove(); } catch { /* already removed */ }
}

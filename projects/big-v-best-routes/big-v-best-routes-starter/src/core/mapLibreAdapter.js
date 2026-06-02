/**
 * mapLibreAdapter.js — Isolated MapLibre GL JS provider adapter
 * Big V's Best Routes
 *
 * All MapLibre-specific logic lives here.
 * NavigationMapShell imports from this file only — never touches maplibre-gl directly.
 * If MapLibre is unavailable or fails to load, returns null and the SVG shell is used.
 */

let maplibre = null;

/**
 * Lazily import maplibre-gl. Returns the module or null on failure.
 */
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
 * Initialise a MapLibre map in the given container element.
 * Returns the map instance or null on failure.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @param {number[]} options.center [lng, lat]
 * @param {number} options.zoom
 * @param {number} options.pitch degrees (0–85)
 * @param {number} options.bearing degrees
 */
export async function createMap(container, {
  center = [-2.5879, 51.4545], // Bristol default
  zoom = 13,
  pitch = 55,
  bearing = 0,
} = {}) {
  const ml = await loadMapLibre();
  if (!ml || !container) return null;

  try {
    const map = new ml.Map({
      container,
      // Free raster tile source — no key required
      style: {
        version: 8,
        name: 'Big V Dark',
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'osm-background',
            type: 'raster',
            source: 'osm-tiles',
            paint: {
              'raster-opacity': 0.62,
              'raster-brightness-max': 0.28,
              'raster-saturation': -0.8,
              'raster-contrast': 0.15,
            },
          },
        ],
      },
      center,
      zoom,
      pitch,
      bearing,
      antialias: true,
      attributionControl: false,
    });

    // Minimal attribution
    map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-left');

    return map;
  } catch (e) {
    console.warn('[mapLibreAdapter] Map init failed:', e.message);
    return null;
  }
}

/** Add (or update) the route polyline layer on an existing map. */
export function setRouteLayer(map, polyline) {
  if (!map || !polyline || polyline.length < 2) return;

  const geojson = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      // MapLibre expects [lng, lat]
      coordinates: polyline.map(([lat, lng]) => [lng, lat]),
    },
  };

  try {
    if (map.getSource('big-v-route')) {
      map.getSource('big-v-route').setData(geojson);
    } else {
      map.addSource('big-v-route', { type: 'geojson', data: geojson });

      // Shadow / halo
      map.addLayer({
        id: 'big-v-route-shadow',
        type: 'line',
        source: 'big-v-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#000000', 'line-width': 22, 'line-opacity': 0.45 },
      });

      // Main route line
      map.addLayer({
        id: 'big-v-route-line',
        type: 'line',
        source: 'big-v-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3af27c', 'line-width': 10, 'line-opacity': 0.9 },
      });
    }

    // Fly to start of route
    const [startLat, startLng] = polyline[0];
    const [endLat, endLng] = polyline[polyline.length - 1];
    map.fitBounds(
      [[Math.min(startLng, endLng) - 0.05, Math.min(startLat, endLat) - 0.05],
       [Math.max(startLng, endLng) + 0.05, Math.max(startLat, endLat) + 0.05]],
      { padding: 60, pitch: 55, duration: 1200 },
    );
  } catch (e) {
    console.warn('[mapLibreAdapter] setRouteLayer error:', e.message);
  }
}

/** Add (or update) restriction warning markers. */
export function setWarningMarkers(map, ml, warnings) {
  if (!map || !ml || !warnings?.length) return;
  warnings.forEach((w, i) => {
    if (!w.lat || !w.lon) return;
    try {
      const el = document.createElement('div');
      el.className = 'map-warning-pin';
      el.textContent = '⚠';
      el.title = w.title || 'Restriction';
      new ml.Marker({ element: el })
        .setLngLat([w.lon, w.lat])
        .addTo(map);
    } catch (e) {
      console.warn('[mapLibreAdapter] marker error:', e.message);
    }
  });
}

/** Move/rotate the vehicle marker to a new position. */
export function moveVehicleMarker(map, ml, markerRef, lat, lng, bearing = 0) {
  if (!map || !ml) return;
  try {
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'maplibre-vehicle-marker';
      el.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="18" fill="#3af27c" opacity="0.95"/>
        <polygon points="20,6 27,30 20,24 13,30" fill="#06100a"/>
      </svg>`;
      markerRef.current = new ml.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      markerRef.current.setLngLat([lng, lat]);
      markerRef.current.setRotation(bearing);
    }
  } catch (e) {
    console.warn('[mapLibreAdapter] moveVehicleMarker error:', e.message);
  }
}

/** Follow-camera: smoothly re-centre map on current position. */
export function followCamera(map, lat, lng, bearing = 0) {
  if (!map) return;
  try {
    map.easeTo({ center: [lng, lat], bearing, pitch: 55, duration: 800 });
  } catch (e) {
    console.warn('[mapLibreAdapter] followCamera error:', e.message);
  }
}

/** Destroy the map instance safely. */
export function destroyMap(map) {
  if (!map) return;
  try { map.remove(); } catch { /* already removed */ }
}

/**
 * Geocoding client for Big V's Best Routes.
 * Uses Nominatim (OpenStreetMap) as a free, no-key geocoder.
 * Falls back to demo coordinate pairs for offline/demo mode.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'BigVBestRoutes/1.0 (contact@bigvroutes.app)';

/** Known demo fallbacks — expand as needed */
const DEMO_COORDS = {
  bristol: [51.4545, -2.5879],
  cardiff: [51.4816, -3.1791],
  london: [51.5074, -0.1278],
  birmingham: [52.4862, -1.8904],
  manchester: [53.4808, -2.2426],
  edinburgh: [55.9533, -3.1883],
  glasgow: [55.8642, -4.2518],
  leeds: [53.8008, -1.5491],
  sheffield: [53.3811, -1.4701],
  liverpool: [53.4084, -2.9916],
  'newport': [51.5842, -2.9977],
  'swansea': [51.6214, -3.9436],
};

function normKey(str) {
  return str.toLowerCase().trim();
}

export async function geocodeAddress(address) {
  const key = normKey(address);

  // Check demo fallbacks first
  for (const [k, coords] of Object.entries(DEMO_COORDS)) {
    if (key.includes(k)) return { lat: coords[0], lon: coords[1], source: 'demo-fallback', label: address };
  }

  // Try Nominatim
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en' },
    });
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.length === 0) throw new Error('No results');
    const item = data[0];
    return { lat: parseFloat(item.lat), lon: parseFloat(item.lon), source: 'nominatim', label: item.display_name };
  } catch (err) {
    // Final fallback — return London as placeholder and flag
    return {
      lat: 51.5074,
      lon: -0.1278,
      source: 'fallback-london',
      label: address,
      warning: `Could not geocode "${address}" (${err.message}). Using London placeholder.`,
    };
  }
}

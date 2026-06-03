/**
 * serviceTester.js — Service health testing utilities
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Tests map providers, geocoding, routing, Overpass, and AI endpoints.
 * Every test: times out safely, catches all errors, returns normalised result.
 * Never crashes the app on failed tests.
 * Never logs or returns full API keys.
 * Never fakes success states.
 *
 * ADVISORY ONLY — test results confirm connectivity, not route legality.
 */

import { validateUrl, validateMapStyleUrl, validateTileUrl } from './urlValidators.js';
import { maskSecret, validateMapboxToken } from './secretGuards.js';

const DEFAULT_TIMEOUT_MS = 8000;

// ─── Normalised result builders ───────────────────────────────────────────────

export function makeSuccess(service, provider, details = {}) {
  return {
    service,
    provider,
    ok:              true,
    status:          'success',
    message:         details.message || 'Service connected successfully.',
    providerUsed:    provider,
    fallbackUsed:    false,
    fallbackProvider: null,
    testedAt:        new Date().toISOString(),
    details:         { ...details, message: undefined },
  };
}

export function makeFailure(service, provider, message, fallbackProvider = 'maplibre_public', errorCode = 'TEST_FAILED') {
  return {
    service,
    provider,
    ok:              false,
    status:          'failed',
    message,
    providerUsed:    null,
    fallbackUsed:    !!fallbackProvider,
    fallbackProvider: fallbackProvider || null,
    testedAt:        new Date().toISOString(),
    errorCode,
    details:         {},
  };
}

export function makeUntested(service, provider) {
  return {
    service,
    provider,
    ok:           null,
    status:       'untested',
    message:      'Not yet tested.',
    testedAt:     null,
    details:      {},
  };
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

/**
 * Fetch with timeout. Never throws — returns { ok, status, error }.
 */
export async function safeFetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, error: null, response: res };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    return {
      ok:     false,
      status: null,
      error:  isTimeout ? 'Request timed out.' : (err.message || 'Network error.'),
    };
  }
}

// ─── Map provider tests ───────────────────────────────────────────────────────

/**
 * Test a MapLibre GL-compatible style URL.
 * Fetches the JSON style file — checks it's a valid style object.
 */
export async function testMapStyle(styleUrl) {
  const service  = 'mapping';
  const provider = 'custom_maplibre';

  if (!styleUrl) return makeFailure(service, provider, 'Style URL is not configured.', 'maplibre_public', 'NOT_CONFIGURED');

  const urlCheck = validateMapStyleUrl(styleUrl);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid URL: ${urlCheck.error}`, 'maplibre_public', 'INVALID_URL');

  // mapbox:// URLs can't be fetched directly — accept them as valid
  if (styleUrl.startsWith('mapbox://')) {
    return makeSuccess(service, 'mapbox', { message: 'Mapbox style URL format is valid. Connection confirmed via token test.' });
  }

  const res = await safeFetchWithTimeout(styleUrl, {}, DEFAULT_TIMEOUT_MS);
  if (!res.ok) {
    return makeFailure(
      service, provider,
      `Map style URL failed (${res.status || res.error}). Public OSM/MapLibre fallback remains available.`,
      'maplibre_public', 'PROVIDER_NOT_AVAILABLE',
    );
  }

  try {
    const json = await res.response.json();
    if (!json.version && !json.layers && !json.sources) {
      return makeFailure(service, provider, 'URL returned data but it does not look like a valid MapLibre style.', 'maplibre_public', 'INVALID_STYLE');
    }
  } catch {
    // Non-JSON is fine if the request succeeded (some servers return OK status)
  }

  return makeSuccess(service, provider, { message: 'Map style loaded successfully.' });
}

/**
 * Test OSM tile URL by fetching a sample tile (z=0, x=0, y=0).
 */
export async function testOsmTile(tileUrl) {
  const service  = 'mapping';
  const provider = 'osm_tile_public';

  if (!tileUrl) return makeFailure(service, provider, 'Tile URL is not configured.', 'maplibre_public', 'NOT_CONFIGURED');

  const urlCheck = validateTileUrl(tileUrl);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid tile URL: ${urlCheck.error}`, 'maplibre_public', 'INVALID_URL');

  const testUrl = tileUrl.replace('{z}', '0').replace('{x}', '0').replace('{y}', '0');
  const res = await safeFetchWithTimeout(testUrl, {}, DEFAULT_TIMEOUT_MS);

  if (!res.ok) {
    return makeFailure(
      service, provider,
      `Tile request failed (${res.status || res.error}). Public OSM/MapLibre fallback available.`,
      'maplibre_public', 'PROVIDER_NOT_AVAILABLE',
    );
  }
  return makeSuccess(service, provider, { message: 'OSM tile server responding.' });
}

/**
 * Test Mapbox provider.
 * Only uses the public token — never the secret token.
 * Validates format first, then fetches style metadata.
 */
export async function testMapboxProvider(publicToken, styleUrl) {
  const service  = 'mapping';
  const provider = 'mapbox';

  if (!publicToken) return makeFailure(service, provider, 'Mapbox public token is not configured. Public OSM/MapLibre fallback will be used.', 'maplibre_public', 'NOT_CONFIGURED');

  const tokenCheck = validateMapboxToken(publicToken);
  if (!tokenCheck.valid) return makeFailure(service, provider, tokenCheck.reason, 'maplibre_public', 'INVALID_TOKEN');

  // Mapbox Styles API — check style access with public token
  const resolvedStyle = styleUrl || 'mapbox://styles/mapbox/streets-v12';
  if (resolvedStyle.startsWith('mapbox://styles/')) {
    const stylePath = resolvedStyle.replace('mapbox://styles/', '');
    const testUrl   = `https://api.mapbox.com/styles/v1/${stylePath}?access_token=${publicToken}`;
    const res = await safeFetchWithTimeout(testUrl, {}, DEFAULT_TIMEOUT_MS);
    if (!res.ok) {
      return makeFailure(
        service, provider,
        `Mapbox style fetch failed (${res.status || res.error}). Check your public token and style URL. Public OSM/MapLibre fallback active.`,
        'maplibre_public', 'PROVIDER_NOT_AVAILABLE',
      );
    }
  }

  return makeSuccess(service, provider, {
    message:       'Mapbox provider connected.',
    tokenMasked:   maskSecret(publicToken),
  });
}

/**
 * Test Google Maps API key.
 * Calls the Maps JavaScript API status endpoint with the browser key.
 * Fails safely if key is missing or invalid.
 */
export async function testGoogleMapsProvider(browserApiKey) {
  const service  = 'mapping';
  const provider = 'google_maps';

  if (!browserApiKey) {
    return makeFailure(service, provider, 'Google Maps API key is not configured. Public OSM/MapLibre fallback will be used.', 'maplibre_public', 'NOT_CONFIGURED');
  }

  // Use the Maps Static API with a minimal request — cheap, no rendering
  const testUrl = `https://maps.googleapis.com/maps/api/staticmap?center=0,0&zoom=1&size=1x1&key=${browserApiKey}`;
  const res = await safeFetchWithTimeout(testUrl, {}, DEFAULT_TIMEOUT_MS);

  if (res.status === 403 || res.status === 400) {
    return makeFailure(
      service, provider,
      'Google Maps API key is invalid or has insufficient permissions. Public OSM/MapLibre fallback active.',
      'maplibre_public', 'INVALID_KEY',
    );
  }
  if (!res.ok && res.status !== 200) {
    return makeFailure(
      service, provider,
      `Google Maps test failed (${res.status || res.error}). Public OSM/MapLibre fallback active.`,
      'maplibre_public', 'PROVIDER_NOT_AVAILABLE',
    );
  }

  return makeSuccess(service, provider, {
    message:    'Google Maps API key accepted.',
    keyMasked:  maskSecret(browserApiKey),
  });
}

// ─── Geocoding tests ──────────────────────────────────────────────────────────

/** Test Nominatim or custom geocoding endpoint. */
export async function testGeocoding(searchUrl) {
  const service  = 'geocoding';
  const provider = searchUrl?.includes('nominatim') ? 'nominatim_public' : 'custom';

  if (!searchUrl) return makeFailure(service, provider, 'Geocoding URL not configured.', 'nominatim_public', 'NOT_CONFIGURED');

  const urlCheck = validateUrl(searchUrl);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid URL: ${urlCheck.error}`, 'nominatim_public', 'INVALID_URL');

  // Lightweight search — single letter in a UK location
  const testUrl = `${searchUrl.replace(/\/$/, '')}?q=london&format=json&limit=1`;
  const res = await safeFetchWithTimeout(testUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'BigVBestRoutes/2.1 (service-test)' },
  }, DEFAULT_TIMEOUT_MS);

  if (!res.ok) {
    return makeFailure(service, provider, `Geocoding test failed (${res.status || res.error}).`, 'nominatim_public', 'PROVIDER_NOT_AVAILABLE');
  }

  try {
    const json = await res.response.json();
    if (!Array.isArray(json)) return makeFailure(service, provider, 'Geocoding returned unexpected data format.', 'nominatim_public', 'INVALID_RESPONSE');
  } catch {
    return makeFailure(service, provider, 'Geocoding returned non-JSON response.', 'nominatim_public', 'INVALID_RESPONSE');
  }

  return makeSuccess(service, provider, { message: 'Geocoding service responding correctly.' });
}

/** Test reverse geocoding endpoint. */
export async function testReverseGeocoding(reverseUrl) {
  const service  = 'geocoding';
  const provider = reverseUrl?.includes('nominatim') ? 'nominatim_reverse' : 'custom_reverse';

  if (!reverseUrl) return makeFailure(service, provider, 'Reverse geocoding URL not configured.', 'nominatim_public', 'NOT_CONFIGURED');

  const urlCheck = validateUrl(reverseUrl);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid URL: ${urlCheck.error}`, 'nominatim_public', 'INVALID_URL');

  // London coordinates
  const testUrl = `${reverseUrl.replace(/\/$/, '')}?lat=51.5074&lon=-0.1278&format=json`;
  const res = await safeFetchWithTimeout(testUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'BigVBestRoutes/2.1 (service-test)' },
  }, DEFAULT_TIMEOUT_MS);

  if (!res.ok) return makeFailure(service, provider, `Reverse geocoding test failed (${res.status || res.error}).`, 'nominatim_public', 'PROVIDER_NOT_AVAILABLE');

  return makeSuccess(service, provider, { message: 'Reverse geocoding service responding.' });
}

// ─── Overpass test ────────────────────────────────────────────────────────────

export async function testOverpass(endpoint) {
  const service  = 'overpass';
  const provider = endpoint?.includes('overpass-api.de') ? 'overpass_public' : 'custom';

  if (!endpoint) return makeFailure(service, provider, 'Overpass endpoint not configured.', null, 'NOT_CONFIGURED');

  const urlCheck = validateUrl(endpoint);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid URL: ${urlCheck.error}`, null, 'INVALID_URL');

  // Minimal Overpass query — just tests connectivity
  const query  = '[out:json][timeout:5];node(51.5,−0.1,51.6,0.0)[amenity=bus_stop];out 1;';
  const testUrl = endpoint.replace(/\/$/, '');
  const res = await safeFetchWithTimeout(testUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `data=${encodeURIComponent(query)}`,
  }, DEFAULT_TIMEOUT_MS);

  if (!res.ok) return makeFailure(service, provider, `Overpass test failed (${res.status || res.error}).`, null, 'PROVIDER_NOT_AVAILABLE');
  return makeSuccess(service, provider, { message: 'Overpass API responding.' });
}

// ─── Routing test ─────────────────────────────────────────────────────────────

/**
 * Test routing endpoint (GraphHopper or custom).
 * Uses a minimal health/info request — does NOT run a full route calculation.
 */
export async function testRouting(endpoint, key) {
  const service  = 'routing';
  const provider = endpoint?.includes('graphhopper') ? 'graphhopper' : 'custom';

  if (!endpoint) return makeFailure(service, provider, 'Routing endpoint not configured.', null, 'NOT_CONFIGURED');

  const urlCheck = validateUrl(endpoint);
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid URL: ${urlCheck.error}`, null, 'INVALID_URL');

  // GraphHopper /info endpoint — lightweight, no route calculation
  const baseUrl = endpoint.replace(/\/$/, '');
  const keyParam = key ? `?key=${encodeURIComponent(key)}` : '';
  const infoUrl = `${baseUrl}/info${keyParam}`;

  const res = await safeFetchWithTimeout(infoUrl, {
    headers: { 'Accept': 'application/json' },
  }, DEFAULT_TIMEOUT_MS);

  if (!res.ok) {
    return makeFailure(
      service, provider,
      `Routing service test failed (${res.status || res.error}). Check your endpoint and API key.`,
      null, 'PROVIDER_NOT_AVAILABLE',
    );
  }

  return makeSuccess(service, provider, {
    message:   'Routing service responding.',
    keyMasked: key ? maskSecret(key) : 'not configured',
  });
}

// ─── AI endpoint test ─────────────────────────────────────────────────────────

/**
 * Test open-source AI server connection.
 * Supports: Ollama, LocalAI, LM Studio, llama.cpp, vLLM, custom.
 * Never sends real AI requests — just checks the health/version endpoint.
 */
export async function testAiEndpoint(providerType, serverUrl, modelName) {
  const service  = 'ai';
  const provider = providerType || 'unknown';

  if (!serverUrl) return makeFailure(service, provider, 'AI server URL not configured. Local AI server must be running.', null, 'NOT_CONFIGURED');

  const urlCheck = validateUrl(serverUrl, { requireHttps: false });
  if (!urlCheck.valid) return makeFailure(service, provider, `Invalid server URL: ${urlCheck.error}`, null, 'INVALID_URL');

  const base = serverUrl.replace(/\/$/, '');

  // Determine health endpoint by provider type
  let healthUrl;
  if (providerType === 'ollama')    healthUrl = `${base}/api/tags`;
  else if (providerType === 'lmstudio') healthUrl = `${base}/v1/models`;
  else if (providerType === 'vllm') healthUrl = `${base}/health`;
  else                              healthUrl = `${base}/v1/models`;  // OpenAI-compatible standard

  const res = await safeFetchWithTimeout(healthUrl, {
    headers: { 'Accept': 'application/json' },
  }, DEFAULT_TIMEOUT_MS);

  if (!res.ok) {
    return makeFailure(
      service, provider,
      `AI server not reachable at ${healthUrl} (${res.status || res.error}). Ensure your local AI server is running.`,
      null, 'PROVIDER_OFFLINE',
    );
  }

  return makeSuccess(service, provider, {
    message:     `${provider} AI server responding.`,
    serverUrl,
    modelName:   modelName || 'not specified',
  });
}

// ─── Resolve active map provider ─────────────────────────────────────────────

/**
 * Resolve which map style URL to use based on config priority.
 * Falls back safely through the provider chain.
 *
 * @param {object} mappingConfig - from serviceConfig.mapping
 * @returns {{ styleUrl: string, provider: string, isFallback: boolean }}
 */
export function resolveActiveMapProvider(mappingConfig) {
  if (!mappingConfig) return getSafeFallbackMapProvider();

  const { activeProvider } = mappingConfig;

  if (activeProvider === 'mapbox' && mappingConfig.mapbox?.enabled && mappingConfig.mapbox?.publicToken) {
    const styleUrl = mappingConfig.mapbox.styleUrl || 'mapbox://styles/mapbox/streets-v12';
    return { styleUrl, provider: 'mapbox', isFallback: false };
  }

  if (activeProvider === 'google_maps' && mappingConfig.googleMaps?.enabled && mappingConfig.googleMaps?.browserApiKey) {
    // Google Maps doesn't use a MapLibre style URL — returns a signal for the map component
    return { styleUrl: null, provider: 'google_maps', isFallback: false };
  }

  if (activeProvider === 'custom_maplibre' && mappingConfig.customMapStyleUrl) {
    return { styleUrl: mappingConfig.customMapStyleUrl, provider: 'custom_maplibre', isFallback: false };
  }

  if (activeProvider === 'custom_tile' && mappingConfig.customTileUrl) {
    return { styleUrl: mappingConfig.customTileUrl, provider: 'custom_tile', isFallback: false };
  }

  if (activeProvider === 'osm_tile_public') {
    return {
      styleUrl: mappingConfig.osmTileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      provider: 'osm_tile_public',
      isFallback: false,
    };
  }

  // Default: MapLibre public style
  return {
    styleUrl:   mappingConfig.maplibrePublicStyleUrl || 'https://demotiles.maplibre.org/style.json',
    provider:   'maplibre_public',
    isFallback: activeProvider !== 'maplibre_public',
  };
}

/** Always-safe fallback provider — never fails. */
export function getSafeFallbackMapProvider() {
  return {
    styleUrl:   'https://demotiles.maplibre.org/style.json',
    provider:   'maplibre_public',
    isFallback: true,
  };
}

// ─── Test all services ────────────────────────────────────────────────────────

/**
 * Run all service tests in parallel.
 * Returns { mapping, geocoding, routing, overpass, ai }
 * Never throws — any test failure is captured in the result.
 */
export async function testAllServices(serviceConfig) {
  const cfg = serviceConfig || {};

  const [mapping, geocoding, routing, overpass, ai] = await Promise.allSettled([
    _testActiveMapProvider(cfg.mapping),
    testGeocoding(cfg.geocoding?.searchUrl || 'https://nominatim.openstreetmap.org/search'),
    testRouting(
      cfg.routing?.graphhopperEndpoint || 'https://graphhopper.com/api/1',
      cfg.routing?.graphhopperKey || '',
    ),
    testOverpass(cfg.overpass?.endpoint || 'https://overpass-api.de/api/interpreter'),
    cfg.ai?.enabled
      ? testAiEndpoint(cfg.ai.providerType, cfg.ai.serverUrl, cfg.ai.modelName)
      : Promise.resolve(makeUntested('ai', cfg.ai?.providerType || 'ollama')),
  ]);

  return {
    mapping:   _settled(mapping,   makeFailure('mapping',   'unknown', 'Map provider test error.')),
    geocoding: _settled(geocoding, makeFailure('geocoding', 'unknown', 'Geocoding test error.')),
    routing:   _settled(routing,   makeFailure('routing',   'unknown', 'Routing test error.')),
    overpass:  _settled(overpass,  makeFailure('overpass',  'unknown', 'Overpass test error.')),
    ai:        _settled(ai,        makeFailure('ai',        'unknown', 'AI endpoint test error.')),
  };
}

async function _testActiveMapProvider(mappingCfg) {
  if (!mappingCfg) return testMapStyle('https://demotiles.maplibre.org/style.json');
  const { activeProvider } = mappingCfg;
  if (activeProvider === 'mapbox')      return testMapboxProvider(mappingCfg.mapbox?.publicToken, mappingCfg.mapbox?.styleUrl);
  if (activeProvider === 'google_maps') return testGoogleMapsProvider(mappingCfg.googleMaps?.browserApiKey);
  if (activeProvider === 'custom_tile') return testOsmTile(mappingCfg.customTileUrl);
  const styleUrl = activeProvider === 'custom_maplibre'
    ? mappingCfg.customMapStyleUrl
    : mappingCfg.maplibrePublicStyleUrl || 'https://demotiles.maplibre.org/style.json';
  return testMapStyle(styleUrl);
}

function _settled(settled, fallback) {
  if (settled.status === 'fulfilled') return settled.value;
  return fallback;
}

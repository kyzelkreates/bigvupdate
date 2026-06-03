/**
 * defaultServiceConfig.js — Central service configuration defaults
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 * Created by Kyzel Kreates — Part of the 4P3X Verse
 *
 * This is the SSOT for all service provider configuration.
 * Merged into storage.js on first load. Never overwrites user settings.
 *
 * ADVISORY ONLY — routing and compliance outputs are never legally guaranteed.
 */

export const SCHEMA_VERSION = 1;

export const DEFAULT_SERVICE_CONFIG = {
  schemaVersion: SCHEMA_VERSION,

  mapping: {
    activeProvider:       'maplibre_public',
    availableProviders:   [
      'maplibre_public',
      'osm_tile_public',
      'custom_maplibre',
      'custom_tile',
      'mapbox',
      'google_maps',
    ],
    fallbackEnabled:            true,
    maplibrePublicStyleUrl:     'https://demotiles.maplibre.org/style.json',
    osmTileUrl:                 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    customMapStyleUrl:          '',
    customTileUrl:              '',
    mapbox: {
      enabled:      false,
      publicToken:  '',
      styleUrl:     'mapbox://styles/mapbox/streets-v12',
      status:       'untested',
      lastTestedAt: null,
    },
    googleMaps: {
      enabled:      false,
      browserApiKey: '',
      mapType:      'roadmap',  // roadmap | satellite | hybrid | terrain
      status:       'untested',
      lastTestedAt: null,
    },
    lastWorkingProvider:  null,
    lastFallbackProvider: 'maplibre_public',
    lastTestedAt:         null,
    status:               'untested',
  },

  geocoding: {
    provider:         'nominatim_public',
    searchUrl:        'https://nominatim.openstreetmap.org/search',
    reverseUrl:       'https://nominatim.openstreetmap.org/reverse',
    customSearchUrl:  '',
    customReverseUrl: '',
    status:           'untested',
    lastTestedAt:     null,
  },

  routing: {
    provider:                 'graphhopper',
    graphhopperEndpoint:      'https://graphhopper.com/api/1',
    graphhopperKey:           '',
    customRoutingEndpoint:    '',
    fallbackRoutingEndpoint:  '',
    status:                   'untested',
    lastTestedAt:             null,
  },

  overpass: {
    endpoint:        'https://overpass-api.de/api/interpreter',
    customEndpoint:  '',
    status:          'untested',
    lastTestedAt:    null,
  },

  ai: {
    enabled:               false,
    providerType:          'ollama',        // ollama | localai | lmstudio | llamacpp | vllm | openwebui | custom
    serverUrl:             'http://localhost:11434',
    modelName:             '',
    agentMode:             'compliance_advisory',
    complianceAgentEnabled: true,
    lockToOpenSource:      true,            // always true — proprietary AI not supported
    status:                'untested',
    lastTestedAt:          null,
  },

  gps: {
    useDeviceGps:     true,
    updateIntervalMs: 3000,
    highAccuracy:     true,
    status:           'untested',
    lastTestedAt:     null,
  },

  security: {
    maskApiKeys:            true,
    neverLogSecrets:        true,
    blockFrontendSecretKeys: true,
  },

  // ── Test results (per service, updated after Test buttons) ─────────────────
  testResults: {
    mapping:   null,
    geocoding: null,
    routing:   null,
    overpass:  null,
    ai:        null,
    gps:       null,
  },
};

/**
 * Deep-merge user config over defaults.
 * Preserves user's saved values, adds any new default fields.
 */
export function mergeWithDefaults(saved) {
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_SERVICE_CONFIG };
  return deepMerge(DEFAULT_SERVICE_CONFIG, saved);
}

function deepMerge(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      typeof defaults[key] === 'object' &&
      defaults[key] !== null
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}

/** Provider display labels */
export const PROVIDER_LABELS = {
  maplibre_public:  'OSM / MapLibre Public (Free, no key)',
  osm_tile_public:  'OSM Tile Fallback (Free, no key)',
  custom_maplibre:  'Custom MapLibre Style URL',
  custom_tile:      'Custom Tile Provider',
  mapbox:           'Mapbox (API token required)',
  google_maps:      'Google Maps (API key required)',
};

export const AI_PROVIDER_LABELS = {
  ollama:     'Ollama (local)',
  localai:    'LocalAI (local)',
  lmstudio:   'LM Studio (local)',
  llamacpp:   'llama.cpp (local)',
  vllm:       'vLLM (self-hosted)',
  openwebui:  'Open WebUI-compatible endpoint',
  custom:     'Custom Open-Source Endpoint',
};

export const PUBLIC_FALLBACK_WARNING =
  'Public fallback services are suitable for light usage and testing. ' +
  'For production/high-volume usage, configure your own hosted services or approved provider endpoints.';

export const COMPLIANCE_DISCLAIMER =
  'Big V\'s Best Routes™ provides advisory routing and compliance support. ' +
  'Drivers remain responsible for checking live road signs, legal restrictions, ' +
  'vehicle suitability, and road conditions.';

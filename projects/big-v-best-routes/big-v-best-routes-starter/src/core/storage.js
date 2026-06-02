import { DEFAULT_SERVICE_CONFIG, mergeWithDefaults, SCHEMA_VERSION } from '../config/defaultServiceConfig.js';

/**
 * storage.js — Single Source of Truth (SSOT)
 * Big V's Best Routes — local-first state management.
 *
 * All business-critical state flows through here.
 * UI components may use local state only for temporary display controls
 * such as open panels, tabs, map instance refs, or loading flags.
 *
 * Fields owned by SSOT:
 * - selected vehicle type + profile + legal/physical fields
 * - trip origin / destination / route mode
 * - route request status + result
 * - decoded route coordinates
 * - GraphHopper provider status
 * - Compliance AI result + confidence score
 * - route warnings
 * - navigation session (with lock, snapshots, GPS status)
 * - saved trips
 * - offline / PWA status
 * - app settings
 * - imported restriction datasets
 */

const STORAGE_KEY = 'big-v-best-routes-state-v2';

export const initialState = {
  app: {
    projectName: "Big V's Best Routes",
    version:     '2.0.0',
    mode:        'planner',   // 'planner' | 'navigation' | 'settings' | 'saved'
    acceptedSafetyDisclaimer: false,
    offlineReady: false,
  },

  vehicle: {
    activeVehicleId: 'default-vehicle',
    profiles: {
      'default-vehicle': {
        id:     'default-vehicle',
        name:   'My Vehicle',
        type:   'car',    // default — user must select appropriate type
        fields: {},       // empty by default — user must fill required fields
      },
    },
  },

  trip: {
    origin:           '',
    destination:      '',
    routeMode:        'fastest',    // 'fastest' | 'safest' | 'scenic'
    selectedRouteId:  null,
    routes:           [],
    lastRouteResult:  null,
    routeStatus:      'idle',       // 'idle' | 'loading' | 'success' | 'error' | 'setup_required' | 'dev_fallback'
    routeError:       null,
    savedTrips:       [],
  },

  navigation: {
    // Session status machine
    status:       'notStarted',   // 'notStarted' | 'preparing' | 'active' | 'rerouting' | 'paused' | 'stopped' | 'completed' | 'error'
    active:       false,          // backwards compat

    // Session lock fields — set on startNavigation, cleared on stopNavigation
    sessionId:          null,
    lockedVehicleId:    null,
    lockedRouteId:      null,
    startedAt:          null,

    // Snapshots — frozen at session start
    routeSnapshot:      null,
    vehicleSnapshot:    null,
    complianceSnapshot: null,
    warningsSnapshot:   [],

    // Live navigation state
    gpsStatus:          'unavailable',   // 'real' | 'simulated' | 'unavailable'
    offlineStatus:      'unknown',       // 'online' | 'offline' | 'unknown'
    gpsConfidence:      0,               // 0–100
    currentLat:         null,
    currentLon:         null,
    currentHeading:     null,

    // Current instruction
    currentInstruction: 'Plan and validate your route before starting navigation.',
    nextManoeuvre:      null,
    distanceToNextM:    null,
    remainingDistanceM: null,
    remainingDurationMs: null,
    eta:                null,

    voiceEnabled:   false,

    // ── Real GPS wiring (extended v2.1) ──────────────────────────────────
    locationPermission:    'unknown',    // 'unknown' | 'granted' | 'denied' | 'unavailable'
    gpsAccuracy:           null,         // metres
    gpsSpeed:              null,         // m/s
    gpsSpeedKph:           null,
    gpsSpeedMph:           null,
    gpsLastUpdated:        null,         // ISO string
    gpsIsStale:            false,
    gpsWatchActive:        false,

    // ── Route progress (from routeProgressEngine) ────────────────────────
    progressFraction:            0,
    routeProgressPercent:        0,
    currentInstructionIndex:     0,
    currentInstruction:          null,
    nextInstruction:             null,
    nextInstructionIndex:        1,
    distanceToNextInstructionM:  null,
    offRouteStatus:              false,
    offRouteDistanceM:           0,
    offRouteConsecutiveFixes:    0,
    navigationWarnings:          [],

    // ── Reroute state ─────────────────────────────────────────────────────
    reroute: {
      status:                    'idle',
      reason:                    null,
      offRouteDistanceM:         null,
      proposedRoute:             null,
      proposedCompliance:        null,
      proposedAgentResults:      null,
      requiresAcknowledgement:   false,
      acknowledgedHighRisk:      false,
      reroutes:                  [],
      error:                     null,
      lastDetectedAt:            null,
    },

    // ── Voice guidance state ─────────────────────────────────────────────
    voice: {
      enabled:                   false,
      muted:                     false,
      lastSpokenInstructionId:   null,
      lastSpokenWarningId:       null,
      supported:                 false,
      error:                     null,
    },

    // ── Offline trip pack ─────────────────────────────────────────────────
    offlineTripPack:       null,
  },

  compliance: {
    status:       'missing_data',   // 'appears_suitable' | 'needs_review' | 'high_risk' | 'missing_data' | 'blocked'
    score:        0,
    dataFreshness: 'no-data',
    warnings:     [
      {
        id:     'initial',
        level:  'info',
        title:  'Compliance not yet run',
        detail: 'Select your vehicle type, fill in required fields, calculate a route, then run Compliance AI.',
      },
    ],
    evidence:      [],
    missingData:   [],
    explanation:   'Run Compliance AI after completing your vehicle profile and calculating a route.',
    disclaimer:
      "Big V's Best Routes provides advisory route guidance only. It does not guarantee legal route suitability. " +
      "Road signs, local restrictions, police instructions, and driver judgement override app guidance. " +
      "The driver remains responsible for route legality and vehicle safety.",
    lastCheckedAt: null,
  },

  restrictions: {
    bridgeRestrictions: [],
    roadRestrictions:   [],
    parkingLocations:   [],
    lastImportedAt:     null,
    importSource:       null,
  },

  settings: {
    mapProvider:         'maplibre',
    routingProvider:     'graphhopper',
    graphHopperApiKey:   '',      // runtime key — env var VITE_GRAPHHOPPER_API_KEY takes priority
    mapStyleUrl:         '',      // runtime override — env var VITE_MAP_STYLE_URL takes priority
    useMetric:           true,
    // demoMode removed — use VITE_ENABLE_DEV_ROUTE_FALLBACK=true in .env for dev fallback
    demoMode:            false,   // user-controlled demo mode toggle in Settings
  },

  // ── Service configuration (extended service provider settings) ────────────
  // Managed by SettingsPage serviceConfig section.
  // Deep-merged with DEFAULT_SERVICE_CONFIG on load — user settings preserved.
  serviceConfig: null,  // populated by loadState() merge below

  // ── 4P3X Specialist AI Agent results ─────────────────────────────────────
  // Populated by agentOrchestrator.runAgentSuite() after every compliance run.
  // All outputs are advisory only.
  agents: {
    ranAt:              null,
    overallLevel:       null,   // 'clear' | 'info' | 'caution' | 'warning' | 'critical'
    headline:           null,
    combinedScore:      null,
    isReadyToNavigate:  false,
    vehicleAgent:       null,
    restrictionAgent:   null,
    legalAgent:         null,
    safetyAgent:        null,
    readinessAgent:     null,
    driverAdvisory:     null,
    // Snapshotted at navigation start — frozen for the session
    sessionSnapshot:    null,
  },
};

// ─── Persistence helpers ────────────────────────────────────────────────────

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export function loadState() {
  // Migrate from v1 storage key if needed
  const savedV1 = safeParse(localStorage.getItem('big-v-best-routes-state-v1'));
  const savedV2 = safeParse(localStorage.getItem(STORAGE_KEY));

  if (savedV2) return deepMerge(initialState, savedV2);
  if (savedV1) {
    // Migrate v1 → v2: strip demoMode, reset compliance to new initial shape
    const migrated = deepMerge(initialState, {
      app:     savedV1.app,
      vehicle: savedV1.vehicle,
      trip:    { ...savedV1.trip, routeStatus: 'idle', lastRouteResult: null },
      restrictions: savedV1.restrictions,
      settings: {
        ...savedV1.settings,
        demoMode: undefined,  // removed in v2
      },
    });
    saveState(migrated);
    return migrated;
  }
  return initialState;
}

// ─── serviceConfig SSOT helpers ──────────────────────────────────────────────

/**
 * Update partial serviceConfig in SSOT.
 * Deep-merges partial config into current serviceConfig.
 * @param {object} state   - current full state
 * @param {object} partial - partial serviceConfig to merge
 * @returns {object} new state
 */
export function updateServiceConfig(state, partial) {
  return updateState(state, (draft) => {
    draft.serviceConfig = mergeWithDefaults({ ...draft.serviceConfig, ...partial });
  });
}

/**
 * Reset serviceConfig to safe defaults.
 */
export function resetServiceConfig(state) {
  return updateState(state, (draft) => {
    draft.serviceConfig = mergeWithDefaults(null);
  });
}

/**
 * Save a test result for a specific service.
 * @param {object} state      - current state
 * @param {string} serviceName - 'mapping'|'geocoding'|'routing'|'overpass'|'ai'
 * @param {object} result     - normalised test result from serviceTester.js
 */
export function saveServiceTestResult(state, serviceName, result) {
  return updateState(state, (draft) => {
    if (!draft.serviceConfig.testResults) draft.serviceConfig.testResults = {};
    draft.serviceConfig.testResults[serviceName] = result;
    // Also update the provider-level status
    if (draft.serviceConfig[serviceName]) {
      draft.serviceConfig[serviceName].status      = result.ok ? 'success' : 'failed';
      draft.serviceConfig[serviceName].lastTestedAt = result.testedAt;
    }
  });
}

/**
 * Set fallback provider in serviceConfig.
 */
export function setFallbackProvider(state, providerName) {
  return updateState(state, (draft) => {
    draft.serviceConfig.mapping.lastFallbackProvider = providerName;
  });
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch)) return patch ?? base;
  if (!base || typeof base !== 'object') return patch ?? base;
  const output = { ...base };
  Object.keys(patch || {}).forEach((key) => {
    output[key] = deepMerge(base[key], patch[key]);
  });
  return output;
}

export function updateState(state, recipe) {
  const draft = structuredClone(state);
  recipe(draft);
  saveState(draft);
  return draft;
}

export function resetState() {
  saveState(initialState);
  return initialState;
}

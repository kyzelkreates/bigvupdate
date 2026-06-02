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
  },

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

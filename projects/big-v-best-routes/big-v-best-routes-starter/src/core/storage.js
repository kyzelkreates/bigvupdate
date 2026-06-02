/**
 * storage.js — Single Source of Truth (SSOT)
 * Big V's Best Routes — local-first state management.
 * All business-critical state flows through here.
 * UI components may use local state only for temporary display controls.
 */

const STORAGE_KEY = 'big-v-best-routes-state-v1';

export const initialState = {
  app: {
    projectName: "Big V's Best Routes",
    mode: 'planner',         // 'planner' | 'navigation' | 'settings' | 'saved'
    acceptedSafetyDisclaimer: false,
    offlineReady: false,
  },
  vehicle: {
    activeVehicleId: 'demo-hgv',
    profiles: {
      'demo-hgv': {
        id: 'demo-hgv',
        name: 'Demo HGV',
        type: 'hgv',
        fields: {
          heightM: 4.1,
          widthM: 2.55,
          lengthM: 13.6,
          grossWeightT: 40,
          axleWeightT: 10.5,
          axleCount: 5,
          hazardousGoods: false,
          emissionsClass: 'Euro VI',
        },
      },
    },
  },
  trip: {
    origin: 'Bristol',
    destination: 'Cardiff',
    routeMode: 'fastest',       // 'fastest' | 'safest' | 'scenic'
    selectedRouteId: null,
    graphHopperEnabled: true,
    routes: [],                 // array of route result objects
    lastRouteResult: null,      // most recent full result from adapter
    routeStatus: 'idle',        // 'idle' | 'loading' | 'success' | 'error' | 'demo'
    routeError: null,
    savedTrips: [],
  },
  navigation: {
    status: 'notStarted',       // 'notStarted' | 'preparing' | 'active' | 'rerouting' | 'paused' | 'stopped' | 'completed' | 'error'
    active: false,              // kept for backwards compat
    lockedVehicleId: null,
    lockedRouteId: null,
    startedAt: null,
    gpsConfidence: 0,
    currentInstruction: 'Plan and validate route before starting navigation.',
    nextManoeuvre: null,
    distanceToNextM: null,
    remainingDistanceM: null,
    remainingDurationMs: null,
    eta: null,
    voiceEnabled: false,
    simulatedMode: true,
  },
  compliance: {
    status: 'needs_review',     // 'appears_suitable' | 'needs_review' | 'high_risk' | 'missing_data' | 'blocked'
    score: 72,
    dataFreshness: 'sample-data',
    warnings: [
      {
        id: 'w1',
        level: 'warning',
        title: 'Restriction data not verified live',
        detail: 'Use road signs and local restrictions as final authority.',
      },
      {
        id: 'w2',
        level: 'info',
        title: 'Demo HGV profile loaded',
        detail: 'Replace sample values with real vehicle measurements before navigation.',
      },
    ],
    evidence: [],
    lastCheckedAt: null,
  },
  restrictions: {
    bridgeRestrictions: [],
    roadRestrictions: [],
    parkingLocations: [],
  },
  settings: {
    mapProvider: 'maplibre',
    routingProvider: 'graphhopper',
    graphHopperApiKey: '',
    useMetric: true,
    demoMode: false,
  },
};

// ─── Persistence helpers ────────────────────────────────────────────────────

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export function loadState() {
  const saved = safeParse(localStorage.getItem(STORAGE_KEY));
  return saved ? deepMerge(initialState, saved) : initialState;
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

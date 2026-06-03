/**
 * navigationConfig.js — Navigation session constants and helpers
 * Big V's Best Routes
 */

/** All valid navigation session states */
export const NAV_STATES = {
  NOT_STARTED: 'notStarted',
  PREPARING:   'preparing',
  ACTIVE:      'active',
  REROUTING:   'rerouting',
  PAUSED:      'paused',
  STOPPED:     'stopped',
  COMPLETED:   'completed',
  ERROR:       'error',
};

/** GPS confidence thresholds */
export const GPS_CONFIDENCE = {
  GOOD:    70,  // >= 70% → show satellite icon
  POOR:    30,  // >= 30% → show partial signal
               //  < 30% → show no-signal
};

/** Simulated GPS progress step — used when real GPS not available */
export const SIM_GPS_STEP_MS = 1800;
export const SIM_GPS_PROGRESS_PER_STEP = 0.004;  // fraction of route per step

/** Instruction distance thresholds (metres) */
export const INSTRUCTION_ADVANCE_DISTANCE = {
  MOTORWAY:   500,
  MAIN_ROAD:  200,
  LOCAL_ROAD: 80,
};

/** How long to show a "rerouting" state before showing error */
export const REROUTE_TIMEOUT_MS = 15000;

/**
 * Build a new navigation session object.
 * Stored in SSOT when navigation starts.
 */
export function buildNavigationSession({
  vehicleId,
  routeId,
  routeSnapshot,
  vehicleSnapshot,
  complianceSnapshot,
  warningsSnapshot,
}) {
  return {
    sessionId:         `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    routeId:           routeId || null,
    vehicleProfileId:  vehicleId,
    startedAt:         new Date().toISOString(),
    status:            NAV_STATES.ACTIVE,
    routeSnapshot:     routeSnapshot || null,
    vehicleSnapshot:   vehicleSnapshot || null,
    complianceSnapshot: complianceSnapshot || null,
    warningsSnapshot:  warningsSnapshot || [],
    gpsStatus:         'simulated',   // 'real' | 'simulated' | 'unavailable'
    offlineStatus:     navigator.onLine ? 'online' : 'offline',
  };
}

// ─── Route progress / off-route constants ────────────────────────────────────

/** Distance from route polyline before off-route is triggered (metres) */
export const OFF_ROUTE_THRESHOLD_M = 50;

/** GPS position is considered stale after this many seconds */
export const GPS_STALE_AFTER_SECONDS = 15;

/** GPS accuracy worse than this (metres) is considered low confidence */
export const LOW_GPS_CONFIDENCE_ACCURACY_M = 75;

/** Minimum distance moved (metres) before updating heading from movement */
export const MIN_MOVEMENT_FOR_HEADING_M = 5;

/** Reroute cooldown — minimum ms between reroute attempts */
export const REROUTE_COOLDOWN_MS = 10_000;

/** Consecutive off-route fixes before triggering reroute prompt */
export const OFF_ROUTE_CONSECUTIVE_FIXES = 3;

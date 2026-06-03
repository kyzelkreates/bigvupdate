/**
 * navigationSessionService.js — Navigation session lifecycle
 * Big V's Best Routes
 *
 * Manages session start/stop/pause/resume transitions.
 * All state mutations return a recipe function to be passed to App.jsx setState().
 * This service never holds state itself — the SSOT (storage.js) owns all state.
 */

import { buildNavigationSession, NAV_STATES } from '../config/navigationConfig.js';

/**
 * Build the SSOT mutation to start a navigation session.
 * Locks vehicle, route, and compliance result.
 *
 * @returns {function} recipe function for setState(recipe)
 */
export function startSessionRecipe(state) {
  const vehicleId = state.vehicle.activeVehicleId;
  const vehicle   = state.vehicle.profiles[vehicleId];
  const route     = state.trip.lastRouteResult;
  const compliance = state.compliance;

  const session = buildNavigationSession({
    vehicleId,
    routeId:           route?.routeId || `route-${Date.now()}`,
    routeSnapshot:     route     ? { ...route }     : null,
    vehicleSnapshot:   vehicle   ? { ...vehicle }   : null,
    complianceSnapshot: compliance ? { ...compliance } : null,
    warningsSnapshot:  compliance?.warnings ? [...compliance.warnings] : [],
  });

  return (draft) => {
    draft.navigation.status              = NAV_STATES.ACTIVE;
    draft.navigation.active              = true;
    draft.navigation.lockedVehicleId     = vehicleId;
    draft.navigation.lockedRouteId       = session.routeId;
    draft.navigation.startedAt           = session.startedAt;
    draft.navigation.sessionId           = session.sessionId;
    draft.navigation.routeSnapshot       = session.routeSnapshot;
    draft.navigation.vehicleSnapshot     = session.vehicleSnapshot;
    draft.navigation.complianceSnapshot  = session.complianceSnapshot;
    draft.navigation.warningsSnapshot    = session.warningsSnapshot;
    draft.navigation.gpsStatus           = session.gpsStatus;
    draft.navigation.offlineStatus       = session.offlineStatus;
    draft.navigation.gpsConfidence       = 0;   // will be updated by locationService
    draft.navigation.currentInstruction  = 'Follow the highlighted route.';
    draft.navigation.nextManoeuvre       = route?.route?.instructions?.[0] || null;
    draft.app.mode                       = 'navigation';
  };
}

/**
 * Build the SSOT mutation to stop navigation.
 * Unlocks vehicle and route.
 */
export function stopSessionRecipe() {
  return (draft) => {
    draft.navigation.status             = NAV_STATES.STOPPED;
    draft.navigation.active             = false;
    draft.navigation.lockedVehicleId    = null;
    draft.navigation.lockedRouteId      = null;
    draft.navigation.startedAt          = null;
    draft.navigation.sessionId          = null;
    draft.navigation.routeSnapshot      = null;
    draft.navigation.vehicleSnapshot    = null;
    draft.navigation.complianceSnapshot = null;
    draft.navigation.warningsSnapshot   = [];
    draft.navigation.gpsStatus          = 'unavailable';
    draft.navigation.gpsConfidence      = 0;
    draft.navigation.currentInstruction = 'Navigation stopped. Vehicle profile can now be edited.';
  };
}

/** Pause navigation. */
export function pauseSessionRecipe() {
  return (draft) => {
    if (draft.navigation.status === NAV_STATES.ACTIVE) {
      draft.navigation.status = NAV_STATES.PAUSED;
    }
  };
}

/** Resume navigation from paused state. */
export function resumeSessionRecipe() {
  return (draft) => {
    if (draft.navigation.status === NAV_STATES.PAUSED) {
      draft.navigation.status = NAV_STATES.ACTIVE;
    }
  };
}

/** Update GPS data in the session. Called by locationService watcher. */
export function updateGpsRecipe({ lat, lon, accuracy, heading, confidence }) {
  return (draft) => {
    draft.navigation.gpsConfidence  = confidence ?? 0;
    draft.navigation.gpsStatus      = 'real';
    draft.navigation.currentLat     = lat;
    draft.navigation.currentLon     = lon;
    draft.navigation.currentHeading = heading;
    draft.navigation.offlineStatus  = navigator.onLine ? 'online' : 'offline';
  };
}

/** Mark session as rerouting. */
export function reroutingRecipe() {
  return (draft) => {
    draft.navigation.status = NAV_STATES.REROUTING;
  };
}

// ─── Extended GPS + route progress recipes (v2.1) ─────────────────────────────

/**
 * Update GPS position, confidence, and derived fields in SSOT.
 * Called on every watchPosition callback.
 *
 * @param {object} normalised - from locationService.normalizePosition()
 */
export function updateGpsPositionRecipe(normalised) {
  return (draft) => {
    draft.navigation.gpsStatus            = 'real';
    draft.navigation.gpsWatchActive       = true;
    draft.navigation.locationPermission   = 'granted';
    draft.navigation.currentLat           = normalised.lat;
    draft.navigation.currentLon           = normalised.lon;
    draft.navigation.currentHeading       = normalised.heading;
    draft.navigation.gpsSpeed             = normalised.speed;
    draft.navigation.gpsSpeedKph          = normalised.speedKph;
    draft.navigation.gpsSpeedMph          = normalised.speedMph;
    draft.navigation.gpsAccuracy          = normalised.accuracy;
    draft.navigation.gpsConfidence        = normalised.gpsConfidence;
    draft.navigation.gpsLastUpdated       = normalised.lastUpdated;
    draft.navigation.gpsIsStale           = false;
    draft.navigation.offlineStatus        = navigator.onLine ? 'online' : 'offline';
  };
}

/**
 * Update route progress engine output into SSOT.
 * Called after calculateRouteProgress() on every GPS update.
 *
 * @param {RouteProgressResult} progress - from routeProgressEngine
 */
export function updateRouteProgressRecipe(progress) {
  return (draft) => {
    draft.navigation.progressFraction            = progress.progressFraction;
    draft.navigation.routeProgressPercent        = progress.routeProgressPercent;
    draft.navigation.currentInstructionIndex     = progress.currentInstructionIndex;
    draft.navigation.currentInstruction          = progress.currentInstruction?.text
                                                    || draft.navigation.currentInstruction;
    draft.navigation.nextInstruction             = progress.nextInstruction;
    draft.navigation.nextInstructionIndex        = progress.nextInstructionIndex;
    draft.navigation.distanceToNextInstructionM  = progress.distanceToNextInstructionM;
    draft.navigation.remainingDistanceM          = progress.remainingDistanceM;
    draft.navigation.remainingDurationMs         = progress.remainingDurationMs;
    draft.navigation.offRouteStatus              = progress.offRoute;
    draft.navigation.offRouteDistanceM           = progress.offRouteDistanceM;
    draft.navigation.navigationWarnings          = progress.warnings || [];

    // Track consecutive off-route fixes
    if (progress.offRoute) {
      draft.navigation.offRouteConsecutiveFixes = (draft.navigation.offRouteConsecutiveFixes || 0) + 1;
    } else {
      draft.navigation.offRouteConsecutiveFixes = 0;
    }
  };
}

/**
 * Set GPS permission state.
 */
export function setGpsPermissionRecipe(permission) {
  return (draft) => {
    draft.navigation.locationPermission = permission;
    if (permission === 'denied' || permission === 'unavailable') {
      draft.navigation.gpsStatus    = 'unavailable';
      draft.navigation.gpsWatchActive = false;
    }
  };
}

/**
 * Set GPS error state — never crashes, just records error.
 */
export function setGpsErrorRecipe(err) {
  return (draft) => {
    draft.navigation.gpsStatus = 'unavailable';
    draft.navigation.gpsWatchActive = false;
    if (err?.code === 1) {
      draft.navigation.locationPermission = 'denied';
    }
  };
}

/**
 * Mark GPS as stale.
 */
export function setGpsStalRecipe() {
  return (draft) => {
    draft.navigation.gpsIsStale = true;
  };
}

/**
 * Update voice guidance state in SSOT.
 * @param {object} partial - partial voice state to merge
 */
export function updateVoiceStateRecipe(partial) {
  return (draft) => {
    draft.navigation.voice = { ...draft.navigation.voice, ...partial };
  };
}

/**
 * Toggle voice enabled state.
 */
export function toggleVoiceRecipe() {
  return (draft) => {
    const enabled = !(draft.navigation.voice?.enabled ?? false);
    draft.navigation.voice = { ...draft.navigation.voice, enabled };
    if (!enabled) {
      draft.navigation.voice.muted = false;
    }
  };
}

/**
 * Toggle voice muted state.
 */
export function toggleVoiceMuteRecipe() {
  return (draft) => {
    const muted = !(draft.navigation.voice?.muted ?? false);
    draft.navigation.voice = { ...draft.navigation.voice, muted };
  };
}

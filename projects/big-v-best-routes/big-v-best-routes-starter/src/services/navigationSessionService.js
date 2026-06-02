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

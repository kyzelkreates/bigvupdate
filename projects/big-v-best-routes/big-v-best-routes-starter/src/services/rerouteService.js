/**
 * rerouteService.js — Safe rerouting flow
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Handles the complete reroute lifecycle:
 *   1. Off-route detection triggers reroute prompt
 *   2. User confirms reroute
 *   3. New GraphHopper route from current GPS to destination
 *   4. Compliance AI + specialist agents run on new route
 *   5. High-risk routes require explicit acknowledgement before accepting
 *   6. Route swap written to SSOT only after acceptance
 *
 * SAFETY RULES:
 *   - Never silently auto-accept high-risk reroutes
 *   - Never choose faster route over safer route without acknowledgement
 *   - Never reroute without valid GPS position
 *   - Always run Compliance AI on new route before presenting it
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

import { calculateRoute }             from './graphhopperClient.js';
import { runComplianceCheck }         from '../core/complianceEngine.js';
import { runAgentSuite, mergeAgentResultsIntoCompliance } from '../agents/agentOrchestrator.js';
import { COMPLIANCE_DISCLAIMER }      from '../config/complianceRules.js';

// ─── Reroute status values ────────────────────────────────────────────────────
export const REROUTE_STATUS = {
  IDLE:                 'idle',
  DETECTING:            'detecting',
  PROMPT:               'prompt',               // show reroute prompt to user
  CALCULATING:          'calculating',
  COMPLIANCE_CHECK:     'compliance_check',
  AWAITING_ACK:         'awaiting_acknowledgement',  // high-risk: user must acknowledge
  ACCEPTED:             'accepted',
  DECLINED:             'declined',
  ERROR:                'error',
};

/** Initial reroute state for SSOT */
export function getInitialRerouteState() {
  return {
    status:                    REROUTE_STATUS.IDLE,
    reason:                    null,
    offRouteDistanceM:         null,
    proposedRoute:             null,
    proposedCompliance:        null,
    proposedAgentResults:      null,
    requiresAcknowledgement:   false,
    acknowledgedHighRisk:      false,
    reroutes:                  [],     // history of reroute events
    error:                     null,
    lastDetectedAt:            null,
  };
}

// ─── Reroute SSOT recipes (return recipe functions for setState) ──────────────

/** Trigger reroute prompt. */
export function promptRerouteRecipe({ offRouteDistanceM, reason }) {
  return (draft) => {
    draft.navigation.reroute = {
      ...getInitialRerouteState(),
      status:            REROUTE_STATUS.PROMPT,
      reason:            reason || 'off_route',
      offRouteDistanceM: offRouteDistanceM || 0,
      lastDetectedAt:    new Date().toISOString(),
    };
    draft.navigation.status = 'rerouting';
  };
}

/** Mark rerouting as calculating. */
export function rerouteCalculatingRecipe() {
  return (draft) => {
    if (draft.navigation.reroute) {
      draft.navigation.reroute.status = REROUTE_STATUS.CALCULATING;
    }
  };
}

/** Store proposed route — user review pending. */
export function rerouteProposedRecipe({ proposedRoute, proposedCompliance, proposedAgentResults }) {
  const requiresAck = _requiresAcknowledgement(proposedCompliance, proposedAgentResults);
  return (draft) => {
    if (draft.navigation.reroute) {
      draft.navigation.reroute.status              = requiresAck ? REROUTE_STATUS.AWAITING_ACK : REROUTE_STATUS.AWAITING_ACK;
      draft.navigation.reroute.proposedRoute       = proposedRoute;
      draft.navigation.reroute.proposedCompliance  = proposedCompliance;
      draft.navigation.reroute.proposedAgentResults = proposedAgentResults;
      draft.navigation.reroute.requiresAcknowledgement = requiresAck;
    }
  };
}

/** Accept the proposed reroute — swaps active route in SSOT. */
export function acceptRerouteRecipe() {
  return (draft) => {
    const reroute = draft.navigation.reroute;
    if (!reroute?.proposedRoute) return;

    // Swap route
    draft.trip.lastRouteResult  = reroute.proposedRoute;
    draft.trip.routeStatus      = reroute.proposedRoute.ok ? 'success' : 'error';

    // Update compliance
    if (reroute.proposedCompliance) {
      draft.compliance = { ...draft.compliance, ...reroute.proposedCompliance };
    }

    // Record reroute event in history
    const event = {
      at:               new Date().toISOString(),
      reason:           reroute.reason,
      offRouteDistanceM: reroute.offRouteDistanceM,
      acknowledgedHighRisk: reroute.requiresAcknowledgement,
      newRouteDistance: reroute.proposedRoute?.route?.distanceM,
    };
    if (!draft.navigation.reroute.reroutes) draft.navigation.reroute.reroutes = [];
    draft.navigation.reroute.reroutes.push(event);

    // Reset reroute state but keep history
    const history = draft.navigation.reroute.reroutes;
    draft.navigation.reroute          = getInitialRerouteState();
    draft.navigation.reroute.reroutes = history;
    draft.navigation.status           = 'active';

    // Update nav session snapshots
    draft.navigation.routeSnapshot = reroute.proposedRoute;
  };
}

/** Decline the proposed reroute — stay on current route. */
export function declineRerouteRecipe() {
  return (draft) => {
    const history = draft.navigation.reroute?.reroutes || [];
    draft.navigation.reroute          = getInitialRerouteState();
    draft.navigation.reroute.reroutes = history;
    draft.navigation.reroute.status   = REROUTE_STATUS.DECLINED;
    draft.navigation.status           = 'active';
  };
}

/** Store reroute error. */
export function rerouteErrorRecipe(message) {
  return (draft) => {
    if (draft.navigation.reroute) {
      draft.navigation.reroute.status = REROUTE_STATUS.ERROR;
      draft.navigation.reroute.error  = { message };
    }
    draft.navigation.status = 'active';
  };
}

// ─── Async reroute flow ───────────────────────────────────────────────────────

/**
 * Execute the full reroute flow.
 * Called by App.jsx when user confirms reroute.
 *
 * @param {object} params
 * @param {number} params.currentLat       - current GPS lat
 * @param {number} params.currentLon       - current GPS lon
 * @param {string} params.destination      - destination string or "lat,lon"
 * @param {object} params.vehicle          - vehicle profile from SSOT
 * @param {object} params.restrictions     - restrictions from SSOT
 * @param {object} params.settings         - app settings from SSOT
 * @param {function} params.onRecipe       - setState-style recipe dispatcher
 * @returns {void}
 */
export async function executeReroute({
  currentLat,
  currentLon,
  destination,
  vehicle,
  restrictions,
  settings,
  onRecipe,
}) {
  if (currentLat == null || currentLon == null) {
    onRecipe(rerouteErrorRecipe('GPS position required for rerouting. Enable location access and try again.'));
    return;
  }

  // 1. Mark as calculating
  onRecipe(rerouteCalculatingRecipe());

  try {
    // 2. Request new GraphHopper route from current GPS position
    const origin      = `${currentLat.toFixed(6)},${currentLon.toFixed(6)}`;
    const routeResult = await calculateRoute({
      origin,
      destination,
      vehicle,
      apiKey: settings.graphHopperApiKey,
    });

    if (!routeResult.ok) {
      onRecipe(rerouteErrorRecipe(routeResult.message || 'Reroute failed. Check your connection and try again.'));
      return;
    }

    // 3. Run Compliance AI on new route
    const baseCompliance = runComplianceCheck({
      vehicle,
      trip:         { origin, destination, routeMode: 'fastest', lastRouteResult: routeResult },
      restrictions,
      routeResult,
    });

    // 4. Run specialist agents
    const agentSuite = runAgentSuite({
      vehicle,
      trip:         { origin, destination, lastRouteResult: routeResult },
      navigation:   {},
      restrictions,
      compliance:   baseCompliance,
      settings,
    });

    const enrichedCompliance = mergeAgentResultsIntoCompliance(baseCompliance, agentSuite);

    // 5. Store proposed route — UI will present for acceptance
    onRecipe(rerouteProposedRecipe({
      proposedRoute:        routeResult,
      proposedCompliance:   enrichedCompliance,
      proposedAgentResults: agentSuite,
    }));

  } catch (err) {
    onRecipe(rerouteErrorRecipe(err?.message || 'Unexpected reroute error.'));
  }
}

// ─── Helper: should reroute require explicit acknowledgement? ─────────────────

function _requiresAcknowledgement(compliance, agentResults) {
  // Require ack for high-risk or restriction conflicts
  if (!compliance) return false;
  if (compliance.status === 'high_risk' || compliance.advisoryStatus === 'high_risk') return true;
  if (compliance.score < 45) return true;
  if ((agentResults?.restrictionAgent?.dataQuality?.totalConflicts || 0) > 0) return true;
  return false;
}

export { COMPLIANCE_DISCLAIMER };

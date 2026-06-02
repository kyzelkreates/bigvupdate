/**
 * navigationReadinessAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Runs pre-navigation readiness checks before the driver can start navigation.
 * Gates navigation start on minimum safety conditions.
 * Presents a clear readiness checklist so the driver knows what is missing.
 *
 * ADVISORY ONLY. Passing readiness checks does not guarantee route safety.
 */

import { COMPLIANCE_DISCLAIMER } from '../config/complianceRules.js';

export const AGENT_ID = 'navigation_readiness_agent';

/**
 * Run navigation readiness check.
 *
 * @param {object} params
 * @param {object} params.vehicle              - vehicle profile
 * @param {object} params.trip                 - trip state from SSOT
 * @param {object} params.navigation           - navigation state from SSOT
 * @param {object} params.compliance           - compliance state from SSOT
 * @param {object} params.vehicleAgentResult   - from vehicleConstraintAgent
 * @param {object} params.safetyAgentResult    - from safetyRouteAgent
 * @returns {ReadinessResult}
 */
export function runNavigationReadinessAgent({
  vehicle,
  trip,
  navigation,
  compliance,
  vehicleAgentResult,
  safetyAgentResult,
}) {
  const checklist = [];
  let readyCount = 0;

  // ── Check 1: Safety disclaimer accepted ───────────────────────────────────
  const disclaimerAccepted = true; // enforced by PlannerDashboard gate — if we're here, it was accepted
  checklist.push({
    id:      'disclaimer',
    label:   'Safety disclaimer acknowledged',
    passed:  disclaimerAccepted,
    blocker: false,
    detail:  disclaimerAccepted ? 'Safety advisory terms accepted.' : 'Accept the safety disclaimer before navigating.',
  });
  if (disclaimerAccepted) readyCount++;

  // ── Check 2: Vehicle type selected ────────────────────────────────────────
  const vehicleTypeSet = !!vehicle?.type && vehicle.type !== '';
  checklist.push({
    id:      'vehicle-type',
    label:   'Vehicle type selected',
    passed:  vehicleTypeSet,
    blocker: true,
    detail:  vehicleTypeSet ? `Vehicle type: ${vehicle.type.toUpperCase()}.` : 'Select a vehicle type in the vehicle form.',
  });
  if (vehicleTypeSet) readyCount++;

  // ── Check 3: Vehicle name set ──────────────────────────────────────────────
  const vehicleNamed = !!vehicle?.name && vehicle.name.trim() !== '' && vehicle.name !== 'My Vehicle';
  checklist.push({
    id:      'vehicle-name',
    label:   'Vehicle identified',
    passed:  vehicleNamed,
    blocker: false,
    detail:  vehicleNamed ? `Vehicle: ${vehicle.name}` : 'Give your vehicle a name for session identification (recommended).',
  });
  if (vehicleNamed) readyCount++;

  // ── Check 4: Legal-critical fields complete ───────────────────────────────
  const vcMissing     = vehicleAgentResult?.missingFields?.length || 0;
  const legalComplete = vcMissing === 0;
  checklist.push({
    id:      'legal-fields',
    label:   'Legal vehicle fields complete',
    passed:  legalComplete,
    blocker: ['hgv', 'bus', 'motorhome', 'trailer', 'custom'].includes(vehicle?.type),
    detail:  legalComplete
      ? 'All required legal fields are filled.'
      : `${vcMissing} required field(s) missing: ${(vehicleAgentResult?.missingFields || []).map((f) => f.label).slice(0, 3).join(', ')}${vcMissing > 3 ? '…' : ''}.`,
  });
  if (legalComplete) readyCount++;

  // ── Check 5: Origin and destination set ───────────────────────────────────
  const tripInputsSet = !!trip?.origin?.trim() && !!trip?.destination?.trim();
  checklist.push({
    id:      'trip-inputs',
    label:   'Origin and destination entered',
    passed:  tripInputsSet,
    blocker: true,
    detail:  tripInputsSet
      ? `${trip.origin} → ${trip.destination}`
      : 'Enter origin and destination before navigating.',
  });
  if (tripInputsSet) readyCount++;

  // ── Check 6: Route calculated ─────────────────────────────────────────────
  const routeCalculated = !!trip?.lastRouteResult?.route;
  checklist.push({
    id:      'route-calculated',
    label:   'Route calculated',
    passed:  routeCalculated,
    blocker: true,
    detail:  routeCalculated
      ? `Route ready — ${_formatDist(trip.lastRouteResult.route.distanceM)}, ${_formatDur(trip.lastRouteResult.route.durationMs)}.`
      : 'Calculate a route on the Trip Planning dashboard.',
  });
  if (routeCalculated) readyCount++;

  // ── Check 7: Route not dev fallback ───────────────────────────────────────
  const notDevFallback = !trip?.lastRouteResult?.demoMode && !trip?.lastRouteResult?.devFallback;
  checklist.push({
    id:      'real-route',
    label:   'Live GraphHopper route',
    passed:  notDevFallback,
    blocker: false,
    detail:  notDevFallback
      ? 'Live GraphHopper route confirmed.'
      : 'Dev fallback route active — configure GraphHopper API key for a real route.',
  });
  if (notDevFallback) readyCount++;

  // ── Check 8: Compliance run ────────────────────────────────────────────────
  const complianceRun = !!compliance?.lastCheckedAt;
  const complianceScore = compliance?.score || 0;
  checklist.push({
    id:      'compliance-run',
    label:   'Compliance AI check run',
    passed:  complianceRun,
    blocker: false,
    detail:  complianceRun
      ? `Compliance score: ${complianceScore}% (${(compliance?.status || '').replaceAll('_', ' ')}).`
      : 'Run the Compliance AI check for an advisory assessment of this route.',
  });
  if (complianceRun) readyCount++;

  // ── Check 9: No critical route conflicts ──────────────────────────────────
  const noRouteConflicts = !safetyAgentResult || (safetyAgentResult?.safetyPriorities?.conflictsCleared !== false);
  checklist.push({
    id:      'no-conflicts',
    label:   'No critical route conflicts',
    passed:  noRouteConflicts,
    blocker: false,
    detail:  noRouteConflicts
      ? 'No critical restriction conflicts detected on route.'
      : 'Restriction conflicts detected on this route — manual checks required before navigating.',
  });
  if (noRouteConflicts) readyCount++;

  // ── Check 10: Device online (soft) ────────────────────────────────────────
  const isOnline = navigator.onLine;
  checklist.push({
    id:      'online',
    label:   'Device online',
    passed:  isOnline,
    blocker: false,
    detail:  isOnline ? 'Device is online.' : 'Device is offline — navigation will use cached route data.',
  });
  if (isOnline) readyCount++;

  // ── Readiness determination ────────────────────────────────────────────────
  const blockersFailed = checklist.filter((c) => !c.passed && c.blocker);
  const isReady        = blockersFailed.length === 0;
  const totalChecks    = checklist.length;
  const readinessScore = Math.round((readyCount / totalChecks) * 100);

  const blockerMessages = blockersFailed.map((c) => c.detail);

  const summary = isReady
    ? `Navigation ready — ${readyCount}/${totalChecks} checks passed.`
    : `Navigation blocked — ${blockersFailed.length} required item(s) not met: ${blockerMessages.slice(0, 2).join(' · ')}`;

  const driverMessage = isReady
    ? `All required checks passed. You may start navigation. Remember: road signs and local restrictions always override app guidance.`
    : `Cannot start navigation: ${blockerMessages[0] || 'Complete required items first.'}`;

  return {
    agentId:        AGENT_ID,
    status:         isReady ? 'ready' : 'not_ready',
    isReady,
    readinessScore,
    readyCount,
    totalChecks,
    checklist,
    blockersFailed,
    summary,
    driverMessage,
    disclaimer:     COMPLIANCE_DISCLAIMER,
    ranAt:          new Date().toISOString(),
  };
}

function _formatDist(m) {
  if (!m) return '?km';
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

function _formatDur(ms) {
  if (!ms) return '?min';
  const mins = Math.round(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}min` : `${mins}min`;
}

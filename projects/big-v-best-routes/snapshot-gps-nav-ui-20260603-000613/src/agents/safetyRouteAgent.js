/**
 * safetyRouteAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Evaluates route selection priorities using safety-first logic:
 *   1. Avoid known legal/physical conflicts
 *   2. Avoid high-risk compliance warnings
 *   3. Prefer higher restriction-data confidence
 *   4. Prefer safer route suitability
 *   5. Only then optimise distance/time
 *
 * ADVISORY ONLY. Never guarantees a safe or legal route.
 */

export const AGENT_ID = 'safety_route_agent';

/**
 * Run safety route assessment.
 *
 * @param {object} params
 * @param {object} params.vehicle                  - vehicle profile
 * @param {object} params.routeResult              - normalised route result
 * @param {object} params.vehicleAgentResult       - from vehicleConstraintAgent
 * @param {object} params.restrictionAgentResult   - from restrictionDataAgent
 * @param {object} params.legalAgentResult         - from legalComplianceAgent
 * @param {object} params.settings                 - app settings from SSOT
 * @returns {AgentResult}
 */
export function runSafetyRouteAgent({
  vehicle,
  routeResult,
  vehicleAgentResult,
  restrictionAgentResult,
  legalAgentResult,
  settings,
}) {
  const assessments = [];
  const routeSafetyScore = _buildSafetyScore(
    vehicleAgentResult,
    restrictionAgentResult,
    legalAgentResult,
    routeResult,
    vehicle,
    settings,
  );

  // ── Priority 1: Legal/physical conflicts ──────────────────────────────────
  const hasConflicts = (restrictionAgentResult?.dataQuality?.totalConflicts || 0) > 0;
  if (hasConflicts) {
    assessments.push({
      id: 'p1-conflict', priority: 1, severity: 'critical',
      title: 'Priority 1: Known restriction conflicts on route',
      detail: 'Route intersects known restriction points that exceed your vehicle profile. Route should be deviated or manually verified.',
      action: 'Deviate route to avoid restriction conflict points.',
    });
  }

  // ── Priority 2: High-risk compliance warnings ─────────────────────────────
  const legalStatus = legalAgentResult?.status;
  const isHighRisk  = legalStatus === 'high_risk' || legalAgentResult?.severity === 'critical';
  if (isHighRisk && !hasConflicts) {
    assessments.push({
      id: 'p2-high-risk', priority: 2, severity: 'critical',
      title: 'Priority 2: High-risk compliance flags',
      detail: 'Compliance AI and legal agent have flagged this route as high risk for this vehicle profile.',
      action: 'Complete manual legal checks before using this route. Consider alternative vehicle profile or route.',
    });
  }

  // ── Priority 3: Restriction data confidence ───────────────────────────────
  const rdStatus    = restrictionAgentResult?.status;
  const hasRdData   = rdStatus !== 'no_data';
  if (!hasRdData) {
    assessments.push({
      id: 'p3-no-data', priority: 3, severity: 'warning',
      title: 'Priority 3: Low restriction data confidence',
      detail: 'No local restriction dataset is loaded. Route physical restriction checks cannot be completed.',
      action: 'Import restriction data in Settings for improved safety advisory.',
    });
  }

  // ── Priority 4: Route suitability ─────────────────────────────────────────
  const routeMode = vehicle?.routeMode || settings?.routeMode || 'fastest';
  if (routeMode === 'fastest' && (isHighRisk || !hasRdData)) {
    assessments.push({
      id: 'p4-route-mode', priority: 4, severity: 'info',
      title: 'Priority 4: Fastest route selected with incomplete safety data',
      detail: 'The "fastest" route mode may not choose the safest available option when restriction data is limited.',
      action: 'Consider "Safest" route mode when restriction data confidence is low.',
    });
  }

  // ── Route profile check ────────────────────────────────────────────────────
  const routeProfile = routeResult?.route?.profile;
  const vehicleType  = vehicle?.type;
  const profileMismatch = _checkProfileMismatch(vehicleType, routeProfile);
  if (profileMismatch) {
    assessments.push({
      id: 'profile-mismatch', priority: 2, severity: 'warning',
      title: `Routing profile advisory: ${routeProfile} used for ${vehicleType}`,
      detail: profileMismatch,
      action: 'Verify routing profile is appropriate for your vehicle.',
    });
  }

  // ── No route ──────────────────────────────────────────────────────────────
  if (!routeResult?.route) {
    assessments.push({
      id: 'no-route', priority: 1, severity: 'warning',
      title: 'No route to assess',
      detail: 'Safety route assessment requires a calculated route.',
      action: 'Calculate a route on the Trip Planning dashboard.',
    });
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const hasCritical = assessments.some((a) => a.severity === 'critical');
  const hasWarning  = assessments.some((a) => a.severity === 'warning');
  const overallSeverity = hasCritical ? 'critical' : hasWarning ? 'warning' : 'clear';

  const recommendation = buildRecommendation(
    hasConflicts, isHighRisk, hasRdData, routeResult, routeSafetyScore,
  );

  return {
    agentId:          AGENT_ID,
    status:           hasCritical ? 'unsafe_to_proceed' : hasWarning ? 'caution_advised' : 'proceed_with_checks',
    severity:         overallSeverity,
    routeSafetyScore,
    assessments,
    recommendation,
    routeMode:        routeMode,
    routeProfile:     routeProfile || null,
    safetyPriorities: {
      conflictsCleared:   !hasConflicts,
      complianceClear:    !isHighRisk,
      restrictionDataOk:  hasRdData,
      routeSuitable:      routeSafetyScore >= 60,
    },
    driverMessage:    recommendation,
    ranAt:            new Date().toISOString(),
  };
}

function _buildSafetyScore(vc, rd, legal, routeResult, vehicle, settings) {
  let score = 100;

  if (!routeResult?.route)              score -= 20;
  if (routeResult?.demoMode)            score -= 20;
  if (routeResult?.setupRequired)       score -= 15;

  const vcCritical = (vc?.findings || []).filter((f) => f.severity === 'critical').length;
  const vcWarning  = (vc?.findings || []).filter((f) => f.severity === 'warning').length;
  score -= vcCritical * 15;
  score -= vcWarning  * 5;

  const rdConflicts = rd?.dataQuality?.totalConflicts || 0;
  score -= rdConflicts * 25;
  if (rd?.status === 'no_data') score -= 15;

  const legalScore = legal?.advisoryScore || 50;
  // Weight: 50% own analysis, 50% legal agent score
  score = Math.round(score * 0.5 + legalScore * 0.5);

  return Math.max(0, Math.min(100, score));
}

function _checkProfileMismatch(vehicleType, routeProfile) {
  if (!vehicleType || !routeProfile) return null;
  const heavyTypes = ['hgv', 'bus', 'motorhome', 'trailer', 'custom'];
  if (heavyTypes.includes(vehicleType) && routeProfile === 'car') {
    return `Heavy vehicle (${vehicleType}) routed on "car" profile. GraphHopper "truck" profile is recommended for accurate HGV routing restrictions.`;
  }
  if (vehicleType === 'motorcycle' && routeProfile === 'car') {
    return `Motorcycle vehicle type routed on "car" profile. Consider using the "motorcycle" routing profile for more accurate lane/road type routing.`;
  }
  if (vehicleType === 'bicycle' && !['bike', 'bicycle'].includes(routeProfile)) {
    return `Bicycle routed on "${routeProfile}" profile instead of "bike". Cycling infrastructure will not be used.`;
  }
  return null;
}

function buildRecommendation(hasConflicts, isHighRisk, hasRdData, routeResult, safetyScore) {
  if (hasConflicts) {
    return '⚠ Route conflicts detected — do not proceed on this route without physically checking all flagged restriction points. Manual deviation may be required.';
  }
  if (isHighRisk) {
    return '⚠ High-risk compliance flags — complete manual legal checks before using this route. Driver and operator remain fully responsible.';
  }
  if (!hasRdData && safetyScore < 70) {
    return 'Caution advised — no restriction dataset loaded. Manual bridge, weight, and width checks required for all restrictions on this route.';
  }
  if (!routeResult?.route) {
    return 'Calculate a route first. Safety route assessment cannot be completed without a route.';
  }
  if (safetyScore >= 75) {
    return 'Advisory: route appears broadly suitable based on available data. Verify against current road signs and local authority guidance before departure.';
  }
  return 'Caution advised — review all warnings. Road signs and physical restrictions override this assessment. Driver remains responsible.';
}

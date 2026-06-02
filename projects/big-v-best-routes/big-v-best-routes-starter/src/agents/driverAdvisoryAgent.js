/**
 * driverAdvisoryAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Composes the final plain-English driver advisory from all upstream
 * specialist agent outputs. This is the "last mile" agent — its output
 * is what the driver reads in the Compliance AI panel and route summary.
 *
 * Priority order for message composition:
 *   1. Critical route conflicts
 *   2. HAZMAT / legal blocks
 *   3. Missing critical vehicle data
 *   4. High-risk compliance findings
 *   5. Navigation readiness blocks
 *   6. Advisory cautions
 *   7. Positive assessment with appropriate caveats
 *
 * ADVISORY ONLY. All outputs must include the mandatory disclaimer.
 */

import { COMPLIANCE_DISCLAIMER } from '../config/complianceRules.js';

export const AGENT_ID = 'driver_advisory_agent';

/**
 * Compose final driver advisory.
 *
 * @param {object} params - all upstream agent results + state
 * @returns {DriverAdvisory}
 */
export function runDriverAdvisoryAgent({
  vehicle,
  routeResult,
  vehicleAgentResult,
  restrictionAgentResult,
  legalAgentResult,
  safetyAgentResult,
  readinessAgentResult,
  compliance,
}) {
  const messages   = [];
  const actions    = [];
  let overallLevel = 'info'; // 'clear' | 'info' | 'caution' | 'warning' | 'critical'

  const type       = vehicle?.type || 'car';
  const typeLabel  = (type).toUpperCase();
  const hasRoute   = !!routeResult?.route;
  const isDevRoute = !!(routeResult?.demoMode || routeResult?.devFallback);

  // ── 1. Route conflicts (highest priority) ─────────────────────────────────
  const rdConflicts = restrictionAgentResult?.dataQuality?.totalConflicts || 0;
  if (rdConflicts > 0) {
    overallLevel = 'critical';
    messages.push({
      level:   'critical',
      heading: '⛔ Route restriction conflicts',
      body:    `${rdConflicts} restriction point(s) on your route exceed your vehicle profile. Do not proceed without checking each flagged point physically.`,
    });
    actions.push('Check each flagged bridge/restriction point manually before departure.');
    actions.push('Consider re-routing to avoid conflict points.');
  }

  // ── 2. HAZMAT block ────────────────────────────────────────────────────────
  if (vehicleAgentResult?.constraintFlags?.hazmat) {
    overallLevel = _escalate(overallLevel, 'critical');
    messages.push({
      level:   'critical',
      heading: '⛔ HAZMAT — legal authorisation required',
      body:    'This vehicle is carrying hazardous goods (ADR). You must obtain specialist HAZMAT routing authorisation before this route can be used operationally.',
    });
    actions.push('Obtain ADR HAZMAT routing authorisation from a specialist operator.');
  }

  // ── 3. Missing critical vehicle data ──────────────────────────────────────
  const missingCount = vehicleAgentResult?.missingFields?.length || 0;
  if (missingCount > 0) {
    overallLevel = _escalate(overallLevel, 'warning');
    const missingLabels = (vehicleAgentResult?.missingFields || []).map((f) => f.label).slice(0, 4);
    messages.push({
      level:   'warning',
      heading: `⚠ Missing ${missingCount} required vehicle field(s)`,
      body:    `Required legal fields not filled: ${missingLabels.join(', ')}${missingCount > 4 ? '…' : ''}. Compliance advisory is reduced without this data.`,
    });
    actions.push(`Complete vehicle fields: ${missingLabels.slice(0, 3).join(', ')}.`);
  }

  // ── 4. High-risk compliance ────────────────────────────────────────────────
  const legalStatus = legalAgentResult?.status;
  if (legalStatus === 'high_risk' || legalStatus === 'missing_data') {
    overallLevel = _escalate(overallLevel, 'warning');
    messages.push({
      level:   'warning',
      heading: '⚠ Compliance AI: high risk / missing data',
      body:    legalAgentResult?.driverMessage || 'Legal advisory assessment flagged high risk. Review all compliance warnings before departure.',
    });
    actions.push('Review all compliance warnings in the Compliance AI panel.');
  }

  // ── 5. No restriction data ────────────────────────────────────────────────
  const noRdData = restrictionAgentResult?.status === 'no_data';
  if (noRdData) {
    overallLevel = _escalate(overallLevel, 'caution');
    messages.push({
      level:   'caution',
      heading: 'ℹ No restriction dataset loaded',
      body:    'Physical bridge height, weight, and width restrictions cannot be checked without a local restriction dataset. Manual checks required for the entire route.',
    });
    actions.push('Import restriction data in Settings → Import restrictions CSV.');
    actions.push('Manually check all bridges, weight limits, and width restrictions on this route.');
  }

  // ── 6. Navigation readiness blockers ─────────────────────────────────────
  const readinessBlockers = readinessAgentResult?.blockersFailed || [];
  if (readinessBlockers.length > 0 && !hasRoute) {
    overallLevel = _escalate(overallLevel, 'warning');
    messages.push({
      level:   'warning',
      heading: `⚠ Navigation not ready — ${readinessBlockers.length} item(s) to complete`,
      body:    readinessBlockers.map((b) => b.detail).slice(0, 3).join(' · '),
    });
    readinessBlockers.slice(0, 3).forEach((b) => actions.push(b.detail));
  }

  // ── 7. Dev route advisory ─────────────────────────────────────────────────
  if (isDevRoute && hasRoute) {
    overallLevel = _escalate(overallLevel, 'caution');
    messages.push({
      level:   'caution',
      heading: 'ℹ Dev fallback route',
      body:    'This is a straight-line development route — not a real navigable route. Configure your GraphHopper API key for live routing.',
    });
    actions.push('Configure VITE_GRAPHHOPPER_API_KEY for live routing.');
  }

  // ── 8. Manual check types ─────────────────────────────────────────────────
  if (legalAgentResult?.manualChecksRequired) {
    overallLevel = _escalate(overallLevel, 'caution');
    messages.push({
      level:   'caution',
      heading: `ℹ Manual legal checks required — ${typeLabel}`,
      body:    `All ${typeLabel} operators must conduct pre-journey restriction and legal checks. This advisory system supplements but does not replace those checks.`,
    });
    actions.push(`Complete pre-journey manual legal checks for ${typeLabel} operation.`);
  }

  // ── 9. Safety route score ──────────────────────────────────────────────────
  const safetyScore = safetyAgentResult?.routeSafetyScore;
  if (safetyScore !== undefined && safetyScore < 55 && overallLevel === 'info') {
    overallLevel = 'caution';
    messages.push({
      level:   'caution',
      heading: `Caution — route safety score ${safetyScore}%`,
      body:    safetyAgentResult?.recommendation || 'Review all safety agent findings before departure.',
    });
  }

  // ── 10. Positive / ready advisory ─────────────────────────────────────────
  if (messages.length === 0 && hasRoute && !isDevRoute) {
    overallLevel = 'clear';
    messages.push({
      level:   'clear',
      heading: `✓ Advisory: ${typeLabel} route appears broadly suitable`,
      body:    `Based on available data, no critical conflicts or high-risk issues were detected. Verify against current road signs and local restrictions before departure.`,
    });
  }

  if (!hasRoute && messages.length === 0) {
    messages.push({
      level:   'info',
      heading: 'ℹ Calculate a route to begin',
      body:    'Enter your origin and destination, fill in your vehicle profile, then calculate a route to receive your 4P3X advisory assessment.',
    });
  }

  // ── Compose final advisory headline ───────────────────────────────────────
  const headline = _buildHeadline(overallLevel, typeLabel, rdConflicts, missingCount, legalStatus);

  // ── Summary ────────────────────────────────────────────────────────────────
  const complianceScore  = legalAgentResult?.advisoryScore ?? compliance?.score ?? 0;
  const readinessScore   = readinessAgentResult?.readinessScore ?? 0;

  return {
    agentId:          AGENT_ID,
    overallLevel,
    headline,
    messages,
    actions:          [...new Set(actions)],   // deduplicate
    complianceScore,
    readinessScore,
    safetyScore:      safetyScore ?? null,
    vehicleType:      type,
    hasRoute,
    isDevRoute,
    disclaimer:       COMPLIANCE_DISCLAIMER,
    summary:          `${typeLabel} advisory — ${overallLevel.toUpperCase()}: ${headline}`,
    ranAt:            new Date().toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _escalate(current, next) {
  const ORDER = ['info', 'clear', 'caution', 'warning', 'critical'];
  return ORDER.indexOf(next) > ORDER.indexOf(current) ? next : current;
}

function _buildHeadline(level, typeLabel, rdConflicts, missingCount, legalStatus) {
  switch (level) {
    case 'critical':
      if (rdConflicts > 0) return `Route conflicts — do not proceed without manual checks`;
      return `Critical issues found — manual checks required before departure`;
    case 'warning':
      if (missingCount > 0) return `Vehicle data incomplete — compliance advisory is limited`;
      if (legalStatus === 'high_risk') return `High-risk advisory — review all warnings before departure`;
      return `Warnings found — review compliance panel before departure`;
    case 'caution':
      return `Advisory cautions — verify against road signs and local restrictions`;
    case 'clear':
      return `No critical issues found — ${typeLabel} route appears broadly suitable`;
    default:
      return `Complete vehicle profile and calculate route for your 4P3X advisory`;
  }
}

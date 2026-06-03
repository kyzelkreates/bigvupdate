/**
 * legalComplianceAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Cross-references vehicle constraints, restriction data, and route
 * characteristics to produce a legal-advisory assessment.
 * Consumes output from VehicleConstraintAgent and RestrictionDataAgent.
 *
 * ADVISORY ONLY. Not legal advice. Not a legal route guarantee.
 * Road signs and local authorities override this assessment.
 */

import { ALWAYS_MANUAL_CHECK_TYPES, COMPLIANCE_DISCLAIMER } from '../config/complianceRules.js';

export const AGENT_ID = 'legal_compliance_agent';

/**
 * Run legal compliance advisory assessment.
 *
 * @param {object} params
 * @param {object} params.vehicle              - vehicle profile
 * @param {object} params.routeResult          - normalised route result
 * @param {object} params.vehicleAgentResult   - from vehicleConstraintAgent
 * @param {object} params.restrictionAgentResult - from restrictionDataAgent
 * @returns {AgentResult}
 */
export function runLegalComplianceAgent({
  vehicle,
  routeResult,
  vehicleAgentResult,
  restrictionAgentResult,
}) {
  const advisoryItems = [];
  let score = 100;

  const type = vehicle?.type || 'car';
  const isHeavyVehicle = ['hgv', 'bus', 'motorhome', 'trailer', 'custom'].includes(type);
  const fields = vehicle?.fields || {};

  // ── Input guard ───────────────────────────────────────────────────────────
  if (!vehicleAgentResult || !restrictionAgentResult) {
    return _failResult('Prerequisite agent results missing. Run VehicleConstraintAgent and RestrictionDataAgent first.');
  }

  // ── Pull in vehicle constraint findings ───────────────────────────────────
  const vcFindings = vehicleAgentResult.findings || [];
  const vcCritical = vcFindings.filter((f) => f.severity === 'critical');
  const vcWarnings = vcFindings.filter((f) => f.severity === 'warning');

  score -= vcCritical.length * 18;
  score -= vcWarnings.length * 6;

  if (vcCritical.length > 0) {
    advisoryItems.push({
      id: 'vc-critical', severity: 'critical',
      title: `${vcCritical.length} vehicle constraint critical issue(s)`,
      detail: vcCritical.map((f) => f.title).join(' · '),
      source: 'VehicleConstraintAgent',
    });
  }

  // ── Pull in restriction data findings ─────────────────────────────────────
  const rdFindings    = restrictionAgentResult.findings   || [];
  const rdCritical    = rdFindings.filter((f) => f.severity === 'critical');
  const rdWarnings    = rdFindings.filter((f) => f.severity === 'warning');
  const noRdData      = restrictionAgentResult.status === 'no_data';
  const rdConflicts   = restrictionAgentResult.dataQuality?.totalConflicts || 0;

  score -= rdCritical.length * 22;  // route conflicts are high-impact
  score -= rdWarnings.length * 8;
  if (noRdData) score -= 15;        // reduced confidence without data

  if (rdCritical.length > 0) {
    advisoryItems.push({
      id: 'rd-critical', severity: 'critical',
      title: `${rdCritical.length} restriction conflict(s) detected on route`,
      detail: rdCritical.map((f) => f.title).join(' · '),
      source: 'RestrictionDataAgent',
    });
  }
  if (noRdData) {
    advisoryItems.push({
      id: 'rd-no-data', severity: 'warning',
      title: 'No restriction dataset — compliance confidence reduced',
      detail: 'Import local restriction data in Settings to improve legal advisory accuracy.',
      source: 'RestrictionDataAgent',
    });
  }

  // ── Route quality checks ───────────────────────────────────────────────────
  if (!routeResult?.route) {
    score -= 20;
    advisoryItems.push({
      id: 'no-route', severity: 'warning',
      title: 'No route calculated',
      detail: 'Legal advisory cannot be fully assessed without a route.',
      source: 'LegalComplianceAgent',
    });
  } else {
    if (routeResult.demoMode || routeResult.devFallback) {
      score -= 15;
      advisoryItems.push({
        id: 'dev-route', severity: 'warning',
        title: 'Dev fallback route — not a real route',
        detail: 'Restriction proximity checks are not meaningful on a straight-line dev route.',
        source: 'LegalComplianceAgent',
      });
    }

    if (routeResult.setupRequired) {
      score -= 10;
      advisoryItems.push({
        id: 'no-api-key', severity: 'warning',
        title: 'Routing provider not configured',
        detail: 'Full legal advisory requires a live GraphHopper route.',
        source: 'LegalComplianceAgent',
      });
    }
  }

  // ── HAZMAT cross-check ─────────────────────────────────────────────────────
  if (vehicleAgentResult.constraintFlags?.hazmat) {
    score -= 20;
    advisoryItems.push({
      id: 'hazmat-legal', severity: 'critical',
      title: 'HAZMAT — legal route authorisation required',
      detail: 'ADR-regulated goods require specialist HAZMAT routing and pre-journey legal clearance. This platform cannot provide this clearance.',
      source: 'LegalComplianceAgent',
    });
  }

  // ── Heavy vehicle manual check ────────────────────────────────────────────
  if (ALWAYS_MANUAL_CHECK_TYPES.includes(type)) {
    advisoryItems.push({
      id: 'manual-legal', severity: 'warning',
      title: `Manual legal checks mandatory — ${type.toUpperCase()}`,
      detail: `All ${type.toUpperCase()} operators must conduct pre-journey restriction and legal checks. This advisory system supplements but does not replace those checks.`,
      source: 'LegalComplianceAgent',
    });
  }

  // ── Offline check ──────────────────────────────────────────────────────────
  if (!navigator.onLine) {
    score -= 5;
    advisoryItems.push({
      id: 'offline', severity: 'info',
      title: 'Device offline — using last-known route data',
      detail: 'Reconnect to verify route data is current.',
      source: 'LegalComplianceAgent',
    });
  }

  // ── Score floor ────────────────────────────────────────────────────────────
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // ── Advisory status ────────────────────────────────────────────────────────
  let advisoryStatus;
  if (finalScore >= 82)      advisoryStatus = 'appears_suitable';
  else if (finalScore >= 60) advisoryStatus = 'needs_review';
  else if (finalScore >= 35) advisoryStatus = 'high_risk';
  else                       advisoryStatus = 'missing_data';

  // Override for critical restriction conflicts on a real route
  if (rdConflicts > 0 && routeResult?.route && !routeResult?.demoMode) {
    advisoryStatus = 'high_risk';
  }

  const hasCritical = advisoryItems.some((a) => a.severity === 'critical');
  const summary = buildSummary(advisoryStatus, hasCritical, rdConflicts, noRdData, type);
  const driverMessage = buildDriverMessage(advisoryStatus, type, rdConflicts, noRdData);

  return {
    agentId:        AGENT_ID,
    status:         advisoryStatus,
    severity:       hasCritical ? 'critical' : advisoryItems.some((a) => a.severity === 'warning') ? 'warning' : 'clear',
    advisoryScore:  finalScore,
    advisoryItems,
    vcFindingsUsed: vcFindings.length,
    rdFindingsUsed: rdFindings.length,
    routeConflicts: rdConflicts,
    summary,
    driverMessage,
    disclaimer:     COMPLIANCE_DISCLAIMER,
    manualChecksRequired: ALWAYS_MANUAL_CHECK_TYPES.includes(type) || hasCritical,
    ranAt:          new Date().toISOString(),
  };
}

function buildSummary(status, hasCritical, rdConflicts, noData, type) {
  if (rdConflicts > 0) return `${rdConflicts} restriction conflict(s) detected on route — legal advisory: HIGH RISK.`;
  switch (status) {
    case 'appears_suitable': return `Advisory assessment: route appears broadly suitable for this ${type.toUpperCase()} profile based on available data.`;
    case 'needs_review':     return `Advisory assessment: ${type.toUpperCase()} — concerns require review before departure.`;
    case 'high_risk':        return `Advisory assessment: HIGH RISK — ${hasCritical ? 'critical issues' : 'significant concerns'} detected. Manual checks required.`;
    default:                 return `Advisory assessment incomplete — critical data missing for ${type.toUpperCase()}.`;
  }
}

function buildDriverMessage(status, type, rdConflicts, noData) {
  if (rdConflicts > 0) return `⚠ Route restriction conflicts detected. Do not proceed on this route without physically checking each flagged point. Route deviation may be required.`;
  if (noData) return `No restriction data loaded. Manual checks required for all bridges, weight limits, and width restrictions on this route.`;
  switch (status) {
    case 'appears_suitable': return `Legal advisory: route appears broadly suitable. Verify against current road signs before departure. Driver remains responsible.`;
    case 'needs_review':     return `Legal advisory: review flagged items before committing to this route. Road signs and local authority instructions take precedence.`;
    case 'high_risk':        return `Legal advisory: do not proceed without completing manual legal and restriction checks. High risk issues have been identified.`;
    default:                 return `Legal advisory cannot be completed — fill in all required vehicle fields and calculate a real route first.`;
  }
}

function _failResult(detail) {
  return {
    agentId:        AGENT_ID,
    status:         'agent_error',
    severity:       'critical',
    advisoryScore:  0,
    advisoryItems:  [{ id: 'error', severity: 'critical', title: 'Legal compliance agent error', detail, source: AGENT_ID }],
    summary:        detail,
    driverMessage:  detail,
    disclaimer:     COMPLIANCE_DISCLAIMER,
    manualChecksRequired: true,
    ranAt:          new Date().toISOString(),
  };
}

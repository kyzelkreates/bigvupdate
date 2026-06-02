/**
 * agentOrchestrator.js — 4P3X Intelligent AI — Agent Orchestrator
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Runs all specialist agents in dependency order and returns a unified
 * AgentSuite result. Feeds the Compliance AI with enriched agent output.
 *
 * Agent execution order:
 *   1. VehicleConstraintAgent  — vehicle dimensions / legal fields
 *   2. RestrictionDataAgent    — restriction CSV vs route geometry
 *   3. LegalComplianceAgent    — cross-reference of 1 + 2 + route
 *   4. SafetyRouteAgent        — safety-first route priority assessment
 *   5. NavigationReadinessAgent — pre-start readiness gate
 *   6. DriverAdvisoryAgent     — final plain-English message composer
 *
 * All agents are advisory only.
 * Output is stored in SSOT as state.agents.
 * ComplianceEngine uses agentSuite.legalAgent.advisoryScore if available.
 *
 * ADVISORY ONLY. Not legal advice. Not a legal compliance guarantee.
 */

import { runVehicleConstraintAgent } from './vehicleConstraintAgent.js';
import { runRestrictionDataAgent }   from './restrictionDataAgent.js';
import { runLegalComplianceAgent }   from './legalComplianceAgent.js';
import { runSafetyRouteAgent }       from './safetyRouteAgent.js';
import { runNavigationReadinessAgent } from './navigationReadinessAgent.js';
import { runDriverAdvisoryAgent }    from './driverAdvisoryAgent.js';
import { COMPLIANCE_DISCLAIMER }     from '../config/complianceRules.js';

export const ORCHESTRATOR_VERSION = '1.0.0';

/**
 * Run the full 4P3X specialist agent suite.
 *
 * @param {object} params
 * @param {object} params.vehicle      - vehicle profile from SSOT
 * @param {object} params.trip         - trip state from SSOT
 * @param {object} params.navigation   - navigation state from SSOT
 * @param {object} params.restrictions - restrictions state from SSOT
 * @param {object} params.compliance   - current compliance state from SSOT
 * @param {object} params.settings     - app settings from SSOT
 * @returns {AgentSuite}
 *
 * AgentSuite: {
 *   version, ranAt, overallLevel, headline,
 *   vehicleAgent, restrictionAgent, legalAgent,
 *   safetyAgent, readinessAgent, driverAdvisory,
 *   combinedScore, isReadyToNavigate, disclaimer
 * }
 */
export function runAgentSuite({
  vehicle,
  trip,
  navigation,
  restrictions,
  compliance,
  settings,
}) {
  const routeResult = trip?.lastRouteResult;
  const ranAt       = new Date().toISOString();

  // ── Step 1: Vehicle Constraint Agent ──────────────────────────────────────
  let vehicleAgent;
  try {
    vehicleAgent = runVehicleConstraintAgent({ vehicle, routeResult });
  } catch (e) {
    vehicleAgent = _agentError('vehicle_constraint_agent', e.message);
  }

  // ── Step 2: Restriction Data Agent ────────────────────────────────────────
  let restrictionAgent;
  try {
    restrictionAgent = runRestrictionDataAgent({ vehicle, restrictions, routeResult });
  } catch (e) {
    restrictionAgent = _agentError('restriction_data_agent', e.message);
  }

  // ── Step 3: Legal Compliance Agent ────────────────────────────────────────
  let legalAgent;
  try {
    legalAgent = runLegalComplianceAgent({
      vehicle,
      routeResult,
      vehicleAgentResult:     vehicleAgent,
      restrictionAgentResult: restrictionAgent,
    });
  } catch (e) {
    legalAgent = _agentError('legal_compliance_agent', e.message);
  }

  // ── Step 4: Safety Route Agent ────────────────────────────────────────────
  let safetyAgent;
  try {
    safetyAgent = runSafetyRouteAgent({
      vehicle,
      routeResult,
      vehicleAgentResult:     vehicleAgent,
      restrictionAgentResult: restrictionAgent,
      legalAgentResult:       legalAgent,
      settings,
    });
  } catch (e) {
    safetyAgent = _agentError('safety_route_agent', e.message);
  }

  // ── Step 5: Navigation Readiness Agent ───────────────────────────────────
  let readinessAgent;
  try {
    readinessAgent = runNavigationReadinessAgent({
      vehicle,
      trip,
      navigation,
      compliance,
      vehicleAgentResult: vehicleAgent,
      safetyAgentResult:  safetyAgent,
    });
  } catch (e) {
    readinessAgent = _agentError('navigation_readiness_agent', e.message);
  }

  // ── Step 6: Driver Advisory Agent ─────────────────────────────────────────
  let driverAdvisory;
  try {
    driverAdvisory = runDriverAdvisoryAgent({
      vehicle,
      routeResult,
      vehicleAgentResult:     vehicleAgent,
      restrictionAgentResult: restrictionAgent,
      legalAgentResult:       legalAgent,
      safetyAgentResult:      safetyAgent,
      readinessAgentResult:   readinessAgent,
      compliance,
    });
  } catch (e) {
    driverAdvisory = _agentError('driver_advisory_agent', e.message);
  }

  // ── Combined score ─────────────────────────────────────────────────────────
  // Weighted blend: legal advisory 50%, safety route 30%, readiness 20%
  const legalScore     = legalAgent?.advisoryScore     ?? 50;
  const safetyScore    = safetyAgent?.routeSafetyScore ?? 50;
  const readinessScore = readinessAgent?.readinessScore ?? 50;
  const combinedScore  = Math.round(legalScore * 0.5 + safetyScore * 0.3 + readinessScore * 0.2);

  // ── Overall level (from driver advisory) ─────────────────────────────────
  const overallLevel = driverAdvisory?.overallLevel || 'info';
  const headline     = driverAdvisory?.headline     || 'Complete vehicle profile and route for advisory.';

  // ── Navigation readiness gate ─────────────────────────────────────────────
  const isReadyToNavigate = readinessAgent?.isReady === true;

  return {
    version:          ORCHESTRATOR_VERSION,
    ranAt,
    overallLevel,
    headline,
    vehicleAgent,
    restrictionAgent,
    legalAgent,
    safetyAgent,
    readinessAgent,
    driverAdvisory,
    combinedScore,
    isReadyToNavigate,
    disclaimer:       COMPLIANCE_DISCLAIMER,
  };
}

/**
 * Merge agent suite output into existing complianceEngine result.
 * Used in App.jsx to enrich the compliance state with agent findings.
 *
 * @param {object} complianceResult - from runComplianceCheck()
 * @param {AgentSuite} agentSuite   - from runAgentSuite()
 * @returns {object} merged compliance state
 */
export function mergeAgentResultsIntoCompliance(complianceResult, agentSuite) {
  if (!agentSuite) return complianceResult;

  // Blend scores: 60% compliance engine, 40% agent combined score
  const baseScore    = complianceResult.score  ?? 0;
  const agentScore   = agentSuite.combinedScore ?? baseScore;
  const blendedScore = Math.round(baseScore * 0.6 + agentScore * 0.4);

  // Agent warnings to inject (deduplicate by id)
  const agentWarnings = _collectAgentWarnings(agentSuite);
  const existingIds   = new Set((complianceResult.warnings || []).map((w) => w.id));
  const newWarnings   = agentWarnings.filter((w) => !existingIds.has(w.id));

  // Override driver message with agent advisory if available
  const driverMessage = agentSuite.driverAdvisory?.headline || complianceResult.driverMessage;

  // Override advisory status if agent found conflicts on a real route
  const rdConflicts  = agentSuite.restrictionAgent?.dataQuality?.totalConflicts || 0;
  const hasRealRoute = !!agentSuite.restrictionAgent?.dataQuality?.routeProximityChecked;
  let advisoryStatus = complianceResult.advisoryStatus || complianceResult.status;
  if (rdConflicts > 0 && hasRealRoute) {
    advisoryStatus = 'high_risk';
  }

  return {
    ...complianceResult,
    score:           blendedScore,
    confidenceScore: blendedScore,
    status:          advisoryStatus,
    advisoryStatus,
    warnings:        [...(complianceResult.warnings || []), ...newWarnings],
    driverMessage,
    agentSuite,
    agentSuiteRanAt: agentSuite.ranAt,
    reportSummary:   `${complianceResult.reportSummary || ''} | 4P3X Agents: ${agentSuite.overallLevel.toUpperCase()} (${blendedScore}%)`.trim(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _collectAgentWarnings(agentSuite) {
  const warnings = [];
  const agents = [
    agentSuite.vehicleAgent,
    agentSuite.restrictionAgent,
    agentSuite.legalAgent,
    agentSuite.safetyAgent,
  ];
  for (const agent of agents) {
    if (!agent) continue;
    for (const f of agent.findings || agent.advisoryItems || []) {
      warnings.push({
        id:     `agent-${agent.agentId}-${f.id}`,
        level:  f.severity === 'critical' ? 'danger' : f.severity,
        title:  f.title,
        detail: f.detail,
        source: agent.agentId,
      });
    }
  }
  return warnings;
}

function _agentError(agentId, message) {
  return {
    agentId,
    status:   'agent_error',
    severity: 'warning',
    findings: [{ id: 'error', severity: 'warning', title: `${agentId} error`, detail: message }],
    advisoryItems: [],
    missingFields: [],
    constraintFlags: {},
    dataQuality: {},
    summary:  `Agent ${agentId} encountered an error: ${message}`,
    driverMessage: `Agent error — falling back to base compliance check.`,
    ranAt:    new Date().toISOString(),
  };
}

/**
 * vehicleConstraintAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Analyses vehicle physical dimensions and legal constraints.
 * Identifies dimension conflicts, missing legal-critical fields,
 * UK HGV limit breaches, and special vehicle classification issues.
 *
 * ADVISORY ONLY — never guarantees legal compliance.
 * All outputs feed AgentOrchestrator → ComplianceEngine.
 */

import { UK_HGV_LIMITS, LEGAL_CRITICAL_FIELDS_BY_TYPE } from '../config/complianceRules.js';
import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';

export const AGENT_ID = 'vehicle_constraint_agent';

/**
 * Run vehicle constraint analysis.
 *
 * @param {object} params
 * @param {object} params.vehicle   - vehicle profile from SSOT
 * @param {object} params.routeResult - normalised route result
 * @returns {AgentResult}
 *
 * AgentResult: {
 *   agentId, status, severity, findings[], missingFields[],
 *   constraintFlags{}, summary, driverMessage, ranAt
 * }
 */
export function runVehicleConstraintAgent({ vehicle, routeResult }) {
  const findings = [];
  const missingFields = [];
  const constraintFlags = {
    hazmat:              false,
    heightRisk:          false,
    widthRisk:           false,
    weightRisk:          false,
    axleRisk:            false,
    lengthRisk:          false,
    towingRisk:          false,
    emissionsUnknown:    false,
    motorwayRestricted:  false,
    busLaneRestricted:   false,
    needsManualCheck:    false,
    dimensionsComplete:  false,
  };

  if (!vehicle) {
    return _failResult('No vehicle profile provided. Select a vehicle type before running checks.');
  }

  const type = vehicle.type || 'car';
  const template = vehicleTemplates[type];
  if (!template) {
    return _failResult(`Unknown vehicle type: "${type}". Select a supported type.`);
  }

  const fields = vehicle.fields || {};
  const legalCritical = LEGAL_CRITICAL_FIELDS_BY_TYPE[type] || [];

  // ── Missing legal-critical fields ─────────────────────────────────────────
  let missingCount = 0;
  for (const key of legalCritical) {
    const def = fieldDefinitions[key];
    const val = fields[key];
    const empty = val === undefined || val === null || val === '';
    if (empty) {
      missingFields.push({ key, label: def?.label || key, helper: def?.helper || '' });
      findings.push({
        id:       `missing-${key}`,
        severity: 'critical',
        title:    `Missing legal field: ${def?.label || key}`,
        detail:   def?.helper || `This field is required for ${template.label} compliance checks.`,
      });
      missingCount++;
    }
  }

  // ── Dimension checks ──────────────────────────────────────────────────────
  const heightM      = parseFloat(fields.heightM);
  const widthM       = parseFloat(fields.widthM);
  const lengthM      = parseFloat(fields.lengthM);
  const grossWeightT = parseFloat(fields.grossWeightT);
  const axleWeightT  = parseFloat(fields.axleWeightT);

  if (!isNaN(heightM) && heightM > UK_HGV_LIMITS.maxBridgeHeightM) {
    constraintFlags.heightRisk = true;
    findings.push({
      id: 'height-risk', severity: 'warning',
      title: `Height ${heightM}m — may trigger bridge restrictions`,
      detail: `Exceeds ${UK_HGV_LIMITS.maxBridgeHeightM}m bridge clearance warning threshold. Manual bridge checks required on this route.`,
    });
  }

  if (!isNaN(widthM) && widthM > UK_HGV_LIMITS.maxWidthM) {
    constraintFlags.widthRisk = true;
    findings.push({
      id: 'width-risk', severity: 'warning',
      title: `Width ${widthM}m — exceeds UK standard limit`,
      detail: `UK standard vehicle width limit is ${UK_HGV_LIMITS.maxWidthM}m. Wide-load permissions may be required.`,
    });
  }

  if (!isNaN(grossWeightT) && grossWeightT > UK_HGV_LIMITS.maxGrossWeightT) {
    constraintFlags.weightRisk = true;
    findings.push({
      id: 'weight-risk', severity: 'warning',
      title: `Gross weight ${grossWeightT}t — exceeds UK standard HGV limit`,
      detail: `Standard UK HGV limit is ${UK_HGV_LIMITS.maxGrossWeightT}t. Special authorisation may be required.`,
    });
  }

  if (!isNaN(axleWeightT) && axleWeightT > UK_HGV_LIMITS.maxSingleAxleT) {
    constraintFlags.axleRisk = true;
    findings.push({
      id: 'axle-risk', severity: 'warning',
      title: `Axle weight ${axleWeightT}t — exceeds standard limit`,
      detail: `UK single-drive axle limit is typically ${UK_HGV_LIMITS.maxSingleAxleT}t. Verify against route bridge limits.`,
    });
  }

  if (!isNaN(lengthM) && lengthM > UK_HGV_LIMITS.maxLengthM) {
    constraintFlags.lengthRisk = true;
    findings.push({
      id: 'length-risk', severity: 'warning',
      title: `Vehicle length ${lengthM}m — exceeds UK articulated max`,
      detail: `UK max articulated vehicle length is ${UK_HGV_LIMITS.maxLengthM}m. Oversized vehicle restrictions may apply.`,
    });
  }

  // ── HAZMAT ────────────────────────────────────────────────────────────────
  if (fields.hazardousGoods) {
    constraintFlags.hazmat = true;
    findings.push({
      id: 'hazmat', severity: 'critical',
      title: 'Hazardous goods (ADR) — mandatory manual checks required',
      detail: 'HAZMAT routes require pre-journey legal authorisation. This platform cannot substitute for ADR compliance routing. Contact a specialist operator.',
    });
  }

  // ── Towing ────────────────────────────────────────────────────────────────
  if (type === 'trailer' || fields.trailerHeightM || fields.trailerLengthM) {
    constraintFlags.towingRisk = true;
    if (!fields.towingVehicleType || !fields.combinedWeightT) {
      findings.push({
        id: 'towing-incomplete', severity: 'warning',
        title: 'Towing configuration incomplete',
        detail: 'Combined weight and towing vehicle type are required for trailer compliance assessment.',
      });
    }
  }

  // ── Emissions ─────────────────────────────────────────────────────────────
  if (!fields.emissionsClass && template.fields.includes('emissionsClass')) {
    constraintFlags.emissionsUnknown = true;
    findings.push({
      id: 'emissions-unknown', severity: 'info',
      title: 'Emissions class not set',
      detail: 'Some routes pass through Clean Air Zones (ULEZ, CAZ). Set emissions class for LEZ guidance.',
    });
  }

  // ── Motorway restriction ──────────────────────────────────────────────────
  if (fields.avoidMotorways) {
    constraintFlags.motorwayRestricted = true;
    findings.push({
      id: 'motorway-restricted', severity: 'info',
      title: 'Motorway avoidance active',
      detail: 'Route will prefer non-motorway roads. Some vehicle types are legally prohibited on motorways.',
    });
  }

  // ── Bus lane permission ───────────────────────────────────────────────────
  if (type === 'bus' && fields.busLanePermission === false) {
    constraintFlags.busLaneRestricted = true;
    findings.push({
      id: 'bus-lane-restricted', severity: 'info',
      title: 'Bus lane permission not confirmed',
      detail: 'Bus lane eligibility varies by route and local authority. Verify locally.',
    });
  }

  // ── Always-manual check types ─────────────────────────────────────────────
  if (['hgv', 'bus', 'custom'].includes(type)) {
    constraintFlags.needsManualCheck = true;
    findings.push({
      id: 'manual-required', severity: 'warning',
      title: `Manual pre-journey checks required — ${template.label}`,
      detail: 'This vehicle type requires manual legal and restriction checks beyond automated advisory guidance.',
    });
  }

  // ── Dimensions completeness flag ─────────────────────────────────────────
  constraintFlags.dimensionsComplete = missingCount === 0;

  // ── Severity rollup ───────────────────────────────────────────────────────
  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasWarning  = findings.some((f) => f.severity === 'warning');
  const severity    = hasCritical ? 'critical' : hasWarning ? 'warning' : 'clear';

  const status = hasCritical ? 'critical_issues' : hasWarning ? 'warnings_found' : 'clear';

  const summary = severity === 'clear'
    ? `${template.label} — no dimension or constraint issues found with available data.`
    : `${template.label} — ${findings.filter((f) => f.severity === 'critical').length} critical + ${findings.filter((f) => f.severity === 'warning').length} warning finding(s).`;

  const driverMessage = hasCritical
    ? `Vehicle constraint issues require attention before this route can be assessed. Complete missing legal fields and address critical findings.`
    : hasWarning
    ? `Vehicle constraints flagged — review warnings and verify physical dimensions against route restrictions manually.`
    : `Vehicle profile appears complete for ${template.label} advisory checks.`;

  return {
    agentId:         AGENT_ID,
    status,
    severity,
    findings,
    missingFields,
    constraintFlags,
    summary,
    driverMessage,
    vehicleType:     type,
    vehicleLabel:    template.label,
    ranAt:           new Date().toISOString(),
  };
}

function _failResult(detail) {
  return {
    agentId:         AGENT_ID,
    status:          'agent_error',
    severity:        'critical',
    findings:        [{ id: 'agent-error', severity: 'critical', title: 'Vehicle constraint check failed', detail }],
    missingFields:   [],
    constraintFlags: {},
    summary:         detail,
    driverMessage:   detail,
    vehicleType:     null,
    vehicleLabel:    null,
    ranAt:           new Date().toISOString(),
  };
}

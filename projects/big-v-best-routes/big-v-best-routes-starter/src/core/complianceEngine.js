/**
 * complianceEngine.js — Advisory Compliance AI
 * Big V's Best Routes
 *
 * Rules-led, deterministic, advisory-only.
 * Uses rules config from src/config/complianceRules.js.
 *
 * MUST NEVER claim legal route certainty.
 * MUST NOT produce forbidden phrases (see complianceRules.js).
 * Output is advisory guidance only. Driver remains responsible.
 */

import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';
import {
  UK_HGV_LIMITS,
  LEGAL_CRITICAL_FIELDS_BY_TYPE,
  SCORE_DEDUCTIONS,
  ADVISORY_THRESHOLDS,
  ALWAYS_MANUAL_CHECK_TYPES,
  COMPLIANCE_DISCLAIMER,
} from '../config/complianceRules.js';

export const ADVISORY_STATUS = {
  SUITABLE:     'suitable_based_on_available_data',
  NEEDS_REVIEW: 'needs_review',
  HIGH_RISK:    'high_risk',
  MISSING_DATA: 'missing_data',
  BLOCKED:      'route_unavailable',
  PROVIDER_ERR: 'provider_error',
};

// ─── Main engine ─────────────────────────────────────────────────────────────

export function runComplianceCheck({ vehicle, trip, restrictions, routeResult }) {
  const warnings     = [];
  const evidence     = [];
  const missingData  = [];
  let score = 100;

  // ── Guard: no vehicle ────────────────────────────────────────────────────
  if (!vehicle) {
    return failResult('No vehicle selected', 'Select a vehicle type and fill in the required fields before running compliance.');
  }

  const template = vehicleTemplates[vehicle?.type];
  if (!template) {
    return failResult(
      'Unknown vehicle type',
      `Vehicle type "${vehicle?.type}" has no legal field template. Select a supported vehicle type.`,
    );
  }

  // ── Provider error state ─────────────────────────────────────────────────
  if (routeResult?.setupRequired) {
    warnings.push({
      id: 'provider-setup', level: 'danger',
      title: 'Routing provider not configured',
      detail: 'GraphHopper API key is required. Configure it in Settings before assessing compliance.',
    });
    score -= SCORE_DEDUCTIONS.providerError;
  }

  // ── Required legal-critical field checks ─────────────────────────────────
  const legalCriticalFields = LEGAL_CRITICAL_FIELDS_BY_TYPE[vehicle.type] || [];
  for (const fieldKey of legalCriticalFields) {
    const field = fieldDefinitions[fieldKey];
    if (!field) continue;
    const value = vehicle.fields?.[fieldKey];
    const isEmpty = value === undefined || value === null || value === '';
    if (isEmpty) {
      warnings.push({
        id: `missing-${fieldKey}`,
        level: 'danger',
        title: `Missing legal field: ${field.label}`,
        detail: field.helper,
      });
      missingData.push(field.label);
      score -= SCORE_DEDUCTIONS.missingLegalCriticalField;
    }
  }

  // ── All template fields — recommended field checks ────────────────────────
  for (const fieldKey of template.fields) {
    if (legalCriticalFields.includes(fieldKey)) continue; // already checked above
    const field = fieldDefinitions[fieldKey];
    const value = vehicle.fields?.[fieldKey];
    const isEmpty = value === undefined || value === null || value === '';
    if (field?.required && isEmpty) {
      warnings.push({
        id: `missing-rec-${fieldKey}`,
        level: 'warning',
        title: `Missing: ${field.label}`,
        detail: field.helper,
      });
      missingData.push(field.label);
      score -= SCORE_DEDUCTIONS.missingRecommendedField;
    }
  }

  // ── Dimension / weight limit checks ─────────────────────────────────────
  const fields = vehicle.fields || {};

  if (fields.heightM && Number(fields.heightM) > UK_HGV_LIMITS.maxBridgeHeightM) {
    warnings.push({ id: 'height-risk', level: 'warning', title: 'Height may trigger bridge restrictions', detail: `${fields.heightM}m exceeds common UK bridge clearance warning threshold (${UK_HGV_LIMITS.maxBridgeHeightM}m). Manual checks required.` });
    score -= SCORE_DEDUCTIONS.extremeHeight;
  }
  if (fields.grossWeightT && Number(fields.grossWeightT) > UK_HGV_LIMITS.maxGrossWeightT) {
    warnings.push({ id: 'weight-risk', level: 'warning', title: 'Gross weight exceeds UK HGV standard limit', detail: `${fields.grossWeightT}t — standard UK HGV limit is ${UK_HGV_LIMITS.maxGrossWeightT}t. Manual legal checks required.` });
    score -= SCORE_DEDUCTIONS.extremeWeight;
  }
  if (fields.axleWeightT && Number(fields.axleWeightT) > UK_HGV_LIMITS.maxSingleAxleT) {
    warnings.push({ id: 'axle-risk', level: 'warning', title: 'Axle weight may exceed UK standard limit', detail: `${fields.axleWeightT}t — UK single axle limit is typically ${UK_HGV_LIMITS.maxSingleAxleT}t.` });
    score -= SCORE_DEDUCTIONS.extremeAxleWeight;
  }
  if (fields.widthM && Number(fields.widthM) > UK_HGV_LIMITS.maxWidthM) {
    warnings.push({ id: 'width-risk', level: 'warning', title: 'Vehicle width exceeds UK standard limit', detail: `${fields.widthM}m — standard UK limit is ${UK_HGV_LIMITS.maxWidthM}m.` });
    score -= 6;
  }

  // ── HAZMAT ───────────────────────────────────────────────────────────────
  if (fields.hazardousGoods) {
    warnings.push({
      id: 'hazmat', level: 'danger',
      title: 'Hazardous goods (ADR) flagged',
      detail: 'HAZMAT routes require mandatory pre-journey legal checks. This platform does not substitute for ADR compliance or HAZMAT routing authorisation.',
    });
    score -= SCORE_DEDUCTIONS.hazardousGoods;
  }

  // ── Emissions / LEZ advisory ─────────────────────────────────────────────
  if (!fields.emissionsClass && template.fields.includes('emissionsClass')) {
    warnings.push({
      id: 'no-emissions', level: 'info',
      title: 'Emissions class not set',
      detail: 'Some routes pass through Clean Air Zones (ULEZ, CAZ). Set emissions class for LEZ guidance.',
    });
    missingData.push('Emissions class');
    score -= SCORE_DEDUCTIONS.emissionsClassMissing;
  }

  // ── Trip inputs ──────────────────────────────────────────────────────────
  if (!trip?.origin?.trim() || !trip?.destination?.trim()) {
    warnings.push({ id: 'no-trip', level: 'warning', title: 'Origin or destination missing', detail: 'Enter both before calculating a route.' });
    score -= SCORE_DEDUCTIONS.missingTripInputs;
  }

  // ── Route result checks ──────────────────────────────────────────────────
  if (!routeResult?.route) {
    warnings.push({ id: 'no-route', level: 'warning', title: 'No route calculated yet', detail: 'Calculate a route before relying on this compliance check.' });
    score -= SCORE_DEDUCTIONS.noRouteResult;
    missingData.push('Route calculation result');
  } else {
    evidence.push({ label: 'Route distance',  value: `${(routeResult.route.distanceM / 1000).toFixed(1)} km` });
    evidence.push({ label: 'Route duration',  value: `${Math.round(routeResult.route.durationMs / 60000)} min` });
    evidence.push({ label: 'Routing profile', value: routeResult.route.profile || 'Unknown' });
    evidence.push({ label: 'Route provider',  value: routeResult.provider || 'Unknown' });

    if (routeResult.demoMode || routeResult.devFallback) {
      warnings.push({
        id: 'dev-route', level: 'warning',
        title: 'Dev fallback route in use',
        detail: 'This is a straight-line estimate only. Configure GraphHopper for real route compliance checks.',
      });
      score -= SCORE_DEDUCTIONS.demoOrFallbackRoute;
    }
  }

  // ── Restriction dataset checks ───────────────────────────────────────────
  const roadCount   = restrictions?.roadRestrictions?.length   || 0;
  const bridgeCount = restrictions?.bridgeRestrictions?.length || 0;
  evidence.push({ label: 'Vehicle type',            value: template.label });
  evidence.push({ label: 'Road restrictions loaded', value: String(roadCount) });
  evidence.push({ label: 'Bridge restrictions loaded', value: String(bridgeCount) });

  if (roadCount + bridgeCount === 0) {
    warnings.push({
      id: 'no-restriction-data', level: 'warning',
      title: 'No local restriction dataset imported',
      detail: 'Import bridge/road restriction CSV files in Settings for enhanced physical restriction checks. Compliance confidence is reduced without this data.',
    });
    missingData.push('Local restriction dataset');
    score -= SCORE_DEDUCTIONS.noRestrictionData;
  }

  // ── Offline check ────────────────────────────────────────────────────────
  if (!navigator.onLine) {
    warnings.push({ id: 'offline', level: 'info', title: 'Device is currently offline', detail: 'Route data uses last-known results. Verify conditions on reconnect.' });
    score -= SCORE_DEDUCTIONS.offlineMode;
  }

  // ── Always-manual-check vehicle types ────────────────────────────────────
  const requiresManualCheck = ALWAYS_MANUAL_CHECK_TYPES.includes(vehicle.type);
  if (requiresManualCheck) {
    warnings.push({
      id: 'manual-check-required', level: 'warning',
      title: `Manual legal checks required for ${template.label}`,
      detail: 'This vehicle type requires manual pre-journey restriction and legal checks beyond what this system can provide.',
    });
  }

  // ── Missing data threshold ────────────────────────────────────────────────
  if (missingData.length >= 3) score = Math.min(score, SCORE_DEDUCTIONS.missingDataThreshold);

  // ── Score → advisory status ───────────────────────────────────────────────
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  let advisoryStatus;
  if (finalScore >= ADVISORY_THRESHOLDS.suitable)     advisoryStatus = ADVISORY_STATUS.SUITABLE;
  else if (finalScore >= ADVISORY_THRESHOLDS.needsReview) advisoryStatus = ADVISORY_STATUS.NEEDS_REVIEW;
  else if (finalScore >= ADVISORY_THRESHOLDS.highRisk) advisoryStatus = ADVISORY_STATUS.HIGH_RISK;
  else advisoryStatus = ADVISORY_STATUS.MISSING_DATA;

  // Override to provider_error if setup required
  if (routeResult?.setupRequired) advisoryStatus = ADVISORY_STATUS.PROVIDER_ERR;

  // ── Mandatory disclaimer always appended ─────────────────────────────────
  warnings.push({
    id:    'advisory-disclaimer',
    level: 'info',
    title: 'Advisory guidance only',
    detail: 'Road signs, local restrictions, police instructions, and driver judgement override app guidance.',
  });

  const explanation = buildExplanation(advisoryStatus, missingData, warnings);
  const driverMessage = buildDriverMessage(advisoryStatus, vehicle.type, requiresManualCheck);

  return {
    status:       advisoryStatus,  // legacy field alias kept for compatibility
    advisoryStatus,
    score:        finalScore,
    confidenceScore: finalScore,
    warnings,
    evidence,
    missingData,
    missingCriticalFields: missingData.filter((_, i) =>
      legalCriticalFields.some((k) => fieldDefinitions[k]?.label === missingData[i]),
    ),
    manualChecksRequired: requiresManualCheck,
    explanation,
    driverMessage,
    dataFreshness: roadCount + bridgeCount > 0 ? 'local-imported-data' : 'no-restriction-data',
    dataFreshnessSummary: roadCount + bridgeCount > 0
      ? `${roadCount} road + ${bridgeCount} bridge restrictions loaded`
      : 'No restriction dataset loaded',
    reportSummary: `${template.label} · Score: ${finalScore}% · ${advisoryStatus.replaceAll('_', ' ')}`,
    disclaimer:   COMPLIANCE_DISCLAIMER,
    lastCheckedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function failResult(title, detail) {
  return {
    status:       ADVISORY_STATUS.BLOCKED,
    advisoryStatus: ADVISORY_STATUS.BLOCKED,
    score:        0,
    confidenceScore: 0,
    warnings:     [{ id: 'blocked', level: 'danger', title, detail }],
    evidence:     [],
    missingData:  [title],
    missingCriticalFields: [],
    manualChecksRequired: false,
    explanation:  detail,
    driverMessage: detail,
    dataFreshness: 'unknown',
    dataFreshnessSummary: 'Unknown',
    reportSummary: `Blocked: ${title}`,
    disclaimer:   COMPLIANCE_DISCLAIMER,
    lastCheckedAt: new Date().toISOString(),
  };
}

function buildExplanation(status, missingData, warnings) {
  const dangerCount = warnings.filter((w) => w.level === 'danger').length;
  const warnCount   = warnings.filter((w) => w.level === 'warning').length;
  switch (status) {
    case ADVISORY_STATUS.SUITABLE:
      return 'Based on the available data, this vehicle profile and route appear broadly suitable for the selected vehicle type. Verify against current road signs and any local authority restrictions before departure.';
    case ADVISORY_STATUS.NEEDS_REVIEW:
      return `${warnCount} advisory concern${warnCount !== 1 ? 's' : ''} found. Review all warnings below before committing to this route. Real-world restrictions may differ from data available in this system.`;
    case ADVISORY_STATUS.HIGH_RISK:
      return `${dangerCount > 0 ? `${dangerCount} high-risk flag${dangerCount !== 1 ? 's' : ''} and ` : ''}${warnCount} advisory warning${warnCount !== 1 ? 's' : ''} detected. Manual legal checks are strongly advised before this route is used operationally.`;
    case ADVISORY_STATUS.MISSING_DATA:
      return `Critical data is missing: ${missingData.slice(0, 3).join(', ')}${missingData.length > 3 ? ` and ${missingData.length - 3} more` : ''}. Advisory compliance cannot be assessed without this information.`;
    case ADVISORY_STATUS.PROVIDER_ERR:
      return 'Routing provider is not configured. A real route is required for meaningful compliance assessment.';
    default:
      return 'Unable to assess advisory compliance. Check vehicle configuration and route, then try again.';
  }
}

function buildDriverMessage(status, vehicleType, requiresManualCheck) {
  const typeLabel = vehicleType?.toUpperCase() || 'VEHICLE';
  const base = `[${typeLabel}] `;
  switch (status) {
    case ADVISORY_STATUS.SUITABLE:
      return base + (requiresManualCheck
        ? 'Route appears broadly suitable. Manual pre-journey checks are still required for this vehicle type.'
        : 'Route appears broadly suitable based on available data. Verify against road signs before departure.');
    case ADVISORY_STATUS.NEEDS_REVIEW:
      return base + 'Warnings detected. Review compliance results and check road signs before proceeding.';
    case ADVISORY_STATUS.HIGH_RISK:
      return base + 'High risk flags detected. Do not proceed without completing manual legal checks.';
    case ADVISORY_STATUS.MISSING_DATA:
      return base + 'Cannot assess route suitability — required vehicle data or route result is missing.';
    case ADVISORY_STATUS.PROVIDER_ERR:
      return base + 'Configure GraphHopper routing to enable full compliance assessment.';
    default:
      return base + 'Compliance check incomplete. Review configuration and try again.';
  }
}

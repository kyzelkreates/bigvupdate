/**
 * complianceEngine.js — Advisory Compliance AI
 * Big V's Best Routes
 *
 * Rules-led, deterministic, advisory-only.
 * Must NEVER claim legal route certainty.
 * Output includes confidence score, plain-English explanation, warnings, missing data list.
 */

import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';

const DISCLAIMER =
  "Big V's Best Routes provides advisory route guidance only. It does not guarantee legal route suitability. " +
  "Road signs, local restrictions, police instructions, and driver judgement override app guidance. " +
  "The driver remains responsible for route legality and vehicle safety.";

// ─── Advisory status labels ──────────────────────────────────────────────────
export const COMPLIANCE_STATUS = {
  SUITABLE: 'appears_suitable',
  NEEDS_REVIEW: 'needs_review',
  HIGH_RISK: 'high_risk',
  MISSING_DATA: 'missing_data',
  BLOCKED: 'blocked',
};

// ─── Main engine ─────────────────────────────────────────────────────────────

export function runComplianceCheck({ vehicle, trip, restrictions, routeResult }) {
  const warnings = [];
  const evidence = [];
  const missingData = [];
  let score = 100;

  // ── Guard: no vehicle ──
  if (!vehicle) return fail('No active vehicle selected', 'Choose a vehicle profile before planning a route.');

  const template = vehicleTemplates[vehicle?.type];
  if (!template) return fail('Unknown vehicle type', `Vehicle type "${vehicle?.type}" has no legal field template.`);

  // ── Required field checks ──
  for (const fieldKey of template.fields) {
    const field = fieldDefinitions[fieldKey];
    const value = vehicle.fields?.[fieldKey];
    const isEmpty = value === undefined || value === null || value === '';

    if (field?.required && isEmpty) {
      warnings.push({
        id: `missing-${fieldKey}`,
        level: field.legalCritical ? 'danger' : 'warning',
        title: `Missing: ${field.label}`,
        detail: field.helper,
      });
      missingData.push(field.label);
      score -= field.legalCritical ? 14 : 7;
    }

    // Unrealistic dimension checks for HGV-type vehicles
    if (field?.type === 'number' && !isEmpty) {
      const num = Number(value);
      if (fieldKey === 'heightM' && num > 5.5) {
        warnings.push({ id: 'extreme-height', level: 'warning', title: 'Unusually high vehicle height', detail: `${num}m — verify this is correct. Max common bridge clearance is ~5m.` });
        score -= 8;
      }
      if (fieldKey === 'grossWeightT' && num > 44) {
        warnings.push({ id: 'extreme-weight', level: 'warning', title: 'Vehicle weight exceeds common UK HGV limit', detail: `${num}t — standard UK HGV limit is 44t. Manual checks required.` });
        score -= 10;
      }
      if (fieldKey === 'axleWeightT' && num > 11.5) {
        warnings.push({ id: 'extreme-axle', level: 'warning', title: 'Axle weight may exceed UK limit', detail: `${num}t — UK single axle limit is typically 10–11.5t.` });
        score -= 8;
      }
    }
  }

  // ── Trip checks ──
  if (!trip?.origin || !trip?.destination) {
    warnings.push({ id: 'trip-missing', level: 'warning', title: 'Trip origin or destination missing', detail: 'Add both before route calculation.' });
    score -= 10;
  }

  // ── Route result checks ──
  if (!routeResult) {
    warnings.push({ id: 'no-route', level: 'warning', title: 'No route calculated yet', detail: 'Calculate a route before relying on this compliance check.' });
    score -= 12;
    missingData.push('Route calculation result');
  } else {
    evidence.push({ label: 'Route distance', value: routeResult.distanceM ? `${(routeResult.distanceM / 1000).toFixed(1)} km` : 'Unknown' });
    evidence.push({ label: 'Route duration', value: routeResult.durationMs ? `${Math.round(routeResult.durationMs / 60000)} min` : 'Unknown' });
    evidence.push({ label: 'Routing profile', value: routeResult.profile || 'Unknown' });

    if (routeResult.demoMode) {
      warnings.push({ id: 'demo-route', level: 'warning', title: 'Demo/fallback route active', detail: 'This is a straight-line estimate. Add a GraphHopper API key for real route analysis.' });
      score -= 15;
    }
  }

  // ── Restriction data checks ──
  const roadCount = restrictions?.roadRestrictions?.length || 0;
  const bridgeCount = restrictions?.bridgeRestrictions?.length || 0;
  evidence.push({ label: 'Vehicle template', value: template.label });
  evidence.push({ label: 'Road restrictions loaded', value: String(roadCount) });
  evidence.push({ label: 'Bridge restrictions loaded', value: String(bridgeCount) });

  if (roadCount + bridgeCount === 0) {
    warnings.push({
      id: 'no-restriction-data',
      level: 'warning',
      title: 'No local restriction data loaded',
      detail: 'Import bridge/road restriction CSVs for enhanced suitability checks.',
    });
    missingData.push('Local restriction database');
    score -= 18;
  }

  // ── Hazardous goods flag ──
  if (vehicle.fields?.hazardousGoods) {
    warnings.push({
      id: 'hazmat',
      level: 'danger',
      title: 'Hazardous goods flagged',
      detail: 'HAZMAT routes require mandatory pre-journey legal checks. This platform does not substitute for HAZMAT routing compliance.',
    });
    score -= 20;
  }

  // ── Emissions / LEZ advisory ──
  if (!vehicle.fields?.emissionsClass && template.fields.includes('emissionsClass')) {
    warnings.push({
      id: 'no-emissions',
      level: 'info',
      title: 'Emissions class not set',
      detail: 'Some routes pass through Clean Air Zones. Set emissions class for LEZ guidance.',
    });
    missingData.push('Emissions class');
  }

  // ── Missing data advisory status override ──
  if (missingData.length >= 3) score = Math.min(score, 45);

  // ── Score → status ──
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  let status;
  if (finalScore >= 82) status = COMPLIANCE_STATUS.SUITABLE;
  else if (finalScore >= 60) status = COMPLIANCE_STATUS.NEEDS_REVIEW;
  else if (finalScore >= 35) status = COMPLIANCE_STATUS.HIGH_RISK;
  else status = COMPLIANCE_STATUS.MISSING_DATA;

  // Always add advisory disclaimer as last item
  warnings.push({
    id: 'legal-disclaimer',
    level: 'info',
    title: 'Advisory guidance only',
    detail: 'Road signs, local restrictions, police instructions, and driver judgement override app guidance.',
  });

  const explanation = buildExplanation(status, missingData, warnings);

  return {
    status,
    score: finalScore,
    warnings,
    evidence,
    missingData,
    explanation,
    dataFreshness: roadCount + bridgeCount > 0 ? 'local-imported-data' : 'sample-data',
    disclaimer: DISCLAIMER,
    lastCheckedAt: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fail(title, detail) {
  return {
    status: COMPLIANCE_STATUS.BLOCKED,
    score: 0,
    warnings: [{ id: 'blocked', level: 'danger', title, detail }],
    evidence: [],
    missingData: [title],
    explanation: detail,
    dataFreshness: 'unknown',
    disclaimer: DISCLAIMER,
    lastCheckedAt: new Date().toISOString(),
  };
}

function buildExplanation(status, missingData, warnings) {
  const dangerCount = warnings.filter((w) => w.level === 'danger').length;
  const warnCount = warnings.filter((w) => w.level === 'warning').length;

  if (status === COMPLIANCE_STATUS.SUITABLE) {
    return 'Based on the available data, this vehicle profile and route appear broadly suitable. Verify against current road signs and any local restrictions before departure.';
  }
  if (status === COMPLIANCE_STATUS.NEEDS_REVIEW) {
    return `${warnCount} advisory concern${warnCount !== 1 ? 's' : ''} found. Review warnings before committing to this route. Real-world restriction data may differ from what is available in this system.`;
  }
  if (status === COMPLIANCE_STATUS.HIGH_RISK) {
    return `${dangerCount > 0 ? `${dangerCount} high-risk flag${dangerCount !== 1 ? 's' : ''} and ` : ''}${warnCount} warning${warnCount !== 1 ? 's' : ''} detected. Manual legal checks are strongly advised before this route is used.`;
  }
  if (status === COMPLIANCE_STATUS.MISSING_DATA) {
    return `Critical data is missing: ${missingData.slice(0, 3).join(', ')}${missingData.length > 3 ? ` and ${missingData.length - 3} more` : ''}. Compliance cannot be assessed without this information.`;
  }
  return 'Unable to assess compliance. Check vehicle configuration and try again.';
}

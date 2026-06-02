/**
 * restrictionDataAgent.js — 4P3X Specialist AI Agent
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Analyses imported local restriction dataset against the vehicle profile
 * and route geometry. Identifies specific bridge height, weight, and width
 * conflicts that may affect the calculated route.
 *
 * ADVISORY ONLY. Restriction data may be incomplete or outdated.
 * Always verify against physical road signs.
 */

import { haversineDistance } from '../utils/geo.js';

export const AGENT_ID = 'restriction_data_agent';

// How close a restriction must be to the route polyline to count as "on route" (metres)
const ROUTE_PROXIMITY_M = 300;

/**
 * Run restriction data analysis.
 *
 * @param {object} params
 * @param {object} params.vehicle      - vehicle profile from SSOT
 * @param {object} params.restrictions - { roadRestrictions[], bridgeRestrictions[] }
 * @param {object} params.routeResult  - normalised route result from graphhopperClient
 * @returns {AgentResult}
 */
export function runRestrictionDataAgent({ vehicle, restrictions, routeResult }) {
  const findings = [];
  const matchedRestrictions = [];

  const roadData   = restrictions?.roadRestrictions   || [];
  const bridgeData = restrictions?.bridgeRestrictions || [];
  const polyline   = routeResult?.route?.polyline     || [];

  const fields = vehicle?.fields || {};
  const heightM      = parseFloat(fields.heightM)      || null;
  const widthM       = parseFloat(fields.widthM)       || null;
  const grossWeightT = parseFloat(fields.grossWeightT) || null;

  const dataTotal = roadData.length + bridgeData.length;

  // ── No restriction data ───────────────────────────────────────────────────
  if (dataTotal === 0) {
    return {
      agentId:               AGENT_ID,
      status:                'no_data',
      severity:              'warning',
      findings: [{
        id: 'no-restriction-data', severity: 'warning',
        title: 'No local restriction dataset loaded',
        detail: 'Import bridge and road restriction data in Settings → Import restrictions CSV to enable route-specific physical checks.',
      }],
      matchedRestrictions:   [],
      dataQuality:           { roadCount: 0, bridgeCount: 0, routeProximityChecked: false },
      summary:               'No restriction data available for this route check.',
      driverMessage:         'No local restriction dataset loaded. Manual checks required for all bridge heights, weight limits, and width restrictions on this route.',
      ranAt:                 new Date().toISOString(),
    };
  }

  // ── No route polyline ─────────────────────────────────────────────────────
  if (polyline.length < 2) {
    return {
      agentId:               AGENT_ID,
      status:                'no_route',
      severity:              'info',
      findings: [{
        id: 'no-route-polyline', severity: 'info',
        title: 'No route calculated',
        detail: 'Calculate a route before running restriction proximity checks.',
      }],
      matchedRestrictions:   [],
      dataQuality:           { roadCount: roadData.length, bridgeCount: bridgeData.length, routeProximityChecked: false },
      summary:               'Restriction data loaded but no route to check against.',
      driverMessage:         'Calculate a route first. Restriction data is ready.',
      ranAt:                 new Date().toISOString(),
    };
  }

  // ── Check each bridge restriction against route proximity ─────────────────
  let bridgeConflicts = 0;
  for (const bridge of bridgeData) {
    const bLat = parseFloat(bridge.lat);
    const bLon = parseFloat(bridge.lon);
    if (isNaN(bLat) || isNaN(bLon)) continue;

    const onRoute = _isNearRoute(bLat, bLon, polyline, ROUTE_PROXIMITY_M);
    if (!onRoute) continue;

    const maxH  = parseFloat(bridge.maxheight || bridge.max_height || bridge.height || '');
    const maxW  = parseFloat(bridge.maxwidth  || bridge.max_width  || bridge.width  || '');
    const maxWt = parseFloat(bridge.maxweight || bridge.max_weight || bridge.weight || '');
    const desc  = bridge.description || bridge.name || `Bridge near ${bLat.toFixed(4)}, ${bLon.toFixed(4)}`;

    // Height conflict
    if (!isNaN(maxH) && heightM !== null && heightM > maxH) {
      bridgeConflicts++;
      findings.push({
        id:       `bridge-height-${bridgeConflicts}`,
        severity: 'critical',
        title:    `Bridge height conflict — ${desc}`,
        detail:   `Your vehicle height (${heightM}m) exceeds this bridge's clearance (${maxH}m). Manual route deviation required.`,
      });
      matchedRestrictions.push({ type: 'bridge_height', lat: bLat, lon: bLon, desc, value: maxH, vehicleValue: heightM });
    }

    // Width conflict
    if (!isNaN(maxW) && widthM !== null && widthM > maxW) {
      bridgeConflicts++;
      findings.push({
        id:       `bridge-width-${bridgeConflicts}`,
        severity: 'critical',
        title:    `Bridge width conflict — ${desc}`,
        detail:   `Your vehicle width (${widthM}m) exceeds this bridge's width limit (${maxW}m).`,
      });
      matchedRestrictions.push({ type: 'bridge_width', lat: bLat, lon: bLon, desc, value: maxW, vehicleValue: widthM });
    }

    // Weight conflict
    if (!isNaN(maxWt) && grossWeightT !== null && grossWeightT > maxWt) {
      bridgeConflicts++;
      findings.push({
        id:       `bridge-weight-${bridgeConflicts}`,
        severity: 'critical',
        title:    `Bridge weight limit — ${desc}`,
        detail:   `Your vehicle weight (${grossWeightT}t) exceeds this bridge's limit (${maxWt}t).`,
      });
      matchedRestrictions.push({ type: 'bridge_weight', lat: bLat, lon: bLon, desc, value: maxWt, vehicleValue: grossWeightT });
    }
  }

  // ── Check road restrictions ────────────────────────────────────────────────
  let roadConflicts = 0;
  for (const road of roadData) {
    const rLat = parseFloat(road.lat);
    const rLon = parseFloat(road.lon);
    if (isNaN(rLat) || isNaN(rLon)) continue;

    const onRoute = _isNearRoute(rLat, rLon, polyline, ROUTE_PROXIMITY_M);
    if (!onRoute) continue;

    const maxH  = parseFloat(road.maxheight || road.max_height || '');
    const maxWt = parseFloat(road.maxweight || road.max_weight || '');
    const maxW  = parseFloat(road.maxwidth  || road.max_width  || '');
    const desc  = road.description || road.name || `Restriction near ${rLat.toFixed(4)}, ${rLon.toFixed(4)}`;

    if (!isNaN(maxH) && heightM !== null && heightM > maxH) {
      roadConflicts++;
      findings.push({
        id:       `road-height-${roadConflicts}`,
        severity: 'critical',
        title:    `Height restriction — ${desc}`,
        detail:   `Your vehicle height (${heightM}m) exceeds this road restriction (${maxH}m).`,
      });
      matchedRestrictions.push({ type: 'road_height', lat: rLat, lon: rLon, desc, value: maxH, vehicleValue: heightM });
    }

    if (!isNaN(maxWt) && grossWeightT !== null && grossWeightT > maxWt) {
      roadConflicts++;
      findings.push({
        id:       `road-weight-${roadConflicts}`,
        severity: 'warning',
        title:    `Weight restriction — ${desc}`,
        detail:   `Your vehicle weight (${grossWeightT}t) may exceed this road's limit (${maxWt}t). Verify locally.`,
      });
      matchedRestrictions.push({ type: 'road_weight', lat: rLat, lon: rLon, desc, value: maxWt, vehicleValue: grossWeightT });
    }

    if (!isNaN(maxW) && widthM !== null && widthM > maxW) {
      roadConflicts++;
      findings.push({
        id:       `road-width-${roadConflicts}`,
        severity: 'warning',
        title:    `Width restriction — ${desc}`,
        detail:   `Your vehicle width (${widthM}m) may exceed this road restriction (${maxW}m).`,
      });
      matchedRestrictions.push({ type: 'road_width', lat: rLat, lon: rLon, desc, value: maxW, vehicleValue: widthM });
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const totalConflicts = bridgeConflicts + roadConflicts;
  const hasCritical    = findings.some((f) => f.severity === 'critical');
  const hasWarning     = findings.some((f) => f.severity === 'warning');
  const severity       = hasCritical ? 'critical' : hasWarning ? 'warning' : 'clear';
  const status         = totalConflicts > 0 ? 'conflicts_found' : 'no_conflicts';

  const summary = totalConflicts === 0
    ? `No restriction conflicts found on this route from ${dataTotal} loaded records (${ROUTE_PROXIMITY_M}m proximity check).`
    : `${totalConflicts} restriction conflict(s) found near this route — manual deviation required.`;

  const driverMessage = totalConflicts === 0
    ? `No known restriction conflicts detected on this route. Restriction dataset: ${roadData.length} road + ${bridgeData.length} bridge records.`
    : `⚠ ${totalConflicts} restriction conflict(s) detected near your route. Do not proceed without manually checking these points.`;

  return {
    agentId:    AGENT_ID,
    status,
    severity,
    findings,
    matchedRestrictions,
    dataQuality: {
      roadCount:              roadData.length,
      bridgeCount:            bridgeData.length,
      routeProximityChecked:  true,
      proximityRadiusM:       ROUTE_PROXIMITY_M,
      totalConflicts,
    },
    summary,
    driverMessage,
    ranAt: new Date().toISOString(),
  };
}

/** Check if a lat/lon point is within proximityM of any segment of the polyline. */
function _isNearRoute(lat, lon, polyline, proximityM) {
  for (const [pLat, pLon] of polyline) {
    if (haversineDistance(lat, lon, pLat, pLon) <= proximityM) return true;
  }
  return false;
}

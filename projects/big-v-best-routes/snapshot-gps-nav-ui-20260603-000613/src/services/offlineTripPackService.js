/**
 * offlineTripPackService.js — Offline trip pack structure
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Creates a self-contained trip data pack stored in SSOT for offline reference.
 *
 * HONEST OFFLINE POLICY:
 *   - Route geometry + instructions are cached (from last successful calculation)
 *   - Vehicle and compliance snapshots are cached
 *   - MAP TILES are NOT cached by this service (MapLibre manages tiles separately)
 *   - Live rerouting is NOT available offline
 *   - Restriction data freshness is flagged if trip pack is > 24h old
 *
 * This service NEVER claims full offline map coverage.
 * If offline, the app shows cached route data with honest limitation notices.
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

import { COMPLIANCE_DISCLAIMER } from '../config/complianceRules.js';
import { polylineLength }         from '../utils/geo.js';

const TRIP_PACK_FRESHNESS_THRESHOLD_MS = 24 * 60 * 60 * 1000;  // 24h

// ─── Pack creation ────────────────────────────────────────────────────────────

/**
 * Build an offline trip pack from current SSOT state.
 * Should be called after route calculation succeeds.
 *
 * @param {object} params
 * @param {object} params.trip          - trip state from SSOT
 * @param {object} params.vehicle       - active vehicle profile
 * @param {object} params.compliance    - compliance state from SSOT
 * @param {object} params.agents        - agent suite results from SSOT
 * @param {object} params.restrictions  - restrictions from SSOT
 * @param {boolean} params.useMetric    - unit preference
 * @returns {OfflineTripPack | null}
 */
export function buildOfflineTripPack({
  trip,
  vehicle,
  compliance,
  agents,
  restrictions,
  useMetric = true,
}) {
  const routeResult = trip?.lastRouteResult;

  if (!routeResult?.route) return null;

  const generatedAt = new Date().toISOString();
  const polyline    = routeResult.route.polyline || [];
  const totalDistM  = routeResult.route.distanceM || (polyline.length > 1 ? polylineLength(polyline) : 0);
  const instructions = routeResult.route.instructions || [];

  return {
    version:        '1.0',
    generatedAt,
    packId:         `trip-pack-${Date.now()}`,

    // Route data
    route: {
      distanceM:    totalDistM,
      durationMs:   routeResult.route.durationMs,
      polyline,
      instructions,
      profile:      routeResult.route.profile,
      provider:     routeResult.provider,
      isDevRoute:   !!(routeResult.demoMode || routeResult.devFallback),
      bbox:         routeResult.route.bbox || null,
    },

    // Trip info
    origin:         trip.origin || '',
    destination:    trip.destination || '',
    originLabel:    routeResult.originLabel || trip.origin || '',
    destLabel:      routeResult.destLabel   || trip.destination || '',

    // Vehicle snapshot (frozen at pack creation time)
    vehicle: vehicle ? {
      id:     vehicle.id,
      name:   vehicle.name,
      type:   vehicle.type,
      fields: { ...vehicle.fields },
    } : null,

    // Compliance snapshot
    compliance: compliance ? {
      status:      compliance.status,
      score:       compliance.score,
      warnings:    compliance.warnings ? [...compliance.warnings] : [],
      disclaimer:  COMPLIANCE_DISCLAIMER,
      lastCheckedAt: compliance.lastCheckedAt,
      driverMessage: compliance.driverMessage,
      reportSummary: compliance.reportSummary,
    } : null,

    // Agent advisory snapshot
    agentSnapshot: agents ? {
      overallLevel:  agents.overallLevel,
      headline:      agents.headline,
      combinedScore: agents.combinedScore,
      ranAt:         agents.ranAt,
    } : null,

    // Route warnings (deduplicated summary for offline display)
    warnings: _extractWarnings(compliance, agents),

    // Data freshness info
    dataFreshness: {
      routeCalculatedAt:    routeResult.calculatedAt || generatedAt,
      complianceCheckedAt:  compliance?.lastCheckedAt || null,
      restrictionImportedAt: restrictions?.lastImportedAt || null,
      restrictionSource:    restrictions?.importSource || null,
    },

    // Honest offline notices — always included
    offlineNotices: buildOfflineNotices(routeResult),

    // Mandatory disclaimer
    disclaimer: COMPLIANCE_DISCLAIMER,
  };
}

/**
 * Check if an offline trip pack is still fresh enough to use.
 * Returns { fresh: bool, ageMs: number, notice: string|null }
 */
export function checkTripPackFreshness(pack) {
  if (!pack?.generatedAt) return { fresh: false, ageMs: null, notice: 'Trip pack has no timestamp.' };
  const ageMs = Date.now() - new Date(pack.generatedAt).getTime();
  const fresh = ageMs < TRIP_PACK_FRESHNESS_THRESHOLD_MS;
  return {
    fresh,
    ageMs,
    notice: fresh ? null : `Trip data is ${Math.round(ageMs / 3600000)}h old. Recalculate when online for fresh route and compliance data.`,
  };
}

/**
 * Build honest offline notices for the pack.
 * Never claims full offline functionality.
 */
export function buildOfflineNotices(routeResult) {
  const notices = [];
  notices.push({
    id:   'offline-routing',
    type: 'info',
    text: 'Live rerouting is unavailable offline. The cached route from your last online session is shown.',
  });
  notices.push({
    id:   'offline-tiles',
    type: 'info',
    text: 'Map tiles may not load unless previously cached or a tile cache service is configured.',
  });
  if (routeResult?.demoMode) {
    notices.push({
      id:   'dev-route',
      type: 'warning',
      text: 'This is a development fallback route, not a real navigable path. Configure GraphHopper API key.',
    });
  }
  notices.push({
    id:   'offline-compliance',
    type: 'info',
    text: 'Compliance AI results are from your last online check. Road conditions may have changed.',
  });
  return notices;
}

// ─── SSOT recipe ──────────────────────────────────────────────────────────────

/**
 * Recipe to save trip pack to SSOT.
 * @param {OfflineTripPack} pack
 */
export function saveTripPackRecipe(pack) {
  return (draft) => {
    if (!draft.navigation) draft.navigation = {};
    draft.navigation.offlineTripPack = pack;
    draft.navigation.offlineStatus   = navigator.onLine ? 'online' : 'offline';
  };
}

/**
 * Recipe to clear offline trip pack from SSOT.
 */
export function clearTripPackRecipe() {
  return (draft) => {
    if (!draft.navigation) return;
    draft.navigation.offlineTripPack = null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _extractWarnings(compliance, agents) {
  const warnings = [];
  const seen = new Set();

  // Top compliance warnings
  for (const w of (compliance?.warnings || []).slice(0, 8)) {
    if (w.id && !seen.has(w.id)) {
      warnings.push({ id: w.id, level: w.level, title: w.title });
      seen.add(w.id);
    }
  }

  // Agent critical findings
  const agentSources = [
    agents?.vehicleAgent?.findings,
    agents?.restrictionAgent?.findings,
  ];
  for (const findings of agentSources) {
    for (const f of (findings || []).filter((f) => f.severity === 'critical')) {
      if (!seen.has(f.id)) {
        warnings.push({ id: f.id, level: 'critical', title: f.title });
        seen.add(f.id);
      }
    }
  }

  return warnings.slice(0, 10);
}

/**
 * routeProgressEngine.js — Route progress tracking engine
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Pure computation module — no state, no side effects.
 * Called on every GPS update to calculate current position on route,
 * next instruction, remaining distance/time, and off-route detection.
 *
 * All functions are deterministic and safe to call with null/partial inputs.
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

import { haversineDistance, bearing } from '../utils/geo.js';
import {
  OFF_ROUTE_THRESHOLD_M,
  GPS_STALE_AFTER_SECONDS,
  LOW_GPS_CONFIDENCE_ACCURACY_M,
} from '../config/navigationConfig.js';

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Calculate full route progress from current GPS position.
 *
 * @param {object} params
 * @param {number} params.lat              - current GPS latitude
 * @param {number} params.lon              - current GPS longitude
 * @param {number} params.accuracy         - GPS accuracy metres
 * @param {number} params.timestamp        - GPS timestamp (ms)
 * @param {array}  params.polyline         - [[lat,lon], ...] route polyline
 * @param {array}  params.instructions     - GraphHopper instruction array
 * @param {number} params.prevInstrIdx     - current instruction index (from SSOT)
 * @param {number} params.totalDistanceM   - total route distance metres
 * @param {number} params.totalDurationMs  - total route duration ms
 * @param {boolean} params.useMetric       - true for metric, false for imperial
 * @returns {RouteProgressResult}
 *
 * RouteProgressResult: {
 *   nearestPolylineIndex, nearestPolylineDistM,
 *   progressFraction,
 *   currentInstructionIndex, currentInstruction,
 *   nextInstruction, nextInstructionIndex,
 *   distanceToNextInstructionM,
 *   remainingDistanceM, remainingDurationMs,
 *   routeProgressPercent,
 *   offRoute, offRouteDistanceM,
 *   warnings
 * }
 */
export function calculateRouteProgress({
  lat, lon, accuracy, timestamp,
  polyline, instructions,
  prevInstrIdx = 0,
  totalDistanceM, totalDurationMs,
  useMetric = true,
}) {
  const warnings = [];

  // ── Guard: incomplete inputs ───────────────────────────────────────────
  if (lat == null || lon == null || !polyline || polyline.length < 2) {
    return _emptyProgress({ totalDistanceM, totalDurationMs, warnings: [{ id: 'no-position', level: 'info', title: 'GPS position not yet available.' }] });
  }

  // ── Guard: stale GPS ───────────────────────────────────────────────────
  const ageMs = timestamp ? (Date.now() - timestamp) : 0;
  const isStale = ageMs > GPS_STALE_AFTER_SECONDS * 1000;
  if (isStale) {
    warnings.push({ id: 'gps-stale', level: 'warning', title: `GPS signal is stale (${Math.round(ageMs / 1000)}s old). Position may be inaccurate.` });
  }

  // ── Guard: low accuracy ────────────────────────────────────────────────
  if (accuracy != null && accuracy > LOW_GPS_CONFIDENCE_ACCURACY_M) {
    warnings.push({ id: 'gps-low-accuracy', level: 'info', title: `Low GPS accuracy (±${Math.round(accuracy)}m). Position may be uncertain.` });
  }

  // ── Find nearest point on polyline ────────────────────────────────────
  const { index: nearestIdx, distanceM: snapDistM } = nearestPolylinePoint(polyline, lat, lon);

  // ── Off-route detection ────────────────────────────────────────────────
  const offRoute = snapDistM > OFF_ROUTE_THRESHOLD_M;
  if (offRoute) {
    warnings.push({
      id:    'off-route',
      level: 'warning',
      title: `Off route — ${Math.round(snapDistM)}m from nearest route point. ${snapDistM > 200 ? 'Rerouting recommended.' : 'Return to the highlighted route.'}`,
    });
  }

  // ── Progress fraction ─────────────────────────────────────────────────
  const progressFraction = nearestIdx / (polyline.length - 1);

  // ── Remaining distance ────────────────────────────────────────────────
  const coveredDistM  = segmentLength(polyline, 0, nearestIdx);
  const totalPolyM    = totalDistanceM ?? polylineLength(polyline);
  const remainDistM   = Math.max(0, totalPolyM - coveredDistM);

  // ── Remaining duration (proportional) ────────────────────────────────
  const remainDurMs   = totalDurationMs
    ? Math.round(totalDurationMs * (1 - progressFraction))
    : null;

  // ── Instruction tracking ──────────────────────────────────────────────
  const instrResult = calculateCurrentInstruction({
    polyline,
    instructions,
    nearestPolylineIndex: nearestIdx,
    prevInstrIdx,
  });

  return {
    nearestPolylineIndex:        nearestIdx,
    nearestPolylineDistM:        Math.round(snapDistM),
    progressFraction,
    routeProgressPercent:        Math.round(progressFraction * 100),
    currentInstructionIndex:     instrResult.currentIdx,
    currentInstruction:          instrResult.current,
    nextInstructionIndex:        instrResult.nextIdx,
    nextInstruction:             instrResult.next,
    distanceToNextInstructionM:  instrResult.distanceToNextM,
    remainingDistanceM:          Math.round(remainDistM),
    remainingDurationMs:         remainDurMs,
    offRoute,
    offRouteDistanceM:           Math.round(snapDistM),
    warnings,
  };
}

// ─── Instruction tracking ─────────────────────────────────────────────────────

/**
 * Find the current instruction based on polyline position.
 * GraphHopper instructions have `interval` [startIdx, endIdx] into the polyline.
 */
export function calculateCurrentInstruction({
  polyline,
  instructions,
  nearestPolylineIndex,
  prevInstrIdx = 0,
}) {
  if (!instructions || instructions.length === 0) {
    return { currentIdx: 0, current: null, nextIdx: 1, next: null, distanceToNextM: null };
  }

  // Find which instruction interval the current polyline index falls into
  let currentIdx = prevInstrIdx;
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    const start = instr.interval?.[0] ?? i;
    const end   = instr.interval?.[1] ?? (i + 1);
    if (nearestPolylineIndex >= start && nearestPolylineIndex <= end) {
      currentIdx = i;
      break;
    }
    // If past the last interval point, advance
    if (i === instructions.length - 1) {
      currentIdx = i;
    }
  }

  // Don't go backwards (prevent flicker on GPS jitter)
  currentIdx = Math.max(currentIdx, prevInstrIdx);

  const current  = instructions[currentIdx] || null;
  const nextIdx  = Math.min(currentIdx + 1, instructions.length - 1);
  const next     = currentIdx < instructions.length - 1 ? instructions[nextIdx] : null;

  // Distance to next instruction manoeuvre point
  let distanceToNextM = null;
  if (next?.interval) {
    const nextStartPt = polyline[next.interval[0]];
    if (nextStartPt) {
      distanceToNextM = haversineDistance(
        polyline[nearestPolylineIndex]?.[0] ?? polyline[0][0],
        polyline[nearestPolylineIndex]?.[1] ?? polyline[0][1],
        nextStartPt[0], nextStartPt[1],
      );
    }
  }

  return { currentIdx, current, nextIdx, next, distanceToNextM };
}

// ─── Voice trigger ────────────────────────────────────────────────────────────

/**
 * Determine if a voice instruction should be spoken.
 * Returns { shouldSpeak: bool, text: string|null }.
 *
 * Speaks when:
 *   - instruction changes (currentIdx changed)
 *   - distance to next instruction crosses an announce threshold
 */
export function getVoiceTrigger({
  prevInstrIdx,
  currentInstrIdx,
  distanceToNextM,
  nextInstruction,
  useMetric = true,
  alreadySpoken = false,
}) {
  // Instruction changed — speak new instruction
  if (currentInstrIdx !== prevInstrIdx) {
    const text = nextInstruction?.text;
    if (text) return { shouldSpeak: true, text, reason: 'instruction_change' };
  }

  // Approaching announce threshold
  const threshold = distanceToNextM != null && distanceToNextM <= 200 && distanceToNextM > 150;
  if (threshold && !alreadySpoken && nextInstruction?.text) {
    const dist = useMetric
      ? `In ${Math.round(distanceToNextM)} metres`
      : `In ${Math.round(distanceToNextM * 3.281)} feet`;
    return { shouldSpeak: true, text: `${dist}, ${nextInstruction.text}`, reason: 'distance_approach' };
  }

  return { shouldSpeak: false, text: null, reason: null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find nearest polyline point to a lat/lon. Returns { index, distanceM }. */
export function nearestPolylinePoint(polyline, lat, lon) {
  let minDist = Infinity;
  let minIdx  = 0;
  for (let i = 0; i < polyline.length; i++) {
    const d = haversineDistance(lat, lon, polyline[i][0], polyline[i][1]);
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return { index: minIdx, distanceM: minDist };
}

/** Calculate cumulative polyline segment length from startIdx to endIdx (metres). */
export function segmentLength(polyline, startIdx, endIdx) {
  let total = 0;
  const end = Math.min(endIdx, polyline.length - 1);
  for (let i = startIdx; i < end; i++) {
    total += haversineDistance(polyline[i][0], polyline[i][1], polyline[i+1][0], polyline[i+1][1]);
  }
  return total;
}

/** Total polyline length (metres). */
function polylineLength(polyline) {
  return segmentLength(polyline, 0, polyline.length - 1);
}

function _emptyProgress({ totalDistanceM, totalDurationMs, warnings }) {
  return {
    nearestPolylineIndex:        0,
    nearestPolylineDistM:        0,
    progressFraction:            0,
    routeProgressPercent:        0,
    currentInstructionIndex:     0,
    currentInstruction:          null,
    nextInstructionIndex:        1,
    nextInstruction:             null,
    distanceToNextInstructionM:  null,
    remainingDistanceM:          totalDistanceM ?? null,
    remainingDurationMs:         totalDurationMs ?? null,
    offRoute:                    false,
    offRouteDistanceM:           0,
    warnings:                    warnings || [],
  };
}

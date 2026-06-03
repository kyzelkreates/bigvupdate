/**
 * RouteProgressPanel.jsx — Live route progress display
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Shows route progress, remaining distance/time, next instruction,
 * off-route warning, and reroute suggestion.
 *
 * All data from SSOT — no local state for navigation values.
 * ADVISORY ONLY — route progress does not guarantee route legality.
 */

import { Navigation2, TriangleAlert, RefreshCw, Route, Clock } from 'lucide-react';
import { REROUTE_STATUS } from '../../services/rerouteService.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDistance(metres, useMetric) {
  if (metres == null) return null;
  if (useMetric) {
    return metres >= 1000
      ? `${(metres / 1000).toFixed(1)} km`
      : `${Math.round(metres)} m`;
  }
  const miles = metres / 1609.34;
  return miles >= 0.5
    ? `${miles.toFixed(1)} mi`
    : `${Math.round(metres * 3.281)} ft`;
}

function formatDuration(ms) {
  if (ms == null || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min`;
  return '< 1 min';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RouteProgressPanel({
  navigation,
  useMetric = true,
  onRerouteConfirm,
  onRerouteDecline,
  onRerouteAccept,
  compact = false,
}) {
  const {
    status,
    progressFraction       = 0,
    routeProgressPercent   = 0,
    currentInstruction,
    nextInstruction,
    distanceToNextInstructionM,
    remainingDistanceM,
    remainingDurationMs,
    offRouteStatus,
    offRouteDistanceM,
    reroute = {},
    navigationWarnings     = [],
  } = navigation;

  const isActive      = status === 'active';
  const isPaused      = status === 'paused';
  const isRerouting   = status === 'rerouting';
  const rerouteStatus = reroute.status || REROUTE_STATUS.IDLE;

  const remainDistLabel = formatDistance(remainingDistanceM, useMetric);
  const remainTimeLabel = formatDuration(remainingDurationMs);
  const distToNextLabel = formatDistance(distanceToNextInstructionM, useMetric);

  const progressPct     = Math.min(100, Math.max(0, routeProgressPercent || Math.round(progressFraction * 100)));

  if (!isActive && !isPaused && !isRerouting) {
    return null;  // Don't render when navigation not running
  }

  // ── Compact mode (slim progress bar only) ─────────────────────────────────
  if (compact) {
    return (
      <div className="routeProgressCompact" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progressBarBg">
          <div className="progressBarFill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="progressCompactLabel">{progressPct}%</span>
      </div>
    );
  }

  return (
    <div className="routeProgressPanel" role="region" aria-label="Route progress">

      {/* ── Progress bar ──────────────────────────────────────────────── */}
      <div className="rpProgressRow">
        <div
          className="rpProgressBar"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Route progress: ${progressPct}%`}
        >
          <div className="rpProgressFill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="rpProgressPct">{progressPct}%</span>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────── */}
      <div className="rpStatsRow">
        {remainDistLabel && (
          <div className="rpStat">
            <Route size={12} />
            <span>{remainDistLabel} remaining</span>
          </div>
        )}
        {remainTimeLabel && (
          <div className="rpStat">
            <Clock size={12} />
            <span>{remainTimeLabel} remaining</span>
          </div>
        )}
        {distToNextLabel && nextInstruction && (
          <div className="rpStat">
            <Navigation2 size={12} />
            <span>{distToNextLabel} to next turn</span>
          </div>
        )}
      </div>

      {/* ── Current instruction ───────────────────────────────────────── */}
      {currentInstruction && (
        <div className="rpInstruction" aria-live="polite" aria-atomic="true">
          <Navigation2 size={15} style={{ flexShrink: 0 }} />
          <span>{currentInstruction}</span>
        </div>
      )}

      {/* ── Off-route warning ─────────────────────────────────────────── */}
      {offRouteStatus && (
        <div className="rpOffRoute" role="alert" aria-live="assertive">
          <TriangleAlert size={15} style={{ flexShrink: 0 }} />
          <div>
            <strong>You may be off the planned route.</strong>
            {offRouteDistanceM != null && (
              <span> ({Math.round(offRouteDistanceM)}m from route)</span>
            )}
            <div className="rpOffRouteSubtext">
              Re-check route suitability before continuing.
            </div>
          </div>
        </div>
      )}

      {/* ── Reroute prompt ────────────────────────────────────────────── */}
      {rerouteStatus === REROUTE_STATUS.PROMPT && (
        <div className="rpReroutePrompt" role="alertdialog" aria-label="Reroute suggestion">
          <TriangleAlert size={14} />
          <div className="rpRerouteText">
            <strong>Reroute suggested.</strong> You appear to be off the planned route.
            Recalculate using your current GPS position?
          </div>
          <div className="rpRerouteBtns">
            <button type="button" className="primary small" onClick={onRerouteConfirm}>
              <RefreshCw size={12} /> Recalculate
            </button>
            <button type="button" className="ghost small" onClick={onRerouteDecline}>
              Stay on route
            </button>
          </div>
        </div>
      )}

      {rerouteStatus === REROUTE_STATUS.CALCULATING && (
        <div className="rpReroutePrompt calculating" role="status">
          <RefreshCw size={14} className="spinIcon" />
          <span>Calculating new route…</span>
        </div>
      )}

      {rerouteStatus === REROUTE_STATUS.AWAITING_ACK && reroute.proposedRoute && (
        <div className="rpReroutePrompt proposed" role="alertdialog" aria-label="Proposed reroute">
          <Navigation2 size={14} />
          <div className="rpRerouteText">
            <strong>New route ready.</strong>
            {reroute.proposedRoute.distanceM && (
              <span> {formatDistance(reroute.proposedRoute.distanceM, useMetric)}</span>
            )}
            {reroute.requiresAcknowledgement && (
              <div className="rpRerouteHighRisk">
                <TriangleAlert size={12} /> High-risk route — review compliance before accepting.
              </div>
            )}
          </div>
          <div className="rpRerouteBtns">
            <button type="button" className="primary small" onClick={onRerouteAccept}>
              Accept
            </button>
            <button type="button" className="ghost small" onClick={onRerouteDecline}>
              Decline
            </button>
          </div>
        </div>
      )}

      {rerouteStatus === REROUTE_STATUS.ERROR && (
        <div className="rpReroutePrompt error" role="alert">
          <TriangleAlert size={14} />
          <span>Reroute failed: {reroute.errorMessage || 'Unknown error'}. Continue on original route.</span>
        </div>
      )}

      {/* ── Navigation warnings from routeProgressEngine ─────────────── */}
      {navigationWarnings.length > 0 && (
        <div className="rpWarningsList" aria-label="Navigation warnings">
          {navigationWarnings.map((w, i) => (
            <div key={i} className="rpWarningItem">
              <TriangleAlert size={12} />
              <span>{typeof w === 'string' ? w : w.message || JSON.stringify(w)}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

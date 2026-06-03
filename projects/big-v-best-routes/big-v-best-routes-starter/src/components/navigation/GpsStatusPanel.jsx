/**
 * GpsStatusPanel.jsx — Live GPS status display + manual GPS toggle
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Shows real GPS state from SSOT. Provides Start GPS / Stop GPS buttons.
 * GPS is never started automatically — requires explicit user action.
 *
 * States handled:
 *   idle | requesting | granted | denied | unavailable | timeout
 *   active | stale | low_accuracy | stopped | offline
 *
 * ADVISORY ONLY — GPS accuracy does not guarantee route legality.
 */

import { Satellite, WifiOff, TriangleAlert, CheckCircle, XCircle, Clock, Navigation2 } from 'lucide-react';
import { LOW_ACCURACY_THRESHOLD_M, GPS_STALE_THRESHOLD_MS } from '../../services/locationService.js';

// ─── GPS status config ────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  idle:         { icon: Satellite,      label: 'GPS not started',     cls: 'gpsIdle'     },
  requesting:   { icon: Clock,          label: 'Requesting GPS…',      cls: 'gpsPending'  },
  granted:      { icon: CheckCircle,    label: 'GPS permission granted', cls: 'gpsOk'     },
  denied:       { icon: XCircle,        label: 'GPS permission denied', cls: 'gpsError'   },
  unavailable:  { icon: WifiOff,        label: 'GPS unavailable',       cls: 'gpsError'   },
  timeout:      { icon: TriangleAlert,  label: 'GPS timeout',           cls: 'gpsWarn'    },
  active:       { icon: Satellite,      label: 'GPS active',            cls: 'gpsActive'  },
  stale:        { icon: TriangleAlert,  label: 'GPS signal stale',      cls: 'gpsWarn'    },
  low_accuracy: { icon: TriangleAlert,  label: 'GPS low accuracy',      cls: 'gpsWarn'    },
  stopped:      { icon: Satellite,      label: 'GPS stopped',           cls: 'gpsIdle'    },
};

function deriveDisplayStatus(navigation) {
  const {
    locationPermission, gpsWatchActive, gpsIsStale,
    gpsAccuracy, gpsStatus,
  } = navigation;

  if (locationPermission === 'denied')       return 'denied';
  if (locationPermission === 'unavailable')  return 'unavailable';

  if (gpsStatus === 'real' && gpsWatchActive) {
    if (gpsIsStale)                                           return 'stale';
    if (gpsAccuracy != null && gpsAccuracy > LOW_ACCURACY_THRESHOLD_M) return 'low_accuracy';
    return 'active';
  }
  if (gpsWatchActive)  return 'requesting';
  if (gpsStatus === 'real' && !gpsWatchActive) return 'stopped';
  return 'idle';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GpsStatusPanel({
  navigation,
  onStartGps,
  onStopGps,
  isNavigating,
  compact = false,
}) {
  const displayStatus = deriveDisplayStatus(navigation);
  const cfg  = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.idle;
  const Icon = cfg.icon;

  const gpsIsReal      = navigation.gpsStatus === 'real';
  const gpsWatching    = navigation.gpsWatchActive;
  const accuracy       = navigation.gpsAccuracy;
  const speedKph       = navigation.gpsSpeedKph;
  const speedMph       = navigation.gpsSpeedMph;
  const heading        = navigation.currentHeading;
  const lastUpdated    = navigation.gpsLastUpdated;
  const isStale        = navigation.gpsIsStale;
  const isLowAccuracy  = accuracy != null && accuracy > LOW_ACCURACY_THRESHOLD_M;
  const permission     = navigation.locationPermission;

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // ── Compact mode (in-map badge style) ─────────────────────────────────────
  if (compact) {
    return (
      <div className={`gpsCompactBadge ${cfg.cls}`}>
        <Icon size={12} />
        <span>{cfg.label}</span>
        {accuracy != null && <span className="gpsAccBadge">±{Math.round(accuracy)}m</span>}
      </div>
    );
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div className={`gpsStatusPanel ${cfg.cls}`} role="region" aria-label="GPS Status">

      {/* ── Header row ────────────────────────────────────────────────── */}
      <div className="gpsPanelHeader">
        <div className="gpsPanelTitle">
          <Icon size={16} />
          <span>GPS &amp; Location</span>
          <span className={`gpsStatusPill ${cfg.cls}`}>{cfg.label}</span>
        </div>

        {/* Start / Stop GPS buttons — only when not in active navigation */}
        {!isNavigating && (
          <div className="gpsControlBtns">
            {!gpsWatching && permission !== 'denied' && permission !== 'unavailable' && (
              <button
                type="button"
                className="primary small"
                onClick={onStartGps}
                aria-label="Start GPS tracking"
              >
                <Navigation2 size={13} /> Start GPS
              </button>
            )}
            {gpsWatching && (
              <button
                type="button"
                className="ghost small danger"
                onClick={onStopGps}
                aria-label="Stop GPS tracking"
              >
                Stop GPS
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Live stats (only when real GPS active) ─────────────────────── */}
      {gpsIsReal && (
        <div className="gpsStatsGrid">
          {accuracy != null && (
            <div className={`gpsStat ${isLowAccuracy ? 'gpsStatWarn' : ''}`}>
              <span className="gpsStatLabel">Accuracy</span>
              <span className="gpsStatValue">±{Math.round(accuracy)}m</span>
              {isLowAccuracy && <span className="gpsStatFlag">Low</span>}
            </div>
          )}
          {speedKph != null && speedKph > 0.5 && (
            <div className="gpsStat">
              <span className="gpsStatLabel">Speed</span>
              <span className="gpsStatValue">
                {speedKph} km/h
                {speedMph != null && <span className="gpsStatSub"> / {speedMph} mph</span>}
              </span>
            </div>
          )}
          {heading != null && (
            <div className="gpsStat">
              <span className="gpsStatLabel">Heading</span>
              <span className="gpsStatValue">{Math.round(heading)}°</span>
            </div>
          )}
          {lastUpdatedLabel && (
            <div className={`gpsStat ${isStale ? 'gpsStatWarn' : ''}`}>
              <span className="gpsStatLabel">Last fix</span>
              <span className="gpsStatValue">{lastUpdatedLabel}</span>
              {isStale && <span className="gpsStatFlag">Stale</span>}
            </div>
          )}
        </div>
      )}

      {/* ── Warning messages ───────────────────────────────────────────── */}
      {displayStatus === 'denied' && (
        <div className="gpsAlertBox gpsAlertError" role="alert">
          <XCircle size={13} />
          GPS permission denied. Route planning works without GPS.
          Enable location access in your browser or device settings to use live navigation.
        </div>
      )}
      {displayStatus === 'unavailable' && (
        <div className="gpsAlertBox gpsAlertError" role="alert">
          <WifiOff size={13} />
          GPS is not available on this device or browser.
          Navigation map will use simulated position.
        </div>
      )}
      {displayStatus === 'stale' && (
        <div className="gpsAlertBox gpsAlertWarn" role="alert">
          <TriangleAlert size={13} />
          GPS signal lost or stale (no update for {Math.round(GPS_STALE_THRESHOLD_MS / 1000)}s).
          Check device location settings.
        </div>
      )}
      {displayStatus === 'low_accuracy' && (
        <div className="gpsAlertBox gpsAlertWarn" role="alert">
          <TriangleAlert size={13} />
          Low GPS accuracy (±{Math.round(accuracy)}m). Route progress and off-route detection may be imprecise.
          Move to an open area for a better signal.
        </div>
      )}
      {displayStatus === 'timeout' && (
        <div className="gpsAlertBox gpsAlertWarn" role="alert">
          <TriangleAlert size={13} />
          GPS request timed out. Ensure location services are enabled and try again.
        </div>
      )}
    </div>
  );
}

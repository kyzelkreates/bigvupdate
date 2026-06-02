import { useEffect, useRef, useState } from 'react';
import {
  Navigation, TriangleAlert, Volume2, VolumeX, RefreshCw,
  Square, Wifi, WifiOff, Satellite, Clock, MapPin,
} from 'lucide-react';
import { polylineToSvgPoints, svgPointsToPath } from '../utils/polyline.js';
import { formatDistance, formatDuration, formatETA } from '../utils/formatters.js';

const SIMULATION_INTERVAL = 2000; // ms between simulated GPS steps

export default function NavigationMapShell({
  navigation, vehicle, routeResult, compliance, onStop, onPause, onResume,
}) {
  const [voiceOn, setVoiceOn] = useState(navigation.voiceEnabled ?? false);
  const [animOffset, setAnimOffset] = useState(0);
  const [simProgress, setSimProgress] = useState(0); // 0–1 along polyline
  const animRef = useRef(null);
  const simRef = useRef(null);

  const isActive = navigation.status === 'active';
  const isPaused = navigation.status === 'paused';
  const route = routeResult?.route;
  const polyline = route?.polyline || [];

  // SVG polyline path
  const svgPoints = polylineToSvgPoints(polyline, 420, 520, 24);
  const routePath = svgPointsToPath(svgPoints);

  // Demo: use a default decorative path when no real polyline exists
  const fallbackPath = 'M210 500 C190 400 270 360 245 280 C220 200 140 180 178 115 C212 60 300 46 286 10';
  const displayPath = routePath || fallbackPath;

  // Animated dash offset
  useEffect(() => {
    animRef.current = setInterval(() => {
      setAnimOffset((p) => (p - 2) % 40);
    }, 50);
    return () => clearInterval(animRef.current);
  }, []);

  // Simulated GPS progress along route
  useEffect(() => {
    if (isActive && polyline.length > 1) {
      simRef.current = setInterval(() => {
        setSimProgress((p) => Math.min(1, p + 0.005));
      }, SIMULATION_INTERVAL);
    }
    return () => clearInterval(simRef.current);
  }, [isActive, polyline.length]);

  // Current vehicle marker position along SVG path
  const markerPos = getMarkerPos(svgPoints, simProgress);

  // Current instruction
  const instructions = route?.instructions || [];
  const currentIdx = Math.floor(simProgress * Math.max(instructions.length - 1, 0));
  const currentIns = instructions[currentIdx] || null;
  const instructionText = currentIns?.text
    || navigation.currentInstruction
    || 'Follow the highlighted route.';

  // Remaining distance/duration (decreasing with simulation)
  const totalDistM = route?.distanceM || navigation.remainingDistanceM;
  const totalDurMs = route?.durationMs || navigation.remainingDurationMs;
  const remainDistM = totalDistM ? totalDistM * (1 - simProgress) : null;
  const remainDurMs = totalDurMs ? totalDurMs * (1 - simProgress) : null;

  const gpsConf = navigation.gpsConfidence || 0;
  const isDemo = routeResult?.demoMode !== false;

  return (
    <section className="navShell">
      {/* ── 3D Map View ──────────────────────────────────────────────── */}
      <div className="fakeMap3d">
        {/* Sky / ground gradient */}
        <div className="mapSkyline" />

        {/* Route polyline SVG */}
        <svg
          className="routeSvg"
          viewBox="0 0 420 520"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Route shadow */}
          <path d={displayPath} className="routeShadow" />
          {/* Animated route line */}
          <path
            d={displayPath}
            className="routeLine"
            style={{ strokeDashoffset: animOffset }}
          />
          {/* Travelled portion overlay */}
          {simProgress > 0.02 && (
            <path
              d={getTravelledPath(svgPoints, simProgress, fallbackPath)}
              stroke="rgba(58,242,124,0.25)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Restriction/warning pins */}
        <div className="restrictionPin" style={{ top: '32%', right: '18%' }}>
          <TriangleAlert size={16} /> Low bridge
        </div>

        {/* Vehicle marker */}
        <div
          className="vehicleMarker"
          style={markerPos
            ? { left: markerPos.x, bottom: 'auto', top: markerPos.y, translate: '-50% -50%', position: 'absolute' }
            : {}}
        >
          <Navigation size={26} />
        </div>

        {/* Map overlay badges */}
        <div className="mapBadge topLeft">
          {isDemo ? '⚠ Demo route' : '● Live route'}
        </div>
        <div className="mapBadge topRight" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {gpsConf >= 70 ? <Satellite size={13} /> : <WifiOff size={13} />}
          GPS {gpsConf}%
        </div>
        {isActive && remainDistM != null && (
          <div className="mapBadge" style={{ top: 18, left: '50%', transform: 'translateX(-50%)' }}>
            {formatDistance(remainDistM)} remaining
          </div>
        )}
        {(navigation.status === 'paused') && (
          <div className="mapBadge" style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'rgba(255,176,32,.18)', borderColor: 'rgba(255,176,32,.45)',
            color: 'var(--warning)', fontSize: 16, padding: '12px 20px',
          }}>
            ⏸ Navigation paused
          </div>
        )}
        {/* Compliance score badge */}
        {compliance?.score != null && (
          <div className="mapBadge" style={{ bottom: 88, left: 18 }}>
            <span style={{ color: scoreColor(compliance.score), fontWeight: 800 }}>
              {compliance.score}%
            </span>
            {' '}confidence
          </div>
        )}
        {/* Offline indicator */}
        <div className="mapBadge" style={{ bottom: 88, right: 18 }}>
          {navigator.onLine ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
        </div>
      </div>

      {/* ── Instruction card ──────────────────────────────────────────── */}
      <div className="navInstructionCard">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow">
            {navigation.status === 'active' ? 'Active navigation' :
             navigation.status === 'paused' ? 'Paused' :
             navigation.status === 'stopped' ? 'Stopped' :
             'Navigation ready'}
          </p>
          <h2 style={{ fontSize: 'clamp(15px, 2.2vw, 20px)', marginBottom: 4, lineHeight: 1.2 }}>
            {instructionText}
          </h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
            {remainDistM != null && (
              <span><MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{formatDistance(remainDistM)}</span>
            )}
            {remainDurMs != null && (
              <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{formatDuration(remainDurMs)}</span>
            )}
            {remainDurMs != null && (
              <span>ETA {formatETA(remainDurMs)}</span>
            )}
            <span style={{ color: isDemo ? 'var(--warning)' : 'var(--green)' }}>
              {vehicle?.name || 'Vehicle'}
              {isActive ? ' 🔒' : ''}
            </span>
          </div>
        </div>

        <div className="navActions">
          <button
            className="ghost"
            onClick={() => setVoiceOn((v) => !v)}
            title={voiceOn ? 'Mute voice' : 'Enable voice'}
            style={{ padding: '10px' }}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="ghost" style={{ padding: '10px' }} title="Reroute">
            <RefreshCw size={18} />
          </button>
          {isActive ? (
            <button className="dangerButton" onClick={onStop} style={{ padding: '10px 16px' }}>
              <Square size={16} /> Stop
            </button>
          ) : (
            <button className="dangerButton" onClick={onStop} style={{ padding: '10px 16px' }}>
              <Square size={16} /> End
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

/** Interpolate marker position along SVG point array at progress 0–1 */
function getMarkerPos(svgPoints, progress) {
  if (!svgPoints || svgPoints.length < 2) return null;
  const idx = Math.min(
    Math.floor(progress * (svgPoints.length - 1)),
    svgPoints.length - 2,
  );
  const t = (progress * (svgPoints.length - 1)) - idx;
  const [x1, y1] = svgPoints[idx];
  const [x2, y2] = svgPoints[idx + 1];
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

/** Build an SVG path for the "travelled" portion of the route */
function getTravelledPath(svgPoints, progress, fallback) {
  if (!svgPoints || svgPoints.length < 2) return fallback;
  const cutIdx = Math.floor(progress * svgPoints.length);
  const subset = svgPoints.slice(0, Math.max(2, cutIdx));
  return svgPointsToPath(subset);
}

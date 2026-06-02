/**
 * NavigationMapShell.jsx
 * Big V's Best Routes — 3D navigation map dashboard
 *
 * Rendering strategy:
 *  1. Attempts to mount a real MapLibre GL JS map.
 *  2. If MapLibre fails to load/render (CSP, browser compat, etc.) the
 *     existing animated SVG shell is shown automatically — no crash.
 *
 * All MapLibre calls are isolated in mapLibreAdapter.js.
 * This component never imports maplibre-gl directly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Navigation, TriangleAlert, Volume2, VolumeX, RefreshCw,
  Square, Wifi, WifiOff, Satellite, Clock, MapPin, Layers,
} from 'lucide-react';
import {
  loadMapLibre, createMap, setRouteLayer,
  setWarningMarkers, moveVehicleMarker, followCamera, destroyMap,
} from '../core/mapLibreAdapter.js';
import { polylineToSvgPoints, svgPointsToPath } from '../utils/polyline.js';
import { formatDistance, formatDuration, formatETA } from '../utils/formatters.js';

const SIM_STEP_MS = 1800;

export default function NavigationMapShell({
  navigation, vehicle, routeResult, compliance, onStop, onPause, onResume,
}) {
  // ── Refs ─────────────────────────────────────────────────────────────────
  const mapContainerRef = useRef(null);
  const mapInstanceRef   = useRef(null);
  const mlRef            = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const simTimerRef      = useRef(null);
  const animTimerRef     = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mapReady, setMapReady]       = useState(false);   // MapLibre mounted ok
  const [mapFailed, setMapFailed]     = useState(false);   // MapLibre failed → SVG fallback
  const [voiceOn, setVoiceOn]         = useState(navigation.voiceEnabled ?? false);
  const [animOffset, setAnimOffset]   = useState(0);
  const [simProgress, setSimProgress] = useState(0);       // 0–1 along route

  const isActive  = navigation.status === 'active';
  const isPaused  = navigation.status === 'paused';
  const route     = routeResult?.route;
  const polyline  = route?.polyline || [];
  const isDemo    = routeResult?.demoMode !== false;

  // SVG fallback assets (always computed cheaply)
  const svgPoints    = polylineToSvgPoints(polyline, 420, 520, 24);
  const routeSvgPath = svgPointsToPath(svgPoints);
  const fallbackPath = 'M210 500 C190 400 270 360 245 280 C220 200 140 180 178 115 C212 60 300 46 286 10';
  const displayPath  = routeSvgPath || fallbackPath;

  // ── MapLibre mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function mount() {
      if (!mapContainerRef.current) return;
      try {
        const ml = await loadMapLibre();
        if (!ml || cancelled) { setMapFailed(true); return; }
        mlRef.current = ml;

        // Determine start centre from polyline or default (Bristol)
        const startCoord = polyline[0]
          ? { center: [polyline[0][1], polyline[0][0]] }
          : { center: [-2.5879, 51.4545] };

        const map = await createMap(mapContainerRef.current, { ...startCoord, zoom: 13, pitch: 55 });
        if (!map || cancelled) { setMapFailed(true); return; }

        mapInstanceRef.current = map;

        map.on('load', () => {
          if (cancelled) return;
          // Add route layer if we already have a polyline
          if (polyline.length > 1) {
            setRouteLayer(map, polyline);
          }
          setMapReady(true);
        });

        map.on('error', (e) => {
          console.warn('[NavigationMapShell] MapLibre error:', e.error?.message);
          if (!mapReady) setMapFailed(true);
        });
      } catch (e) {
        console.warn('[NavigationMapShell] mount error:', e.message);
        if (!cancelled) setMapFailed(true);
      }
    }

    mount();
    return () => {
      cancelled = true;
      destroyMap(mapInstanceRef.current);
      mapInstanceRef.current = null;
      vehicleMarkerRef.current = null;
      setMapReady(false);
    };
    // Only re-mount when the container/polyline identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update route layer when polyline changes ──────────────────────────────
  useEffect(() => {
    if (mapReady && mapInstanceRef.current && polyline.length > 1) {
      setRouteLayer(mapInstanceRef.current, polyline);
    }
  }, [mapReady, polyline]);

  // ── SVG fallback animation ────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady) return; // MapLibre handles rendering
    animTimerRef.current = setInterval(() => {
      setAnimOffset((p) => (p - 2) % 40);
    }, 50);
    return () => clearInterval(animTimerRef.current);
  }, [mapReady]);

  // ── Simulated GPS progress ────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(simTimerRef.current);
    if (isActive && polyline.length > 1) {
      simTimerRef.current = setInterval(() => {
        setSimProgress((p) => {
          const next = Math.min(1, p + 0.004);
          return next;
        });
      }, SIM_STEP_MS);
    }
    return () => clearInterval(simTimerRef.current);
  }, [isActive, polyline.length]);

  // ── MapLibre vehicle follow-cam ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mlRef.current) return;
    if (polyline.length < 2) return;

    const idx = Math.min(
      Math.floor(simProgress * (polyline.length - 1)),
      polyline.length - 2,
    );
    const t = simProgress * (polyline.length - 1) - idx;
    const [lat1, lng1] = polyline[idx];
    const [lat2, lng2] = polyline[idx + 1] || polyline[idx];
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;

    // Bearing from current to next point
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    const bearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;

    moveVehicleMarker(mapInstanceRef.current, mlRef.current, vehicleMarkerRef, lat, lng, bearing);
    if (isActive) followCamera(mapInstanceRef.current, lat, lng, bearing);
  }, [simProgress, mapReady, polyline, isActive]);

  // ── Computed display values ───────────────────────────────────────────────
  const instructions   = route?.instructions || [];
  const currentIdx     = Math.floor(simProgress * Math.max(instructions.length - 1, 0));
  const currentIns     = instructions[currentIdx] || null;
  const instructionText = currentIns?.text || navigation.currentInstruction || 'Follow the highlighted route.';

  const totalDistM  = route?.distanceM  || navigation.remainingDistanceM;
  const totalDurMs  = route?.durationMs || navigation.remainingDurationMs;
  const remainDistM = totalDistM ? totalDistM * (1 - simProgress) : null;
  const remainDurMs = totalDurMs ? totalDurMs * (1 - simProgress) : null;

  const gpsConf  = navigation.gpsConfidence || 0;
  const markerPos = getMarkerPos(svgPoints, simProgress);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="navShell">

      {/* ── MapLibre container (always mounted so the ref is available) ── */}
      <div
        ref={mapContainerRef}
        className="maplibreContainer"
        style={{ display: mapReady && !mapFailed ? 'block' : 'none' }}
        aria-hidden={!mapReady || mapFailed}
      />

      {/* ── SVG fallback shell (shown while MapLibre loads or if it fails) */}
      {(!mapReady || mapFailed) && (
        <div className="fakeMap3d">
          <div className="mapSkyline" />

          <svg
            className="routeSvg"
            viewBox="0 0 420 520"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={displayPath} className="routeShadow" />
            <path
              d={displayPath}
              className="routeLine"
              style={{ strokeDashoffset: animOffset }}
            />
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

          {/* SVG vehicle marker */}
          <div
            className="vehicleMarker"
            style={
              markerPos
                ? { left: markerPos.x, top: markerPos.y, bottom: 'auto',
                    position: 'absolute', translate: '-50% -50%' }
                : {}
            }
          >
            <Navigation size={26} />
          </div>

          {/* Restriction pin */}
          <div className="restrictionPin" style={{ top: '32%', right: '18%' }}>
            <TriangleAlert size={16} /> Low bridge
          </div>
        </div>
      )}

      {/* ── Map loading indicator ─────────────────────────────────────── */}
      {!mapReady && !mapFailed && (
        <div className="mapLoadingOverlay">
          <span className="mapLoadingDot" />
          Loading MapLibre map…
        </div>
      )}

      {/* ── Map provider badge (shared between both render modes) ─────── */}
      <div className="mapBadge topLeft" style={{ zIndex: 10 }}>
        <Layers size={12} style={{ marginRight: 4, display: 'inline' }} />
        {mapReady && !mapFailed ? 'MapLibre GL' : mapFailed ? '⚠ SVG shell' : 'Loading map…'}
        {isDemo && ' · demo route'}
      </div>

      <div className="mapBadge topRight" style={{ display: 'flex', gap: 6, alignItems: 'center', zIndex: 10 }}>
        {gpsConf >= 70 ? <Satellite size={13} /> : <WifiOff size={13} />}
        GPS {gpsConf}%
      </div>

      {isActive && remainDistM != null && (
        <div className="mapBadge" style={{ top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          {formatDistance(remainDistM)} remaining
        </div>
      )}

      {isPaused && (
        <div className="mapBadge" style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10,
          background: 'rgba(255,176,32,.18)', borderColor: 'rgba(255,176,32,.45)',
          color: 'var(--warning)', fontSize: 16, padding: '12px 20px',
        }}>
          ⏸ Navigation paused
        </div>
      )}

      {compliance?.score != null && (
        <div className="mapBadge" style={{ bottom: 88, left: 18, zIndex: 10 }}>
          <span style={{ color: scoreColor(compliance.score), fontWeight: 800 }}>
            {compliance.score}%
          </span>
          {' '}confidence
        </div>
      )}

      <div className="mapBadge" style={{ bottom: 88, right: 18, zIndex: 10 }}>
        {navigator.onLine
          ? <><Wifi size={12} /> Online</>
          : <><WifiOff size={12} /> Offline</>}
      </div>

      {/* ── Instruction card ──────────────────────────────────────────── */}
      <div className="navInstructionCard">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow">
            {navigation.status === 'active'  ? 'Active navigation' :
             navigation.status === 'paused'  ? 'Paused'            :
             navigation.status === 'stopped' ? 'Stopped'           :
             'Navigation ready'}
          </p>
          <h2 style={{ fontSize: 'clamp(14px, 2.2vw, 20px)', marginBottom: 4, lineHeight: 1.2 }}>
            {instructionText}
          </h2>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
            {remainDistM != null && (
              <span>
                <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />
                {formatDistance(remainDistM)}
              </span>
            )}
            {remainDurMs != null && (
              <span>
                <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                {formatDuration(remainDurMs)}
              </span>
            )}
            {remainDurMs != null && <span>ETA {formatETA(remainDurMs)}</span>}
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
            style={{ padding: 10 }}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="ghost" style={{ padding: 10 }} title="Reroute">
            <RefreshCw size={18} />
          </button>
          <button className="dangerButton" onClick={onStop} style={{ padding: '10px 16px' }}>
            <Square size={16} /> Stop
          </button>
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

function getMarkerPos(svgPoints, progress) {
  if (!svgPoints || svgPoints.length < 2) return null;
  const idx = Math.min(Math.floor(progress * (svgPoints.length - 1)), svgPoints.length - 2);
  const t = progress * (svgPoints.length - 1) - idx;
  const [x1, y1] = svgPoints[idx];
  const [x2, y2] = svgPoints[idx + 1];
  return { x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t };
}

function getTravelledPath(svgPoints, progress, fallback) {
  if (!svgPoints || svgPoints.length < 2) return fallback;
  const cutIdx = Math.floor(progress * svgPoints.length);
  const subset = svgPoints.slice(0, Math.max(2, cutIdx));
  return svgPointsToPath(subset);
}

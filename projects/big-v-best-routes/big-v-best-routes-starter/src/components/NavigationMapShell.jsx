/**
 * NavigationMapShell.jsx — MapLibre GL JS 3D Navigation Map
 * Big V's Best Routes
 *
 * Rendering strategy:
 *  1. Reads map style URL from mapConfig.js (VITE_MAP_STYLE_URL env var).
 *  2. If style URL is missing → shows product-grade setup-required state.
 *  3. If MapLibre loads but fails at runtime → shows error state.
 *  4. If no map style is configured → never pretends map is working.
 *
 * MapLibre calls are isolated in mapLibreAdapter.js.
 * This component never imports maplibre-gl directly.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Navigation, TriangleAlert, Volume2, VolumeX, RefreshCw,
  Square, Wifi, WifiOff, Satellite, Clock, MapPin, Layers,
  AlertCircle, Settings2,
} from 'lucide-react';
import {
  loadMapLibre, createMap, setRouteLayer,
  moveVehicleMarker, followCamera, destroyMap,
} from '../core/mapLibreAdapter.js';
import {
  MAP_STYLE_CONFIGURED, MAP_STYLE_URL, MAP_STYLE_IS_FALLBACK,
  MAP_DEFAULTS, NAV_CAMERA, OVERVIEW_CAMERA, MAP_LAYER_IDS,
} from '../config/mapConfig.js';
import { polylineToSvgPoints, svgPointsToPath } from '../utils/polyline.js';
import { formatDistance, formatDuration, formatETA } from '../utils/formatters.js';
import { interpolateAlongPolyline } from '../utils/geo.js';

const SIM_STEP_MS = 1800;
const SIM_STEP_SIZE = 0.004;

export default function NavigationMapShell({
  navigation, vehicle, routeResult, compliance, onStop, onPause, onResume,
}) {
  const mapContainerRef  = useRef(null);
  const mapInstanceRef   = useRef(null);
  const mlRef            = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const simTimerRef      = useRef(null);
  const animTimerRef     = useRef(null);

  const [mapReady,     setMapReady]     = useState(false);
  const [mapFailed,    setMapFailed]    = useState(false);
  const [mapError,     setMapError]     = useState(null);
  const [voiceOn,      setVoiceOn]      = useState(navigation.voiceEnabled ?? false);
  const [animOffset,   setAnimOffset]   = useState(0);
  const [simProgress,  setSimProgress]  = useState(0);

  const isActive  = navigation.status === 'active';
  const isPaused  = navigation.status === 'paused';
  const route     = routeResult?.route;
  const polyline  = route?.polyline || [];

  // Is this a dev-fallback route? (product mode should always flag this)
  const isDevFallback = !!(routeResult?.demoMode || routeResult?.devFallback);

  // SVG fallback data (used when MapLibre unavailable or not yet loaded)
  const svgPoints    = polylineToSvgPoints(polyline, 420, 520, 24);
  const routeSvgPath = svgPointsToPath(svgPoints);
  const fallbackSvgPath = 'M210 500 C190 400 270 360 245 280 C220 200 140 180 178 115 C212 60 300 46 286 10';
  const displaySvgPath  = routeSvgPath || fallbackSvgPath;

  // ── MapLibre mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function mount() {
      if (!mapContainerRef.current) return;

      const ml = await loadMapLibre();
      if (!ml || cancelled) { setMapFailed(true); setMapError('MapLibre GL JS failed to load.'); return; }
      mlRef.current = ml;

      const startCenter = polyline[0]
        ? [polyline[0][1], polyline[0][0]]  // [lng, lat]
        : MAP_DEFAULTS.center;

      const map = await createMap(mapContainerRef.current, {
        style:  MAP_STYLE_URL,
        center: startCenter,
        zoom:   polyline.length > 1 ? NAV_CAMERA.zoom : MAP_DEFAULTS.zoom,
        pitch:  NAV_CAMERA.pitch,
      });

      if (!map || cancelled) { setMapFailed(true); setMapError('Map failed to initialise.'); return; }
      mapInstanceRef.current = map;

      map.on('load', () => {
        if (cancelled) return;
        if (polyline.length > 1) setRouteLayer(map, polyline);
        setMapReady(true);
        setMapError(null);
      });

      map.on('error', (e) => {
        const msg = e.error?.message || 'Unknown map error.';
        console.warn('[NavigationMapShell] MapLibre error:', msg);
        if (!mapReady) { setMapFailed(true); setMapError(msg); }
      });
    }

    mount();

    return () => {
      cancelled = true;
      clearInterval(simTimerRef.current);
      clearInterval(animTimerRef.current);
      destroyMap(mapInstanceRef.current);
      mapInstanceRef.current   = null;
      vehicleMarkerRef.current = null;
      setMapReady(false);
    };
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
    if (mapReady) return;
    animTimerRef.current = setInterval(() => {
      setAnimOffset((p) => (p - 2) % 40);
    }, 50);
    return () => clearInterval(animTimerRef.current);
  }, [mapReady]);

  // ── Simulated GPS progress (used when real GPS not available) ────────────
  useEffect(() => {
    clearInterval(simTimerRef.current);
    if (isActive && polyline.length > 1 && navigation.gpsStatus !== 'real') {
      simTimerRef.current = setInterval(() => {
        setSimProgress((p) => Math.min(1, p + SIM_STEP_SIZE));
      }, SIM_STEP_MS);
    }
    return () => clearInterval(simTimerRef.current);
  }, [isActive, polyline.length, navigation.gpsStatus]);

  // Reset progress when navigation stops/restarts
  useEffect(() => {
    if (!isActive && !isPaused) setSimProgress(0);
  }, [isActive, isPaused]);

  // ── MapLibre vehicle follow-camera ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mlRef.current) return;
    if (polyline.length < 2) return;

    // Use real GPS if available, otherwise simulation
    let pos;
    if (navigation.gpsStatus === 'real' && navigation.currentLat && navigation.currentLon) {
      pos = { lat: navigation.currentLat, lon: navigation.currentLon, bearing: navigation.currentHeading || 0 };
    } else {
      pos = interpolateAlongPolyline(polyline, simProgress);
    }
    if (!pos) return;

    moveVehicleMarker(mapInstanceRef.current, mlRef.current, vehicleMarkerRef, pos.lat, pos.lon, pos.bearing);
    if (isActive) followCamera(mapInstanceRef.current, pos.lat, pos.lon, pos.bearing);
  }, [simProgress, navigation.currentLat, navigation.currentLon, mapReady, polyline, isActive]);

  // ── Derived display values ────────────────────────────────────────────────
  const progress = navigation.gpsStatus === 'real'
    ? (navigation.progressFraction ?? simProgress)
    : simProgress;

  const instructions   = route?.instructions || [];
  const instrIdx       = Math.floor(progress * Math.max(instructions.length - 1, 0));
  const currentInstr   = instructions[instrIdx] || null;
  const instructionText = currentInstr?.text || navigation.currentInstruction || 'Follow the highlighted route.';

  const totalDistM  = route?.distanceM  || navigation.remainingDistanceM;
  const totalDurMs  = route?.durationMs || navigation.remainingDurationMs;
  const remainDistM = totalDistM ? totalDistM * (1 - progress) : null;
  const remainDurMs = totalDurMs ? totalDurMs * (1 - progress) : null;

  const gpsConf     = navigation.gpsConfidence || 0;
  const gpsIsReal   = navigation.gpsStatus === 'real';
  const svgMarker   = getMarkerPos(svgPoints, progress);

  // ── Render: map style not configured ─────────────────────────────────────
  if (!MAP_STYLE_CONFIGURED) {
    return (
      <section className="navShell">
        <div className="mapSetupRequired">
          <AlertCircle size={40} style={{ color: 'var(--warning)', marginBottom: 14 }} />
          <h3>Map style not configured</h3>
          <p>
            Set <code>VITE_MAP_STYLE_URL</code> in your <code>.env</code> file to enable the navigation map.
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
            Options: MapTiler, Stadia Maps, or any MapLibre GL-compatible style URL.
          </p>
          <a
            href="https://maplibre.org/maplibre-gl-js/docs/"
            target="_blank"
            rel="noreferrer"
            className="ghost"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14 }}
          >
            <Settings2 size={14} /> MapLibre setup guide
          </a>
          {/* Still show route info and controls even without map */}
          <div style={{ marginTop: 20, width: '100%', maxWidth: 420 }}>
            <NavInfoStrip route={route} remainDistM={remainDistM} remainDurMs={remainDurMs} instructionText={instructionText} compliance={compliance} />
          </div>
        </div>
        <NavInstructionCard
          navigation={navigation} vehicle={vehicle}
          remainDistM={remainDistM} remainDurMs={remainDurMs}
          instructionText={instructionText} isDevFallback={isDevFallback}
          voiceOn={voiceOn} setVoiceOn={setVoiceOn}
          onStop={onStop}
        />
      </section>
    );
  }

  // ── Render: full map with SVG fallback ────────────────────────────────────
  return (
    <section className="navShell">

      {/* MapLibre real map container */}
      <div
        ref={mapContainerRef}
        className="maplibreContainer"
        style={{ display: mapReady && !mapFailed ? 'block' : 'none' }}
        aria-hidden={!mapReady || mapFailed}
      />

      {/* SVG animated fallback — shown while MapLibre loads or on failure */}
      {(!mapReady || mapFailed) && (
        <div className="fakeMap3d">
          <div className="mapSkyline" />
          <svg className="routeSvg" viewBox="0 0 420 520" preserveAspectRatio="none" aria-hidden="true">
            <path d={displaySvgPath} className="routeShadow" />
            <path d={displaySvgPath} className="routeLine" style={{ strokeDashoffset: animOffset }} />
            {progress > 0.02 && (
              <path
                d={getTravelledSvgPath(svgPoints, progress, fallbackSvgPath)}
                stroke="rgba(58,242,124,0.25)" strokeWidth="10"
                fill="none" strokeLinecap="round"
              />
            )}
          </svg>
          <div
            className="vehicleMarker"
            style={svgMarker ? { left: svgMarker.x, top: svgMarker.y, bottom: 'auto', position: 'absolute', translate: '-50% -50%' } : {}}
          >
            <Navigation size={26} />
          </div>
          {mapFailed && mapError && (
            <div className="mapBadge" style={{ top: '45%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(220,53,69,.16)', borderColor: 'rgba(220,53,69,.4)', color: 'var(--danger)', maxWidth: 280, textAlign: 'center', fontSize: 12, zIndex: 10 }}>
              <AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />
              Map error: {mapError}
            </div>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {!mapReady && !mapFailed && (
        <div className="mapLoadingOverlay">
          <span className="mapLoadingDot" />
          Loading map…
        </div>
      )}

      {/* Dev fallback warning banner */}
      {isDevFallback && (
        <div className="mapBadge" style={{ top: 58, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,176,32,.25)', borderColor: 'rgba(255,176,32,.6)', color: 'var(--warning)', zIndex: 10, fontSize: 12 }}>
          ⚠ Dev fallback route — not product routing
        </div>
      )}

      {/* MapLibre dev-style fallback indicator */}
      {MAP_STYLE_IS_FALLBACK && mapReady && (
        <div className="mapBadge" style={{ top: 58, left: '50%', transform: 'translateX(-50%)', fontSize: 11, zIndex: 10, color: 'var(--warning)' }}>
          Dev map tiles — set VITE_MAP_STYLE_URL for production
        </div>
      )}

      {/* Map provider badge */}
      <div className="mapBadge topLeft" style={{ zIndex: 10 }}>
        <Layers size={12} style={{ marginRight: 4, display: 'inline' }} />
        {mapReady && !mapFailed ? 'MapLibre GL' : mapFailed ? '⚠ Map error' : 'Loading…'}
      </div>

      {/* GPS badge */}
      <div className="mapBadge topRight" style={{ display: 'flex', gap: 6, alignItems: 'center', zIndex: 10 }}>
        {gpsIsReal ? <Satellite size={13} /> : gpsConf >= 30 ? <Satellite size={13} style={{ opacity: 0.5 }} /> : <WifiOff size={13} />}
        {gpsIsReal ? `GPS ${gpsConf}%` : 'GPS: simulated'}
      </div>

      {/* Remaining distance badge */}
      {isActive && remainDistM != null && (
        <div className="mapBadge" style={{ top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          {formatDistance(remainDistM)} remaining
        </div>
      )}

      {/* Paused overlay */}
      {isPaused && (
        <div className="mapBadge" style={{
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10,
          background: 'rgba(255,176,32,.18)', borderColor: 'rgba(255,176,32,.45)',
          color: 'var(--warning)', fontSize: 16, padding: '12px 20px',
        }}>
          ⏸ Navigation paused
        </div>
      )}

      {/* Compliance confidence badge */}
      {compliance?.score != null && (
        <div className="mapBadge" style={{ bottom: 88, left: 18, zIndex: 10 }}>
          <span style={{ color: scoreColor(compliance.score), fontWeight: 800 }}>{compliance.score}%</span>
          {' '}confidence
        </div>
      )}

      {/* Online/offline badge */}
      <div className="mapBadge" style={{ bottom: 88, right: 18, zIndex: 10 }}>
        {navigator.onLine ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
      </div>

      {/* Instruction card */}
      <NavInstructionCard
        navigation={navigation} vehicle={vehicle}
        remainDistM={remainDistM} remainDurMs={remainDurMs}
        instructionText={instructionText} isDevFallback={isDevFallback}
        voiceOn={voiceOn} setVoiceOn={setVoiceOn}
        onStop={onStop}
      />
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavInstructionCard({
  navigation, vehicle, remainDistM, remainDurMs,
  instructionText, isDevFallback, voiceOn, setVoiceOn, onStop,
}) {
  const isActive  = navigation.status === 'active';
  const isPaused  = navigation.status === 'paused';

  return (
    <div className="navInstructionCard">
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow">
          {navigation.status === 'active'  ? 'Active navigation' :
           navigation.status === 'paused'  ? 'Paused'            :
           navigation.status === 'stopped' ? 'Stopped'           :
           'Navigation ready'}
          {isDevFallback && <span style={{ color: 'var(--warning)', marginLeft: 8, fontSize: 12 }}>· dev route</span>}
        </p>
        <h2 style={{ fontSize: 'clamp(14px, 2.2vw, 20px)', marginBottom: 4, lineHeight: 1.2 }}>
          {instructionText}
        </h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
          {remainDistM != null && (
            <span><MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{formatDistance(remainDistM)}</span>
          )}
          {remainDurMs != null && (
            <span><Clock size={11} style={{ display: 'inline', marginRight: 3 }} />{formatDuration(remainDurMs)}</span>
          )}
          {remainDurMs != null && <span>ETA {formatETA(remainDurMs)}</span>}
          <span style={{ color: 'var(--green)' }}>
            {vehicle?.name || 'Vehicle'}{isActive ? ' 🔒' : ''}
          </span>
        </div>
      </div>

      <div className="navActions">
        <button className="ghost" onClick={() => setVoiceOn((v) => !v)} title={voiceOn ? 'Mute voice' : 'Enable voice'} style={{ padding: 10 }}>
          {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button className="ghost" style={{ padding: 10 }} title="Reroute (tap to request reroute)">
          <RefreshCw size={18} />
        </button>
        <button className="dangerButton" onClick={onStop} style={{ padding: '10px 16px' }}>
          <Square size={16} /> Stop
        </button>
      </div>
    </div>
  );
}

function NavInfoStrip({ route, remainDistM, remainDurMs, instructionText, compliance }) {
  if (!route) return null;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, background: 'rgba(0,0,0,.2)', fontSize: 13, color: 'var(--muted)' }}>
      <p style={{ marginBottom: 6, color: 'var(--fg)' }}>{instructionText}</p>
      {remainDistM != null && <p>{formatDistance(remainDistM)} remaining · ETA {formatETA(remainDurMs)}</p>}
      {compliance?.score != null && (
        <p style={{ color: scoreColor(compliance.score) }}>Compliance: {compliance.score}%</p>
      )}
    </div>
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

function getTravelledSvgPath(svgPoints, progress, fallback) {
  if (!svgPoints || svgPoints.length < 2) return fallback;
  const cutIdx = Math.floor(progress * svgPoints.length);
  const subset = svgPoints.slice(0, Math.max(2, cutIdx));
  return svgPointsToPath(subset);
}

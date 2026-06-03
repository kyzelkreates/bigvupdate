/**
 * NavigationMapShell.jsx — MapLibre GL JS 3D Navigation Map (v2.1)
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * GPS wiring: uses real GPS from SSOT (navigation.currentLat/Lon/Heading).
 * Falls back to simulated progress only when gpsStatus !== 'real'.
 * Reroute prompt, voice controls, off-route badge all wired.
 *
 * MapLibre calls isolated in mapLibreAdapter.js.
 * This component never imports maplibre-gl directly.
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Navigation, TriangleAlert, Volume2, VolumeX, RefreshCw,
  Square, Wifi, WifiOff, Satellite, Clock, MapPin, Layers,
  AlertCircle, Settings2, RotateCcw, Mic, ChevronUp, ChevronDown,
  ShieldAlert, CheckCircle, Repeat2,
} from 'lucide-react';
import {
  loadMapLibre, createMap, setRouteLayer, setStartEndMarkers, fitRouteBounds,
  moveVehicleMarker, followCamera, destroyMap,
} from '../core/mapLibreAdapter.js';
import {
  MAP_STYLE_CONFIGURED, MAP_STYLE_URL, MAP_STYLE_IS_FALLBACK,
  MAP_DEFAULTS, NAV_CAMERA, OVERVIEW_CAMERA, resolveMapStyle,
} from '../config/mapConfig.js';
import { polylineToSvgPoints, svgPointsToPath } from '../utils/polyline.js';
import { formatDistance, formatDuration, formatETA } from '../utils/formatters.js';
import { interpolateAlongPolyline } from '../utils/geo.js';
import { REROUTE_STATUS } from '../services/rerouteService.js';

const SIM_STEP_MS   = 1800;
const SIM_STEP_SIZE = 0.004;

export default function NavigationMapShell({
  navigation, vehicle, routeResult, compliance,
  onStop, onPause, onResume,
  onRerouteConfirm, onRerouteAccept, onRerouteDecline,
  onToggleVoice, onToggleMute, onRepeatInstruction,
}) {
  const mapContainerRef  = useRef(null);
  const mapInstanceRef   = useRef(null);
  const mlRef            = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const startMarkerRef   = useRef(null);
  const endMarkerRef     = useRef(null);
  const simTimerRef      = useRef(null);
  const animTimerRef     = useRef(null);
  const userPannedRef    = useRef(false);
  const recenterTimerRef = useRef(null);

  const [mapReady,      setMapReady]      = useState(false);
  const [mapFailed,     setMapFailed]     = useState(false);
  const [mapError,      setMapError]      = useState(null);
  const [animOffset,    setAnimOffset]    = useState(0);
  const [simProgress,   setSimProgress]   = useState(0);
  const [showWarnings,  setShowWarnings]  = useState(false);
  const [osmFallback,   setOsmFallback]   = useState(false);  // true when using OSM raster tiles

  const isActive   = navigation.status === 'active';
  const isPaused   = navigation.status === 'paused';
  const isRerouting = navigation.status === 'rerouting';
  const route      = routeResult?.route;
  const polyline   = route?.polyline || [];
  const isDevFallback = !!(routeResult?.demoMode || routeResult?.devFallback);

  // Voice state from SSOT
  const voice     = navigation.voice || { enabled: false, muted: false, supported: false };
  const voiceOn   = voice.enabled && !voice.muted;

  // Reroute state from SSOT
  const reroute   = navigation.reroute || {};
  const rerouteStatus = reroute.status || REROUTE_STATUS.IDLE;

  // GPS state
  const gpsIsReal  = navigation.gpsStatus === 'real';
  const gpsConf    = navigation.gpsConfidence || 0;
  const gpsIsStale = navigation.gpsIsStale || false;

  // SVG fallback
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
      const startCenter = polyline[0] ? [polyline[0][1], polyline[0][0]] : MAP_DEFAULTS.center;
      // Resolve style: uses VITE_MAP_STYLE_URL if set, else OSM raster (no key needed)
      const customTileUrl = null; // serviceConfig?.mapping?.osmTileUrl if passed in future
      const { style: resolvedStyle, isOsmFallback: usingOsmFallback } = resolveMapStyle(customTileUrl);
      if (!cancelled) setOsmFallback(usingOsmFallback);

      const map = await createMap(mapContainerRef.current, {
        style:  resolvedStyle,
        center: startCenter,
        zoom:   polyline.length > 1 ? 13 : MAP_DEFAULTS.zoom,
        pitch:  polyline.length > 1 ? 20 : NAV_CAMERA.pitch,  // flat overview on load; 3D when navigating
      });
      if (!map || cancelled) { setMapFailed(true); setMapError('Map failed to initialise.'); return; }
      mapInstanceRef.current = map;

      // Track manual pan to suppress aggressive recentering
      map.on('dragstart', () => {
        userPannedRef.current = true;
        clearTimeout(recenterTimerRef.current);
        // Auto-resume follow-cam after 8s inactivity
        recenterTimerRef.current = setTimeout(() => { userPannedRef.current = false; }, 8000);
      });

      map.on('load', () => {
        if (cancelled) return;
        if (polyline.length > 1) {
          setRouteLayer(map, polyline);
          setStartEndMarkers(map, mlRef.current, polyline, { start: startMarkerRef, end: endMarkerRef });
          // Fit to full route bounds on initial load (flat view for overview)
          fitRouteBounds(map, polyline, { pitch: 20, padding: 60, duration: 1200 });
        }
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
      clearTimeout(recenterTimerRef.current);
      destroyMap(mapInstanceRef.current);
      mapInstanceRef.current   = null;
      vehicleMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);  // eslint-disable-line

  // ── Update route layer when polyline changes ──────────────────────────────
  useEffect(() => {
    if (mapReady && mapInstanceRef.current && polyline.length > 1) {
      setRouteLayer(mapInstanceRef.current, polyline);
      setStartEndMarkers(mapInstanceRef.current, mlRef.current, polyline, { start: startMarkerRef, end: endMarkerRef });
      fitRouteBounds(mapInstanceRef.current, polyline, { pitch: 20, padding: 60, duration: 1000 });
    }
  }, [mapReady, polyline.length]);  // eslint-disable-line

  // ── SVG fallback animation ────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady) return;
    animTimerRef.current = setInterval(() => { setAnimOffset((p) => (p - 2) % 40); }, 50);
    return () => clearInterval(animTimerRef.current);
  }, [mapReady]);

  // ── Simulated GPS progress (only when real GPS unavailable) ──────────────
  useEffect(() => {
    clearInterval(simTimerRef.current);
    if (isActive && polyline.length > 1 && !gpsIsReal) {
      simTimerRef.current = setInterval(() => {
        setSimProgress((p) => Math.min(1, p + SIM_STEP_SIZE));
      }, SIM_STEP_MS);
    }
    return () => clearInterval(simTimerRef.current);
  }, [isActive, polyline.length, gpsIsReal]);

  // Reset simulation when navigation restarts
  useEffect(() => {
    if (!isActive && !isPaused) setSimProgress(0);
  }, [isActive, isPaused]);

  // ── MapLibre vehicle follow-camera ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !mlRef.current) return;
    if (polyline.length < 2) return;

    let pos;
    if (gpsIsReal && navigation.currentLat && navigation.currentLon) {
      pos = {
        lat:     navigation.currentLat,
        lon:     navigation.currentLon,
        bearing: navigation.currentHeading || 0,
      };
    } else {
      pos = interpolateAlongPolyline(polyline, simProgress);
    }
    if (!pos) return;

    moveVehicleMarker(mapInstanceRef.current, mlRef.current, vehicleMarkerRef, pos.lat, pos.lon, pos.bearing);
    // Only follow if user hasn't manually panned
    if (isActive && !userPannedRef.current) {
      followCamera(mapInstanceRef.current, pos.lat, pos.lon, pos.bearing);
    }
  }, [simProgress, navigation.currentLat, navigation.currentLon, navigation.currentHeading, mapReady, polyline, isActive, gpsIsReal]);

  // Manual recenter handler
  const handleRecenter = useCallback(() => {
    userPannedRef.current = false;
    if (!mapReady || !mapInstanceRef.current) return;
    const pos = gpsIsReal && navigation.currentLat
      ? { lat: navigation.currentLat, lon: navigation.currentLon, bearing: navigation.currentHeading || 0 }
      : interpolateAlongPolyline(polyline, simProgress);
    if (pos) followCamera(mapInstanceRef.current, pos.lat, pos.lon, pos.bearing);
  }, [mapReady, gpsIsReal, navigation.currentLat, navigation.currentLon, navigation.currentHeading, polyline, simProgress]);

  // ── Derived display values ────────────────────────────────────────────────
  // Prefer SSOT progress values (from routeProgressEngine) over simulated
  const remainDistM  = navigation.remainingDistanceM  ?? (route?.distanceM  ? route.distanceM  * (1 - simProgress) : null);
  const remainDurMs  = navigation.remainingDurationMs ?? (route?.durationMs ? route.durationMs * (1 - simProgress) : null);

  const instrText = navigation.currentInstruction
    || (route?.instructions?.[0]?.text)
    || 'Follow the highlighted route.';
  const distToNext = navigation.distanceToNextInstructionM;

  const svgMarker = getMarkerPos(svgPoints, gpsIsReal ? (navigation.progressFraction ?? simProgress) : simProgress);
  const progress  = gpsIsReal ? (navigation.progressFraction ?? simProgress) : simProgress;

  const navWarnings = navigation.navigationWarnings || [];
  const isOffRoute  = navigation.offRouteStatus || false;

  // ── MAP_STYLE_CONFIGURED guard removed — OSM raster is always available ─────
  // The map always loads using resolveMapStyle() which falls back to OSM raster tiles.
  // osmFallback=true means we're using public OSM tiles — show a notice but don't block.

  // ── Full map render ────────────────────────────────────────────────────────
  return (
    <section className="navShell">

      {/* MapLibre real map container */}
      <div
        ref={mapContainerRef}
        className="maplibreContainer"
        style={{ display: mapReady && !mapFailed ? 'block' : 'none' }}
        aria-hidden={!mapReady || mapFailed}
      />

      {/* SVG animated fallback */}
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
            <div className="mapBadge" style={{ top: '45%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(220,53,69,.16)', borderColor: 'rgba(220,53,69,.4)', color: 'var(--danger)', maxWidth: 280, textAlign: 'center', fontSize: 12, zIndex: 10 }}>
              <AlertCircle size={13} style={{ display: 'inline', marginRight: 4 }} />
              Map error: {mapError}
            </div>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {!mapReady && !mapFailed && (
        <div className="mapLoadingOverlay">
          <span className="mapLoadingDot" />Loading map…
        </div>
      )}

      {/* Dev fallback banner */}
      {isDevFallback && (
        <div className="mapBadge" style={{ top: 58, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,176,32,.25)', borderColor: 'rgba(255,176,32,.6)', color: 'var(--warning)', zIndex: 10, fontSize: 12 }}>
          ⚠ Dev fallback route — not product routing
        </div>
      )}

      {/* OSM raster fallback notice */}
      {osmFallback && mapReady && (
        <div className="mapBadge osmFallbackBadge" style={{ top: 58, left: '50%', transform: 'translateX(-50%)', fontSize: 11, zIndex: 10 }}>
          🗺 OSM public tiles · © OpenStreetMap contributors
        </div>
      )}

      {/* Map provider badge (top-left) */}
      <div className="mapBadge topLeft" style={{ zIndex: 10 }}>
        <Layers size={12} style={{ marginRight: 4, display: 'inline' }} />
        {mapReady && !mapFailed ? 'MapLibre GL' : mapFailed ? '⚠ Map error' : 'Loading…'}
      </div>

      {/* GPS badge (top-right) */}
      <div className={`mapBadge topRight ${gpsIsStale ? 'staleBadge' : ''}`} style={{ display: 'flex', gap: 6, alignItems: 'center', zIndex: 10 }}>
        {gpsIsReal
          ? <Satellite size={13} style={{ color: gpsConf >= 70 ? 'var(--green)' : 'var(--warning)' }} />
          : <WifiOff size={13} style={{ opacity: 0.5 }} />
        }
        {gpsIsReal
          ? `GPS ${gpsConf}%${gpsIsStale ? ' ⚠ stale' : ''}`
          : navigation.locationPermission === 'denied'
            ? 'GPS denied'
            : 'GPS: simulated'
        }
      </div>

      {/* GPS accuracy badge */}
      {gpsIsReal && navigation.gpsAccuracy != null && (
        <div className="mapBadge" style={{ top: 50, right: 18, fontSize: 11, zIndex: 10, color: 'var(--muted)' }}>
          ±{Math.round(navigation.gpsAccuracy)}m
        </div>
      )}

      {/* Speed badge */}
      {gpsIsReal && navigation.gpsSpeedKph != null && navigation.gpsSpeedKph > 2 && (
        <div className="mapBadge" style={{ top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontWeight: 700, fontSize: 15 }}>
          {navigation.gpsSpeedKph} km/h
        </div>
      )}

      {/* Remaining distance (when not showing speed) */}
      {isActive && remainDistM != null && !(navigation.gpsSpeedKph > 2) && (
        <div className="mapBadge" style={{ top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          {formatDistance(remainDistM)} remaining
        </div>
      )}

      {/* OFF-ROUTE badge */}
      {isOffRoute && (
        <div className="mapBadge offRouteBadge" style={{ top: '35%', left: '50%', transform: 'translateX(-50%)', zIndex: 20, padding: '10px 18px', fontSize: 14, fontWeight: 700 }}>
          <TriangleAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
          Off route — {Math.round(navigation.offRouteDistanceM)}m
        </div>
      )}

      {/* Paused overlay */}
      {isPaused && (
        <div className="mapBadge" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, background: 'rgba(255,176,32,.18)', borderColor: 'rgba(255,176,32,.45)', color: 'var(--warning)', fontSize: 16, padding: '12px 20px' }}>
          ⏸ Navigation paused
        </div>
      )}

      {/* GPS permission denied notice */}
      {navigation.locationPermission === 'denied' && (
        <div className="mapBadge" style={{ bottom: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(220,53,69,.12)', borderColor: 'rgba(220,53,69,.4)', color: 'var(--danger)', maxWidth: 300, textAlign: 'center', fontSize: 12 }}>
          GPS permission denied. Route planning works without GPS. Enable location in browser settings for live navigation.
        </div>
      )}

      {/* Compliance confidence badge */}
      {compliance?.score != null && (
        <div className="mapBadge" style={{ bottom: 96, left: 18, zIndex: 10 }}>
          <span style={{ color: scoreColor(compliance.score), fontWeight: 800 }}>{compliance.score}%</span>
          {' '}advisory
        </div>
      )}

      {/* Online/offline badge */}
      <div className="mapBadge" style={{ bottom: 96, right: 18, zIndex: 10 }}>
        {navigator.onLine ? <><Wifi size={12} /> Online</> : <><WifiOff size={12} /> Offline</>}
      </div>

      {/* Recenter button */}
      {mapReady && isActive && (
        <button
          className="mapRecenterBtn"
          onClick={handleRecenter}
          title="Recenter map on vehicle"
          style={{ position: 'absolute', bottom: 96, right: 80, zIndex: 10 }}
        >
          <RotateCcw size={15} />
        </button>
      )}

      {/* Warnings drawer toggle */}
      {navWarnings.length > 0 && (
        <button
          className="mapBadge warningToggle"
          onClick={() => setShowWarnings((v) => !v)}
          style={{ bottom: 96, left: '50%', transform: 'translateX(-50%)', zIndex: 10, cursor: 'pointer', color: 'var(--warning)' }}
        >
          <TriangleAlert size={12} style={{ display: 'inline', marginRight: 4 }} />
          {navWarnings.length} warning{navWarnings.length !== 1 ? 's' : ''}
          {showWarnings ? <ChevronDown size={12} style={{ display: 'inline', marginLeft: 4 }} /> : <ChevronUp size={12} style={{ display: 'inline', marginLeft: 4 }} />}
        </button>
      )}

      {/* Warnings drawer */}
      {showWarnings && navWarnings.length > 0 && (
        <div className="navWarningsDrawer" style={{ zIndex: 15 }}>
          {navWarnings.map((w, i) => (
            <div key={w.id || i} className={`navWarningItem ${w.level}`}>
              <TriangleAlert size={12} style={{ flexShrink: 0 }} />
              <span>{w.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Reroute prompt ────────────────────────────────────────────── */}
      {(rerouteStatus === REROUTE_STATUS.PROMPT || rerouteStatus === REROUTE_STATUS.CALCULATING || rerouteStatus === REROUTE_STATUS.AWAITING_ACK || rerouteStatus === REROUTE_STATUS.ERROR) && (
        <ReroutePrompt
          reroute={reroute}
          onConfirm={onRerouteConfirm}
          onAccept={onRerouteAccept}
          onDecline={onRerouteDecline}
        />
      )}

      {/* ── Instruction card ──────────────────────────────────────────── */}
      <NavInstructionCard
        navigation={navigation} vehicle={vehicle}
        remainDistM={remainDistM} remainDurMs={remainDurMs}
        distToNext={distToNext}
        instructionText={instrText} isDevFallback={isDevFallback}
        voice={voice} onToggleVoice={onToggleVoice} onToggleMute={onToggleMute}
        onRepeatInstruction={onRepeatInstruction}
        onStop={onStop}
      />
    </section>
  );
}

// ─── Reroute prompt sub-component ─────────────────────────────────────────────

function ReroutePrompt({ reroute, onConfirm, onAccept, onDecline }) {
  const { status, proposedRoute, proposedCompliance, requiresAcknowledgement, error } = reroute;

  const isCalculating  = status === REROUTE_STATUS.CALCULATING;
  const isProposed     = status === REROUTE_STATUS.AWAITING_ACK;
  const isError        = status === REROUTE_STATUS.ERROR;
  const isPrompt       = status === REROUTE_STATUS.PROMPT;

  const isHighRisk = proposedCompliance?.status === 'high_risk' || (proposedCompliance?.score ?? 100) < 45;

  return (
    <div className="reroutePrompt" style={{ zIndex: 25 }}>
      {isPrompt && (
        <>
          <TriangleAlert size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Off route</strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '3px 0 10px' }}>
              You appear to be off the planned route. Request a new route?
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onConfirm}>
              <RefreshCw size={13} /> Reroute
            </button>
            <button className="ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={onDecline}>
              Stay
            </button>
          </div>
        </>
      )}

      {isCalculating && (
        <>
          <RefreshCw size={16} style={{ color: 'var(--green)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13 }}>Calculating new route…</span>
        </>
      )}

      {isProposed && proposedRoute && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            {isHighRisk
              ? <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />
              : <CheckCircle size={16} style={{ color: 'var(--green)' }} />
            }
            <strong style={{ fontSize: 14 }}>
              {isHighRisk ? '⚠ New route — high risk' : 'New route ready'}
            </strong>
          </div>
          {proposedCompliance && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Advisory score: {proposedCompliance.score}% · {proposedCompliance.status?.replaceAll('_', ' ')}
            </p>
          )}
          {isHighRisk && (
            <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>
              This route has high-risk compliance warnings. Review before accepting.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onAccept}>
              Accept new route
            </button>
            <button className="ghost" style={{ padding: '8px 12px', fontSize: 13 }} onClick={onDecline}>
              Keep current
            </button>
          </div>
        </div>
      )}

      {isError && (
        <>
          <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 13, color: 'var(--danger)' }}>Reroute failed</strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>{reroute.error?.message || 'Try again when online.'}</p>
          </div>
          <button className="ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={onDecline}>Dismiss</button>
        </>
      )}
    </div>
  );
}

// ─── Nav instruction card ─────────────────────────────────────────────────────

function NavInstructionCard({
  navigation, vehicle,
  remainDistM, remainDurMs, distToNext,
  instructionText, isDevFallback,
  voice, onToggleVoice, onToggleMute, onRepeatInstruction,
  onStop,
}) {
  const isActive  = navigation.status === 'active';
  const isPaused  = navigation.status === 'paused';
  const voiceOn   = voice?.enabled && !voice?.muted;

  return (
    <div className="navInstructionCard">
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow">
          {navigation.status === 'active'    ? 'Active navigation'  :
           navigation.status === 'rerouting' ? '↺ Rerouting…'       :
           navigation.status === 'paused'    ? 'Paused'             :
           navigation.status === 'stopped'   ? 'Stopped'            :
           'Navigation ready'}
          {isDevFallback && <span style={{ color: 'var(--warning)', marginLeft: 8, fontSize: 12 }}>· dev route</span>}
        </p>
        <h2 style={{ fontSize: 'clamp(14px, 2.2vw, 20px)', marginBottom: 4, lineHeight: 1.2 }}>
          {instructionText}
        </h2>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13 }}>
          {distToNext != null && (
            <span style={{ color: 'var(--fg)', fontWeight: 600 }}>
              In {formatDistance(distToNext)}
            </span>
          )}
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
        {/* Voice: repeat instruction */}
        {voice?.supported && (
          <button
            className="ghost"
            onClick={onRepeatInstruction}
            title="Repeat last instruction"
            style={{ padding: 10 }}
          >
            <Repeat2 size={17} />
          </button>
        )}
        {/* Voice: mute/unmute */}
        {voice?.supported && (
          <button
            className="ghost"
            onClick={onToggleMute}
            title={voice.muted ? 'Unmute voice' : 'Mute voice'}
            style={{ padding: 10 }}
          >
            {voice.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        )}
        {/* Voice: enable/disable */}
        {voice?.supported && (
          <button
            className={`ghost ${voice.enabled ? 'voiceEnabled' : ''}`}
            onClick={onToggleVoice}
            title={voice.enabled ? 'Disable voice guidance' : 'Enable voice guidance'}
            style={{ padding: 10, color: voice.enabled ? 'var(--green)' : 'var(--muted)' }}
          >
            <Mic size={16} />
          </button>
        )}
        <button
          className="dangerButton"
          onClick={onStop}
          style={{ padding: '10px 16px' }}
        >
          <Square size={16} /> Stop
        </button>
      </div>
    </div>
  );
}

// ─── Nav info strip (map-not-configured fallback) ────────────────────────────

function NavInfoStrip({ route, remainDistM, remainDurMs, instructionText, compliance }) {
  if (!route) return null;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, background: 'rgba(0,0,0,.2)', fontSize: 13, color: 'var(--muted)' }}>
      <p style={{ marginBottom: 6, color: 'var(--fg)' }}>{instructionText}</p>
      {remainDistM != null && <p>{formatDistance(remainDistM)} remaining · ETA {formatETA(remainDurMs)}</p>}
      {compliance?.score != null && <p style={{ color: scoreColor(compliance.score) }}>Advisory: {compliance.score}%</p>}
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

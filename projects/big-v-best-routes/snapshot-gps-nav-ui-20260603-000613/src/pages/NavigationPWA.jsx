/**
 * NavigationPWA.jsx — Full-screen driver navigation page
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 * Created by Kyzel Kreates — Part of the 4P3X Verse
 *
 * Hosts:
 *   - GpsStatusPanel     — GPS state, permissions, stats, manual Start/Stop
 *   - RouteProgressPanel — progress bar, off-route warning, reroute prompt
 *   - NavigationSafetyPanel — Compliance AI + GPS-aware safety notices
 *   - NavigationMapShell — MapLibre map with driver marker (existing)
 *
 * All state flows through SSOT (storage.js).
 * GPS is NOT started automatically — requires explicit user action.
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

import { useState } from 'react';
import { ShieldAlert, Wifi, WifiOff, MapPin, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

import NavigationMapShell    from '../components/NavigationMapShell.jsx';
import SafetyDisclaimer      from '../components/SafetyDisclaimer.jsx';
import GpsStatusPanel        from '../components/navigation/GpsStatusPanel.jsx';
import RouteProgressPanel    from '../components/navigation/RouteProgressPanel.jsx';
import NavigationSafetyPanel from '../components/navigation/NavigationSafetyPanel.jsx';

import { MAP_STYLE_CONFIGURED } from '../config/mapConfig.js';

// ─── Component ────────────────────────────────────────────────────────────────

export default function NavigationPWA({
  state, setState, onStop, onPause, onResume, onStart,
  onRerouteConfirm, onRerouteAccept, onRerouteDecline,
  onToggleVoice, onToggleMute, onRepeatInstruction,
  onStartGps, onStopGps,
  agents,
}) {
  const [showDisclaimer,     setShowDisclaimer]     = useState(!state.app.acceptedSafetyDisclaimer);
  const [showSafetyPanel,    setShowSafetyPanel]    = useState(false);
  const [showGpsDetails,     setShowGpsDetails]     = useState(false);

  const navigation    = state.navigation;
  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
  const navStatus     = navigation.status;
  const isActive      = navStatus === 'active';
  const isPaused      = navStatus === 'paused';
  const isRerouting   = navStatus === 'rerouting';
  const isStopped     = navStatus === 'stopped' || navStatus === 'notStarted';
  const hasRoute      = !!state.trip.lastRouteResult?.route;
  const routeIsReal   = hasRoute && !state.trip.lastRouteResult?.demoMode;
  const routeIsDevFallback = hasRoute && !!state.trip.lastRouteResult?.demoMode;
  const useMetric     = state.settings.useMetric !== false;
  const isNavigating  = isActive || isPaused || isRerouting;

  // ── Compliance AI — feed navigation status for GPS-aware warnings ──────────
  const complianceWithNav = state.compliance
    ? {
        ...state.compliance,
        // navigationStatus is read-only advisory data for the panel — not re-run here
        _navigationStatus: navigation,
      }
    : null;

  function acceptDisclaimer() {
    setShowDisclaimer(false);
    setState((draft) => { draft.app.acceptedSafetyDisclaimer = true; });
  }

  if (showDisclaimer) {
    return <SafetyDisclaimer onAccept={acceptDisclaimer} />;
  }

  const canStartNavigation = hasRoute && !isActive && !isPaused;

  // ── Off-route / safety alert level ────────────────────────────────────────
  const hasComplianceAlert = (state.compliance?.warnings || []).some((w) => w.level === 'danger');
  const isOffRoute         = navigation.offRouteStatus;

  return (
    <main className="navigationPage">

      {/* ── System warning banners (non-blocking) ────────────────────── */}
      {!hasRoute && !isActive && (
        <div className="statusBanner error">
          <ShieldAlert size={16} />
          No route calculated. Go to Trip Planning, enter an origin and destination, and calculate a route before navigating.
        </div>
      )}

      {state.trip.routeStatus === 'setup_required' && (
        <div className="statusBanner warning">
          <AlertTriangle size={16} />
          GraphHopper API key required. Go to Settings to configure your routing provider.
        </div>
      )}

      {routeIsDevFallback && (
        <div className="statusBanner demo">
          <AlertTriangle size={16} />
          Dev fallback route active (VITE_ENABLE_DEV_ROUTE_FALLBACK=true). Configure GraphHopper for real routing.
        </div>
      )}

      {!MAP_STYLE_CONFIGURED && (
        <div className="statusBanner warning" style={{ fontSize: 13 }}>
          <AlertTriangle size={15} />
          Map style not configured. Set <code>VITE_MAP_STYLE_URL</code> in <code>.env</code> for the full navigation map.
        </div>
      )}

      {/* ── Off-route alert (high-visibility, top of view) ───────────── */}
      {isOffRoute && isNavigating && (
        <div className="navOffRouteAlert" role="alert" aria-live="assertive">
          <AlertTriangle size={18} />
          <div>
            <strong>Off route</strong>
            {navigation.offRouteDistanceM != null && (
              <span> — {Math.round(navigation.offRouteDistanceM)}m from planned route</span>
            )}
            <div className="navOffRouteSubtext">
              Re-check route suitability before continuing.
            </div>
          </div>
        </div>
      )}

      {/* ── GPS Status Panel (collapsible when navigating) ───────────── */}
      <div className="navGpsPanelWrap">
        {isNavigating ? (
          <>
            <button
              type="button"
              className="navPanelToggle"
              onClick={() => setShowGpsDetails((v) => !v)}
              aria-expanded={showGpsDetails}
            >
              <GpsStatusPanel navigation={navigation} compact />
              {showGpsDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showGpsDetails && (
              <GpsStatusPanel
                navigation={navigation}
                onStartGps={onStartGps}
                onStopGps={onStopGps}
                isNavigating={isNavigating}
              />
            )}
          </>
        ) : (
          <GpsStatusPanel
            navigation={navigation}
            onStartGps={onStartGps}
            onStopGps={onStopGps}
            isNavigating={false}
          />
        )}
      </div>

      {/* ── Route Progress Panel (only during active/paused/rerouting) ── */}
      {isNavigating && (
        <RouteProgressPanel
          navigation={navigation}
          useMetric={useMetric}
          onRerouteConfirm={onRerouteConfirm}
          onRerouteAccept={onRerouteAccept}
          onRerouteDecline={onRerouteDecline}
        />
      )}

      {/* ── Navigation map shell (MapLibre — existing) ───────────────── */}
      <NavigationMapShell
        navigation={navigation}
        vehicle={activeVehicle}
        routeResult={state.trip.lastRouteResult}
        compliance={state.compliance}
        onStop={onStop}
        onPause={onPause}
        onResume={onResume}
        onRerouteConfirm={onRerouteConfirm}
        onRerouteAccept={onRerouteAccept}
        onRerouteDecline={onRerouteDecline}
        onToggleVoice={onToggleVoice}
        onToggleMute={onToggleMute}
        onRepeatInstruction={onRepeatInstruction}
      />

      {/* ── Navigation control bar ───────────────────────────────────── */}
      <div className="navControlBar">
        {isStopped && canStartNavigation && (
          <button className="primary large" onClick={onStart}>
            Start navigation — lock vehicle &amp; route
          </button>
        )}

        {isStopped && !canStartNavigation && (
          <button className="primary large" disabled>
            <MapPin size={15} /> Calculate a route first
          </button>
        )}

        {isActive && (
          <>
            <button className="ghost" onClick={onPause}>Pause</button>
            <button className="dangerButton" onClick={onStop}>Stop navigation</button>
          </>
        )}

        {isPaused && (
          <>
            <button className="primary" onClick={onResume}>Resume</button>
            <button className="dangerButton" onClick={onStop}>Stop navigation</button>
          </>
        )}

        {isRerouting && (
          <button className="ghost" onClick={onStop}>Cancel reroute &amp; stop</button>
        )}

        {/* Status badges */}
        <div className="navStatusBadges">
          <span className={`badge ${navigator.onLine ? 'green' : 'danger'}`}>
            {navigator.onLine
              ? <><Wifi size={11} /> Online</>
              : <><WifiOff size={11} /> Offline</>}
          </span>

          {navigation.gpsStatus === 'real' && navigation.gpsWatchActive && (
            <span className="badge green">📡 Live GPS</span>
          )}
          {navigation.gpsStatus === 'real' && !navigation.gpsWatchActive && (
            <span className="badge" style={{ color: 'var(--muted)', fontSize: 11 }}>GPS stopped</span>
          )}
          {navigation.locationPermission === 'denied' && (
            <span className="badge" style={{ color: 'var(--danger)', fontSize: 11 }}>GPS denied</span>
          )}
          {navigation.gpsStatus !== 'real' && navigation.locationPermission !== 'denied' && (
            <span className="badge" style={{ color: 'var(--muted)', fontSize: 11 }}>Simulated position</span>
          )}

          {routeIsReal        && <span className="badge green">GraphHopper route</span>}
          {routeIsDevFallback && <span className="badge" style={{ color: 'var(--warning)' }}>Dev route</span>}

          {isActive && navigation.lockedVehicleId && (
            <span className="badge danger">🔒 Vehicle locked</span>
          )}
        </div>
      </div>

      {/* ── Safety & Compliance AI panel (collapsible) ───────────────── */}
      <div className={`navSafetyWrap ${hasComplianceAlert ? 'safetyHasAlert' : ''}`}>
        <button
          type="button"
          className="navPanelToggle safetyToggle"
          onClick={() => setShowSafetyPanel((v) => !v)}
          aria-expanded={showSafetyPanel}
        >
          <span className="safetyToggleLabel">
            {hasComplianceAlert && <AlertTriangle size={13} style={{ color: 'var(--danger)' }} />}
            Safety &amp; Compliance AI
          </span>
          <NavigationSafetyPanel
            compliance={state.compliance}
            navigation={navigation}
            serviceConfig={state.serviceConfig}
            compact
          />
          {showSafetyPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showSafetyPanel && (
          <NavigationSafetyPanel
            compliance={state.compliance}
            navigation={navigation}
            serviceConfig={state.serviceConfig}
          />
        )}
      </div>

      {/* ── Advisory footer ──────────────────────────────────────────── */}
      <p className="navAdvisoryFooter">
        <strong>Big V's Best Routes™</strong> — Powered by <strong>4P3X Intelligent AI</strong>.
        Route guidance is advisory only. Drivers remain responsible for all road signs,
        legal restrictions, and vehicle suitability.
      </p>

    </main>
  );
}

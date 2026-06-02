/**
 * NavigationPWA.jsx — Full-screen driver navigation page
 * Big V's Best Routes
 *
 * This page owns the navigation layout.
 * NavigationMapShell owns the map rendering.
 * All session state flows through SSOT (storage.js).
 */

import { useState } from 'react';
import { ShieldAlert, Wifi, WifiOff, MapPin, AlertTriangle } from 'lucide-react';
import NavigationMapShell from '../components/NavigationMapShell.jsx';
import SafetyDisclaimer from '../components/SafetyDisclaimer.jsx';
import { MAP_STYLE_CONFIGURED } from '../config/mapConfig.js';

export default function NavigationPWA({
  state, setState, onStop, onPause, onResume, onStart,
  onRerouteConfirm, onRerouteAccept, onRerouteDecline,
  onToggleVoice, onToggleMute, onRepeatInstruction,
  agents,
}) {
  const [showDisclaimer, setShowDisclaimer] = useState(!state.app.acceptedSafetyDisclaimer);

  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
  const navStatus     = state.navigation.status;
  const isActive      = navStatus === 'active';
  const isPaused      = navStatus === 'paused';
  const isStopped     = navStatus === 'stopped' || navStatus === 'notStarted';
  const hasRoute      = !!state.trip.lastRouteResult?.route;
  const routeIsReal   = hasRoute && !state.trip.lastRouteResult?.demoMode;
  const routeIsDevFallback = hasRoute && !!state.trip.lastRouteResult?.demoMode;

  function acceptDisclaimer() {
    setShowDisclaimer(false);
    setState((draft) => { draft.app.acceptedSafetyDisclaimer = true; });
  }

  if (showDisclaimer) {
    return <SafetyDisclaimer onAccept={acceptDisclaimer} />;
  }

  // Start navigation requires: route exists, not a dev fallback (or user explicitly chooses to proceed)
  const canStartNavigation = hasRoute && !isActive && !isPaused;

  return (
    <main className="navigationPage">

      {/* ── No route warning ─────────────────────────────────────────── */}
      {!hasRoute && !isActive && (
        <div className="statusBanner error" style={{ margin: '0 0 12px 0' }}>
          <ShieldAlert size={16} />
          No route calculated. Go to Trip Planning, enter an origin and destination, and calculate a route before navigating.
        </div>
      )}

      {/* ── GraphHopper setup required ───────────────────────────────── */}
      {state.trip.routeStatus === 'setup_required' && (
        <div className="statusBanner warning" style={{ margin: '0 0 12px 0' }}>
          <AlertTriangle size={16} />
          GraphHopper API key required. Go to Settings to configure your routing provider.
        </div>
      )}

      {/* ── Dev fallback route warning ───────────────────────────────── */}
      {routeIsDevFallback && (
        <div className="statusBanner demo" style={{ margin: '0 0 12px 0' }}>
          <AlertTriangle size={16} />
          Dev fallback route active (VITE_ENABLE_DEV_ROUTE_FALLBACK=true). Configure GraphHopper for real routing.
        </div>
      )}

      {/* ── MapLibre setup required ──────────────────────────────────── */}
      {!MAP_STYLE_CONFIGURED && (
        <div className="statusBanner warning" style={{ margin: '0 0 8px 0', fontSize: 13 }}>
          <AlertTriangle size={15} />
          Map style not configured. Set <code>VITE_MAP_STYLE_URL</code> in <code>.env</code> for the full navigation map.
        </div>
      )}

      {/* ── Navigation map shell ─────────────────────────────────────── */}
      <NavigationMapShell
        navigation={state.navigation}
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
          <button className="primary" onClick={onStart}>
            Start navigation — lock vehicle &amp; route
          </button>
        )}

        {isStopped && !canStartNavigation && (
          <button className="primary" disabled>
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
            <button className="primary" onClick={onResume}>Resume navigation</button>
            <button className="dangerButton" onClick={onStop}>Stop navigation</button>
          </>
        )}

        {/* Status badges */}
        <div className="navStatusBadges">
          <span className={`badge ${navigator.onLine ? 'green' : 'danger'}`}>
            {navigator.onLine ? <><Wifi size={11} /> Online</> : <><WifiOff size={11} /> Offline</>}
          </span>

          {state.navigation.gpsStatus === 'real' && (
            <span className="badge green">Live GPS</span>
          )}
          {state.navigation.gpsStatus === 'simulated' && (
            <span className="badge" style={{ color: 'var(--muted)', fontSize: 11 }}>Simulated position</span>
          )}

          {routeIsReal && <span className="badge green">GraphHopper route</span>}
          {routeIsDevFallback && <span className="badge" style={{ color: 'var(--warning)' }}>Dev route</span>}

          {isActive && state.navigation.lockedVehicleId && (
            <span className="badge danger">🔒 Vehicle locked</span>
          )}
        </div>
      </div>
    </main>
  );
}

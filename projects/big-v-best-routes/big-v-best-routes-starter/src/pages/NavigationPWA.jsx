import NavigationMapShell from '../components/NavigationMapShell.jsx';
import SafetyDisclaimer from '../components/SafetyDisclaimer.jsx';
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';

export default function NavigationPWA({ state, setState }) {
  const [showDisclaimer, setShowDisclaimer] = useState(!state.app.acceptedSafetyDisclaimer);
  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
  const navStatus = state.navigation.status;
  const isActive = navStatus === 'active';

  function startNavigation() {
    setState((draft) => {
      draft.navigation.status = 'active';
      draft.navigation.active = true;
      draft.navigation.lockedVehicleId = draft.vehicle.activeVehicleId;
      draft.navigation.startedAt = new Date().toISOString();
      draft.navigation.gpsConfidence = 88;
      draft.navigation.simulatedMode = true;
      draft.navigation.currentInstruction = 'Follow the highlighted route. Prepare for next instruction.';
    });
  }

  function stopNavigation() {
    setState((draft) => {
      draft.navigation.status = 'stopped';
      draft.navigation.active = false;
      draft.navigation.lockedVehicleId = null;
      draft.navigation.startedAt = null;
      draft.navigation.currentInstruction = 'Navigation stopped. Vehicle profile can now be changed.';
    });
  }

  function pauseNavigation() {
    setState((draft) => {
      draft.navigation.status = 'paused';
    });
  }

  function resumeNavigation() {
    setState((draft) => {
      draft.navigation.status = 'active';
    });
  }

  function acceptDisclaimer() {
    setShowDisclaimer(false);
    setState((draft) => { draft.app.acceptedSafetyDisclaimer = true; });
  }

  if (showDisclaimer) {
    return <SafetyDisclaimer onAccept={acceptDisclaimer} />;
  }

  const hasRoute = !!state.trip.lastRouteResult?.route;
  const noRoute = !hasRoute && !isActive;

  return (
    <main className="navigationPage">
      {/* Pre-nav warning if no route */}
      {noRoute && (
        <div className="statusBanner demo" style={{ margin: '0 0 12px 0' }}>
          <ShieldAlert size={16} />
          No route calculated yet. Go to Trip Planning to calculate a route first.
        </div>
      )}

      <NavigationMapShell
        navigation={state.navigation}
        vehicle={activeVehicle}
        routeResult={state.trip.lastRouteResult}
        compliance={state.compliance}
        onStop={stopNavigation}
        onPause={pauseNavigation}
        onResume={resumeNavigation}
      />

      {/* Control bar below map */}
      <div className="navControlBar">
        {!isActive ? (
          <button className="primary" onClick={startNavigation}>
            Start navigation — lock vehicle
          </button>
        ) : (
          <>
            {navStatus === 'paused' ? (
              <button className="primary" onClick={resumeNavigation}>Resume navigation</button>
            ) : (
              <button className="ghost" onClick={pauseNavigation}>Pause</button>
            )}
            <button className="dangerButton" onClick={stopNavigation}>Stop navigation</button>
          </>
        )}

        <span className={`badge ${state.app.offlineReady ? 'green' : ''}`}>
          {state.app.offlineReady ? '✓ Offline ready' : 'PWA shell cached'}
        </span>
        <span className="badge purple">MapLibre-ready</span>
        {state.navigation.simulatedMode && (
          <span className="badge" style={{ color: 'var(--warning)' }}>Simulated GPS</span>
        )}
      </div>
    </main>
  );
}

import { useMemo, useState } from 'react';
import { Map, Route, ShieldCheck, Settings, BookMarked, RotateCcw } from 'lucide-react';
import PlannerDashboard from './pages/PlannerDashboard.jsx';
import NavigationPWA from './pages/NavigationPWA.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SavedTripsPage from './pages/SavedTripsPage.jsx';
import { loadState, resetState, updateState } from './core/storage.js';
import { runComplianceCheck } from './core/complianceEngine.js';
import { calculateRoute } from './services/graphhopperClient.js';
import { cacheTrip } from './services/offlineCache.js';
import {
  startSessionRecipe,
  stopSessionRecipe,
  pauseSessionRecipe,
  resumeSessionRecipe,
} from './services/navigationSessionService.js';
import './styles/app.css';

export default function App() {
  const [state, setRawState] = useState(loadState);
  const [routeLoading, setRouteLoading] = useState(false);

  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];

  function setState(recipe) {
    setRawState((current) => updateState(current, recipe));
  }

  function runCompliance() {
    setState((draft) => {
      const vehicle = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
      const routeResult = draft.trip.lastRouteResult;
      const result = runComplianceCheck({
        vehicle,
        trip: draft.trip,
        restrictions: draft.restrictions,
        routeResult,
      });
      draft.compliance = { ...draft.compliance, ...result };
    });
  }

  async function handleCalculateRoute() {
    if (routeLoading) return;
    setRouteLoading(true);
    setState((draft) => {
      draft.trip.routeStatus = 'loading';
      draft.trip.routeError  = null;
    });

    try {
      const result = await calculateRoute({
        origin:      state.trip.origin,
        destination: state.trip.destination,
        vehicle:     activeVehicle,
        apiKey:      state.settings.graphHopperApiKey,
        // forceDemo removed — use VITE_ENABLE_DEV_ROUTE_FALLBACK=true for dev fallback
      });

      setState((draft) => {
        draft.trip.lastRouteResult = result;

        if (result.setupRequired) {
          draft.trip.routeStatus = 'setup_required';
          draft.trip.routeError  = result.message;
        } else if (result.ok) {
          draft.trip.routeStatus = result.demoMode ? 'dev_fallback' : 'success';
          draft.trip.routeError  = result.demoMode ? result.message : null;
        } else {
          draft.trip.routeStatus = 'error';
          draft.trip.routeError  = result.message;
        }

        if (result.route) {
          draft.navigation.remainingDistanceM = result.route.distanceM;
          draft.navigation.remainingDurationMs = result.route.durationMs;
          if (result.route.instructions?.length) {
            draft.navigation.nextManoeuvre    = result.route.instructions[0];
            draft.navigation.distanceToNextM  = result.route.instructions[0].distanceM;
          }
        }

        // Auto-run compliance after every route calculation
        const vehicle = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
        const complianceResult = runComplianceCheck({
          vehicle,
          trip: draft.trip,
          restrictions: draft.restrictions,
          routeResult: result,
        });
        draft.compliance = { ...draft.compliance, ...complianceResult };
      });
    } catch (err) {
      setState((draft) => {
        draft.trip.routeStatus = 'error';
        draft.trip.routeError  = err.message || 'Unexpected error calculating route.';
      });
    } finally {
      setRouteLoading(false);
    }
  }

  function saveCurrentTrip() {
    const vehicle = activeVehicle;
    const routeResult = state.trip.lastRouteResult;
    const complianceResult = state.compliance;
    const entry = cacheTrip({
      origin: state.trip.origin,
      destination: state.trip.destination,
      vehicle,
      routeResult,
      complianceResult,
    });
    setState((draft) => {
      if (!draft.trip.savedTrips) draft.trip.savedTrips = [];
      draft.trip.savedTrips = [entry, ...draft.trip.savedTrips].slice(0, 20);
    });
  }

  function startNavigation() {
    setState(startSessionRecipe(state));
  }

  function stopNavigation() {
    setState(stopSessionRecipe());
  }

  function pauseNavigation() {
    setState(pauseSessionRecipe());
  }

  function resumeNavigation() {
    setState(resumeSessionRecipe());
  }

  const view = useMemo(() => state.app.mode, [state.app.mode]);
  const navLocked = state.navigation.status === 'active' || state.navigation.status === 'paused';
  const apiKeyConfigured = !!(state.settings.graphHopperApiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRAPHHOPPER_API_KEY));

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandIcon">BV</div>
          <div>
            <strong>Big V's Best Routes</strong>
            <span>Safety-first navigation OS</span>
          </div>
        </div>

        <nav>
          <button
            className={view === 'planner' ? 'active' : ''}
            onClick={() => setState((d) => { d.app.mode = 'planner'; })}
          >
            <Route size={18} /> Trip planning
          </button>
          <button
            className={view === 'navigation' ? 'active' : ''}
            onClick={() => setState((d) => { d.app.mode = 'navigation'; })}
          >
            <Map size={18} /> Navigation PWA
          </button>
          <button
            className={view === 'saved' ? 'active' : ''}
            onClick={() => setState((d) => { d.app.mode = 'saved'; })}
          >
            <BookMarked size={18} /> Saved trips
          </button>
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => setState((d) => { d.app.mode = 'settings'; })}
          >
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="sideCard">
          <span>Active vehicle</span>
          <strong>{activeVehicle?.name || '—'}</strong>
          <small>{(activeVehicle?.type || '').toUpperCase()} profile</small>
          {navLocked && <span className="badge danger" style={{ marginTop: 6 }}>🔒 Navigation active</span>}
        </div>

        <div className="sideCard" style={{ marginTop: 0 }}>
          <span>Compliance score</span>
          <strong style={{ color: scoreColor(state.compliance.score) }}>{state.compliance.score}%</strong>
          <small>{state.compliance.status?.replaceAll('_', ' ')}</small>
        </div>

        <button
          className="resetButton"
          onClick={() => {
            if (window.confirm('Reset all trip and vehicle data to defaults?')) {
              setRawState(resetState());
            }
          }}
        >
          <RotateCcw size={14} /> Reset app data
        </button>
      </aside>

      <section className="content">
        <header className="topBar">
          <div>
            <p className="eyebrow">Big V's Best Routes — Safety-First Navigation OS</p>
            <h1>
              {view === 'planner'    && 'Driver dashboard'}
              {view === 'navigation' && '3D navigation PWA'}
              {view === 'settings'   && 'Settings'}
              {view === 'saved'      && 'Saved trips'}
            </h1>
          </div>
          <div className="topBadges">
            <span className={`badge ${apiKeyConfigured ? 'green' : 'warning'}`}>
              {apiKeyConfigured ? 'GraphHopper configured' : '⚠ GraphHopper: setup required'}
            </span>
            <span className="badge purple">Compliance AI</span>
            <span className="badge">Local-first</span>
          </div>
        </header>

        {view === 'planner' && (
          <PlannerDashboard
            state={state}
            setState={setState}
            runCompliance={runCompliance}
            calculateRoute={handleCalculateRoute}
            routeLoading={routeLoading}
            saveCurrentTrip={saveCurrentTrip}
            startNavigation={startNavigation}
          />
        )}
        {view === 'navigation' && (
          <NavigationPWA
            state={state}
            setState={setState}
            onStop={stopNavigation}
            onPause={pauseNavigation}
            onResume={resumeNavigation}
            onStart={startNavigation}
          />
        )}
        {view === 'settings' && (
          <SettingsPage state={state} setState={setState} />
        )}
        {view === 'saved' && (
          <SavedTripsPage state={state} setState={setState} />
        )}
      </section>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return 'var(--green)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

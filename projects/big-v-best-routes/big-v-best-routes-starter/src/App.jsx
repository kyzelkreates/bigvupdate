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
import { runAgentSuite, mergeAgentResultsIntoCompliance } from './agents/agentOrchestrator.js';
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
      const vehicle      = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
      const routeResult  = draft.trip.lastRouteResult;

      // Base compliance check
      const baseResult = runComplianceCheck({
        vehicle,
        trip:         draft.trip,
        restrictions: draft.restrictions,
        routeResult,
      });

      // 4P3X specialist agent suite
      const agentSuite = runAgentSuite({
        vehicle,
        trip:         draft.trip,
        navigation:   draft.navigation,
        restrictions: draft.restrictions,
        compliance:   draft.compliance,
        settings:     draft.settings,
      });

      // Merge agent results into compliance output
      const enrichedResult = mergeAgentResultsIntoCompliance(baseResult, agentSuite);

      draft.compliance = { ...draft.compliance, ...enrichedResult };
      draft.agents = {
        ranAt:             agentSuite.ranAt,
        overallLevel:      agentSuite.overallLevel,
        headline:          agentSuite.headline,
        combinedScore:     agentSuite.combinedScore,
        isReadyToNavigate: agentSuite.isReadyToNavigate,
        vehicleAgent:      agentSuite.vehicleAgent,
        restrictionAgent:  agentSuite.restrictionAgent,
        legalAgent:        agentSuite.legalAgent,
        safetyAgent:       agentSuite.safetyAgent,
        readinessAgent:    agentSuite.readinessAgent,
        driverAdvisory:    agentSuite.driverAdvisory,
        sessionSnapshot:   draft.agents?.sessionSnapshot || null,
      };
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

        // Auto-run compliance + 4P3X agents after every route calculation
        const vehicle = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
        const baseComplianceResult = runComplianceCheck({
          vehicle,
          trip:         draft.trip,
          restrictions: draft.restrictions,
          routeResult:  result,
        });
        const agentSuiteAuto = runAgentSuite({
          vehicle,
          trip:         draft.trip,
          navigation:   draft.navigation,
          restrictions: draft.restrictions,
          compliance:   draft.compliance,
          settings:     draft.settings,
        });
        const enrichedAuto = mergeAgentResultsIntoCompliance(baseComplianceResult, agentSuiteAuto);
        draft.compliance = { ...draft.compliance, ...enrichedAuto };
        draft.agents = {
          ranAt:             agentSuiteAuto.ranAt,
          overallLevel:      agentSuiteAuto.overallLevel,
          headline:          agentSuiteAuto.headline,
          combinedScore:     agentSuiteAuto.combinedScore,
          isReadyToNavigate: agentSuiteAuto.isReadyToNavigate,
          vehicleAgent:      agentSuiteAuto.vehicleAgent,
          restrictionAgent:  agentSuiteAuto.restrictionAgent,
          legalAgent:        agentSuiteAuto.legalAgent,
          safetyAgent:       agentSuiteAuto.safetyAgent,
          readinessAgent:    agentSuiteAuto.readinessAgent,
          driverAdvisory:    agentSuiteAuto.driverAdvisory,
          sessionSnapshot:   draft.agents?.sessionSnapshot || null,
        };
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
            <strong>Big V's Best Routes™</strong>
            <span>Powered by 4P3X Intelligent AI</span>
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

        <div className="brandCredit">
          <span>Created by Kyzel Kreates</span>
          <span>Part of the 4P3X Verse</span>
        </div>
      </aside>

      <section className="content">
        <header className="topBar">
          <div>
            <p className="eyebrow">Big V's Best Routes™ — Powered by 4P3X Intelligent AI</p>
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
            agents={state.agents}
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

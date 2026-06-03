import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  updateGpsPositionRecipe,
  updateRouteProgressRecipe,
  setGpsPermissionRecipe,
  setGpsErrorRecipe,
  setGpsStalRecipe,
  updateVoiceStateRecipe,
  toggleVoiceRecipe,
  toggleVoiceMuteRecipe,
} from './services/navigationSessionService.js';
import {
  startLocationWatch,
  stopLocationWatch,
  checkLocationPermission,
  requestLocationPermission,
} from './services/locationService.js';
import { calculateRouteProgress, getVoiceTrigger } from './services/routeProgressEngine.js';
import {
  REROUTE_STATUS,
  promptRerouteRecipe,
  acceptRerouteRecipe,
  declineRerouteRecipe,
  rerouteErrorRecipe,
  executeReroute,
  getInitialRerouteState,
} from './services/rerouteService.js';
import {
  speakInstruction, speakWarning, stopSpeaking, triggerInstructionVoice,
  triggerWarningVoice, onNavigationStop, getInitialVoiceState, VOICE_SUPPORTED,
} from './services/voiceGuidanceService.js';
import {
  buildOfflineTripPack,
  saveTripPackRecipe,
  clearTripPackRecipe,
} from './services/offlineTripPackService.js';
import { OFF_ROUTE_CONSECUTIVE_FIXES, REROUTE_COOLDOWN_MS } from './config/navigationConfig.js';
import { runAgentSuite, mergeAgentResultsIntoCompliance } from './agents/agentOrchestrator.js';
import './styles/app.css';

export default function App() {
  const [state, setRawState] = useState(loadState);
  const [routeLoading, setRouteLoading] = useState(false);

  // GPS watcher ref — lives outside React state to avoid stale closures
  const gpsWatchIdRef       = useRef(null);
  const lastRerouteTimeRef  = useRef(0);
  const prevInstrIdxRef     = useRef(0);
  const voiceSpokenRef      = useRef({ instrId: null, warnId: null });

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

  // ── GPS wiring: start live GPS watch when navigation begins ────────────────
  const startGpsWatch = useCallback(() => {
    if (gpsWatchIdRef.current != null) return; // already watching

    const watchId = startLocationWatch(
      // onPosition — called on every GPS update
      (normalised) => {
        // 1. Update GPS fields in SSOT
        setState(updateGpsPositionRecipe(normalised));

        // 2. Calculate route progress
        setRawState((current) => {
          const nav     = current.navigation;
          const route   = nav.routeSnapshot?.route || current.trip.lastRouteResult?.route;
          const polyline = route?.polyline || [];
          if (polyline.length < 2 || nav.status !== 'active') return current;

          const progress = calculateRouteProgress({
            lat:           normalised.lat,
            lon:           normalised.lon,
            accuracy:      normalised.accuracy,
            timestamp:     normalised.timestamp,
            polyline,
            instructions:  route.instructions || [],
            prevInstrIdx:  prevInstrIdxRef.current,
            totalDistanceM:  route.distanceM,
            totalDurationMs: route.durationMs,
            useMetric:     current.settings.useMetric !== false,
          });

          // 3. Voice guidance trigger
          if (progress.currentInstructionIndex !== prevInstrIdxRef.current) {
            const instr = progress.currentInstruction;
            if (instr?.text) {
              const voiceResult = triggerInstructionVoice({
                instructionText: instr.text,
                instructionId:   `${progress.currentInstructionIndex}`,
                voiceState:      current.navigation.voice,
              });
              if (voiceResult.updatedVoiceState) {
                updateState(current, (d) => {
                  d.navigation.voice = { ...d.navigation.voice, ...voiceResult.updatedVoiceState };
                });
              }
            }
            prevInstrIdxRef.current = progress.currentInstructionIndex;
          }

          // 4. Off-route + reroute prompt
          const newConsecutive = progress.offRoute
            ? (current.navigation.offRouteConsecutiveFixes || 0) + 1
            : 0;
          const shouldPromptReroute =
            progress.offRoute &&
            newConsecutive >= OFF_ROUTE_CONSECUTIVE_FIXES &&
            current.navigation.reroute?.status === 'idle' &&
            (Date.now() - lastRerouteTimeRef.current) > REROUTE_COOLDOWN_MS;

          if (shouldPromptReroute) {
            lastRerouteTimeRef.current = Date.now();
            // Speak off-route warning
            triggerWarningVoice({
              warningText: 'Off route. Rerouting recommended.',
              warningId:   'off-route',
              voiceState:  current.navigation.voice,
            });
          }

          return updateState(current, (d) => {
            // Progress
            d.navigation.progressFraction            = progress.progressFraction;
            d.navigation.routeProgressPercent        = progress.routeProgressPercent;
            d.navigation.currentInstructionIndex     = progress.currentInstructionIndex;
            d.navigation.nextInstruction             = progress.nextInstruction;
            d.navigation.nextInstructionIndex        = progress.nextInstructionIndex;
            d.navigation.distanceToNextInstructionM  = progress.distanceToNextInstructionM;
            d.navigation.remainingDistanceM          = progress.remainingDistanceM;
            d.navigation.remainingDurationMs         = progress.remainingDurationMs;
            d.navigation.offRouteStatus              = progress.offRoute;
            d.navigation.offRouteDistanceM           = progress.offRouteDistanceM;
            d.navigation.offRouteConsecutiveFixes    = newConsecutive;
            d.navigation.navigationWarnings          = progress.warnings || [];
            if (progress.currentInstruction?.text) {
              d.navigation.currentInstruction        = progress.currentInstruction.text;
            }
            if (shouldPromptReroute) {
              d.navigation.reroute = {
                ...(d.navigation.reroute || {}),
                status:            'prompt',
                reason:            'off_route',
                offRouteDistanceM: progress.offRouteDistanceM,
                lastDetectedAt:    new Date().toISOString(),
              };
              d.navigation.status = 'rerouting';
            }
          });
        });
      },
      // onError
      (err) => {
        setState(setGpsErrorRecipe(err));
        if (err.code === 1) {
          // Permission denied — don't crash, just degrade to simulation
          console.warn('[App] GPS denied:', err.message);
        }
      },
    );
    gpsWatchIdRef.current = watchId;
  }, []);  // eslint-disable-line

  const stopGpsWatch = useCallback(() => {
    if (gpsWatchIdRef.current != null) {
      stopLocationWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    onNavigationStop();
  }, []);

  // ── Manual GPS toggle — called from GpsStatusPanel Start/Stop GPS btns ───
  // GPS is NEVER started automatically — requires explicit user action.
  const handleStartGps = useCallback(() => {
    if (gpsWatchIdRef.current != null) return; // already watching
    setState((draft) => { draft.navigation.gpsWatchActive = true; });
    startGpsWatch();
  }, [startGpsWatch]);  // eslint-disable-line

  const handleStopGps = useCallback(() => {
    if (gpsWatchIdRef.current == null) return; // not watching
    stopLocationWatch(gpsWatchIdRef.current);
    gpsWatchIdRef.current = null;
    onNavigationStop();
    setState((draft) => {
      draft.navigation.gpsWatchActive = false;
      draft.navigation.gpsStatus      = 'unavailable';
    });
  }, []);  // eslint-disable-line

  // ── GPS permission check on mount ────────────────────────────────────────
  useEffect(() => {
    checkLocationPermission().then((perm) => {
      setState(setGpsPermissionRecipe(perm));
    });
    // Initialise voice state
    setState((draft) => {
      draft.navigation.voice = {
        ...getInitialVoiceState(),
        ...(draft.navigation.voice || {}),
        supported: typeof window !== 'undefined' && 'speechSynthesis' in window,
      };
    });
  }, []);  // eslint-disable-line

  // ── Start/stop GPS watch when navigation status changes ──────────────────
  useEffect(() => {
    const status = state.navigation.status;
    if (status === 'active') {
      startGpsWatch();
    } else if (status === 'stopped' || status === 'completed' || status === 'notStarted') {
      stopGpsWatch();
      prevInstrIdxRef.current = 0;
    }
  }, [state.navigation.status]);  // eslint-disable-line

  // ── Build offline trip pack after successful route calculation ────────────
  useEffect(() => {
    if (state.trip.routeStatus === 'success' && state.trip.lastRouteResult?.route) {
      const vehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
      const pack = buildOfflineTripPack({
        trip:         state.trip,
        vehicle,
        compliance:   state.compliance,
        agents:       state.agents,
        restrictions: state.restrictions,
        useMetric:    state.settings.useMetric !== false,
      });
      if (pack) setState(saveTripPackRecipe(pack));
    }
  }, [state.trip.routeStatus]);  // eslint-disable-line

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { stopGpsWatch(); };
  }, []);  // eslint-disable-line

  function startNavigation() {
    prevInstrIdxRef.current = 0;
    setState(startSessionRecipe(state));
    // GPS watch is started by the useEffect above when status → 'active'
  }

  function stopNavigation() {
    stopGpsWatch();
    setState(stopSessionRecipe());
    setState(clearTripPackRecipe());
  }

  function pauseNavigation() {
    setState(pauseSessionRecipe());
    // Keep GPS watch active during pause
  }

  function resumeNavigation() {
    setState(resumeSessionRecipe());
  }

  // ── Reroute handlers ──────────────────────────────────────────────────────
  function handleRerouteConfirm() {
    const nav  = state.navigation;
    const dest = state.trip.destination;
    if (!nav.currentLat || !nav.currentLon) {
      setState(rerouteErrorRecipe('GPS position required for rerouting.'));
      return;
    }
    const vehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
    executeReroute({
      currentLat:   nav.currentLat,
      currentLon:   nav.currentLon,
      destination:  dest,
      vehicle,
      restrictions: state.restrictions,
      settings:     state.settings,
      onRecipe:     setState,
    });
  }

  function handleRerouteAccept() {
    setState(acceptRerouteRecipe());
  }

  function handleRerouteDecline() {
    setState(declineRerouteRecipe());
  }

  // ── Voice handlers ─────────────────────────────────────────────────────────
  function handleToggleVoice() {
    const enabled = !(state.navigation.voice?.enabled ?? false);
    if (!enabled) stopSpeaking();
    setState(toggleVoiceRecipe());
  }

  function handleToggleVoiceMute() {
    const muted = !(state.navigation.voice?.muted ?? false);
    if (!muted) stopSpeaking();
    setState(toggleVoiceMuteRecipe());
  }

  function handleRepeatInstruction() {
    const instr = state.navigation.currentInstruction;
    if (instr) {
      stopSpeaking();
      speakInstruction(instr, { enabled: true, muted: false, supported: true });
    }
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
            onRerouteConfirm={handleRerouteConfirm}
            onRerouteAccept={handleRerouteAccept}
            onRerouteDecline={handleRerouteDecline}
            onToggleVoice={handleToggleVoice}
            onToggleMute={handleToggleVoiceMute}
            onRepeatInstruction={handleRepeatInstruction}
            onStartGps={handleStartGps}
            onStopGps={handleStopGps}
            agents={state.agents}
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

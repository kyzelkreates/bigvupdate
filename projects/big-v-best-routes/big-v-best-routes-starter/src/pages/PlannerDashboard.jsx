/**
 * PlannerDashboard.jsx — Driver Trip Planning Dashboard
 * Big V's Best Routes
 *
 * Panel layout:
 *  Left:  Hero + Trip inputs + Route status + Route summary
 *  Right: Vehicle form + Compliance AI
 */

import { useState } from 'react';
import {
  Navigation, Route, ShieldCheck, Save, TriangleAlert,
  CheckCircle, AlertCircle, Loader, WifiOff, Info,
  Settings2, AlertTriangle,
} from 'lucide-react';
import VehicleForm from '../components/VehicleForm.jsx';
import CompliancePanel from '../components/CompliancePanel.jsx';
import RouteSummaryPanel from '../components/RouteSummaryPanel.jsx';
import SafetyDisclaimer from '../components/SafetyDisclaimer.jsx';
import AgentSuitePanel from '../components/AgentSuitePanel.jsx';
import { formatDistance, formatDuration } from '../utils/formatters.js';

const ROUTE_MODES = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'safest',  label: 'Safest'  },
  { value: 'scenic',  label: 'Scenic'  },
];

export default function PlannerDashboard({
  state, setState, runCompliance, calculateRoute, routeLoading, saveCurrentTrip, startNavigation, agents,
}) {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(state.app.acceptedSafetyDisclaimer);
  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
  const navLocked     = state.navigation.status === 'active' || state.navigation.status === 'paused';
  const routeStatus   = state.trip.routeStatus;
  const routeResult   = state.trip.lastRouteResult;
  const hasRoute      = !!routeResult?.route;

  // API key: env var takes priority over settings
  const apiKeyConfigured = !!(
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRAPHHOPPER_API_KEY) ||
    state.settings.graphHopperApiKey
  );

  function updateVehicleType(type) {
    if (navLocked) return;
    setState((draft) => {
      const v = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
      v.type   = type;
      v.fields = {};
    });
  }

  function updateVehicleField(field, value) {
    if (navLocked) return;
    setState((draft) => {
      draft.vehicle.profiles[draft.vehicle.activeVehicleId].fields[field] = value;
    });
  }

  function acceptDisclaimer() {
    setDisclaimerAccepted(true);
    setState((draft) => { draft.app.acceptedSafetyDisclaimer = true; });
  }

  if (!disclaimerAccepted) {
    return <SafetyDisclaimer onAccept={acceptDisclaimer} />;
  }

  return (
    <main className="pageGrid">

      {/* ── Left column ─────────────────────────────────────────────────── */}
      <div className="leftCol">

        {/* API status panel */}
        {!apiKeyConfigured && (
          <section className="panel apiStatusPanel">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>GraphHopper routing not configured</strong>
                <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
                  Add your free GraphHopper API key in{' '}
                  <button
                    className="ghost"
                    style={{ display: 'inline', padding: 0, fontSize: 13, color: 'var(--green)', border: 'none', background: 'none', cursor: 'pointer' }}
                    onClick={() => setState((d) => { d.app.mode = 'settings'; })}
                  >
                    Settings <Settings2 size={11} style={{ display: 'inline' }} />
                  </button>
                  {' '}or set <code>VITE_GRAPHHOPPER_API_KEY</code> in your <code>.env</code> file.
                  Without a key, route calculation will show a setup-required message.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Hero panel */}
        <section className="heroPanel">
          <p className="eyebrow">Driver Trip Planning Dashboard</p>
          <h1>Plan, check, and validate before you go.</h1>
          <p>
            GraphHopper routing · Compliance AI · Modular vehicle input · Local-first PWA
          </p>
          <div className="heroActions">
            <button className="primary" onClick={calculateRoute} disabled={routeLoading || navLocked}>
              {routeLoading
                ? <><Loader size={16} className="spin" /> Calculating…</>
                : <><Route size={16} /> Calculate route</>}
            </button>
            <button className="ghost" onClick={runCompliance} disabled={navLocked}>
              <ShieldCheck size={16} /> Run Compliance AI
            </button>
            {hasRoute && !routeResult?.demoMode && (
              <button className="ghost" onClick={saveCurrentTrip}>
                <Save size={16} /> Save trip
              </button>
            )}
          </div>
          {navLocked && (
            <p className="disclaimer" style={{ color: 'var(--warning)', marginTop: 10 }}>
              🔒 Navigation active — vehicle profile and route are locked. Stop navigation to make changes.
            </p>
          )}
        </section>

        {/* Trip inputs */}
        <section className="panel tripPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Trip</p>
              <h2>Journey details</h2>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROUTE_MODES.map((m) => (
                <button
                  key={m.value}
                  className={state.trip.routeMode === m.value ? 'primary' : 'ghost'}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                  onClick={() => setState((d) => { d.trip.routeMode = m.value; })}
                  disabled={navLocked}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Origin</span>
            <input
              value={state.trip.origin}
              onChange={(e) => setState((d) => { d.trip.origin = e.target.value; })}
              placeholder="e.g. Bristol, BS1 4DJ or 51.4545,-2.5879"
              disabled={navLocked}
            />
          </label>
          <label className="field">
            <span>Destination</span>
            <input
              value={state.trip.destination}
              onChange={(e) => setState((d) => { d.trip.destination = e.target.value; })}
              placeholder="e.g. Cardiff, CF10 1EP or 51.4816,-3.1791"
              disabled={navLocked}
            />
          </label>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: -8, marginBottom: 12 }}>
            <Info size={11} style={{ display: 'inline', marginRight: 4 }} />
            Geocoding via Nominatim (OpenStreetMap). For best results use a full postcode or city name.
            Coordinates (lat,lon) are also accepted.
          </p>

          <RouteStatusBanner
            status={routeStatus}
            error={state.trip.routeError}
            routeResult={routeResult}
            onGoToSettings={() => setState((d) => { d.app.mode = 'settings'; })}
          />

          {state.compliance.dataFreshness && (
            <p className="disclaimer">
              <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
              Restriction data: <strong>{state.compliance.dataFreshness}</strong>.
              {' '}Always verify against live road signs and local authority notices.
            </p>
          )}
        </section>

        {/* Route summary */}
        {hasRoute && (
          <RouteSummaryPanel
            routeResult={routeResult}
            compliance={state.compliance}
            onStartNavigation={startNavigation}
            navLocked={navLocked}
          />
        )}
      </div>

      {/* ── Right column ────────────────────────────────────────────────── */}
      <div className="rightCol">
        <VehicleForm
          vehicle={activeVehicle}
          onChangeType={updateVehicleType}
          onChangeField={updateVehicleField}
          locked={navLocked}
        />
        <CompliancePanel
          compliance={state.compliance}
          onRunCheck={runCompliance}
          locked={navLocked}
        />
        <AgentSuitePanel agents={agents || state.agents} />
      </div>
    </main>
  );
}

// ── Route status banner ──────────────────────────────────────────────────────

function RouteStatusBanner({ status, error, routeResult, onGoToSettings }) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="statusBanner loading">
        <Loader size={16} className="spin" />
        Geocoding addresses and calculating route via GraphHopper…
      </div>
    );
  }

  if (status === 'setup_required') {
    return (
      <div className="statusBanner warning">
        <AlertTriangle size={16} />
        <span>
          {error || 'GraphHopper API key required.'}{' '}
          <button
            className="ghost"
            style={{ display: 'inline', padding: 0, fontSize: 13, color: 'var(--green)', border: 'none', background: 'none', cursor: 'pointer' }}
            onClick={onGoToSettings}
          >
            Open Settings →
          </button>
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="statusBanner error">
        <AlertCircle size={16} />
        {error || 'Route calculation failed. Check your origin/destination and try again.'}
      </div>
    );
  }

  if (status === 'dev_fallback' || routeResult?.demoMode) {
    return (
      <div className="statusBanner demo">
        <WifiOff size={16} />
        Dev fallback route (VITE_ENABLE_DEV_ROUTE_FALLBACK=true). Configure GraphHopper for real routing.
      </div>
    );
  }

  if (status === 'success' && routeResult?.ok) {
    return (
      <div className="statusBanner success">
        <CheckCircle size={16} />
        Route found via GraphHopper.
        {routeResult.message && routeResult.message.includes('⚠') && (
          <span style={{ marginLeft: 8, color: 'var(--warning)', fontSize: 12 }}>
            {routeResult.message.split('⚠')[1]}
          </span>
        )}
      </div>
    );
  }

  return null;
}

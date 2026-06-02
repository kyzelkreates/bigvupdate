import { useState } from 'react';
import {
  Navigation, Route, ShieldCheck, Save, TriangleAlert,
  CheckCircle, AlertCircle, Loader, WifiOff, Info,
} from 'lucide-react';
import VehicleForm from '../components/VehicleForm.jsx';
import CompliancePanel from '../components/CompliancePanel.jsx';
import RouteSummaryPanel from '../components/RouteSummaryPanel.jsx';
import SafetyDisclaimer from '../components/SafetyDisclaimer.jsx';
import { formatDistance, formatDuration } from '../utils/formatters.js';

const ROUTE_MODES = [
  { value: 'fastest', label: 'Fastest' },
  { value: 'safest', label: 'Safest' },
  { value: 'scenic', label: 'Scenic' },
];

export default function PlannerDashboard({
  state, setState, runCompliance, calculateRoute, routeLoading, saveCurrentTrip, startNavigation,
}) {
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(state.app.acceptedSafetyDisclaimer);
  const activeVehicle = state.vehicle.profiles[state.vehicle.activeVehicleId];
  const navLocked = state.navigation.status === 'active';
  const routeStatus = state.trip.routeStatus;
  const routeResult = state.trip.lastRouteResult;
  const hasRoute = !!routeResult?.route;

  function updateVehicleType(type) {
    if (navLocked) return;
    setState((draft) => {
      const vehicle = draft.vehicle.profiles[draft.vehicle.activeVehicleId];
      vehicle.type = type;
      vehicle.fields = {};
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
        {/* Hero */}
        <section className="heroPanel">
          <p className="eyebrow">Driver Trip Planning Dashboard</p>
          <h1>Plan, check, and validate before you go.</h1>
          <p>
            GraphHopper-ready routing · Compliance AI · Modular vehicle input ·
            Local-first · PWA-ready
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
            {hasRoute && (
              <button className="ghost" onClick={saveCurrentTrip}>
                <Save size={16} /> Save trip
              </button>
            )}
          </div>
          {navLocked && (
            <p className="disclaimer" style={{ color: 'var(--warning)', marginTop: 10 }}>
              🔒 Navigation active — vehicle profile is locked. Stop navigation to make changes.
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
              placeholder="e.g. Bristol, BS1 4DJ"
              disabled={navLocked}
            />
          </label>
          <label className="field">
            <span>Destination</span>
            <input
              value={state.trip.destination}
              onChange={(e) => setState((d) => { d.trip.destination = e.target.value; })}
              placeholder="e.g. Cardiff, CF10 1EP"
              disabled={navLocked}
            />
          </label>

          {/* Route status feedback */}
          <RouteStatusBanner
            status={routeStatus}
            error={state.trip.routeError}
            routeResult={routeResult}
          />

          {/* Data freshness */}
          {state.compliance.dataFreshness && (
            <p className="disclaimer">
              <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
              Data freshness: <strong>{state.compliance.dataFreshness}</strong>.
              {' '}Restriction data from local import only. Always verify against live road signs.
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
      </div>
    </main>
  );
}

// ── Route status banner ──────────────────────────────────────────────────────

function RouteStatusBanner({ status, error, routeResult }) {
  if (status === 'idle') return null;

  if (status === 'loading') {
    return (
      <div className="statusBanner loading">
        <Loader size={16} className="spin" />
        Geocoding and calculating route…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="statusBanner error">
        <AlertCircle size={16} />
        {error || 'Route calculation failed.'}
      </div>
    );
  }
  if (status === 'demo' || routeResult?.demoMode) {
    return (
      <div className="statusBanner demo">
        <WifiOff size={16} />
        Demo route — add a GraphHopper API key in Settings for live routing.
      </div>
    );
  }
  if (status === 'success') {
    return (
      <div className="statusBanner success">
        <CheckCircle size={16} />
        Route found via GraphHopper.
      </div>
    );
  }
  return null;
}

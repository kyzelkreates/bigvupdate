/**
 * SettingsPanel.jsx — Big V's Best Routes™ Service Settings
 * Powered by 4P3X Intelligent AI | Created by Kyzel Kreates
 *
 * Production-grade service configuration panel.
 * Wires into storage.js SSOT — no duplicate storage.
 * All saves go through updateServiceConfig() recipe.
 * All tests use serviceTester.js — real pass/fail only.
 *
 * ADVISORY ONLY — route guidance never guarantees legal compliance.
 */

import { useState, useCallback } from 'react';
import {
  Map, Route, Satellite, Brain, Shield,
  RefreshCcw, Save, FlaskConical, TriangleAlert,
  Globe, Layers, Navigation2, Cpu, Info,
  ChevronDown, CheckCircle, Eye, EyeOff, ToggleLeft, ToggleRight,
} from 'lucide-react';

import { updateServiceConfig, resetServiceConfig, saveServiceTestResult } from '../../core/storage.js';
import { PROVIDER_LABELS, AI_PROVIDER_LABELS, PUBLIC_FALLBACK_WARNING, COMPLIANCE_DISCLAIMER } from '../../config/defaultServiceConfig.js';
import {
  testMapStyle, testOsmTile, testMapboxProvider, testGoogleMapsProvider,
  testGeocoding, testReverseGeocoding, testOverpass, testRouting, testAiEndpoint,
  testAllServices,
} from '../../utils/serviceTester.js';
import { validateMapboxToken } from '../../utils/secretGuards.js';

import ServiceStatusCard  from './ServiceStatusCard.jsx';
import EndpointInput      from './EndpointInput.jsx';
import ApiKeyInput        from './ApiKeyInput.jsx';
import ProviderStatusBadge from './ProviderStatusBadge.jsx';

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ id, label, value, onChange, hint, disabled }) {
  return (
    <div className="settingsField toggleRow">
      <label htmlFor={id} className="settingsLabel toggleLabel">
        {label}
        {hint && <span className="settingsHint toggleHint">{hint}</span>}
      </label>
      <button
        id={id} type="button"
        className={`toggleBtn ${value ? 'toggleOn' : ''}`}
        onClick={() => onChange(!value)}
        aria-checked={value} role="switch"
        disabled={disabled}
      >
        {value ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        <span>{value ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

// ─── Select component ─────────────────────────────────────────────────────────

function SettingsSelect({ id, label, value, onChange, options, hint, disabled }) {
  return (
    <div className="settingsField">
      <label htmlFor={id} className="settingsLabel">{label}</label>
      <select
        id={id} className="settingsInput settingsSelect"
        value={value} onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map(({ value: v, label: l }) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      {hint && <p className="settingsHint">{hint}</p>}
    </div>
  );
}

// ─── Main Settings Panel ──────────────────────────────────────────────────────

export default function SettingsPanel({ state, setState }) {
  const cfg   = state.serviceConfig || {};
  const map   = cfg.mapping   || {};
  const geo   = cfg.geocoding || {};
  const rte   = cfg.routing   || {};
  const ovp   = cfg.overpass  || {};
  const ai    = cfg.ai        || {};
  const gps   = cfg.gps       || {};
  const tests = cfg.testResults || {};

  const [testing,    setTesting]    = useState({});    // { serviceName: bool }
  const [saved,      setSaved]      = useState(false);
  const [testingAll, setTestingAll] = useState(false);
  const [resetDone,  setResetDone]  = useState(false);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const updateCfg = useCallback((partial) => {
    setState(updateServiceConfig(state, partial));
  }, [state, setState]);

  const updateSection = useCallback((section, partial) => {
    updateCfg({ [section]: { ...(cfg[section] || {}), ...partial } });
  }, [cfg, updateCfg]);

  const updateNested = useCallback((section, subKey, partial) => {
    updateCfg({
      [section]: {
        ...(cfg[section] || {}),
        [subKey]: { ...((cfg[section] || {})[subKey] || {}), ...partial },
      },
    });
  }, [cfg, updateCfg]);

  function markTesting(name, val) {
    setTesting((t) => ({ ...t, [name]: val }));
  }

  async function runTest(name, testFn) {
    markTesting(name, true);
    try {
      const result = await testFn();
      setState(saveServiceTestResult(state, name, result));
    } catch (err) {
      setState(saveServiceTestResult(state, name, {
        service: name, ok: false, status: 'failed',
        message: err?.message || 'Unexpected test error.',
        testedAt: new Date().toISOString(),
      }));
    } finally {
      markTesting(name, false);
    }
  }

  function handleSaveAll() {
    // State is already live — just show save confirmation
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleTestAll() {
    setTestingAll(true);
    try {
      const results = await testAllServices(cfg);
      setState((draft) => {
        Object.entries(results).forEach(([name, result]) => {
          if (!draft.serviceConfig.testResults) draft.serviceConfig.testResults = {};
          draft.serviceConfig.testResults[name] = result;
          if (draft.serviceConfig[name]) {
            draft.serviceConfig[name].status      = result.ok ? 'success' : 'failed';
            draft.serviceConfig[name].lastTestedAt = result.testedAt;
          }
        });
      });
    } finally {
      setTestingAll(false);
    }
  }

  function handleReset() {
    if (!window.confirm('Reset all service settings to safe defaults? Your GraphHopper key and restriction data will be preserved.')) return;
    setState(resetServiceConfig(state));
    setResetDone(true);
    setTimeout(() => setResetDone(false), 3000);
  }

  // ── Demo mode toggle (in existing settings SSOT) ─────────────────────────
  function toggleDemoMode() {
    setState((draft) => { draft.settings.demoMode = !draft.settings.demoMode; });
  }

  const demoMode = state.settings?.demoMode === true;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="settingsPanelWrap">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="settingsPanelHeader">
        <h1 className="settingsPanelTitle">
          Big V's Best Routes™ Service Settings
        </h1>
        <p className="settingsPanelSubtitle">
          Configure maps, routing, geocoding, GPS services, and open-source AI agents.
          Public OSM/MapLibre fallbacks stay available if custom services fail.
        </p>
        <p className="settingsBrand">
          Powered by <strong>4P3X Intelligent AI</strong> · Created by <strong>Kyzel Kreates</strong>
        </p>

        {/* Public fallback warning */}
        <div className="fallbackWarningBanner" role="note">
          <TriangleAlert size={14} style={{ flexShrink: 0 }} />
          <span>{PUBLIC_FALLBACK_WARNING}</span>
        </div>
      </div>

      {/* ── Demo Mode toggle ────────────────────────────────────────────── */}
      <section className="settingsSection demoModeSection">
        <h2 className="settingsSectionTitle"><Eye size={16} /> Demo Mode</h2>
        <p className="settingsSectionDesc">
          Enable demo mode to explore the app with a simulated route and sample data.
          Turn off for production use with real GraphHopper routing and live GPS.
        </p>
        <Toggle
          id="demo-mode-toggle"
          label="Demo Mode"
          value={demoMode}
          onChange={toggleDemoMode}
          hint={demoMode ? 'Demo mode is ON — using simulated route data' : 'Demo mode is OFF — live routing active'}
        />
        {demoMode && (
          <div className="settingsInfoBox warning">
            <TriangleAlert size={13} /> Demo mode is active. Route results are simulated and not suitable for real navigation.
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1 — MAPPING SERVICES
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Map size={16} /> Mapping Services</h2>
        <p className="settingsSectionDesc">
          Select your active map provider. OSM / MapLibre public fallback is always available at no cost.
          Custom, Mapbox, and Google Maps providers are optional.
        </p>

        <ServiceStatusCard
          title="Map Provider"
          icon={Layers}
          status={map.status}
          lastTestedAt={map.lastTestedAt}
          testResult={tests.mapping}
          onTest={() => runTest('mapping', () => {
            const active = map.activeProvider;
            if (active === 'mapbox')       return testMapboxProvider(map.mapbox?.publicToken, map.mapbox?.styleUrl);
            if (active === 'google_maps')  return testGoogleMapsProvider(map.googleMaps?.browserApiKey);
            if (active === 'custom_tile')  return testOsmTile(map.customTileUrl);
            if (active === 'osm_tile_public') return testOsmTile(map.osmTileUrl);
            const url = active === 'custom_maplibre' ? map.customMapStyleUrl : map.maplibrePublicStyleUrl;
            return testMapStyle(url);
          })}
          testing={testing.mapping}
          fallbackActive={map.lastFallbackProvider === 'maplibre_public' && map.status === 'failed'}
          fallbackProvider={map.lastFallbackProvider}
          defaultOpen
        >
          <SettingsSelect
            id="map-provider"
            label="Active Map Provider"
            value={map.activeProvider || 'maplibre_public'}
            onChange={(v) => updateSection('mapping', { activeProvider: v })}
            options={Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label }))}
            hint="OSM / MapLibre Public is always available and requires no API key."
          />

          {/* OSM / MapLibre public info */}
          {(map.activeProvider === 'maplibre_public' || !map.activeProvider) && (
            <div className="settingsInfoBox">
              <CheckCircle size={13} /> Using MapLibre public demo tiles. No API key required.
              Suitable for testing. For production, configure a custom style URL or tile provider.
              <br /><code style={{ fontSize: 11 }}>{map.maplibrePublicStyleUrl}</code>
            </div>
          )}

          {/* OSM tile */}
          {map.activeProvider === 'osm_tile_public' && (
            <EndpointInput
              id="osm-tile-url"
              label="OSM Tile URL"
              value={map.osmTileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'}
              onChange={(v) => updateSection('mapping', { osmTileUrl: v })}
              hint="Must contain {z}, {x}, {y} placeholders."
              placeholder="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}

          {/* Custom MapLibre */}
          {map.activeProvider === 'custom_maplibre' && (
            <EndpointInput
              id="custom-style-url"
              label="Custom MapLibre Style URL"
              value={map.customMapStyleUrl || ''}
              onChange={(v) => updateSection('mapping', { customMapStyleUrl: v })}
              hint="MapLibre GL-compatible style JSON URL. Falls back to OSM/MapLibre public if this fails."
              allowMapbox
            />
          )}

          {/* Custom tile */}
          {map.activeProvider === 'custom_tile' && (
            <EndpointInput
              id="custom-tile-url"
              label="Custom Tile URL"
              value={map.customTileUrl || ''}
              onChange={(v) => updateSection('mapping', { customTileUrl: v })}
              hint="Must contain {z}, {x}, {y} placeholders."
              placeholder="https://your-tile-server.com/{z}/{x}/{y}.png"
            />
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — GOOGLE MAPS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Globe size={16} /> Google Maps (Optional)</h2>
        <p className="settingsSectionDesc">
          Optional Google Maps integration. Requires a browser API key. Fails safely to OSM/MapLibre if not configured.
          The app works fully without this.
        </p>

        <ServiceStatusCard
          title="Google Maps"
          icon={Globe}
          status={map.googleMaps?.status}
          lastTestedAt={map.googleMaps?.lastTestedAt}
          testResult={map.googleMaps?.enabled ? tests.mapping : null}
          onTest={map.googleMaps?.enabled ? () => runTest('mapping', () => testGoogleMapsProvider(map.googleMaps?.browserApiKey)) : undefined}
          testing={testing.mapping}
        >
          <Toggle
            id="google-maps-enabled"
            label="Enable Google Maps"
            value={map.googleMaps?.enabled || false}
            onChange={(v) => updateNested('mapping', 'googleMaps', { enabled: v })}
            hint="When enabled, select Google Maps as the active provider above."
          />

          {map.googleMaps?.enabled && (
            <>
              <ApiKeyInput
                id="google-maps-key"
                label="Browser API Key"
                savedValue={map.googleMaps?.browserApiKey || ''}
                onSave={(v) => updateNested('mapping', 'googleMaps', { browserApiKey: v, status: 'untested' })}
                placeholder="AIza…"
                hint="Use a browser-restricted API key only. Never use a server/backend key."
                fieldLabel="Google Maps browser API key"
              />

              <SettingsSelect
                id="google-map-type"
                label="Map Type"
                value={map.googleMaps?.mapType || 'roadmap'}
                onChange={(v) => updateNested('mapping', 'googleMaps', { mapType: v })}
                options={[
                  { value: 'roadmap',   label: 'Roadmap' },
                  { value: 'satellite', label: 'Satellite' },
                  { value: 'hybrid',    label: 'Hybrid' },
                  { value: 'terrain',   label: 'Terrain' },
                ]}
              />

              <div className="settingsInfoBox warning">
                <TriangleAlert size={12} /> Google Maps is an optional overlay. If the API key is invalid or quota is exceeded,
                the app automatically falls back to OSM/MapLibre. Route guidance remains advisory only.
              </div>
            </>
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5 — MAPBOX
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Layers size={16} /> Mapbox (Optional)</h2>
        <p className="settingsSectionDesc">
          Optional Mapbox integration. Requires a public token (pk.*). Secret tokens are not accepted.
          Fails safely to OSM/MapLibre if not configured or if the token is invalid.
        </p>

        <ServiceStatusCard
          title="Mapbox"
          icon={Layers}
          status={map.mapbox?.status}
          lastTestedAt={map.mapbox?.lastTestedAt}
          testResult={map.mapbox?.enabled ? tests.mapping : null}
          onTest={map.mapbox?.enabled ? () => runTest('mapping', () => testMapboxProvider(map.mapbox?.publicToken, map.mapbox?.styleUrl)) : undefined}
          testing={testing.mapping}
        >
          <Toggle
            id="mapbox-enabled"
            label="Enable Mapbox"
            value={map.mapbox?.enabled || false}
            onChange={(v) => updateNested('mapping', 'mapbox', { enabled: v })}
          />

          {map.mapbox?.enabled && (
            <>
              <ApiKeyInput
                id="mapbox-token"
                label="Public Token (pk.*)"
                savedValue={map.mapbox?.publicToken || ''}
                onSave={(v) => {
                  const check = validateMapboxToken(v);
                  if (!check.valid && v) { alert(check.reason); return; }
                  updateNested('mapping', 'mapbox', { publicToken: v, status: 'untested' });
                }}
                placeholder="pk.eyJ1..."
                hint="Only public tokens (pk.*) are accepted. Secret tokens (sk.*) are blocked."
                fieldLabel="Mapbox public token"
              />

              <EndpointInput
                id="mapbox-style-url"
                label="Style URL"
                value={map.mapbox?.styleUrl || 'mapbox://styles/mapbox/streets-v12'}
                onChange={(v) => updateNested('mapping', 'mapbox', { styleUrl: v })}
                hint="mapbox:// or https:// style URLs. Falls back to OSM/MapLibre on failure."
                allowMapbox
              />

              <div className="settingsInfoBox">
                <Info size={12} /> If Mapbox token is invalid, the app falls back to OSM/MapLibre public tiles automatically.
              </div>
            </>
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2 — ROUTING SERVICES
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Route size={16} /> Routing Services</h2>
        <p className="settingsSectionDesc">
          GraphHopper routing configuration. Your existing GraphHopper key from Settings is preserved here.
          Custom routing endpoints are supported.
        </p>

        <ServiceStatusCard
          title="GraphHopper / Routing"
          icon={Navigation2}
          status={rte.status}
          lastTestedAt={rte.lastTestedAt}
          testResult={tests.routing}
          onTest={() => runTest('routing', () => testRouting(
            rte.graphhopperEndpoint || 'https://graphhopper.com/api/1',
            rte.graphhopperKey || state.settings?.graphHopperApiKey || '',
          ))}
          testing={testing.routing}
        >
          <EndpointInput
            id="gh-endpoint"
            label="GraphHopper Endpoint"
            value={rte.graphhopperEndpoint || 'https://graphhopper.com/api/1'}
            onChange={(v) => updateSection('routing', { graphhopperEndpoint: v })}
            hint="Default: https://graphhopper.com/api/1. Point to your self-hosted instance if needed."
          />

          <ApiKeyInput
            id="gh-api-key"
            label="GraphHopper API Key"
            savedValue={rte.graphhopperKey || state.settings?.graphHopperApiKey || ''}
            onSave={(v) => {
              updateSection('routing', { graphhopperKey: v, status: 'untested' });
              // Also update existing settings SSOT for backwards compat
              setState((draft) => { draft.settings.graphHopperApiKey = v; });
            }}
            placeholder="Paste your GraphHopper key…"
            hint="Get a free key at graphhopper.com. Key is masked after save."
            fieldLabel="GraphHopper API key"
          />

          {!rte.graphhopperKey && !state.settings?.graphHopperApiKey && (
            <div className="settingsInfoBox warning">
              <TriangleAlert size={12} /> No routing API key configured.
              Route planning will show a setup-required state. Compliance AI advisory still functions.
            </div>
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3 — GEOCODING
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Globe size={16} /> Geocoding Services</h2>
        <p className="settingsSectionDesc">
          Nominatim (OpenStreetMap) is the default public geocoder. Configure custom endpoints for production.
        </p>

        <ServiceStatusCard
          title="Geocoding"
          icon={Globe}
          status={geo.status}
          lastTestedAt={geo.lastTestedAt}
          testResult={tests.geocoding}
          onTest={() => runTest('geocoding', () => testGeocoding(
            geo.customSearchUrl || geo.searchUrl || 'https://nominatim.openstreetmap.org/search'
          ))}
          testing={testing.geocoding}
        >
          <SettingsSelect
            id="geocoding-provider"
            label="Geocoding Provider"
            value={geo.provider || 'nominatim_public'}
            onChange={(v) => updateSection('geocoding', { provider: v })}
            options={[
              { value: 'nominatim_public', label: 'Nominatim Public (OSM, free)' },
              { value: 'custom',           label: 'Custom Endpoint' },
            ]}
          />

          {geo.provider === 'custom' ? (
            <>
              <EndpointInput
                id="geocoding-search-url"
                label="Custom Search URL"
                value={geo.customSearchUrl || ''}
                onChange={(v) => updateSection('geocoding', { customSearchUrl: v })}
                placeholder="https://your-geocoder.example.com/search"
                hint="Must accept ?q= and ?format=json parameters."
              />
              <EndpointInput
                id="geocoding-reverse-url"
                label="Custom Reverse URL"
                value={geo.customReverseUrl || ''}
                onChange={(v) => updateSection('geocoding', { customReverseUrl: v })}
                placeholder="https://your-geocoder.example.com/reverse"
                hint="Must accept ?lat= ?lon= ?format=json parameters. Falls back to Nominatim."
              />
            </>
          ) : (
            <div className="settingsInfoBox">
              <CheckCircle size={12} /> Using Nominatim public geocoding (OpenStreetMap).
              Free for light usage. For high-volume, configure a custom endpoint.
            </div>
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4 — OVERPASS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Globe size={16} /> Overpass / OSM Data</h2>

        <ServiceStatusCard
          title="Overpass API"
          icon={Globe}
          status={ovp.status}
          lastTestedAt={ovp.lastTestedAt}
          testResult={tests.overpass}
          onTest={() => runTest('overpass', () => testOverpass(
            ovp.customEndpoint || ovp.endpoint || 'https://overpass-api.de/api/interpreter'
          ))}
          testing={testing.overpass}
        >
          <EndpointInput
            id="overpass-endpoint"
            label="Overpass Endpoint"
            value={ovp.customEndpoint || ovp.endpoint || 'https://overpass-api.de/api/interpreter'}
            onChange={(v) => updateSection('overpass', { customEndpoint: v })}
            hint="Default: overpass-api.de. Self-host with Overpass API for production."
            placeholder="https://overpass-api.de/api/interpreter"
          />
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7 — OPEN-SOURCE AI AGENTS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Brain size={16} /> Open-Source AI Agents</h2>
        <p className="settingsSectionDesc">
          Connect a self-hosted open-source AI server for enhanced advisory intelligence.
          Only open-source/self-hostable AI providers are supported — proprietary AI services are not integrated.
        </p>

        <ServiceStatusCard
          title="Local AI Server"
          icon={Cpu}
          status={ai.status}
          lastTestedAt={ai.lastTestedAt}
          testResult={tests.ai}
          onTest={ai.enabled ? () => runTest('ai', () => testAiEndpoint(ai.providerType, ai.serverUrl, ai.modelName)) : undefined}
          testing={testing.ai}
        >
          <Toggle
            id="ai-enabled"
            label="Enable Local AI"
            value={ai.enabled || false}
            onChange={(v) => updateSection('ai', { enabled: v })}
            hint="Connects to your local open-source AI server for enhanced compliance advisory."
          />

          {ai.enabled && (
            <>
              <SettingsSelect
                id="ai-provider-type"
                label="AI Provider"
                value={ai.providerType || 'ollama'}
                onChange={(v) => updateSection('ai', { providerType: v, status: 'untested' })}
                options={Object.entries(AI_PROVIDER_LABELS).map(([value, label]) => ({ value, label }))}
                hint="All providers are open-source/self-hostable only."
              />

              <EndpointInput
                id="ai-server-url"
                label="Local AI Server URL"
                value={ai.serverUrl || 'http://localhost:11434'}
                onChange={(v) => updateSection('ai', { serverUrl: v, status: 'untested' })}
                placeholder="http://localhost:11434"
                hint="Your local AI server must be running. http://localhost is allowed for local dev."
              />

              <div className="settingsField">
                <label htmlFor="ai-model-name" className="settingsLabel">Model Name</label>
                <input
                  id="ai-model-name"
                  type="text"
                  className="settingsInput"
                  value={ai.modelName || ''}
                  onChange={(e) => updateSection('ai', { modelName: e.target.value })}
                  placeholder="llama3, mistral, phi3…"
                />
                <p className="settingsHint">Leave blank to use server default.</p>
              </div>

              <SettingsSelect
                id="ai-agent-mode"
                label="Agent Mode"
                value={ai.agentMode || 'compliance_advisory'}
                onChange={(v) => updateSection('ai', { agentMode: v })}
                options={[
                  { value: 'compliance_advisory', label: 'Compliance Advisory (recommended)' },
                  { value: 'routing_assistant',   label: 'Routing Assistant' },
                  { value: 'driver_advisory',     label: 'Driver Advisory' },
                ]}
              />

              <div className="settingsInfoBox warning">
                <TriangleAlert size={12} /> Local AI is advisory only. AI agent outputs never override legal route requirements.
                Drivers must verify road signs, restrictions, and vehicle suitability.
              </div>
            </>
          )}
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8 — COMPLIANCE AI
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Shield size={16} /> Safety & Compliance AI</h2>

        <ServiceStatusCard
          title="Compliance AI Status"
          icon={Shield}
          status="success"
          defaultOpen
        >
          <Toggle
            id="compliance-ai-enabled"
            label="Compliance AI Enabled"
            value={ai.complianceAgentEnabled !== false}
            onChange={(v) => updateSection('ai', { complianceAgentEnabled: v })}
            hint="4P3X Intelligent Compliance AI runs locally — no external API required."
          />

          <div className="settingsInfoBox complianceNotice">
            <Shield size={13} />
            <span>{COMPLIANCE_DISCLAIMER}</span>
          </div>

          <ul className="complianceFeatureList">
            {[
              'HAZMAT route flagging',
              'Emissions zone advisory',
              'Bridge and weight restriction checks',
              'Lane restriction advisory',
              'Toll preference routing',
              'Driver plain-English summaries',
            ].map((f) => (
              <li key={f}><CheckCircle size={11} /> {f}</li>
            ))}
          </ul>
        </ServiceStatusCard>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 9 — SERVICE HEALTH
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection">
        <h2 className="settingsSectionTitle"><Satellite size={16} /> Service Health</h2>
        <p className="settingsSectionDesc">
          Current status of all configured services. Use "Test All" to refresh.
        </p>

        <div className="serviceHealthGrid">
          {[
            { name: 'mapping',   label: 'Mapping',   result: tests.mapping   },
            { name: 'geocoding', label: 'Geocoding', result: tests.geocoding },
            { name: 'routing',   label: 'Routing',   result: tests.routing   },
            { name: 'overpass',  label: 'Overpass',  result: tests.overpass  },
            { name: 'ai',        label: 'AI Server', result: tests.ai        },
          ].map(({ name, label, result }) => (
            <div key={name} className="serviceHealthItem">
              <span className="serviceHealthLabel">{label}</span>
              <ProviderStatusBadge
                status={result == null ? 'untested' : result.ok ? 'success' : 'failed'}
                lastTestedAt={result?.testedAt}
              />
              {result && !result.ok && result.fallbackUsed && (
                <span className="serviceHealthFallback">↪ {result.fallbackProvider}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 10 — RESET
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="settingsSection resetSection">
        <h2 className="settingsSectionTitle"><RefreshCcw size={16} /> Reset to Safe Defaults</h2>
        <p className="settingsSectionDesc">
          Resets all service provider settings to their safe public defaults.
          Does not affect your restriction data, vehicle profiles, or saved trips.
        </p>
        <button
          type="button" className="ghost danger"
          onClick={handleReset}
        >
          <RefreshCcw size={14} /> Reset Service Defaults
        </button>
        {resetDone && (
          <p className="settingsSuccess" role="status">
            <CheckCircle size={13} /> Service settings reset to safe defaults.
          </p>
        )}
      </section>

      {/* ── Global action bar ─────────────────────────────────────────────── */}
      <div className="settingsActionBar" role="group" aria-label="Settings actions">
        <button
          type="button" className="primary"
          onClick={handleSaveAll}
          disabled={saved}
        >
          <Save size={15} /> {saved ? 'Saved ✓' : 'Save Settings'}
        </button>

        <button
          type="button" className="ghost"
          onClick={handleTestAll}
          disabled={testingAll}
        >
          <FlaskConical size={15} /> {testingAll ? 'Testing all services…' : 'Test All Services'}
        </button>
      </div>
    </div>
  );
}

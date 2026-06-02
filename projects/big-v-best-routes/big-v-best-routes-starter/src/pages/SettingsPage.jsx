/**
 * SettingsPage.jsx — App configuration and provider setup
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 */

import { useState, useRef } from 'react';
import {
  Eye, EyeOff, CheckCircle, UploadCloud, Trash2,
  TriangleAlert, Map, Settings2, Info, Shield,
} from 'lucide-react';

export default function SettingsPage({ state, setState }) {
  const [showKey,    setShowKey]    = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [draftKey,   setDraftKey]   = useState(state.settings.graphHopperApiKey || '');
  const [csvStatus,  setCsvStatus]  = useState(null);
  const csvRef = useRef(null);

  const metricOn  = state.settings.useMetric !== false;
  const hasKey    = !!state.settings.graphHopperApiKey;
  const envKeySet = !!(typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRAPHHOPPER_API_KEY);
  const devFallbackEnabled = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_DEV_ROUTE_FALLBACK) === 'true';

  function saveKey() {
    setState((draft) => { draft.settings.graphHopperApiKey = draftKey.trim(); });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleMetric(val) {
    setState((draft) => { draft.settings.useMetric = val; });
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setCsvStatus({ type: 'error', msg: 'Only CSV files (.csv) are accepted.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target.result);
        if (!rows.length) throw new Error('CSV appears empty.');
        const roadRows   = rows.filter((r) => r.type === 'road' || r.restriction_type === 'road' || (!r.type && !r.restriction_type && r.lat && r.lon));
        const bridgeRows = rows.filter((r) => r.type === 'bridge' || r.restriction_type === 'bridge');
        setState((draft) => {
          if (roadRows.length)   draft.restrictions.roadRestrictions   = roadRows;
          if (bridgeRows.length) draft.restrictions.bridgeRestrictions = bridgeRows;
          draft.restrictions.lastImportedAt = new Date().toISOString();
          draft.restrictions.importSource   = file.name;
        });
        setCsvStatus({
          type: 'success',
          msg: `Imported ${rows.length} restriction record${rows.length !== 1 ? 's' : ''} (${roadRows.length} road · ${bridgeRows.length} bridge).`,
        });
      } catch (err) {
        setCsvStatus({ type: 'error', msg: `CSV parse error: ${err.message}` });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function clearRestrictions() {
    setState((draft) => {
      draft.restrictions.roadRestrictions   = [];
      draft.restrictions.bridgeRestrictions = [];
      draft.restrictions.lastImportedAt     = null;
      draft.restrictions.importSource       = null;
    });
    setCsvStatus({ type: 'success', msg: 'All restriction data cleared.' });
  }

  const roadCount   = state.restrictions?.roadRestrictions?.length   || 0;
  const bridgeCount = state.restrictions?.bridgeRestrictions?.length || 0;

  return (
    <main className="settingsPage">

      {/* ── Routing provider ────────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Routing provider</p>
            <h2>GraphHopper API key</h2>
          </div>
          <Map size={22} style={{ color: hasKey || envKeySet ? 'var(--green)' : 'var(--warning)' }} />
        </div>

        {envKeySet && (
          <div className="statusBanner success" style={{ marginBottom: 16 }}>
            <CheckCircle size={15} />
            API key loaded from <code>VITE_GRAPHHOPPER_API_KEY</code> environment variable — live routing active.
          </div>
        )}

        {!envKeySet && !hasKey && (
          <div className="statusBanner warning" style={{ marginBottom: 16 }}>
            <TriangleAlert size={15} />
            No API key configured. Route calculation will show a setup-required state until you add your key below.
          </div>
        )}

        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
          A free GraphHopper API key is required for live routing. Get one at{' '}
          <a href="https://graphhopper.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>
            graphhopper.com
          </a>
          . Your key is stored in your browser only — never sent to any Big V server.
        </p>

        <label className="field">
          <span>GraphHopper API key</span>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="Enter your GraphHopper API key…"
              style={{ paddingRight: 44 }}
            />
            <button
              className="ghost"
              onClick={() => setShowKey((v) => !v)}
              style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: '4px 8px', border: 'none', background: 'transparent' }}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <small>Stored in <code>localStorage</code> only. Never shared. Overridden by <code>VITE_GRAPHHOPPER_API_KEY</code> if set.</small>
        </label>

        <button className="primary" onClick={saveKey} style={{ marginTop: 8 }}>
          {saved ? <><CheckCircle size={16} /> Saved</> : 'Save API key'}
        </button>

        {(hasKey || envKeySet) && (
          <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 12 }}>
            ✓ API key configured — live GraphHopper routing active.
          </p>
        )}

        {devFallbackEnabled && (
          <div className="statusBanner demo" style={{ marginTop: 14 }}>
            <Info size={14} />
            <span>
              <strong>Developer fallback mode active</strong> — <code>VITE_ENABLE_DEV_ROUTE_FALLBACK=true</code>.
              A straight-line dev route will be used when no API key is set. Remove this flag for production.
            </span>
          </div>
        )}
      </section>

      {/* ── Display preferences ───────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Display preferences</p>
            <h2>Units</h2>
          </div>
          <Settings2 size={22} style={{ color: 'var(--muted)' }} />
        </div>

        <div className="toggleRow">
          <div>
            <strong>{metricOn ? 'Metric units (km, m)' : 'Imperial units (mi, yd)'}</strong>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '3px 0 0' }}>
              Affects distance display in route summaries and navigation.
            </p>
          </div>
          <button
            className={`toggleSwitch ${metricOn ? 'on' : 'off'}`}
            onClick={() => toggleMetric(!metricOn)}
            aria-pressed={metricOn}
            aria-label="Toggle metric units"
          >
            <span className="toggleThumb" />
            <span className="toggleLabel">{metricOn ? 'km' : 'mi'}</span>
          </button>
        </div>
      </section>

      {/* ── Restriction CSV import ─────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Compliance AI — restriction data</p>
            <h2>Import restrictions CSV</h2>
          </div>
          <UploadCloud size={22} style={{ color: roadCount + bridgeCount > 0 ? 'var(--green)' : 'var(--muted)' }} />
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
          Import a CSV file of local bridge heights, weight limits, and road restrictions.
          This data improves Compliance AI advisory accuracy for your vehicle type.
          Stored in your browser only.
        </p>

        <div className="csvSummaryGrid">
          <div className="csvSummaryItem">
            <span>Road restrictions</span>
            <strong style={{ color: roadCount > 0 ? 'var(--green)' : 'var(--muted)' }}>{roadCount}</strong>
          </div>
          <div className="csvSummaryItem">
            <span>Bridge restrictions</span>
            <strong style={{ color: bridgeCount > 0 ? 'var(--green)' : 'var(--muted)' }}>{bridgeCount}</strong>
          </div>
        </div>

        {roadCount + bridgeCount === 0 && (
          <div className="statusBanner demo" style={{ marginBottom: 14 }}>
            <TriangleAlert size={14} />
            No restriction dataset loaded. Compliance AI confidence is reduced without local restriction data.
          </div>
        )}

        {state.restrictions?.importSource && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Last import: <strong>{state.restrictions.importSource}</strong>
            {state.restrictions.lastImportedAt && (
              <> · {new Date(state.restrictions.lastImportedAt).toLocaleString()}</>
            )}
          </p>
        )}

        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>
          CSV format guide:{' '}
          <code>lat, lon, type (road|bridge), maxheight, maxweight, maxwidth, maxlength, description</code>
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCsvUpload} style={{ display: 'none' }} />
          <button className="primary" onClick={() => csvRef.current?.click()}>
            <UploadCloud size={16} /> Import CSV
          </button>
          {(roadCount + bridgeCount > 0) && (
            <button className="ghost" onClick={clearRestrictions} style={{ color: 'var(--danger)' }}>
              <Trash2 size={16} /> Clear restriction data
            </button>
          )}
        </div>

        {csvStatus && (
          <div className={`statusBanner ${csvStatus.type === 'success' ? 'success' : 'error'}`} style={{ marginTop: 14 }}>
            {csvStatus.type === 'success' ? <CheckCircle size={14} /> : <TriangleAlert size={14} />}
            {csvStatus.msg}
          </div>
        )}
      </section>

      {/* ── Environment configuration guide ──────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Developer setup</p>
            <h2>Environment variables</h2>
          </div>
          <Info size={22} style={{ color: 'var(--muted)' }} />
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)', background: 'rgba(0,0,0,.2)', borderRadius: 12, padding: 16, lineHeight: 2 }}>
          <div><span style={{ color: 'var(--green)' }}>VITE_GRAPHHOPPER_API_KEY</span>=your_graphhopper_key_here</div>
          <div><span style={{ color: 'var(--green)' }}>VITE_MAP_STYLE_URL</span>=your_maplibre_style_url_here</div>
          <div><span style={{ color: 'var(--muted)' }}>VITE_ENABLE_DEV_ROUTE_FALLBACK</span>=false</div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
          Copy <code>.env.example</code> to <code>.env</code> and fill in your values. Never commit <code>.env</code> to version control.
        </p>
      </section>

      {/* ── Product identity / about ──────────────────────────────────── */}
      <section className="panel settingsSection aboutPanel">
        <Shield size={22} style={{ color: 'var(--green)', marginBottom: 10 }} />
        <strong style={{ fontSize: 16 }}>Big V's Best Routes™</strong>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Powered by 4P3X Intelligent AI</p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>Created by Kyzel Kreates · Part of the 4P3X Verse</p>
        <p className="disclaimer" style={{ marginTop: 14 }}>
          Big V's Best Routes™ provides advisory route guidance only. It does not guarantee legal route suitability.
          Road signs, local restrictions, police instructions, and driver judgement override app guidance.
          The driver remains responsible for route legality and vehicle safety.
        </p>
      </section>

    </main>
  );
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  }).filter((r) => r.lat && r.lon);
}

import { useState, useRef } from 'react';
import {
  Eye, EyeOff, CheckCircle, UploadCloud, Trash2,
  TriangleAlert, Map, Settings2, FlaskConical,
} from 'lucide-react';

export default function SettingsPage({ state, setState }) {
  const [showKey,    setShowKey]  = useState(false);
  const [saved,      setSaved]    = useState(false);
  const [draftKey,   setDraftKey] = useState(state.settings.graphHopperApiKey || '');
  const [csvStatus,  setCsvStatus] = useState(null); // {type:'success'|'error', msg:string}
  const csvRef = useRef(null);

  const demoOn     = state.settings.demoMode === true;
  const metricOn   = state.settings.useMetric !== false;
  const hasKey     = !!state.settings.graphHopperApiKey;
  const envKeySet  = !!(typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRAPHHOPPER_API_KEY);

  function saveKey() {
    setState((draft) => { draft.settings.graphHopperApiKey = draftKey.trim(); });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function toggleDemo(val) {
    setState((draft) => { draft.settings.demoMode = val; });
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
        });

        setCsvStatus({
          type: 'success',
          msg: `Imported ${rows.length} restriction record${rows.length !== 1 ? 's' : ''}` +
               ` (${roadRows.length} road · ${bridgeRows.length} bridge).`,
        });
      } catch (err) {
        setCsvStatus({ type: 'error', msg: `CSV parse error: ${err.message}` });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function clearRestrictions() {
    setState((draft) => {
      draft.restrictions.roadRestrictions   = [];
      draft.restrictions.bridgeRestrictions = [];
    });
    setCsvStatus({ type: 'success', msg: 'All restriction data cleared.' });
  }

  const roadCount   = state.restrictions?.roadRestrictions?.length   || 0;
  const bridgeCount = state.restrictions?.bridgeRestrictions?.length || 0;

  return (
    <main className="settingsPage">

      {/* ── Demo mode ─────────────────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Routing mode</p>
            <h2>Demo mode</h2>
          </div>
          <FlaskConical size={22} style={{ color: demoOn ? 'var(--warning)' : 'var(--muted)' }} />
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
          When <strong>Demo mode is on</strong>, all route calculations use a straight-line
          fallback route regardless of your API key. Useful for testing UI without making live API calls.
          When <strong>off</strong>, real GraphHopper routing is used if an API key is configured.
        </p>

        <div className="toggleRow">
          <div>
            <strong>{demoOn ? 'Demo mode is ON' : 'Demo mode is OFF'}</strong>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '3px 0 0' }}>
              {demoOn
                ? 'Routing will always use a demo/fallback route.'
                : hasKey || envKeySet
                  ? 'Live GraphHopper routing active.'
                  : 'No API key — app will use demo routes automatically.'}
            </p>
          </div>
          <button
            className={`toggleSwitch ${demoOn ? 'on' : 'off'}`}
            onClick={() => toggleDemo(!demoOn)}
            aria-pressed={demoOn}
            aria-label="Toggle demo mode"
          >
            <span className="toggleThumb" />
            <span className="toggleLabel">{demoOn ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {demoOn && (
          <div className="statusBanner demo" style={{ marginTop: 14 }}>
            <TriangleAlert size={15} />
            Demo mode is active — route calculations will always return a fallback route.
          </div>
        )}
      </section>

      {/* ── GraphHopper API key ───────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Routing provider</p>
            <h2>GraphHopper API key</h2>
          </div>
          <Map size={22} style={{ color: hasKey || envKeySet ? 'var(--green)' : 'var(--muted)' }} />
        </div>

        {envKeySet && (
          <div className="statusBanner success" style={{ marginBottom: 16 }}>
            <CheckCircle size={15} />
            API key loaded from environment variable — live routing active.
          </div>
        )}

        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
          Without an API key the app uses a safe demo route. Add your key to enable live routing.
          Get a free key at{' '}
          <a href="https://graphhopper.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>
            graphhopper.com
          </a>.
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
              disabled={demoOn}
            />
            <button
              className="ghost"
              onClick={() => setShowKey((v) => !v)}
              style={{
                position: 'absolute', right: 6, top: '50%',
                transform: 'translateY(-50%)', padding: '4px 8px',
                border: 'none', background: 'transparent',
              }}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <small>Stored in localStorage only — never sent to any Big V server.</small>
        </label>

        <button
          className="primary"
          onClick={saveKey}
          disabled={demoOn}
          style={{ marginTop: 8 }}
        >
          {saved ? <><CheckCircle size={16} /> Saved</> : 'Save API key'}
        </button>

        {!demoOn && (hasKey || envKeySet) && (
          <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 12 }}>
            ✓ API key configured — live routing active.
          </p>
        )}
        {!demoOn && !hasKey && !envKeySet && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
            No key configured — demo routing will be used automatically.
          </p>
        )}
      </section>

      {/* ── Display preferences ──────────────────────────────────────── */}
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

      {/* ── Restriction CSV import ────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Restriction data</p>
            <h2>Import restrictions CSV</h2>
          </div>
          <UploadCloud size={22} style={{ color: roadCount + bridgeCount > 0 ? 'var(--green)' : 'var(--muted)' }} />
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
          Import a CSV file of local bridge heights, weight limits, and road restrictions to
          improve Compliance AI accuracy. Data is stored in your browser only.
        </p>

        {/* Current data summary */}
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

        {/* CSV format guide */}
        <details style={{ marginBottom: 14 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>
            Expected CSV format (click to expand)
          </summary>
          <pre style={{
            background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)',
            borderRadius: 12, padding: 12, fontSize: 12,
            color: 'var(--green)', overflowX: 'auto', marginTop: 8,
          }}>
{`lat,lon,type,title,detail,value
51.4545,-2.5879,bridge,Low bridge,Maximum clearance 3.8m,3.8
51.4816,-3.1791,road,Weight limit,Max gross weight 7.5t,7.5
51.5074,-0.1278,road,Width restriction,Max width 2.0m,2.0`}
          </pre>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>
            Required columns: <code>lat</code>, <code>lon</code>, <code>type</code> (bridge or road),
            <code>title</code>, <code>detail</code>.
            The <code>value</code> column is optional (used for numeric limit checks).
          </p>
        </details>

        {/* Upload button */}
        <input
          ref={csvRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleCsvUpload}
        />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="primary" onClick={() => csvRef.current?.click()}>
            <UploadCloud size={16} /> Upload restriction CSV
          </button>
          {(roadCount + bridgeCount) > 0 && (
            <button className="dangerButton" onClick={clearRestrictions}>
              <Trash2 size={15} /> Clear all restriction data
            </button>
          )}
        </div>

        {/* Upload status */}
        {csvStatus && (
          <div className={`statusBanner ${csvStatus.type === 'error' ? 'error' : 'success'}`} style={{ marginTop: 12 }}>
            {csvStatus.type === 'error' ? <TriangleAlert size={15} /> : <CheckCircle size={15} />}
            {csvStatus.msg}
          </div>
        )}

        <p className="disclaimer" style={{ marginTop: 14 }}>
          Imported restriction data is advisory only. Always verify road signs and local notices.
          This data does not replace official restriction surveys or professional routing compliance.
        </p>
      </section>

      {/* ── Env variable reference ────────────────────────────────────── */}
      <section className="panel settingsSection">
        <div className="settingsSectionHeader">
          <div>
            <p className="eyebrow">Production deployment</p>
            <h2>Environment variable</h2>
          </div>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
          For production deployments, set your API key via environment variable:
        </p>
        <pre style={{
          background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)',
          borderRadius: 12, padding: 14, fontSize: 13,
          color: 'var(--green)', overflowX: 'auto',
        }}>
{`# .env
VITE_GRAPHHOPPER_API_KEY=your_graphhopper_key_here`}
        </pre>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          The app checks <code>import.meta.env.VITE_GRAPHHOPPER_API_KEY</code> first,
          then falls back to the value saved in Settings above.
        </p>
      </section>

    </main>
  );
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    // Coerce lat/lon to numbers
    if (row.lat) row.lat = parseFloat(row.lat);
    if (row.lon) row.lon = parseFloat(row.lon);
    if (row.value) row.value = parseFloat(row.value);
    return row;
  }).filter((r) => r.lat && r.lon && !isNaN(r.lat) && !isNaN(r.lon));
}

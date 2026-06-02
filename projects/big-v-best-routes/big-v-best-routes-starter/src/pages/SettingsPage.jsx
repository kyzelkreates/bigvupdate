/**
 * SettingsPage.jsx — Settings page shell
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 * Created by Kyzel Kreates — Part of the 4P3X Verse
 *
 * Hosts:
 *   - SettingsPanel (new service config layer)
 *   - Restriction CSV import (existing, preserved)
 *   - Unit preference toggle (existing, preserved)
 *
 * No storage is duplicated — all state flows through storage.js SSOT.
 */

import { useRef, useState } from 'react';
import {
  UploadCloud, Trash2, CheckCircle, TriangleAlert, Info,
} from 'lucide-react';

import SettingsPanel from '../components/settings/SettingsPanel.jsx';

export default function SettingsPage({ state, setState }) {
  const [csvStatus, setCsvStatus] = useState(null);
  const csvRef = useRef(null);

  const metricOn    = state.settings.useMetric !== false;
  const roadCount   = state.restrictions?.roadRestrictions?.length   || 0;
  const bridgeCount = state.restrictions?.bridgeRestrictions?.length || 0;

  // ── Unit preference ────────────────────────────────────────────────────────

  function toggleMetric(val) {
    setState((draft) => { draft.settings.useMetric = val; });
  }

  // ── CSV restriction import (preserved from original) ──────────────────────

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
        const rows       = parseCsv(ev.target.result);
        if (!rows.length) throw new Error('CSV appears empty.');
        const roadRows   = rows.filter((r) => r.type === 'road'   || r.restriction_type === 'road'   || (!r.type && !r.restriction_type && r.lat && r.lon));
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

  return (
    <main className="settingsPage">

      {/* ── Service configuration panel (new) ─────────────────────────── */}
      <SettingsPanel state={state} setState={setState} />

      {/* ── Unit preference ───────────────────────────────────────────── */}
      <section className="settingsSection legacySection">
        <h2 className="settingsSectionTitle"><Info size={15} /> Display Preferences</h2>

        <div className="settingsCard">
          <div className="settingsField toggleRow">
            <label className="settingsLabel toggleLabel">
              Units
              <span className="settingsHint toggleHint">Distance and speed display units</span>
            </label>
            <div className="unitToggle">
              <button
                type="button"
                className={`unitBtn ${metricOn ? 'active' : ''}`}
                onClick={() => toggleMetric(true)}
              >
                Metric (km)
              </button>
              <button
                type="button"
                className={`unitBtn ${!metricOn ? 'active' : ''}`}
                onClick={() => toggleMetric(false)}
              >
                Imperial (mi)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Restriction CSV import ─────────────────────────────────────── */}
      <section className="settingsSection legacySection">
        <h2 className="settingsSectionTitle">
          <UploadCloud size={15} /> Road & Bridge Restrictions
        </h2>
        <p className="settingsSectionDesc">
          Import custom restriction data in CSV format.
          Used by the Compliance AI and restriction agents to flag route conflicts.
        </p>

        <div className="settingsCard">
          <div className="restrictionStats">
            <span><strong>{roadCount}</strong> road restrictions</span>
            <span><strong>{bridgeCount}</strong> bridge restrictions</span>
            {state.restrictions?.importSource && (
              <span className="restrictionSource">
                Source: {state.restrictions.importSource}
              </span>
            )}
            {state.restrictions?.lastImportedAt && (
              <span className="restrictionSource">
                Imported: {new Date(state.restrictions.lastImportedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="csvActions">
            <input
              ref={csvRef} type="file" accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCsvUpload}
              aria-label="Upload restriction CSV file"
            />
            <button
              type="button" className="primary small"
              onClick={() => csvRef.current?.click()}
            >
              <UploadCloud size={14} /> Upload CSV
            </button>
            {(roadCount > 0 || bridgeCount > 0) && (
              <button type="button" className="ghost small danger" onClick={clearRestrictions}>
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>

          {csvStatus && (
            <div className={`csvStatusMsg ${csvStatus.type === 'error' ? 'testFail' : 'testOk'}`} role="status">
              {csvStatus.type === 'error'
                ? <TriangleAlert size={13} />
                : <CheckCircle   size={13} />
              }
              {csvStatus.msg}
            </div>
          )}

          <div className="settingsInfoBox">
            <Info size={12} /> CSV format: columns <code>lat</code>, <code>lon</code>, <code>type</code> (road/bridge),
            and optional <code>restriction_type</code>, <code>description</code>, <code>max_weight_t</code>,
            <code>max_height_m</code>, <code>max_width_m</code>.
          </div>
        </div>
      </section>

      {/* ── Advisory footer ───────────────────────────────────────────── */}
      <footer className="settingsFooter">
        <p>
          <strong>Big V's Best Routes™</strong> provides advisory routing and compliance support.
          Drivers remain responsible for checking live road signs, legal restrictions,
          vehicle suitability, and road conditions.
        </p>
        <p className="settingsBrand" style={{ marginTop: 6 }}>
          Powered by <strong>4P3X Intelligent AI</strong> · Created by <strong>Kyzel Kreates</strong>
        </p>
      </footer>

    </main>
  );
}

// ─── CSV parser (preserved from original) ─────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  }).filter((r) => r.lat && r.lon);
}

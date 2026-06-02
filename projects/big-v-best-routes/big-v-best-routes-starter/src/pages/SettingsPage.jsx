import { useState } from 'react';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function SettingsPage({ state, setState }) {
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftKey, setDraftKey] = useState(state.settings.graphHopperApiKey || '');

  function saveKey() {
    setState((draft) => {
      draft.settings.graphHopperApiKey = draftKey.trim();
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <main className="settingsPage">
      <section className="panel" style={{ maxWidth: 620 }}>
        <p className="eyebrow">Routing provider</p>
        <h2>GraphHopper API key</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.5, marginBottom: 18 }}>
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
          <small>Stored in localStorage only — never sent to any Big V server.</small>
        </label>

        <button className="primary" onClick={saveKey} style={{ marginTop: 8 }}>
          {saved ? <><CheckCircle size={16} /> Saved</> : 'Save API key'}
        </button>

        {state.settings.graphHopperApiKey && (
          <p style={{ color: 'var(--green)', fontSize: 13, marginTop: 12 }}>
            ✓ API key configured — live routing active.
          </p>
        )}
        {!state.settings.graphHopperApiKey && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 12 }}>
            No key configured — demo/fallback routing mode active.
          </p>
        )}
      </section>

      <section className="panel" style={{ maxWidth: 620, marginTop: 18 }}>
        <p className="eyebrow">Display preferences</p>
        <h2>Units and routing</h2>

        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <input
            type="checkbox"
            checked={state.settings.useMetric}
            onChange={(e) => setState((d) => { d.settings.useMetric = e.target.checked; })}
            style={{ width: 22, height: 22 }}
          />
          <span>Use metric units (km, m)</span>
        </label>

        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <input
            type="checkbox"
            checked={state.settings.demoMode}
            onChange={(e) => setState((d) => { d.settings.demoMode = e.target.checked; })}
            style={{ width: 22, height: 22 }}
          />
          <span>Force demo mode (ignore API key, always use demo route)</span>
        </label>
      </section>

      <section className="panel" style={{ maxWidth: 620, marginTop: 18 }}>
        <p className="eyebrow">Environment variable</p>
        <h2>Production deployment</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
          For production deployments, set your API key via environment variable instead of localStorage:
        </p>
        <pre style={{
          background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', borderRadius: 12,
          padding: 14, fontSize: 13, color: 'var(--green)', overflowX: 'auto',
        }}>
{`# .env
VITE_GRAPHHOPPER_API_KEY=your_graphhopper_key_here`}
        </pre>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          The app checks <code>import.meta.env.VITE_GRAPHHOPPER_API_KEY</code> first,
          then falls back to the value stored in Settings.
        </p>
      </section>
    </main>
  );
}

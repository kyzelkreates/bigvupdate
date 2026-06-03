import { Navigation, Clock, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatDistance, formatDuration, formatETA } from '../utils/formatters.js';

export default function RouteSummaryPanel({ routeResult, compliance, onStartNavigation, navLocked }) {
  if (!routeResult?.route) return null;
  const { route, demoMode, originLabel, destLabel, message } = routeResult;

  return (
    <section className="panel routeSummaryPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Route summary</p>
          <h2>
            {formatDistance(route.distanceM)}
            <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 16, marginLeft: 8 }}>
              · {formatDuration(route.durationMs)}
            </span>
          </h2>
        </div>
        <button
          className="primary"
          onClick={onStartNavigation}
          disabled={navLocked}
        >
          <Navigation size={16} /> Start navigation
        </button>
      </div>

      <div className="summaryGrid">
        <div className="summaryItem">
          <span><MapPin size={12} /> From</span>
          <strong>{originLabel || 'Origin'}</strong>
        </div>
        <div className="summaryItem">
          <span><MapPin size={12} /> To</span>
          <strong>{destLabel || 'Destination'}</strong>
        </div>
        <div className="summaryItem">
          <span><Clock size={12} /> ETA</span>
          <strong>{formatETA(route.durationMs)}</strong>
        </div>
        <div className="summaryItem">
          <span>Confidence</span>
          <strong style={{ color: scoreColor(compliance?.score) }}>
            {compliance?.score ?? '—'}%
          </strong>
        </div>
      </div>

      {demoMode && (
        <div className="statusBanner demo" style={{ marginTop: 12 }}>
          <AlertTriangle size={14} />
          {message || 'Demo route — add a GraphHopper API key for live routing.'}
        </div>
      )}

      {/* Turn-by-turn instructions preview */}
      {route.instructions?.length > 0 && (
        <div className="instructionsList">
          <p className="eyebrow" style={{ marginTop: 14 }}>Turn-by-turn preview</p>
          {route.instructions.slice(0, 5).map((ins, i) => (
            <div className="instructionItem" key={i}>
              <span className="instrIcon">{signIcon(ins.sign)}</span>
              <span className="instrText">{ins.text || 'Continue'}</span>
              <span className="instrDist">{formatDistance(ins.distanceM)}</span>
            </div>
          ))}
          {route.instructions.length > 5 && (
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>
              +{route.instructions.length - 5} more instructions
            </p>
          )}
        </div>
      )}

      <p className="disclaimer" style={{ marginTop: 12 }}>
        Route is advisory only. Always obey road signs and local restrictions.
        Driver is responsible for route legality.
      </p>
    </section>
  );
}

function scoreColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 80) return 'var(--green)';
  if (score >= 55) return 'var(--warning)';
  return 'var(--danger)';
}

function signIcon(sign) {
  // GraphHopper turn signs: 0=straight, -2=left, 2=right, -3=sharp left, 3=sharp right, 4=finish
  if (sign === 4) return '🏁';
  if (sign === 2 || sign === 3) return '→';
  if (sign === -2 || sign === -3) return '←';
  if (sign === -7 || sign === 7) return 'U';
  return '↑';
}

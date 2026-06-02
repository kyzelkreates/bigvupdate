import { Trash2, Navigation, MapPin, Clock, ShieldCheck } from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/formatters.js';
import { removeCachedTrip, getCachedTrips } from '../services/offlineCache.js';

export default function SavedTripsPage({ state, setState }) {
  // Merge SSOT saved trips with localStorage cache
  const savedTrips = state.trip.savedTrips || getCachedTrips();

  function removeTrip(id) {
    removeCachedTrip(id);
    setState((draft) => {
      draft.trip.savedTrips = (draft.trip.savedTrips || []).filter((t) => t.id !== id);
    });
  }

  function loadTrip(trip) {
    setState((draft) => {
      draft.trip.origin = trip.origin;
      draft.trip.destination = trip.destination;
      draft.app.mode = 'planner';
    });
  }

  if (!savedTrips || savedTrips.length === 0) {
    return (
      <main className="settingsPage">
        <section className="panel" style={{ maxWidth: 640 }}>
          <p className="eyebrow">Saved trips</p>
          <h2>No saved trips yet</h2>
          <p style={{ color: 'var(--muted)' }}>
            Calculate a route on the Trip Planning dashboard, then click <strong>Save trip</strong>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="settingsPage">
      <section className="panel" style={{ maxWidth: 720 }}>
        <p className="eyebrow">Saved trips</p>
        <h2>{savedTrips.length} saved trip{savedTrips.length !== 1 ? 's' : ''}</h2>
      </section>

      <div style={{ display: 'grid', gap: 14, marginTop: 14, maxWidth: 720 }}>
        {savedTrips.map((trip) => (
          <article
            key={trip.id}
            style={{
              border: '1px solid var(--line)',
              borderRadius: 20,
              padding: 18,
              background: 'var(--panel)',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>{trip.vehicleName} · {trip.vehicleType?.toUpperCase()}</p>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />
                  {trip.origin} → {trip.destination}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="ghost" style={{ padding: '8px 12px' }} onClick={() => loadTrip(trip)} title="Load trip">
                  <Navigation size={15} />
                </button>
                <button className="dangerButton" style={{ padding: '8px 12px' }} onClick={() => removeTrip(trip.id)} title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              {trip.distanceM && (
                <span><strong style={{ color: 'var(--text)' }}>{formatDistance(trip.distanceM)}</strong></span>
              )}
              {trip.durationMs && (
                <span><Clock size={12} style={{ display: 'inline', marginRight: 3 }} />{formatDuration(trip.durationMs)}</span>
              )}
              {trip.complianceScore != null && (
                <span>
                  <ShieldCheck size={12} style={{ display: 'inline', marginRight: 3 }} />
                  <span style={{ color: trip.complianceScore >= 80 ? 'var(--green)' : trip.complianceScore >= 55 ? 'var(--warning)' : 'var(--danger)' }}>
                    {trip.complianceScore}% compliance
                  </span>
                </span>
              )}
              {trip.demoMode && <span style={{ color: 'var(--warning)' }}>Demo route</span>}
              <span>{new Date(trip.savedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

/**
 * locationService.js — Browser Geolocation adapter (FULL PRODUCT VERSION)
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Abstracts the browser Geolocation API.
 * Returns structured position or error — never throws, never crashes.
 * Components must never call navigator.geolocation directly.
 *
 * GPS state shape (exported for SSOT consumers):
 * {
 *   permission,        // 'unknown' | 'granted' | 'denied' | 'unavailable'
 *   isWatching,        // bool
 *   currentPosition,   // { lat, lon, accuracy, heading, speed, timestamp } | null
 *   previousPosition,  // previous position for derived heading
 *   heading,           // degrees 0–360 or null
 *   speed,             // m/s or null
 *   speedKph,          // km/h or null
 *   speedMph,          // mph or null
 *   accuracy,          // metres or null
 *   gpsConfidence,     // 0–100
 *   lastUpdated,       // ISO string or null
 *   isStale,           // bool — true if last update > GPS_STALE_THRESHOLD_MS ago
 *   error,             // { code, message } | null
 * }
 *
 * ADVISORY ONLY — never guarantees legal route compliance.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
export const GPS_STALE_THRESHOLD_MS     = 15_000;   // 15s
export const LOW_ACCURACY_THRESHOLD_M   = 75;        // metres
export const HIGH_ACCURACY_THRESHOLD_M  = 20;        // metres

const DEFAULT_WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout:            12_000,
  maximumAge:         2_000,
};

const DEFAULT_ONCE_OPTIONS = {
  enableHighAccuracy: true,
  timeout:            12_000,
  maximumAge:         8_000,
};

// ─── Module-level watch state (not SSOT — watcher lifecycle only) ──────────
let _activeWatchId = null;

// ─── Permission check ─────────────────────────────────────────────────────────

/**
 * Check GPS permission state without triggering a browser prompt.
 * Returns 'granted' | 'denied' | 'prompt' | 'unavailable'.
 */
export async function checkLocationPermission() {
  if (!navigator.geolocation)        return 'unavailable';
  if (!navigator.permissions)        return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;   // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}

/**
 * Request location permission by triggering a one-shot GPS fix.
 * Resolves with { granted: bool, position?, error? }.
 * Never throws.
 */
export async function requestLocationPermission() {
  if (!navigator.geolocation) {
    return {
      granted:  false,
      error:    { code: 'UNSUPPORTED', message: 'GPS is not supported by this browser.' },
    };
  }
  try {
    const pos = await getCurrentPositionOnce();
    return { granted: true, position: pos };
  } catch (err) {
    const isDenied = err.code === 1;
    return {
      granted: false,
      error:   {
        code:    err.code || 'ERROR',
        message: isDenied
          ? 'GPS permission is required for live navigation. Route planning still works without live GPS.'
          : (err.message || 'Location unavailable.'),
      },
    };
  }
}

// ─── Single fix ───────────────────────────────────────────────────────────────

/**
 * Get a single GPS fix.
 * Resolves with normalised position or rejects with { code, message }.
 */
export function getCurrentPositionOnce(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(normalizePosition(pos)),
      (err) => reject(buildLocationError(err)),
      { ...DEFAULT_ONCE_OPTIONS, ...options },
    );
  });
}

// ─── Watch (continuous) ───────────────────────────────────────────────────────

/**
 * Start watching GPS position.
 * Calls onPosition with normalised position on every update.
 * Calls onError with { code, message } on error.
 * Returns watchId — pass to stopLocationWatch() on cleanup.
 *
 * Only one watch is active at a time — calling this again while watching
 * returns the existing watchId without creating a duplicate.
 */
export function startLocationWatch(onPosition, onError, options = {}) {
  if (!navigator.geolocation) {
    onError({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
    return null;
  }
  // Avoid duplicate watchers
  if (_activeWatchId != null) return _activeWatchId;

  let _lastPos = null;

  _activeWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const normalised = normalizePosition(pos, _lastPos);
      _lastPos = normalised;
      onPosition(normalised);
    },
    (err) => {
      onError(buildLocationError(err));
    },
    { ...DEFAULT_WATCH_OPTIONS, ...options },
  );
  return _activeWatchId;
}

/**
 * Stop the active location watch.
 * Safe to call even if not watching.
 */
export function stopLocationWatch(watchId) {
  const idToStop = watchId ?? _activeWatchId;
  if (idToStop != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(idToStop);
  }
  if (idToStop === _activeWatchId) _activeWatchId = null;
}

/** Check if a location watch is currently active. */
export function isWatching() {
  return _activeWatchId != null;
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Normalise a browser GeolocationPosition into a clean object.
 * Derives heading from movement if device doesn't provide one.
 * @param {GeolocationPosition} pos
 * @param {object|null} prevNormalised - previous normalised position for derived heading
 */
export function normalizePosition(pos, prevNormalised = null) {
  const { latitude, longitude, accuracy, heading, speed, altitude, altitudeAccuracy } = pos.coords;

  // Derive heading from movement if device doesn't supply it
  const derivedHeading = (heading == null || isNaN(heading))
    ? calculateHeadingFromMovement(
        prevNormalised?.lat, prevNormalised?.lon,
        latitude, longitude,
      )
    : heading;

  const gpsConfidence = calculateGpsConfidence(accuracy);

  return {
    lat:            latitude,
    lon:            longitude,
    accuracy:       accuracy,
    heading:        derivedHeading,
    speed:          speed,                             // m/s (native browser)
    speedKph:       calculateSpeedKph(speed),
    speedMph:       calculateSpeedMph(speed),
    altitude:       altitude,
    altitudeAccuracy: altitudeAccuracy,
    gpsConfidence,
    source:         'gps',
    timestamp:      pos.timestamp,
    lastUpdated:    new Date(pos.timestamp).toISOString(),
    isStale:        false,
  };
}

// ─── Derived calculations ─────────────────────────────────────────────────────

/**
 * Calculate GPS confidence 0–100 from accuracy in metres.
 * Lower accuracy metres → higher confidence.
 */
export function calculateGpsConfidence(accuracyMetres) {
  if (accuracyMetres == null || isNaN(accuracyMetres)) return 0;
  if (accuracyMetres <= 5)   return 99;
  if (accuracyMetres <= 10)  return 95;
  if (accuracyMetres <= 20)  return 88;
  if (accuracyMetres <= 50)  return 75;
  if (accuracyMetres <= 75)  return 62;
  if (accuracyMetres <= 100) return 50;
  if (accuracyMetres <= 200) return 35;
  if (accuracyMetres <= 500) return 20;
  return 10;
}

/**
 * Calculate bearing (heading) from previous to current position.
 * Returns degrees 0–360 or null if positions are the same.
 */
export function calculateHeadingFromMovement(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  if (lat1 === lat2 && lon1 === lon2) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLon  = toRad(lon2 - lon1);
  const y     = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x     = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
              - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Convert browser speed (m/s) to km/h. */
export function calculateSpeedKph(speedMs) {
  if (speedMs == null || isNaN(speedMs)) return null;
  return Math.round(speedMs * 3.6 * 10) / 10;
}

/** Convert browser speed (m/s) to mph. */
export function calculateSpeedMph(speedMs) {
  if (speedMs == null || isNaN(speedMs)) return null;
  return Math.round(speedMs * 2.23694 * 10) / 10;
}

/**
 * Check if a position timestamp is stale.
 * @param {number} timestamp - GeolocationPosition.timestamp (ms)
 */
export function isPositionStale(timestamp) {
  if (!timestamp) return true;
  return (Date.now() - timestamp) > GPS_STALE_THRESHOLD_MS;
}

// ─── Error builder ────────────────────────────────────────────────────────────

export function buildLocationError(err) {
  const code = err?.code;
  const messages = {
    1: 'GPS permission is required for live navigation. Route planning still works without live GPS.',
    2: 'GPS signal unavailable. Check device location settings.',
    3: 'GPS request timed out. Move to an area with better signal.',
    UNSUPPORTED: 'Geolocation is not supported by this browser.',
  };
  return {
    code:    code || 'UNKNOWN',
    message: messages[code] || messages[err?.code] || err?.message || 'Unknown location error.',
  };
}

/** Handle a location error gracefully — returns a structured error state (never throws). */
export function handleLocationError(err) {
  const structured = buildLocationError(err);
  return {
    permission:   err?.code === 1 ? 'denied' : 'unknown',
    isWatching:   false,
    error:        structured,
  };
}

// ─── Backwards compatibility exports ─────────────────────────────────────────
// These match the old locationService.js API so existing imports still work.

/** @deprecated Use getCurrentPositionOnce() */
export function getCurrentPosition(options = {}) {
  return getCurrentPositionOnce(options);
}

/** @deprecated Use startLocationWatch() / stopLocationWatch() */
export function watchPosition(onPosition, onError, options = {}) {
  return startLocationWatch(onPosition, onError, options);
}

/** @deprecated Use stopLocationWatch() */
export function stopWatching(watchId) {
  return stopLocationWatch(watchId);
}

/** @deprecated Use calculateGpsConfidence() */
export function gpsAccuracyToConfidence(accuracyMetres) {
  return calculateGpsConfidence(accuracyMetres);
}

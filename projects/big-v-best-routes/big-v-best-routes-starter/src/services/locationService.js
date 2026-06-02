/**
 * locationService.js — Browser Geolocation adapter
 * Big V's Best Routes
 *
 * Abstracts the browser Geolocation API.
 * Returns position or a structured error — never crashes.
 * Components must never call navigator.geolocation directly.
 */

/**
 * Request a single GPS fix.
 * Resolves with { lat, lon, accuracy, source } or rejects with { code, message }.
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat:      pos.coords.latitude,
        lon:      pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading:  pos.coords.heading,
        speed:    pos.coords.speed,
        source:   'gps',
        timestamp: pos.timestamp,
      }),
      (err) => {
        const messages = {
          1: 'Location permission denied. Enable location access to use live GPS navigation.',
          2: 'Location unavailable. GPS signal lost or device location is off.',
          3: 'Location request timed out.',
        };
        reject({ code: err.code, message: messages[err.code] || 'Unknown location error.' });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
        ...options,
      },
    );
  });
}

/**
 * Start watching GPS position.
 * Returns a watchId that must be passed to stopWatching() on cleanup.
 *
 * @param {function} onPosition - called with { lat, lon, accuracy, heading, speed, source }
 * @param {function} onError    - called with { code, message }
 */
export function watchPosition(onPosition, onError, options = {}) {
  if (!navigator.geolocation) {
    onError({ code: 'UNSUPPORTED', message: 'Geolocation is not supported by this browser.' });
    return null;
  }

  return navigator.geolocation.watchPosition(
    (pos) => onPosition({
      lat:      pos.coords.latitude,
      lon:      pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      heading:  pos.coords.heading,
      speed:    pos.coords.speed,
      source:   'gps',
      timestamp: pos.timestamp,
    }),
    (err) => {
      const messages = {
        1: 'Location permission denied.',
        2: 'Location unavailable.',
        3: 'Location request timed out.',
      };
      onError({ code: err.code, message: messages[err.code] || 'Unknown location error.' });
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 2000,
      ...options,
    },
  );
}

/** Stop a previously started watch. */
export function stopWatching(watchId) {
  if (watchId != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Calculate GPS confidence percentage based on accuracy (metres).
 * Lower accuracy = lower confidence.
 */
export function gpsAccuracyToConfidence(accuracyMetres) {
  if (accuracyMetres == null) return 0;
  if (accuracyMetres <= 5)   return 99;
  if (accuracyMetres <= 10)  return 95;
  if (accuracyMetres <= 20)  return 88;
  if (accuracyMetres <= 50)  return 75;
  if (accuracyMetres <= 100) return 55;
  if (accuracyMetres <= 250) return 35;
  return 15;
}

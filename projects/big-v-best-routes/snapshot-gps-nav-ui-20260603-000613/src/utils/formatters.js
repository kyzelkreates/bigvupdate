/**
 * Format distance in metres to a human-readable string.
 * @param {number} metres
 * @param {boolean} metric
 */
export function formatDistance(metres, metric = true) {
  if (metres == null || isNaN(metres)) return '—';
  if (metric) {
    if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
    return `${Math.round(metres)} m`;
  }
  const miles = metres / 1609.344;
  if (miles >= 1) return `${miles.toFixed(1)} mi`;
  return `${Math.round(metres * 1.0936)} yd`;
}

/**
 * Format duration in milliseconds to h / min / sec.
 * @param {number} ms
 */
export function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}min`;
  if (minutes > 0) return `${minutes} min`;
  return `${totalSeconds}s`;
}

/**
 * Calculate and format an ETA from now + duration.
 * @param {number} durationMs
 */
export function formatETA(durationMs) {
  if (durationMs == null || isNaN(durationMs)) return '—';
  const eta = new Date(Date.now() + durationMs);
  return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Clamp a score between 0 and 100 and return an integer.
 */
export function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Capitalise first letter of a string.
 */
export function capitalise(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Turn snake_case or camelCase into Title Case.
 */
export function humanLabel(str) {
  if (!str) return '';
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

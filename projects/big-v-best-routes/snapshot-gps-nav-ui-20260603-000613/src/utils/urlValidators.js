/**
 * urlValidators.js — URL validation utilities
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Safe URL validation for service endpoint configuration.
 * Never throws — always returns a result object.
 */

/**
 * Validate a URL string.
 * @param {string} url
 * @param {object} options
 * @param {boolean} options.requireHttps - default false (localhost allows http)
 * @param {boolean} options.allowMapbox  - allow mapbox:// scheme
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateUrl(url, { requireHttps = false, allowMapbox = false } = {}) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }
  const trimmed = url.trim();
  if (!trimmed) return { valid: false, error: 'URL cannot be empty.' };

  // Allow mapbox:// scheme for Mapbox style URLs
  if (allowMapbox && trimmed.startsWith('mapbox://')) {
    return { valid: true, error: null };
  }

  try {
    const parsed = new URL(trimmed);
    const isHttp  = parsed.protocol === 'http:';
    const isHttps = parsed.protocol === 'https:';

    if (!isHttp && !isHttps) {
      if (allowMapbox && parsed.protocol === 'mapbox:') return { valid: true, error: null };
      return { valid: false, error: 'URL must use http:// or https:// protocol.' };
    }

    // Require HTTPS except for localhost/127.0.0.1 (local dev AI servers)
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.local');
    if (requireHttps && isHttp && !isLocal) {
      return { valid: false, error: 'HTTPS is required for external service URLs.' };
    }

    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

/**
 * Validate a tile URL — must contain {z}, {x}, {y} placeholders.
 * @param {string} url
 * @returns {{ valid: boolean, error: string | null }}
 */
export function validateTileUrl(url) {
  const base = validateUrl(url);
  if (!base.valid) return base;
  if (!url.includes('{z}') || !url.includes('{x}') || !url.includes('{y}')) {
    return { valid: false, error: 'Tile URL must contain {z}, {x}, and {y} placeholders.' };
  }
  return { valid: true, error: null };
}

/**
 * Validate a MapLibre style URL.
 * Accepts https:// or mapbox:// scheme.
 */
export function validateMapStyleUrl(url) {
  if (!url) return { valid: false, error: 'Style URL is required.' };
  if (url.startsWith('mapbox://')) return { valid: true, error: null };
  return validateUrl(url, { allowMapbox: true });
}

/**
 * Validate an AI server URL.
 * Allows http://localhost and https:// external.
 */
export function validateAiServerUrl(url) {
  if (!url) return { valid: false, error: 'Server URL is required.' };
  return validateUrl(url, { requireHttps: false });
}

/**
 * Quick non-throwing safe URL check — returns boolean.
 */
export function isValidUrl(url) {
  return validateUrl(url).valid;
}

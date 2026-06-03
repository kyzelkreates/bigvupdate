/**
 * DriverPositionMarker.jsx — SVG driver position marker for MapLibre GL JS
 * Big V's Best Routes™ — Powered by 4P3X Intelligent AI
 *
 * Renders an SVG navigation arrow + accuracy radius circle.
 * Exported as a React component (for overlays) AND as a raw SVG string
 * (for use as a MapLibre custom marker image).
 *
 * Heading: 0 = North, 90 = East, 180 = South, 270 = West.
 * Accuracy ring: shown only when accuracy < 100m and GPS is real.
 *
 * ADVISORY ONLY — marker position does not guarantee legal route accuracy.
 */

import { memo } from 'react';
import { LOW_ACCURACY_THRESHOLD_M } from '../../services/locationService.js';

// ─── SVG raw string (for MapLibre marker image) ───────────────────────────────

/**
 * Generate SVG string for a navigation arrow.
 * @param {object} opts
 * @param {number} opts.heading    - degrees (0 = N)
 * @param {boolean} opts.isReal    - is real GPS?
 * @param {boolean} opts.isStale   - is GPS stale?
 * @param {boolean} opts.isOffRoute - is driver off-route?
 * @param {number}  opts.size      - SVG size in px (default 40)
 */
export function buildMarkerSvgString({
  heading    = 0,
  isReal     = false,
  isStale    = false,
  isOffRoute = false,
  size       = 40,
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.35;
  const arrowColor = isOffRoute ? '#FF4444' : isStale ? '#FFA500' : isReal ? '#3AF27C' : '#5BA4FD';
  const ringColor  = isOffRoute ? 'rgba(255,68,68,0.3)' : isStale ? 'rgba(255,165,0,0.25)' : 'rgba(58,242,124,0.2)';

  // Arrow points (upward triangle, rotated by heading)
  const arrowPath = `M${cx},${cy - r} L${cx - r * 0.45},${cy + r * 0.55} L${cx},${cy + r * 0.15} L${cx + r * 0.45},${cy + r * 0.55} Z`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="${ringColor}" />
  <g transform="rotate(${heading}, ${cx}, ${cy})">
    <path d="${arrowPath}" fill="${arrowColor}" stroke="rgba(0,0,0,0.4)" stroke-width="1.5" />
  </g>
</svg>`;
}

// ─── React overlay component ──────────────────────────────────────────────────

/**
 * DriverPositionMarker — SVG React overlay.
 * Used inside a positioned container on top of the map canvas.
 * Position (x, y in px) is computed by the parent from lat/lon + map project().
 */
const DriverPositionMarker = memo(function DriverPositionMarker({
  x, y,                // pixel position on map canvas
  heading   = 0,
  accuracy  = null,    // metres
  isReal    = false,
  isStale   = false,
  isOffRoute = false,
  pixelsPerMetre = null, // for accuracy ring size
  size      = 44,
}) {
  if (x == null || y == null) return null;

  const arrowColor = isOffRoute ? '#FF4444'
    : isStale   ? '#FFA500'
    : isReal    ? '#3AF27C'
    : '#5BA4FD';

  const ringColor  = isOffRoute ? 'rgba(255,68,68,0.2)'
    : isStale   ? 'rgba(255,165,0,0.15)'
    : 'rgba(58,242,124,0.15)';

  const cx = size / 2;
  const cy = size / 2;
  const r  = size * 0.35;

  const arrowPath = `M${cx},${cy - r} L${cx - r * 0.45},${cy + r * 0.55} L${cx},${cy + r * 0.15} L${cx + r * 0.45},${cy + r * 0.55} Z`;

  // Accuracy ring (only show if real GPS and accuracy data available)
  const showAccuracyRing =
    isReal && accuracy != null && accuracy < 150 && pixelsPerMetre != null;
  const accRingPx = showAccuracyRing
    ? Math.max(size / 2, accuracy * pixelsPerMetre)
    : null;

  return (
    <div
      className="driverMarkerWrap"
      style={{
        position:  'absolute',
        left:       x - size / 2,
        top:        y - size / 2,
        pointerEvents: 'none',
        zIndex:     20,
      }}
      aria-label={`Driver position${isOffRoute ? ' — off route' : ''}`}
    >
      {/* Accuracy ring */}
      {showAccuracyRing && (
        <div
          className="driverAccuracyRing"
          style={{
            position: 'absolute',
            width:  accRingPx * 2,
            height: accRingPx * 2,
            left:   size / 2 - accRingPx,
            top:    size / 2 - accRingPx,
            border: `1px solid ${arrowColor}`,
            background: `${arrowColor}15`,
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Navigation arrow SVG */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
        aria-hidden="true"
      >
        <circle cx={cx} cy={cy} r={r * 0.9} fill={ringColor} />
        <g transform={`rotate(${heading}, ${cx}, ${cy})`}>
          <path
            d={arrowPath}
            fill={arrowColor}
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="1.5"
          />
        </g>
        {isStale && (
          <circle
            cx={cx + r * 0.85}
            cy={cy - r * 0.85}
            r={r * 0.35}
            fill="#FFA500"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="1"
          />
        )}
      </svg>
    </div>
  );
});

export default DriverPositionMarker;

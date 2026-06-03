/**
 * Decode a Google-encoded polyline string into [[lat, lng], ...] pairs.
 * GraphHopper returns encoded polylines in this format.
 */
export function decodePolyline(encoded, precision = 5) {
  const factor = Math.pow(10, precision);
  const result = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result_chunk = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_chunk |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result_chunk & 1 ? ~(result_chunk >> 1) : result_chunk >> 1;
    lat += dlat;

    shift = 0;
    result_chunk = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result_chunk |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result_chunk & 1 ? ~(result_chunk >> 1) : result_chunk >> 1;
    lng += dlng;

    result.push([lat / factor, lng / factor]);
  }
  return result;
}

/**
 * Convert [[lat, lng]] array to SVG-friendly normalised screen coords
 * within a viewBox of (0,0,width,height).
 */
export function polylineToSvgPoints(coords, width = 420, height = 680, padding = 30) {
  if (!coords || coords.length < 2) return [];
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const rangeX = maxLng - minLng || 1;
  const rangeY = maxLat - minLat || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  return coords.map(([lat, lng]) => {
    const x = padding + ((lng - minLng) / rangeX) * innerW;
    // SVG y is inverted — higher lat = lower y
    const y = padding + ((maxLat - lat) / rangeY) * innerH;
    return [x, y];
  });
}

export function svgPointsToPath(points) {
  if (!points || points.length < 2) return '';
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

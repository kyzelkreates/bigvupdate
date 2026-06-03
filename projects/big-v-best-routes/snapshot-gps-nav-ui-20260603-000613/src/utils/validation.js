import { fieldDefinitions, vehicleTemplates } from '../config/vehicleTemplates.js';

/**
 * Validate a vehicle profile against its template.
 * Returns { valid: boolean, errors: { [fieldKey]: string } }
 */
export function validateVehicle(vehicle) {
  const errors = {};
  if (!vehicle) return { valid: false, errors: { _: 'No vehicle provided.' } };
  const template = vehicleTemplates[vehicle.type];
  if (!template) return { valid: false, errors: { _: `Unknown vehicle type: ${vehicle.type}` } };

  for (const fieldKey of template.fields) {
    const def = fieldDefinitions[fieldKey];
    if (!def) continue;
    const value = vehicle.fields?.[fieldKey];
    if (def.required && (value === undefined || value === null || value === '')) {
      errors[fieldKey] = `${def.label} is required.`;
      continue;
    }
    if (def.type === 'number' && value !== '' && value !== undefined && value !== null) {
      const num = Number(value);
      if (isNaN(num)) {
        errors[fieldKey] = `${def.label} must be a number.`;
      } else if (def.min !== undefined && num < def.min) {
        errors[fieldKey] = `${def.label} must be ≥ ${def.min}.`;
      } else if (def.max !== undefined && num > def.max) {
        errors[fieldKey] = `${def.label} must be ≤ ${def.max}.`;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a trip object.
 */
export function validateTrip(trip) {
  const errors = {};
  if (!trip?.origin || trip.origin.trim() === '') errors.origin = 'Origin is required.';
  if (!trip?.destination || trip.destination.trim() === '') errors.destination = 'Destination is required.';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate coordinate pair.
 */
export function isValidCoord(lat, lon) {
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    !isNaN(lat) && !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

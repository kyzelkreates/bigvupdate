/**
 * vehicleTemplates.js — Modular vehicle input config
 * Each vehicle type shows ONLY its relevant legal/physical/routing fields.
 * No mega-form. No irrelevant fields. Field order is deliberate (legal-critical first).
 */

export const fieldDefinitions = {
  // ── Identification / preferences ──────────────────────────────────────────
  fuelType: {
    label: 'Fuel type', type: 'select',
    options: ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Hydrogen'],
    required: false, legalCritical: false,
    helper: 'Used for emissions zone and LEZ guidance.',
    defaultValue: 'Diesel',
  },
  emissionsClass: {
    label: 'Emissions class', type: 'text',
    required: false, legalCritical: true,
    helper: 'e.g. Euro VI, Euro 5, ULEZ-compliant. Required for Clean Air Zone guidance.',
    defaultValue: '',
  },
  tollPreference: {
    label: 'Toll preference', type: 'select',
    options: ['Use toll roads', 'Avoid tolls where possible', 'No preference'],
    required: false, legalCritical: false,
    helper: 'Controls whether toll roads are preferred or avoided.',
    defaultValue: 'No preference',
  },
  avoidMotorways: {
    label: 'Avoid motorways', type: 'checkbox',
    required: false, legalCritical: false,
    helper: 'Routing preference — some vehicles cannot legally use motorways.',
    defaultValue: false,
  },

  // ── Physical dimensions ───────────────────────────────────────────────────
  heightM: {
    label: 'Vehicle height (m)', type: 'number', min: 0, max: 7, step: 0.01,
    required: true, legalCritical: true,
    helper: 'Used for low bridge and height restriction checks. Measure to highest fixed point.',
    defaultValue: '',
  },
  widthM: {
    label: 'Vehicle width (m)', type: 'number', min: 0, max: 5, step: 0.01,
    required: true, legalCritical: true,
    helper: 'Used for narrow road and width restriction checks.',
    defaultValue: '',
  },
  lengthM: {
    label: 'Vehicle length (m)', type: 'number', min: 0, max: 30, step: 0.1,
    required: true, legalCritical: true,
    helper: 'Used for length restrictions and turning risk.',
    defaultValue: '',
  },
  grossWeightT: {
    label: 'Gross vehicle weight (t)', type: 'number', min: 0, max: 200, step: 0.1,
    required: true, legalCritical: true,
    helper: 'Used for weight restriction and bridge limit checks.',
    defaultValue: '',
  },
  axleWeightT: {
    label: 'Maximum axle weight (t)', type: 'number', min: 0, max: 30, step: 0.1,
    required: false, legalCritical: true,
    helper: 'Used where axle-load limits are available. UK single axle limit typically 10–11.5t.',
    defaultValue: '',
  },
  axleCount: {
    label: 'Number of axles', type: 'number', min: 1, max: 12, step: 1,
    required: false, legalCritical: true,
    helper: 'Improves heavy vehicle suitability scoring.',
    defaultValue: '',
  },
  hazardousGoods: {
    label: 'Carrying hazardous goods (ADR)', type: 'checkbox',
    required: false, legalCritical: true,
    helper: 'Flags route for mandatory HAZMAT manual legal review. Advisory only.',
    defaultValue: false,
  },

  // ── Towing ───────────────────────────────────────────────────────────────
  towingVehicleType: {
    label: 'Towing vehicle type', type: 'select',
    options: ['Car', 'Van', 'SUV', 'Pickup', 'Motorhome'],
    required: true, legalCritical: true,
    helper: 'Towing capacity depends on the towing vehicle type.',
    defaultValue: 'Car',
  },
  towing: {
    label: 'Currently towing trailer/caravan', type: 'checkbox',
    required: false, legalCritical: true,
    helper: 'Adds trailer constraints and towing-specific warnings.',
    defaultValue: false,
  },
  trailerHeightM: {
    label: 'Trailer / caravan height (m)', type: 'number', min: 0, max: 5, step: 0.01,
    required: true, legalCritical: true,
    helper: 'Required for towing profiles and bridge clearance checks.',
    defaultValue: '',
  },
  trailerWidthM: {
    label: 'Trailer / caravan width (m)', type: 'number', min: 0, max: 5, step: 0.01,
    required: false, legalCritical: true,
    helper: 'Used for narrow road checks on trailer/caravan.',
    defaultValue: '',
  },
  trailerLengthM: {
    label: 'Trailer / caravan length (m)', type: 'number', min: 0, max: 20, step: 0.1,
    required: true, legalCritical: true,
    helper: 'Combined length affects manoeuvring and length restrictions.',
    defaultValue: '',
  },
  combinedWeightT: {
    label: 'Combined gross train weight (t)', type: 'number', min: 0, max: 200, step: 0.1,
    required: true, legalCritical: true,
    helper: 'Towing vehicle + trailer/caravan combined weight.',
    defaultValue: '',
  },

  // ── Routing preferences ───────────────────────────────────────────────────
  narrowRoadAvoidance: {
    label: 'Avoid narrow roads where possible', type: 'checkbox',
    required: false, legalCritical: false,
    helper: 'Useful for motorhomes, coaches, and large vans.',
    defaultValue: false,
  },
  passengerClass: {
    label: 'Passenger vehicle class', type: 'select',
    options: ['Minibus (≤16 seats)', 'Coach', 'Bus', 'Double-decker'],
    required: true, legalCritical: true,
    helper: 'Affects bus-lane permissions and route restriction context.',
    defaultValue: '',
  },
  busLanePermission: {
    label: 'Bus lane permitted', type: 'checkbox',
    required: false, legalCritical: false,
    helper: 'Mark if this vehicle is permitted to use bus lanes on this route.',
    defaultValue: false,
  },
  roadSurfaceRisk: {
    label: 'Road surface risk preference', type: 'select',
    options: ['Normal', 'Avoid poor surfaces', 'Prefer main roads'],
    required: false, legalCritical: false,
    helper: 'Useful for motorcycles on wet or uneven roads.',
    defaultValue: 'Normal',
  },
  scenicFastestPreference: {
    label: 'Route style preference', type: 'select',
    options: ['Fastest', 'Most scenic', 'Balanced'],
    required: false, legalCritical: false,
    helper: 'Routing style preference — does not override legal restrictions.',
    defaultValue: 'Fastest',
  },
  cycleLanePreference: {
    label: 'Cycle lane preference', type: 'select',
    options: ['Prefer cycle lanes', 'Balanced', 'Avoid busy roads'],
    required: false, legalCritical: false,
    helper: 'Used for bicycle/e-bike routing preference.',
    defaultValue: 'Prefer cycle lanes',
  },
  elevationDifficulty: {
    label: 'Elevation / hill preference', type: 'select',
    options: ['Normal', 'Avoid steep hills', 'Prefer flat routes'],
    required: false, legalCritical: false,
    helper: 'Useful for e-bikes and cyclists managing battery range.',
    defaultValue: 'Normal',
  },
  batteryRangeKm: {
    label: 'E-bike battery range (km)', type: 'number', min: 0, max: 500, step: 1,
    required: false, legalCritical: false,
    helper: 'Optional: used for e-bike range awareness during trip planning.',
    defaultValue: '',
  },

  // ── Custom vehicle ────────────────────────────────────────────────────────
  customVehicleNote: {
    label: 'Custom vehicle description', type: 'text',
    required: false, legalCritical: false,
    helper: 'Briefly describe the vehicle type for manual review purposes.',
    defaultValue: '',
  },
};

/** Modular vehicle templates — only relevant fields per type */
export const vehicleTemplates = {
  car: {
    label: 'Car',
    graphHopperProfile: 'car',
    fields: ['fuelType', 'emissionsClass', 'avoidMotorways', 'tollPreference'],
  },
  van: {
    label: 'Van',
    graphHopperProfile: 'car',
    fields: ['heightM', 'widthM', 'grossWeightT', 'emissionsClass', 'avoidMotorways', 'tollPreference'],
  },
  hgv: {
    label: 'HGV / Lorry',
    graphHopperProfile: 'truck',
    fields: ['heightM', 'widthM', 'lengthM', 'grossWeightT', 'axleWeightT', 'axleCount', 'hazardousGoods', 'emissionsClass'],
  },
  motorhome: {
    label: 'Motorhome / Campervan',
    graphHopperProfile: 'truck',
    fields: ['heightM', 'widthM', 'lengthM', 'grossWeightT', 'narrowRoadAvoidance', 'tollPreference'],
  },
  trailer: {
    label: 'Caravan / Trailer',
    graphHopperProfile: 'truck',
    fields: ['towingVehicleType', 'towing', 'trailerHeightM', 'trailerWidthM', 'trailerLengthM', 'combinedWeightT'],
  },
  bus: {
    label: 'Coach / Bus / Minibus',
    graphHopperProfile: 'truck',
    fields: ['heightM', 'widthM', 'lengthM', 'grossWeightT', 'passengerClass', 'busLanePermission', 'narrowRoadAvoidance'],
  },
  motorcycle: {
    label: 'Motorcycle',
    graphHopperProfile: 'motorcycle',
    fields: ['avoidMotorways', 'roadSurfaceRisk', 'scenicFastestPreference'],
  },
  bicycle: {
    label: 'Bicycle / E-bike',
    graphHopperProfile: 'bike',
    fields: ['cycleLanePreference', 'elevationDifficulty', 'batteryRangeKm'],
  },
  custom: {
    label: 'Custom vehicle',
    graphHopperProfile: 'truck',
    fields: ['customVehicleNote', 'heightM', 'widthM', 'lengthM', 'grossWeightT', 'axleWeightT', 'hazardousGoods', 'emissionsClass'],
  },
};

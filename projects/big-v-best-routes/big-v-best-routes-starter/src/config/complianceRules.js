/**
 * complianceRules.js — Deterministic advisory compliance rules
 * Big V's Best Routes
 *
 * These rules are used by complianceEngine.js (src/core/complianceEngine.js).
 * Rules are advisory only. They never guarantee legal compliance.
 * The driver remains fully responsible for route legality and vehicle safety.
 */

/** UK HGV standard limits — advisory reference only */
export const UK_HGV_LIMITS = {
  maxGrossWeightT:     44,    // standard UK HGV GVW limit (t)
  maxSingleAxleT:      11.5,  // standard UK single-drive axle limit (t)
  maxTandemAxleT:      18.5,
  maxBridgeHeightM:    5.03,  // common UK bridge clearance warning threshold (m)
  maxWidthM:           2.55,  // standard UK vehicle width limit (m)
  maxLengthM:          18.75, // standard UK articulated max length (m)
};

/** Per-vehicle-type required legal fields — must match fieldDefinitions keys */
export const LEGAL_CRITICAL_FIELDS_BY_TYPE = {
  car:        [],
  van:        ['heightM', 'grossWeightT'],
  hgv:        ['heightM', 'widthM', 'lengthM', 'grossWeightT', 'axleWeightT'],
  motorhome:  ['heightM', 'widthM', 'lengthM', 'grossWeightT'],
  trailer:    ['trailerHeightM', 'trailerLengthM', 'combinedWeightT', 'towingVehicleType'],
  bus:        ['heightM', 'widthM', 'lengthM', 'grossWeightT', 'passengerClass'],
  motorcycle: [],
  bicycle:    [],
  custom:     ['heightM', 'widthM', 'lengthM', 'grossWeightT'],
};

/** Score deductions per issue type */
export const SCORE_DEDUCTIONS = {
  missingLegalCriticalField:  14,
  missingRecommendedField:    7,
  noRouteResult:              12,
  demoOrFallbackRoute:        20,   // higher penalty — product mode should flag this clearly
  noRestrictionData:          18,
  hazardousGoods:             20,
  extremeHeight:              8,
  extremeWeight:              10,
  extremeAxleWeight:          8,
  emissionsClassMissing:      5,
  missingTripInputs:          10,
  providerError:              15,
  offlineMode:                5,
  missingDataThreshold:       45,  // max score when 3+ critical items missing
};

/** Advisory status thresholds (score → status) */
export const ADVISORY_THRESHOLDS = {
  suitable:    82,  // score >= 82 → appears_suitable
  needsReview: 60,  // score >= 60 → needs_review
  highRisk:    35,  // score >= 35 → high_risk
                    // score < 35  → missing_data
};

/** Manual checks always required for these vehicle types */
export const ALWAYS_MANUAL_CHECK_TYPES = ['hgv', 'bus', 'custom'];

/** Mandatory safety disclaimer — must appear on every compliance output */
export const COMPLIANCE_DISCLAIMER =
  "Big V's Best Routes provides advisory route guidance only. " +
  "It does not guarantee legal route suitability. " +
  "Road signs, local restrictions, police instructions, and driver judgement override app guidance. " +
  "The driver remains responsible for route legality and vehicle safety.";

/** Forbidden compliance output phrases — never generate these */
export const FORBIDDEN_PHRASES = [
  'legally guaranteed',
  'fully compliant',
  '100% legal',
  'safe without driver checks',
  'guaranteed route',
];

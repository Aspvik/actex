export const SCHEMA_VERSION = 2;
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const NORMAL_SAMPLE_GAP_SECONDS = 5;
export const HARD_GAP_LIMIT_SECONDS = 30;
export const NP_WINDOW_SECONDS = 30;
export const NP_SHORT_SELECTION_SECONDS = 10 * 60;
export const OUTLIER_POWER_WATTS = 2500;
export const ELEVATION_HYSTERESIS_METERS = 3;

export const DEFAULT_ZONE_BOUNDARIES = [
  { id: "coasting", label: "Z0 - Coasting", minimum: 0, maximum: 0 },
  { id: "recovery", label: "Z1 - Active Recovery", minimum: 0, maximum: 0.55 },
  { id: "endurance", label: "Z2 - Endurance", minimum: 0.55, maximum: 0.76 },
  { id: "tempo", label: "Z3 - Tempo", minimum: 0.76, maximum: 0.88 },
  { id: "sweetSpot", label: "Z4 - Sweet Spot", minimum: 0.88, maximum: 0.95 },
  { id: "threshold", label: "Z5 - Threshold", minimum: 0.95, maximum: 1.06 },
  { id: "vo2", label: "Z6 - VO2 Max", minimum: 1.06, maximum: 1.21 },
  { id: "anaerobic", label: "Z7 - Anaerobic", minimum: 1.21, maximum: null }
];

export const DEFAULT_HEART_RATE_ZONE_BOUNDARIES = [
  { id: "zone1", label: "Z1 - Warm Up", minimum: 0.55, maximum: 0.72 },
  { id: "zone2", label: "Z2 - Easy", minimum: 0.72, maximum: 0.82 },
  { id: "zone3", label: "Z3 - Aerobic", minimum: 0.82, maximum: 0.87 },
  { id: "zone4", label: "Z4 - Threshold", minimum: 0.87, maximum: 0.92 },
  { id: "zone5", label: "Z5 - Maximum", minimum: 0.92, maximum: 1 }
];

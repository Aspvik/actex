export const SCHEMA_VERSION = 1;
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const NORMAL_SAMPLE_GAP_SECONDS = 5;
export const HARD_GAP_LIMIT_SECONDS = 30;
export const NP_WINDOW_SECONDS = 30;
export const NP_SHORT_SELECTION_SECONDS = 10 * 60;
export const OUTLIER_POWER_WATTS = 2500;
export const ELEVATION_HYSTERESIS_METERS = 3;

export const DEFAULT_ZONE_BOUNDARIES = [
  { id: "coasting", label: "Coasting", minimum: 0, maximum: 0 },
  { id: "recovery", label: "Active Recovery", minimum: 0, maximum: 0.55 },
  { id: "endurance", label: "Endurance", minimum: 0.55, maximum: 0.76 },
  { id: "tempo", label: "Tempo", minimum: 0.76, maximum: 0.88 },
  { id: "sweetSpot", label: "Sweet Spot", minimum: 0.88, maximum: 0.95 },
  { id: "threshold", label: "Threshold", minimum: 0.95, maximum: 1.06 },
  { id: "vo2", label: "VO2 Max", minimum: 1.06, maximum: 1.21 },
  { id: "anaerobic", label: "Anaerobic", minimum: 1.21, maximum: null }
];

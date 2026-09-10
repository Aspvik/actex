import { DEFAULT_HEART_RATE_ZONE_BOUNDARIES, DEFAULT_ZONE_BOUNDARIES } from "../utils/constants.js";

const KEY = "actex-settings-v1";
const defaults = () => ({ defaultFtp: null, defaultMaxHeartRate: null, zones: structuredClone(DEFAULT_ZONE_BOUNDARIES), heartRateZones: structuredClone(DEFAULT_HEART_RATE_ZONE_BOUNDARIES), ui: {} });

export const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (!stored || !Array.isArray(stored.zones) || stored.zones.length !== DEFAULT_ZONE_BOUNDARIES.length || (stored.heartRateZones && (!Array.isArray(stored.heartRateZones) || stored.heartRateZones.length !== DEFAULT_HEART_RATE_ZONE_BOUNDARIES.length))) return defaults();
    const settings = { ...defaults(), ...stored };
    const powerLabels = new Map(DEFAULT_ZONE_BOUNDARIES.map((zone) => [zone.id, zone.label]));
    const heartRateLabels = new Map(DEFAULT_HEART_RATE_ZONE_BOUNDARIES.map((zone) => [zone.id, zone.label]));
    return {
      ...settings,
      zones: settings.zones.map((zone) => ({ ...zone, label: powerLabels.get(zone.id) ?? zone.label })),
      heartRateZones: settings.heartRateZones.map((zone) => ({ ...zone, label: heartRateLabels.get(zone.id) ?? zone.label }))
    };
  } catch { return defaults(); }
};
export const saveSettings = (settings) => localStorage.setItem(KEY, JSON.stringify({ defaultFtp: settings.defaultFtp, defaultMaxHeartRate: settings.defaultMaxHeartRate, zones: settings.zones, heartRateZones: settings.heartRateZones, ui: settings.ui ?? {} }));
export const resetSettings = () => { localStorage.removeItem(KEY); return defaults(); };

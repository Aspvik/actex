import { DEFAULT_ZONE_BOUNDARIES } from "../utils/constants.js";

const KEY = "actex-settings-v1";
const defaults = () => ({ defaultFtp: null, zones: structuredClone(DEFAULT_ZONE_BOUNDARIES), units: "metric", ui: {} });

export const loadSettings = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY));
    if (!stored || !["metric", "imperial"].includes(stored.units) || !Array.isArray(stored.zones) || stored.zones.length !== DEFAULT_ZONE_BOUNDARIES.length) return defaults();
    return { ...defaults(), ...stored };
  } catch { return defaults(); }
};
export const saveSettings = (settings) => localStorage.setItem(KEY, JSON.stringify({ defaultFtp: settings.defaultFtp, zones: settings.zones, units: settings.units, ui: settings.ui ?? {} }));
export const resetSettings = () => { localStorage.removeItem(KEY); return defaults(); };

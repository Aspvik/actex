import { round } from "./math.js";
import { formatDuration } from "./time.js";

export const formatNumber = (value, decimals = 0) => value == null ? "Unavailable" : new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(round(value, decimals));
export const formatPercent = (value, decimals = 1) => value == null ? "Unavailable" : `${formatNumber(value * 100, decimals)}%`;
export const formatDate = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Unavailable";
export const formatDateTime = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" }).format(date) : "Unavailable";
export const formatMetricDistance = (meters) => {
  if (meters == null) return "Unavailable";
  return `${formatNumber(meters / 1000, 2)} km`;
};
export const formatSpeed = (metersPerSecond) => {
  if (metersPerSecond == null) return "Unavailable";
  return `${formatNumber(metersPerSecond * 3.6, 1)} km/h`;
};
export const formatMetric = (value, unit, decimals = 0) => value == null ? "Unavailable" : `${formatNumber(value, decimals)} ${unit}`;
export { formatDuration };

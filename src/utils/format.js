import { round } from "./math.js";
import { formatDuration } from "./time.js";

export const formatNumber = (value, decimals = 0) => value == null ? "Unavailable" : new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(round(value, decimals));
export const formatPercent = (value, decimals = 1) => value == null ? "Unavailable" : `${formatNumber(value * 100, decimals)}%`;
export const formatDate = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Unavailable";
export const formatMetricDistance = (meters, units = "metric") => {
  if (meters == null) return "Unavailable";
  return units === "imperial" ? `${formatNumber(meters / 1609.344, 2)} mi` : `${formatNumber(meters / 1000, 2)} km`;
};
export const formatSpeed = (metersPerSecond, units = "metric") => {
  if (metersPerSecond == null) return "Unavailable";
  const multiplier = units === "imperial" ? 2.236936 : 3.6;
  return `${formatNumber(metersPerSecond * multiplier, 1)} ${units === "imperial" ? "mph" : "km/h"}`;
};
export const formatMetric = (value, unit, decimals = 0) => value == null ? "Unavailable" : `${formatNumber(value, decimals)} ${unit}`;
export { formatDuration };

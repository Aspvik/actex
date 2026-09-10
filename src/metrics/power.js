import { intervalsForField } from "../activity/sample-durations.js";
import { OUTLIER_POWER_WATTS } from "../utils/constants.js";
import { maximumField, weightedField } from "./common.js";
import { reconstructPowerSeries } from "./reconstruct-power.js";
import { calculateNormalizedPower } from "./normalized-power.js";

export const calculatePower = (intervals, activeSeconds, ftp, deviceNormalizedPower = null) => {
  const valid = intervalsForField(intervals, "powerWatts");
  const averageWatts = weightedField(intervals, "powerWatts");
  const maximumWatts = maximumField(intervals, "powerWatts");
  const workJoules = valid.reduce((total, interval) => total + interval.record.powerWatts * interval.validSeconds, 0) || null;
  const normalized = calculateNormalizedPower(reconstructPowerSeries(valid), activeSeconds);
  const warnings = normalized.warning ? [normalized.warning] : [];
  if (normalized.watts && deviceNormalizedPower && Math.abs(normalized.watts - deviceNormalizedPower) / normalized.watts >= 0.05) warnings.push(`Calculated NP differs from the device value by ${(Math.abs(normalized.watts - deviceNormalizedPower) / normalized.watts * 100).toFixed(1)}%.`);
  return {
    averageWatts,
    maximumWatts,
    workJoules,
    normalizedPowerWatts: normalized.watts,
    deviceNormalizedPowerWatts: deviceNormalizedPower,
    variabilityIndex: normalized.watts && averageWatts ? normalized.watts / averageWatts : null,
    intensityFactor: normalized.watts && ftp ? normalized.watts / ftp : null,
    warnings
  };
};

export const detectPowerOutliers = (records) => records.flatMap((record, index) => {
  const previous = records[index - 1]?.powerWatts;
  const next = records[index + 1]?.powerWatts;
  return record.powerWatts > OUTLIER_POWER_WATTS && previous != null && next != null && record.powerWatts >= previous * 3 && record.powerWatts >= next * 3
    ? [`A possible isolated power spike of ${record.powerWatts} W was retained in the raw maximum.`] : [];
});

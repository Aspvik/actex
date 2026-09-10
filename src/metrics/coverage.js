import { HARD_GAP_LIMIT_SECONDS } from "../utils/constants.js";
import { median } from "../utils/math.js";
import { intervalsForField } from "../activity/sample-durations.js";

export const fieldCoverage = (intervals, field, activeSeconds) => {
  const validSeconds = intervalsForField(intervals, field).reduce((total, interval) => total + interval.validSeconds, 0);
  return { validSeconds, percentage: activeSeconds ? validSeconds / activeSeconds : null };
};

export const dataQuality = ({ records, selection, timerSegments, intervals, activeSeconds, decodeWarnings = [] }) => {
  const selected = records.filter((record) => record.timestamp >= selection.startTimestamp && record.timestamp < selection.endTimestamp);
  const gaps = selected.slice(1).map((record, index) => (record.timestamp - selected[index].timestamp) / 1000).filter((gap) => gap >= 0);
  const activeGaps = selected.slice(1).flatMap((record, index) => {
    const start = selected[index].timestamp;
    const end = record.timestamp;
    return timerSegments.filter((segment) => segment.timerRunning).map((segment) => Math.max(0, (Math.min(end, segment.endTimestamp) - Math.max(start, segment.startTimestamp)) / 1000)).filter((gap) => gap > 0);
  });
  const largestGap = activeGaps.length ? Math.max(...activeGaps) : null;
  const power = fieldCoverage(intervals, "powerWatts", activeSeconds);
  const heartRate = fieldCoverage(intervals, "heartRateBpm", activeSeconds);
  const cadence = fieldCoverage(intervals, "cadenceRpm", activeSeconds);
  const warnings = [];
  if (power.percentage !== null && power.percentage < 0.9) warnings.push(`Power data is present for ${(power.percentage * 100).toFixed(0)}% of active time. Power-zone durations may be incomplete.`);
  if (largestGap !== null && largestGap >= HARD_GAP_LIMIT_SECONDS) warnings.push(`The activity contains an active recording gap of ${Math.round(largestGap)} seconds. actex did not fabricate samples across this gap.`);
  return {
    recordCount: selected.length,
    activeTimerDurationSeconds: activeSeconds,
    powerCoverage: power,
    heartRateCoverage: heartRate,
    cadenceCoverage: cadence,
    medianRecordIntervalSeconds: median(gaps),
    largestActiveRecordGapSeconds: largestGap,
    decodeWarningCount: decodeWarnings.length,
    warnings
  };
};

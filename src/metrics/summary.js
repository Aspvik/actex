import { activeTimerSeconds } from "../activity/build-timer-state.js";
import { buildSampleIntervals } from "../activity/sample-durations.js";
import { secondsBetween } from "../utils/time.js";
import { dataQuality } from "./coverage.js";
import { calculateHeartRate } from "./heart-rate.js";
import { calculateCadence } from "./cadence.js";
import { calculatePower, detectPowerOutliers } from "./power.js";
import { calculatePowerZones } from "./power-zones.js";
import { calculateSpeedDistance } from "./speed-distance.js";
import { calculateElevation } from "./elevation.js";

export const calculateSelection = ({ activity, selection, timerSegments, ftp = null, zones, session = null }) => {
  const activeDurationSeconds = activeTimerSeconds(timerSegments, selection);
  if (!activeDurationSeconds) throw new Error("The selected range contains no active timer time.");
  const intervals = buildSampleIntervals(activity.records, selection, timerSegments);
  const quality = dataQuality({ records: activity.records, selection, timerSegments, intervals, activeSeconds: activeDurationSeconds, decodeWarnings: activity.diagnostics.decodeWarnings });
  const power = calculatePower(intervals, activeDurationSeconds, ftp, session?.deviceNormalizedPowerWatts ?? null);
  const heartRate = calculateHeartRate(intervals);
  const cadence = calculateCadence(intervals);
  const speed = calculateSpeedDistance(activity.records, intervals, selection, activeDurationSeconds);
  const elevation = calculateElevation(activity.records, selection, session?.totalAscentMeters ?? null, session?.totalDescentMeters ?? null);
  const warnings = [...quality.warnings, ...power.warnings, ...detectPowerOutliers(activity.records)];
  return {
    selection,
    summary: {
      activeDurationSeconds,
      elapsedDurationSeconds: secondsBetween(selection.startTimestamp, selection.endTimestamp),
      pausedDurationSeconds: secondsBetween(selection.startTimestamp, selection.endTimestamp) - activeDurationSeconds,
      ...speed
    },
    power,
    heartRate,
    cadence,
    elevation,
    zones: calculatePowerZones(intervals, ftp, zones),
    quality,
    warnings: [...new Set(warnings)]
  };
};

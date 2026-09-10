import { validIntervalSeconds } from "../activity/sample-durations.js";

/** Produces one-second contiguous segments, deliberately split at pauses and gaps. */
export const reconstructPowerSeries = (intervals) => {
  const output = [];
  for (const interval of intervals) {
    if (interval.record.powerWatts == null) continue;
    const validEnd = new Date(interval.startTimestamp.getTime() + validIntervalSeconds(interval) * 1000);
    for (let cursor = new Date(interval.startTimestamp); cursor < validEnd; cursor = new Date(cursor.getTime() + 1000)) {
      const end = new Date(cursor.getTime() + 1000);
      if (end <= validEnd) output.push({ timestamp: cursor, watts: interval.record.powerWatts });
    }
  }
  return output.toSorted((left, right) => left.timestamp - right.timestamp);
};

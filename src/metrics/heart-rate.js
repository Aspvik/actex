import { intervalsForField } from "../activity/sample-durations.js";
import { maximumField, weightedField } from "./common.js";

export const calculateHeartRateExposure = (intervals, maxHeartRate) => {
  const heartRateIntervals = intervalsForField(intervals, "heartRateBpm");
  const timeAtOrAbove = (ratio) => maxHeartRate == null ? null : heartRateIntervals
    .filter((interval) => interval.record.heartRateBpm >= Math.ceil(maxHeartRate * ratio))
    .reduce((total, interval) => total + interval.validSeconds, 0);
  return {
    timeAtOrAbove90Seconds: timeAtOrAbove(.9),
    timeAtOrAbove95Seconds: timeAtOrAbove(.95)
  };
};

export const calculateHeartRate = (intervals, maxHeartRate) => ({
  averageBpm: weightedField(intervals, "heartRateBpm"),
  maximumBpm: maximumField(intervals, "heartRateBpm"),
  ...calculateHeartRateExposure(intervals, maxHeartRate)
});

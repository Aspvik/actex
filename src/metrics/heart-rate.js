import { maximumField, weightedField } from "./common.js";
export const calculateHeartRate = (intervals) => ({ averageBpm: weightedField(intervals, "heartRateBpm"), maximumBpm: maximumField(intervals, "heartRateBpm") });

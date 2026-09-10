import { maximumField, weightedField } from "./common.js";
export const calculateCadence = (intervals) => ({ averageRpm: weightedField(intervals, "cadenceRpm"), maximumRpm: maximumField(intervals, "cadenceRpm") });

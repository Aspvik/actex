import { maximumField } from "./common.js";

const distanceAt = (records, timestamp) => records
  .filter((record) => record.timestamp <= timestamp && record.distanceMeters != null)
  .toSorted((left, right) => right.timestamp - left.timestamp)[0]?.distanceMeters ?? null;

export const calculateSpeedDistance = (records, intervals, selection, activeSeconds) => {
  const startDistance = distanceAt(records, selection.startTimestamp);
  const endDistance = distanceAt(records, new Date(selection.endTimestamp.getTime() - 1));
  const distanceMeters = startDistance != null && endDistance != null && endDistance >= startDistance ? endDistance - startDistance : null;
  return {
    distanceMeters,
    averageSpeedMps: distanceMeters != null && activeSeconds ? distanceMeters / activeSeconds : null,
    maximumSpeedMps: maximumField(intervals, "speedMps")
  };
};

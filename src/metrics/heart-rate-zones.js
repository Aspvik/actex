import { intervalsForField } from "../activity/sample-durations.js";

export const calculateHeartRateZones = (intervals, maxHeartRate, zones) => {
  if (!Number.isFinite(maxHeartRate) || maxHeartRate <= 0) return [];
  const durations = new Map(zones.map((zone) => [zone.id, 0]));
  const valid = intervalsForField(intervals, "heartRateBpm");
  for (const interval of valid) {
    const ratio = interval.record.heartRateBpm / maxHeartRate;
    const zone = zones.find((item) => ratio >= item.minimum && (item.maximum == null || (item.maximum === 1 ? ratio <= item.maximum : ratio < item.maximum)));
    if (zone) durations.set(zone.id, durations.get(zone.id) + interval.validSeconds);
  }
  const coveredSeconds = valid.reduce((total, interval) => total + interval.validSeconds, 0);
  return zones.map((zone) => ({ ...zone, durationSeconds: durations.get(zone.id), percentage: coveredSeconds ? durations.get(zone.id) / coveredSeconds : null }));
};

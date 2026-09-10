import { intervalsForField } from "../activity/sample-durations.js";

export const classifyPower = (watts, ftp, zones) => {
  if (watts === 0) return zones.find((zone) => zone.id === "coasting") ?? null;
  if (!ftp || watts == null || watts < 0) return null;
  const ratio = watts / ftp;
  return zones.find((zone) => zone.id !== "coasting" && (zone.id === "recovery" ? ratio > zone.minimum : ratio >= zone.minimum) && (zone.maximum === null || ratio < zone.maximum)) ?? null;
};

export const calculatePowerZones = (intervals, ftp, zones) => {
  if (!ftp) return [];
  const durations = new Map(zones.map((zone) => [zone.id, 0]));
  const valid = intervalsForField(intervals, "powerWatts");
  for (const interval of valid) {
    const zone = classifyPower(interval.record.powerWatts, ftp, zones);
    if (zone) durations.set(zone.id, durations.get(zone.id) + interval.validSeconds);
  }
  const coveredSeconds = valid.reduce((total, interval) => total + interval.validSeconds, 0);
  return zones.map((zone) => ({ ...zone, durationSeconds: durations.get(zone.id), percentage: coveredSeconds ? durations.get(zone.id) / coveredSeconds : null }));
};

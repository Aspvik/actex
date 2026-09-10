import { formatDate, formatDuration, formatMetric, formatMetricDistance, formatSpeed } from "../utils/format.js";

export const buildCompactText = (model, units = "metric") => [
  `${model.activity.sport ?? "Activity"}, ${formatDate(new Date(model.activity.startTimestamp))}`,
  `${formatDuration(model.summary.activeDurationSeconds)}, ${formatMetricDistance(model.summary.distanceMeters, units)}, ${formatSpeed(model.summary.averageSpeedMps, units)}`,
  model.power.averageWatts == null ? null : `FTP ${formatMetric(model.power.ftpWatts, "W")}, Avg ${formatMetric(model.power.averageWatts, "W")}, NP ${formatMetric(model.power.normalizedPowerWatts, "W")}, Max ${formatMetric(model.power.maximumWatts, "W")}, IF ${model.power.intensityFactor?.toFixed(2) ?? "Unavailable"}, VI ${model.power.variabilityIndex?.toFixed(2) ?? "Unavailable"}, Work ${formatMetric(model.power.workJoules == null ? null : model.power.workJoules / 1000, "kJ")}`,
  model.heartRate.averageBpm == null ? null : `HR ${formatMetric(model.heartRate.averageBpm, "avg")} / ${formatMetric(model.heartRate.maximumBpm, "max")}`,
  model.cadence.averageRpm == null ? null : `Cadence ${formatMetric(model.cadence.averageRpm, "avg")} / ${formatMetric(model.cadence.maximumRpm, "max")}`,
  model.elevation.gainMeters == null ? null : `Elevation ${formatMetric(model.elevation.gainMeters, "m")}`,
  model.powerZones.length ? `Zones: ${model.powerZones.map((zone) => `${zone.label} ${formatDuration(zone.durationSeconds)}`).join(", ")}` : null
].filter(Boolean).join("\n");

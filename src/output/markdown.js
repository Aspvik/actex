import { formatDate, formatDuration, formatMetric, formatMetricDistance, formatPercent, formatSpeed } from "../utils/format.js";
import { formatRelativeTime } from "../utils/time.js";

const line = (label, value) => value == null ? null : `${label}: ${value}`;
const section = (title, lines) => lines.filter(Boolean).length ? `## ${title}\n\n${lines.filter(Boolean).join("\n")}` : null;

export const buildMarkdown = (model, units = "metric") => {
  const activityStart = new Date(model.activity.startTimestamp);
  const summary = model.summary;
  const power = model.power;
  const quality = model.dataQuality;
  const sections = [
    "# Activity Data\n\nactex schema: 1",
    section("Activity", [
      line("Sport", model.activity.sport), line("Date", formatDate(activityStart)), line("Selection", model.activity.selectionType),
      line("Start", formatRelativeTime(activityStart, new Date(model.selection.startTimestamp))), line("End", formatRelativeTime(activityStart, new Date(model.selection.endTimestamp)))
    ]),
    section("Summary", [line("Active Duration", formatDuration(summary.activeDurationSeconds)), line("Elapsed Duration", formatDuration(summary.elapsedDurationSeconds)), summary.distanceMeters == null ? null : line("Distance", formatMetricDistance(summary.distanceMeters, units)), summary.averageSpeedMps == null ? null : line("Average Speed", formatSpeed(summary.averageSpeedMps, units)), summary.maximumSpeedMps == null ? null : line("Maximum Speed", formatSpeed(summary.maximumSpeedMps, units)), model.elevation.gainMeters == null ? null : line("Elevation Gain", formatMetric(model.elevation.gainMeters, "m"))]),
    section("Power", [power.ftpWatts == null ? null : line("FTP", formatMetric(power.ftpWatts, "W")), power.averageWatts == null ? null : line("Average Power", formatMetric(power.averageWatts, "W")), power.normalizedPowerWatts == null ? null : line("Normalized Power", formatMetric(power.normalizedPowerWatts, "W")), power.maximumWatts == null ? null : line("Maximum Power", formatMetric(power.maximumWatts, "W")), line("Variability Index", power.variabilityIndex?.toFixed(2)), line("Intensity Factor", power.intensityFactor?.toFixed(2)), power.workJoules == null ? null : line("Mechanical Work", formatMetric(power.workJoules / 1000, "kJ")), quality.powerCoverage.percentage == null ? null : line("Power Coverage", formatPercent(quality.powerCoverage.percentage))]),
    section("Heart Rate", [model.heartRate.averageBpm == null ? null : line("Average HR", formatMetric(model.heartRate.averageBpm, "bpm")), model.heartRate.maximumBpm == null ? null : line("Maximum HR", formatMetric(model.heartRate.maximumBpm, "bpm")), quality.heartRateCoverage.percentage == null ? null : line("HR Coverage", formatPercent(quality.heartRateCoverage.percentage))]),
    section("Cadence", [model.cadence.averageRpm == null ? null : line("Average Cadence", formatMetric(model.cadence.averageRpm, "rpm")), model.cadence.maximumRpm == null ? null : line("Maximum Cadence", formatMetric(model.cadence.maximumRpm, "rpm")), quality.cadenceCoverage.percentage == null ? null : line("Cadence Coverage", formatPercent(quality.cadenceCoverage.percentage))]),
    model.powerZones.length ? section("Power Zones", model.powerZones.map((zone) => `${zone.label}: ${formatDuration(zone.durationSeconds)}, ${formatPercent(zone.percentage)}, ${zone.id === "coasting" ? "0 W" : `${zone.minimum * 100}% FTP${zone.maximum === null ? "+" : `–${zone.maximum * 100}%`}`}`)) : null,
    section("Data Quality", [line("Record Count", String(quality.recordCount)), line("Median Record Interval", formatMetric(quality.medianRecordIntervalSeconds, "s", 1)), line("Largest Active Record Gap", formatMetric(quality.largestActiveRecordGapSeconds, "s", 1)), line("Warnings", model.warnings.length ? model.warnings.join(" ") : "None")]),
    model.laps.length ? section("Laps", model.laps.flatMap((lap) => [`### ${lap.title}`, `Duration: ${formatDuration(lap.summary.activeDurationSeconds)}`, line("Normalized Power", formatMetric(lap.power.normalizedPowerWatts, "W")), line("Average Power", formatMetric(lap.power.averageWatts, "W")), line("Average HR", formatMetric(lap.heartRate.averageBpm, "bpm")), line("Average Cadence", formatMetric(lap.cadence.averageRpm, "rpm")), line("Average Speed", formatSpeed(lap.summary.averageSpeedMps, units)), line("Distance", formatMetricDistance(lap.summary.distanceMeters, units))].filter(Boolean).join("\n"))) : null
  ];
  return sections.filter(Boolean).join("\n\n");
};

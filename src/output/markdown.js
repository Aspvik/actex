import { formatDateTime, formatDuration, formatMetric, formatMetricDistance, formatPercent, formatSpeed } from "../utils/format.js";
import { formatRelativeTime } from "../utils/time.js";

const line = (label, value) => value == null ? null : `${label}: ${value}`;
const section = (title, lines) => lines.filter(Boolean).length ? `## ${title}\n\n${lines.filter(Boolean).join("\n")}` : null;
const table = (headers, rows) => [`| ${headers.join(" | ")} |`, `| ${headers.map((header, index) => index ? "---:" : ":---").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)];
const powerZoneBoundary = (ratio, ftp) => ratio == null ? "No limit" : formatMetric(ratio * ftp, "W");
const heartRateZoneBoundary = (ratio, maxHeartRate) => ratio == null ? "No limit" : formatMetric(maxHeartRate * ratio, "bpm");
const formatThreshold = (value) => value == null ? null : formatMetric(value, "bpm", Number.isInteger(value) ? 0 : 1);
const COMMON_INTERVAL_DURATIONS_SECONDS = [5, 10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 900, 1200];
const DISPLAY_INTERVAL_DURATION_TOLERANCE_SECONDS = 2;
const normalizedIntervalDuration = (seconds) => {
  const nearest = COMMON_INTERVAL_DURATIONS_SECONDS.reduce((closest, candidate) => Math.abs(candidate - seconds) < Math.abs(closest - seconds) ? candidate : closest, COMMON_INTERVAL_DURATIONS_SECONDS[0]);
  return Math.abs(nearest - seconds) <= DISPLAY_INTERVAL_DURATION_TOLERANCE_SECONDS ? nearest : null;
};
const intervalDuration = (seconds) => {
  const normalized = normalizedIntervalDuration(seconds);
  if (normalized != null) return normalized >= 60 ? formatDuration(normalized).replace(/^0:/, "") : String(normalized);
  const roundedMeasuredSeconds = Math.round(seconds);
  return roundedMeasuredSeconds >= 60 ? formatDuration(roundedMeasuredSeconds).replace(/^0:/, "") : String(roundedMeasuredSeconds);
};
const metricLine = (label, value, unit, decimals = 0) => value == null ? null : line(label, formatMetric(value, unit, decimals));
const percentLine = (label, value) => value == null ? null : line(label, formatPercent(value));
const intervalProtocol = (protocol) => `${protocol.repetitions} x ${intervalDuration(protocol.workDurationSeconds)}${protocol.recoveryDurationConsistent === false ? "" : `/${intervalDuration(protocol.recoveryDurationSeconds)}`}`;
const groupedIntervalProtocols = (protocols) => [...protocols.reduce((groups, protocol) => {
  const label = intervalProtocol(protocol);
  const group = groups.get(label) ?? { label, count: 0 };
  group.count += 1;
  groups.set(label, group);
  return groups;
}, new Map()).values()]
  .map((group) => group.count > 1 ? `${group.count} x [${group.label}]` : group.label)
  .join(" + ");

const intervalSessionSummary = (summary) => !summary ? null : section("Interval Session Summary", [
  line("Sets", `${summary.setCount}${summary.partial ? " (partial selection)" : ""}`),
  line("Protocol", groupedIntervalProtocols(summary.protocols)),
  line("Total Interval Set Duration", formatDuration(summary.totalSetDurationSeconds)),
  line("Total Hard Work", formatDuration(summary.totalHardWorkDurationSeconds)),
  metricLine("Average Work Power", summary.averageWorkPowerWatts, "W"),
  line("Time >= 90% HRmax", formatDuration(summary.timeAtOrAbove90Seconds)),
  line("Time >= 95% HRmax", formatDuration(summary.timeAtOrAbove95Seconds)),
  metricLine("Maximum HR", summary.maximumHeartRateBpm, "bpm")
]);

const intervalSet = (set) => {
  const title = `${set.partial ? "Partial Set" : "Set"} ${set.number} - ${intervalProtocol({ repetitions: set.repetitions, ...set.pattern })}`;
  const repetitions = set.partial ? `${set.includedRepetitions} of ${set.repetitions}` : String(set.repetitions);
  return [`### ${title}`,
    line("Repetitions", repetitions),
    line("Set Duration", formatDuration(set.durationSeconds)),
    line("Hard Work Duration", formatDuration(set.hardWorkDurationSeconds)),
    "Work Power:",
    metricLine("Average", set.power.workAverageWatts, "W"),
    metricLine("Minimum Rep Average", set.power.minimumRepAverageWatts, "W"),
    metricLine("Maximum Rep Average", set.power.maximumRepAverageWatts, "W"),
    metricLine("First Half Average", set.power.firstHalfAverageWatts, "W"),
    metricLine("Second Half Average", set.power.secondHalfAverageWatts, "W"),
    percentLine("Power Fade", set.power.fadePercent),
    "Recovery Power:",
    metricLine("Average", set.power.recoveryAverageWatts, "W"),
    "Whole Set:",
    metricLine("Average Power", set.power.wholeSetAverageWatts, "W"),
    "Heart Rate:",
    metricLine("Start", set.heartRate.startBpm, "bpm"),
    metricLine("Average", set.heartRate.averageBpm, "bpm"),
    metricLine("Maximum", set.heartRate.maximumBpm, "bpm"),
    metricLine("End", set.heartRate.endBpm, "bpm"),
    line("Time >= 90% HRmax", formatDuration(set.heartRate.timeAtOrAbove90Seconds)),
    line("Time >= 95% HRmax", formatDuration(set.heartRate.timeAtOrAbove95Seconds)),
    line("Time to first reach 90% HRmax", formatDuration(set.heartRate.timeToFirst90Seconds)),
    "Cadence:",
    metricLine("Work Average", set.cadence.workAverageRpm, "rpm"),
    metricLine("Recovery Average", set.cadence.recoveryAverageRpm, "rpm")
  ].filter(Boolean).join("\n");
};

const betweenSetRecovery = (recovery) => {
  const hasPause = recovery.pausedDurationSeconds > .5;
  return [`### ${recovery.partial ? "Partial recovery before" : "Recovery before"} Set ${recovery.beforeSetNumber}`,
    hasPause ? line("Elapsed Recovery", formatDuration(recovery.elapsedDurationSeconds)) : line("Recovery Duration", formatDuration(recovery.elapsedDurationSeconds)),
    hasPause ? line("Active Recovery", formatDuration(recovery.activeDurationSeconds)) : null,
    hasPause ? line("Paused", formatDuration(recovery.pausedDurationSeconds)) : null,
    metricLine("Average Active Power", recovery.averageActivePowerWatts, "W"),
    metricLine("Lowest HR", recovery.lowestHeartRateBpm, "bpm"),
    metricLine("HR at Next Set Start", recovery.heartRateAtNextSetStartBpm, "bpm")
  ].filter(Boolean).join("\n");
};

const athleteNotes = (notes) => !notes ? null : section("Athlete Notes", [
  notes.rpe == null ? null : line("RPE", `${notes.rpe}/10`),
  notes.fatigue == null ? null : line("Fatigue", `${notes.fatigue}/10 (10 = extremely fatigued)`),
  line("Position", notes.position),
  line("Notes", notes.notes)
]);

export const buildMarkdown = (model) => {
  const activityStart = new Date(model.activity.startTimestamp);
  const summary = model.summary;
  const power = model.power;
  const quality = model.dataQuality;
  const sections = [
    `# Activity Data\n\nactex schema: ${model.schemaVersion}`,
    section("Activity", [
      line("Sport", model.activity.sport), line("Date", formatDateTime(activityStart)), line("Device", model.activity.device), line("Selection", model.activity.selectionType),
      line("Start", formatRelativeTime(activityStart, new Date(model.selection.startTimestamp))), line("End", formatRelativeTime(activityStart, new Date(model.selection.endTimestamp)))
    ]),
    section("Summary", [line("Active Duration", formatDuration(summary.activeDurationSeconds)), line("Elapsed Duration", formatDuration(summary.elapsedDurationSeconds)), summary.distanceMeters == null ? null : line("Distance", formatMetricDistance(summary.distanceMeters)), summary.averageSpeedMps == null ? null : line("Average Speed", formatSpeed(summary.averageSpeedMps)), summary.maximumSpeedMps == null ? null : line("Maximum Speed", formatSpeed(summary.maximumSpeedMps)), model.elevation.gainMeters == null ? null : line("Elevation Gain", formatMetric(model.elevation.gainMeters, "m"))]),
    section("Power", [power.ftpWatts == null ? null : line("FTP", formatMetric(power.ftpWatts, "W")), power.averageWatts == null ? null : line("Average Power", formatMetric(power.averageWatts, "W")), power.normalizedPowerWatts == null ? null : line("Normalized Power", formatMetric(power.normalizedPowerWatts, "W")), power.maximumWatts == null ? null : line("Maximum Power", formatMetric(power.maximumWatts, "W")), line("Variability Index", power.variabilityIndex?.toFixed(2)), line("Intensity Factor", power.intensityFactor?.toFixed(2)), power.workJoules == null ? null : line("Mechanical Work", formatMetric(power.workJoules / 1000, "kJ")), quality.powerCoverage.percentage == null ? null : line("Power Coverage", formatPercent(quality.powerCoverage.percentage))]),
    section("Heart Rate", [model.heartRate.configuredMaximumBpm == null ? null : line("Configured Max HR", formatMetric(model.heartRate.configuredMaximumBpm, "bpm")), model.heartRate.threshold90Bpm == null ? null : line("90% HRmax", formatThreshold(model.heartRate.threshold90Bpm)), model.heartRate.threshold95Bpm == null ? null : line("95% HRmax", formatThreshold(model.heartRate.threshold95Bpm)), model.heartRate.configuredMaximumBpm == null ? null : line("Zone basis", "% Max HR"), model.heartRate.averageBpm == null ? null : line("Average HR", formatMetric(model.heartRate.averageBpm, "bpm")), model.heartRate.maximumBpm == null ? null : line("Maximum HR", formatMetric(model.heartRate.maximumBpm, "bpm")), quality.heartRateCoverage.percentage == null ? null : line("HR Coverage", formatPercent(quality.heartRateCoverage.percentage))]),
    section("Cadence", [model.cadence.averageRpm == null ? null : line("Average Cadence", formatMetric(model.cadence.averageRpm, "rpm")), model.cadence.maximumRpm == null ? null : line("Maximum Cadence", formatMetric(model.cadence.maximumRpm, "rpm")), quality.cadenceCoverage.percentage == null ? null : line("Cadence Coverage", formatPercent(quality.cadenceCoverage.percentage))]),
    model.powerZones.length ? section("Power Zones", table(["Zone", "Duration", "Share", "From", "To"], model.powerZones.map((zone) => [zone.label, formatDuration(zone.durationSeconds), formatPercent(zone.percentage), powerZoneBoundary(zone.minimum, power.ftpWatts), powerZoneBoundary(zone.maximum, power.ftpWatts)]))) : null,
    model.heartRateZones.length ? section("Heart Rate Zones", table(["Zone", "Duration", "Share", "From", "To"], model.heartRateZones.map((zone) => [zone.label, formatDuration(zone.durationSeconds), formatPercent(zone.percentage), heartRateZoneBoundary(zone.minimum, model.heartRate.configuredMaximumBpm), heartRateZoneBoundary(zone.maximum, model.heartRate.configuredMaximumBpm)]))) : null,
    intervalSessionSummary(model.intervalSessionSummary),
    model.intervalSets?.length ? section("Interval Sets", [model.intervalSets.map(intervalSet).join("\n\n")]) : null,
    ...(model.betweenSetRecoveries ?? []).map(betweenSetRecovery),
    athleteNotes(model.athleteNotes),
    section("Data Quality", [line("Record Count", String(quality.recordCount)), line("Median Record Interval", formatMetric(quality.medianRecordIntervalSeconds, "s", 1)), line("Largest Active Record Gap", formatMetric(quality.largestActiveRecordGapSeconds, "s", 1)), line("Warnings", model.warnings.length ? model.warnings.join(" ") : "None")]),
    model.laps?.length ? section("Laps", model.laps.flatMap((lap) => [`### ${lap.title}`, `Duration: ${formatDuration(lap.summary.activeDurationSeconds)}`, line("Normalized Power", formatMetric(lap.power.normalizedPowerWatts, "W")), line("Average Power", formatMetric(lap.power.averageWatts, "W")), line("Average HR", formatMetric(lap.heartRate.averageBpm, "bpm")), line("Average Cadence", formatMetric(lap.cadence.averageRpm, "rpm")), line("Average Speed", formatSpeed(lap.summary.averageSpeedMps)), line("Distance", formatMetricDistance(lap.summary.distanceMeters))].filter(Boolean).join("\n"))) : null
  ];
  return sections.filter(Boolean).join("\n\n");
};

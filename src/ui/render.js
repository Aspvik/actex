import { formatDate, formatDuration, formatMetric, formatMetricDistance, formatNumber, formatPercent, formatSpeed } from "../utils/format.js";
import { formatIntervalProtocol } from "../utils/interval-protocol.js";
import { formatRelativeTime } from "../utils/time.js";

const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const titleAttribute = (description) => ` title="${escape(description)}"`;
const selected = (value, expected) => value === expected ? " selected" : "";
const checked = (value) => value ? " checked" : "";
const active = (value) => value ? " active" : "";
const capitalizeFirstLetter = (value) => `${String(value ?? "Cycling").charAt(0).toUpperCase()}${String(value ?? "Cycling").slice(1)}`;
const lapName = (lap) => lap.title ?? `Lap ${lap.index + 1}`;
const metricDescriptions = {
  "Active duration": "Time spent moving or otherwise active during the selected activity range.",
  "Elapsed duration": "Wall-clock time from the start to the end of the selected activity range, including stops.",
  "Distance": "Distance recorded during the selected activity range.",
  "Average speed": "Average moving speed during the selected activity range.",
  "Maximum speed": "Highest recorded speed during the selected activity range.",
  "Average power": "Average recorded cycling power during the selected activity range.",
  "Normalized Power": "Estimated physiological cost of variable power, calculated from rolling 30-second power values.",
  "Maximum power": "Highest recorded cycling power during the selected activity range.",
  "Mechanical work": "Total mechanical energy produced through recorded cycling power during the selected activity range.",
  "FTP": "Functional Threshold Power. Your configured estimate of the highest power you can sustain for about one hour.",
  "Intensity Factor": "Normalized Power divided by FTP. A value of 1.00 is approximately your threshold intensity.",
  "Variability Index": "Normalized Power divided by average power. Higher values indicate more variable pacing.",
  "Average HR": "Average recorded heart rate during the selected activity range.",
  "Maximum HR": "Highest recorded heart rate during the selected activity range.",
  "Average cadence": "Average pedalling cadence during the selected activity range.",
  "Maximum cadence": "Highest recorded pedalling cadence during the selected activity range.",
  "Elevation gain": "Total accumulated climbing during the selected activity range.",
  "Total interval-set time": "Combined elapsed duration of all detected interval sets in the selection.",
  "Hard work": "Combined duration of the work portions of detected interval sets.",
  "Avg work power": "Average power across the work portions of all detected interval sets.",
  "Time >=90% HRmax": "Time at or above 90 percent of your configured maximum heart rate.",
  "Time >=95% HRmax": "Time at or above 95 percent of your configured maximum heart rate.",
  "Max HR": "Highest recorded heart rate within the detected interval sets.",
  "Work power": "Average power during the work portions of this interval set.",
  "Recovery power": "Average power during the recovery portions of this interval set.",
  "Power fade": "Percentage change in average work power from the first half to the second half of this interval set.",
  "Avg / max HR": "Average and highest recorded heart rate within this interval set.",
  ">=90% HRmax": "Time at or above 90 percent of your configured maximum heart rate.",
  "Work / recovery cadence": "Average pedalling cadence during work portions, followed by recovery portions.",
  "Set duration": "Elapsed duration of this interval set, including its work and included recovery portions.",
  "Minimum rep power": "Lowest average power among the work repetitions in this interval set.",
  "Maximum rep power": "Highest average power among the work repetitions in this interval set.",
  "First-half power": "Average work power in the first half of this interval set.",
  "Second-half power": "Average work power in the second half of this interval set.",
  "Whole-set power": "Average power across the entire interval set, including work and recovery portions.",
  "Start / end HR": "Heart rate at the start and end of this interval set.",
  ">=95% HRmax": "Time at or above 95 percent of your configured maximum heart rate.",
  "Time to 90% HRmax": "Time from the start of this interval set until heart rate first reaches 90 percent of your configured maximum heart rate.",
  "Records": "Number of activity records included in the selected range.",
  "Power coverage": "Share of records in the selected range that contain a power value.",
  "Heart-rate coverage": "Share of records in the selected range that contain a heart-rate value.",
  "Cadence coverage": "Share of records in the selected range that contain a cadence value.",
  "Median interval": "Median time between consecutive activity records in the selected range.",
  "Largest gap": "Longest time between consecutive active activity records in the selected range."
};
const metricDescription = (label) => metricDescriptions[label] ?? `${label}.`;
const metric = (label, value, source = "Calculated") => {
  if (value == null) return "";
  const description = metricDescription(label);
  return `<div class="metric"${titleAttribute(description)}><dt${titleAttribute(description)}>${label}</dt><dd${titleAttribute(description)}>${value}<span class="source"${titleAttribute(`Data source: ${source}.`)}>${source}</span></dd></div>`;
};

const timeline = (activity, selection, chartOptions) => {
  const start = activity.metadata.startTime;
  const end = activity.metadata.endTime;
  const duration = Math.max(1, (end - start) / 1000);
  const series = (field) => {
    const records = activity.records.filter((record) => record[field] != null);
    const sampled = records.filter((_, index) => index % Math.ceil(Math.max(records.length, 1) / 240) === 0);
    const values = sampled.map((record) => record[field]);
    if (!values.length) return null;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = Math.max(1, maximum - minimum);
    const points = sampled.map((record) => `${((record.timestamp - start) / 1000 / duration * 100).toFixed(2)},${(40 - (record[field] - minimum) / spread * 34).toFixed(2)}`).join(" ");
    return { points, minimum, maximum, startX: (sampled[0].timestamp - start) / 1000 / duration * 100, endX: (sampled.at(-1).timestamp - start) / 1000 / duration * 100 };
  };
  const elevation = series("altitudeMeters");
  const power = series("powerWatts");
  const cadence = series("cadenceRpm");
  const heartRate = series("heartRateBpm");
  const elevationFill = elevation ? `${elevation.startX.toFixed(2)},44 ${elevation.points} ${elevation.endX.toFixed(2)},44` : "";
  const rangeStart = Math.round((selection.startTimestamp - start) / 1000);
  const rangeEnd = Math.round((selection.endTimestamp - start) / 1000);
  const selectionStartPercent = rangeStart / duration * 100;
  const selectionWidthPercent = Math.max(0.5, (rangeEnd - rangeStart) / duration * 100);
  const lapMarkers = activity.laps.map((lap) => ({ ...lap, percent: (lap.startTime - start) / duration * 100 })).filter((lap) => lap.percent > 0 && lap.percent < 100);
  const selectionLabel = selection.type === "activity" ? "Whole activity" : selection.type === "range" ? "Custom range" : `Lap ${selection.lapIndex + 1}`;
  return `<section class="panel timeline"${titleAttribute("Choose the part of the activity used for the analysis below.")}><div class="section-heading"><div><h2${titleAttribute("The currently analysed part of the activity.")}>Selection</h2><p class="quiet"${titleAttribute("Available chart series: elevation, power, cadence, and heart rate.")}>Elevation profile, power, cadence, and heart rate</p></div><span class="selection-label"${titleAttribute("Current analysis selection.")}>${escape(selectionLabel)}</span></div>
    <div class="selection-presets"><button class="${active(selection.type === "activity")}" data-action="select-activity" type="button"${titleAttribute("Analyse the complete activity.")}>Whole activity</button><button class="${active(selection.type === "range")}" data-action="select-range" type="button"${titleAttribute("Analyse a custom time range from the chart.")}>Custom range</button>${activity.laps.length > 1 ? activity.laps.map((lap) => `<button class="${active(selection.type === "lap" && selection.lapIndex === lap.index)}" type="button" data-action="select-lap" data-index="${lap.index}"${titleAttribute(`Analyse ${lapName(lap)}.`)}>${escape(lapName(lap))}</button>`).join("") : ""}</div>
    <div class="chart-toggles">${elevation ? `<label${titleAttribute("Show or hide the elevation profile.")}><input type="checkbox" name="chart-elevation"${checked(chartOptions.elevation)} /> Elevation</label>` : ""}${power ? `<label${titleAttribute("Show or hide recorded cycling power.")}><input type="checkbox" name="chart-power"${checked(chartOptions.power)} /> Power</label>` : ""}${cadence ? `<label${titleAttribute("Show or hide pedalling cadence.")}><input type="checkbox" name="chart-cadence"${checked(chartOptions.cadence)} /> Cadence</label>` : ""}${heartRate ? `<label${titleAttribute("Show or hide recorded heart rate.")}><input type="checkbox" name="chart-heartRate"${checked(chartOptions.heartRate)} /> Heart rate</label>` : ""}</div>
    <div class="chart-stage"><svg class="range-timeline" viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="Elevation profile, power in watts, cadence, and heart rate over the activity. Hover for exact sample values; drag the handles on the shaded window to select a range.">${chartOptions.elevation && elevation ? `<polygon class="elevation-profile" points="${elevationFill}" />` : ""}<rect class="selection-window" x="${selectionStartPercent}" y="0" width="${selectionWidthPercent}" height="44" />${lapMarkers.map((lap) => `<line class="lap-marker" x1="${lap.percent}" x2="${lap.percent}" y1="0" y2="44" />`).join("")}${chartOptions.power && power ? `<polyline class="power-line" points="${power.points}" />` : ""}${chartOptions.cadence && cadence ? `<polyline class="cadence-line" points="${cadence.points}" />` : ""}${chartOptions.heartRate && heartRate ? `<polyline class="heart-rate-line" points="${heartRate.points}" />` : ""}<line class="hover-cursor" x1="0" x2="0" y1="0" y2="44" /><line class="selection-handle" data-edge="start" x1="${selectionStartPercent}" x2="${selectionStartPercent}" y1="0" y2="44" /><line class="selection-handle" data-edge="end" x1="${selectionStartPercent + selectionWidthPercent}" x2="${selectionStartPercent + selectionWidthPercent}" y1="0" y2="44" /><line class="selection-hit-area" data-handle="start" data-edge="start" x1="${selectionStartPercent}" x2="${selectionStartPercent}" y1="0" y2="44" /><line class="selection-hit-area" data-handle="end" data-edge="end" x1="${selectionStartPercent + selectionWidthPercent}" x2="${selectionStartPercent + selectionWidthPercent}" y1="0" y2="44" /></svg><div class="chart-tooltip" role="tooltip" hidden></div></div>
    <p class="timeline-key"${titleAttribute("Drag either edge of the shaded window to change the analysed range.")}><span class="key-window"${titleAttribute("The shaded window marks the currently analysed range.")}></span>Selected range · drag either edge to adjust${lapMarkers.length ? ` · <span class="key-line"${titleAttribute("Vertical line marking a recorded lap boundary.")}></span>Lap boundary` : ""}</p></section>`;
};

const summary = (result, ftp) => `<section class="panel"${titleAttribute("Summary metrics for the selected activity range.")}><h2${titleAttribute("Summary metrics for the selected activity range.")}>Summary</h2><dl class="metrics">
  ${metric("Active duration", formatDuration(result.summary.activeDurationSeconds))}
  ${metric("Elapsed duration", formatDuration(result.summary.elapsedDurationSeconds))}
  ${metric("Distance", result.summary.distanceMeters == null ? null : formatMetricDistance(result.summary.distanceMeters))}
  ${metric("Average speed", result.summary.averageSpeedMps == null ? null : formatSpeed(result.summary.averageSpeedMps))}
  ${metric("Maximum speed", result.summary.maximumSpeedMps == null ? null : formatSpeed(result.summary.maximumSpeedMps))}
  ${metric("Average power", result.power.averageWatts == null ? null : formatMetric(result.power.averageWatts, "W"))}
  ${metric("Normalized Power", result.power.normalizedPowerWatts == null ? null : formatMetric(result.power.normalizedPowerWatts, "W"))}
  ${metric("Maximum power", result.power.maximumWatts == null ? null : formatMetric(result.power.maximumWatts, "W"))}
  ${metric("Mechanical work", result.power.workJoules == null ? null : formatMetric(result.power.workJoules / 1000, "kJ"))}
  ${metric("FTP", ftp == null ? null : formatMetric(ftp, "W"), "User")}
  ${metric("Intensity Factor", result.power.intensityFactor == null ? null : result.power.intensityFactor.toFixed(2))}
  ${metric("Variability Index", result.power.variabilityIndex == null ? null : result.power.variabilityIndex.toFixed(2))}
  ${metric("Average HR", result.heartRate.averageBpm == null ? null : formatMetric(result.heartRate.averageBpm, "bpm"))}
  ${metric("Maximum HR", result.heartRate.maximumBpm == null ? null : formatMetric(result.heartRate.maximumBpm, "bpm"))}
  ${metric("Average cadence", result.cadence.averageRpm == null ? null : formatMetric(result.cadence.averageRpm, "rpm"))}
  ${metric("Maximum cadence", result.cadence.maximumRpm == null ? null : formatMetric(result.cadence.maximumRpm, "rpm"))}
  ${metric("Elevation gain", result.elevation.gainMeters == null ? null : formatMetric(result.elevation.gainMeters, "m"), result.elevation.source ?? "Calculated")}
</dl></section>`;

const intervalMetric = (label, value) => {
  const description = metricDescription(label);
  return `<div${titleAttribute(description)}><dt${titleAttribute(description)}>${label}</dt><dd${titleAttribute(description)}>${value}</dd></div>`;
};
const pairedMetric = (firstValue, secondValue, unit) => firstValue == null && secondValue == null
  ? "Unavailable"
  : `${firstValue == null ? "Unavailable" : formatNumber(firstValue)} / ${secondValue == null ? "Unavailable" : formatNumber(secondValue)} ${unit}`;
const exposureBar = (label, seconds, totalSeconds, className) => {
  if (seconds == null) return "";
  const percentage = totalSeconds > 0 ? Math.min(100, Math.max(0, seconds / totalSeconds * 100)) : 0;
  const percentageLabel = formatPercent(percentage / 100);
  const description = `${metricDescription(label)} This is ${percentageLabel} of the combined interval-set time.`;
  return `<div class="interval-exposure__row"${titleAttribute(description)}><div><span${titleAttribute(description)}>${label}</span><strong${titleAttribute(description)}>${percentageLabel}</strong></div><div class="interval-exposure__track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${percentageLabel}"${titleAttribute(description)}><span class="interval-exposure__fill ${className}" style="width: ${percentage}%"></span></div></div>`;
};
const intervalSet = (set) => `<article class="interval-set"${titleAttribute(`Detected interval set ${set.number}.`)}><div class="interval-set__heading"><div><h3${titleAttribute(`Protocol for detected interval set ${set.number}.`)}>Set ${set.number} · ${formatIntervalProtocol({ repetitions: set.repetitions, ...set.pattern })}</h3>${set.partial ? `<p class="quiet"${titleAttribute("Only the repetitions within the current selection are included.")}>${set.includedRepetitions} of ${set.repetitions} repetitions in selection</p>` : ""}</div></div><dl class="interval-set__metrics">
  ${intervalMetric("Work power", formatMetric(set.power.workAverageWatts, "W"))}
  ${intervalMetric("Recovery power", formatMetric(set.power.recoveryAverageWatts, "W"))}
  ${intervalMetric("Power fade", formatPercent(set.power.fadePercent))}
  ${intervalMetric("Avg / max HR", pairedMetric(set.heartRate.averageBpm, set.heartRate.maximumBpm, "bpm"))}
  ${intervalMetric(">=90% HRmax", formatDuration(set.heartRate.timeAtOrAbove90Seconds))}
  ${intervalMetric("Work / recovery cadence", pairedMetric(set.cadence.workAverageRpm, set.cadence.recoveryAverageRpm, "rpm"))}
</dl><details class="interval-set__details"${titleAttribute("Additional metrics for this interval set.")}><summary${titleAttribute("Show or hide additional metrics for this interval set.")}>Details</summary><dl class="interval-set__details-grid">
  ${intervalMetric("Set duration", formatDuration(set.durationSeconds))}
  ${intervalMetric("Hard work", formatDuration(set.hardWorkDurationSeconds))}
  ${intervalMetric("Minimum rep power", formatMetric(set.power.minimumRepAverageWatts, "W"))}
  ${intervalMetric("Maximum rep power", formatMetric(set.power.maximumRepAverageWatts, "W"))}
  ${intervalMetric("First-half power", formatMetric(set.power.firstHalfAverageWatts, "W"))}
  ${intervalMetric("Second-half power", formatMetric(set.power.secondHalfAverageWatts, "W"))}
  ${intervalMetric("Whole-set power", formatMetric(set.power.wholeSetAverageWatts, "W"))}
  ${intervalMetric("Start / end HR", pairedMetric(set.heartRate.startBpm, set.heartRate.endBpm, "bpm"))}
  ${intervalMetric(">=95% HRmax", formatDuration(set.heartRate.timeAtOrAbove95Seconds))}
  ${intervalMetric("Time to 90% HRmax", formatDuration(set.heartRate.timeToFirst90Seconds))}
</dl></details></article>`;
const betweenSetRecovery = (recovery) => `<div class="between-set-recovery${recovery.partial ? " partial" : ""}"${titleAttribute("Recovery between consecutive detected interval sets.")}><span${titleAttribute("Duration of the recovery between interval sets.")}>${recovery.partial ? "Partial recovery" : "Recovery"} ${formatDuration(recovery.elapsedDurationSeconds)}</span><span${titleAttribute("Average active power during this recovery.")}>${formatMetric(recovery.averageActivePowerWatts, "W")}</span><span${titleAttribute("Lowest heart rate during recovery, followed by heart rate at the next set's start.")}>HR ${formatMetric(recovery.lowestHeartRateBpm, "bpm")} → ${formatMetric(recovery.heartRateAtNextSetStartBpm, "bpm")}</span></div>`;
const intervalAnalysis = (intervalSets, sessionSummary, recoveries) => {
  if (!sessionSummary || !intervalSets.length) return "";
  const recoveriesByNextSet = new Map(recoveries.map((recovery) => [recovery.beforeSetNumber, recovery]));
  return `<section class="panel interval-analysis"${titleAttribute("Analysis of detected repeated work and recovery intervals.")}><div class="section-heading"><div><h2${titleAttribute("Analysis of detected repeated work and recovery intervals.")}>Interval analysis</h2><p class="interval-analysis__protocol"${titleAttribute("Detected interval protocol or protocols.")}>${sessionSummary.protocols.map(formatIntervalProtocol).join(" + ")}</p></div><span class="selection-label"${titleAttribute("Number of detected interval sets.")}>${sessionSummary.setCount} ${sessionSummary.setCount === 1 ? "set" : "sets"}</span></div><dl class="interval-session-metrics">
    ${intervalMetric("Total interval-set time", formatDuration(sessionSummary.totalSetDurationSeconds))}
    ${intervalMetric("Hard work", formatDuration(sessionSummary.totalHardWorkDurationSeconds))}
    ${intervalMetric("Avg work power", formatMetric(sessionSummary.averageWorkPowerWatts, "W"))}
    ${intervalMetric("Time >=90% HRmax", formatDuration(sessionSummary.timeAtOrAbove90Seconds))}
    ${intervalMetric("Time >=95% HRmax", formatDuration(sessionSummary.timeAtOrAbove95Seconds))}
    ${intervalMetric("Max HR", formatMetric(sessionSummary.maximumHeartRateBpm, "bpm"))}
  </dl><div class="interval-exposure"><h3${titleAttribute("Share of interval-set time spent at high heart-rate intensities.")}>HR exposure within interval sets</h3>${exposureBar(">=90% HRmax", sessionSummary.timeAtOrAbove90Seconds, sessionSummary.totalSetDurationSeconds, "interval-exposure__fill--90")}${exposureBar(">=95% HRmax", sessionSummary.timeAtOrAbove95Seconds, sessionSummary.totalSetDurationSeconds, "interval-exposure__fill--95")}</div><div class="interval-sets">${intervalSets.map((set) => `${intervalSet(set)}${recoveriesByNextSet.has(set.number + 1) ? betweenSetRecovery(recoveriesByNextSet.get(set.number + 1)) : ""}`).join("")}</div></section>`;
};

const numericRange = (minimum, maximum, value, unit) => maximum == null ? `${value(minimum)} ${unit}+` : `${value(minimum)}-${value(maximum)} ${unit}`;
const percentageRange = (minimum, maximum, reference) => maximum == null ? `${formatNumber(minimum * 100)}% ${reference}+` : `${formatNumber(minimum * 100)}-${formatNumber(maximum * 100)}% ${reference}`;
const powerZoneRange = (zone, ftp) => zone.id === "coasting" ? "0 W" : `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(ratio * ftp), "W")} · ${percentageRange(zone.minimum, zone.maximum, "FTP")}`;
const zones = (result, ftp) => !result.zones.length ? "" : `<section class="panel"${titleAttribute("Time spent in cycling power zones, calculated from your configured FTP.")}><h2${titleAttribute("Time spent in cycling power zones, calculated from your configured FTP.")}>Power zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col"${titleAttribute("Power zone and its wattage range.")}>Zone</th><th scope="col"${titleAttribute("Time spent in this power zone.")}>Duration</th><th scope="col"${titleAttribute("Share of the selected activity spent in this power zone.")}>Share</th></tr></thead><tbody>${result.zones.map((zone) => `<tr${titleAttribute(`Power zone ${zone.label}.`)}><th scope="row"${titleAttribute(`Power zone ${zone.label}. ${powerZoneRange(zone, ftp)}.`)}>${zone.label}<span class="zone-range"${titleAttribute(`Wattage range for power zone ${zone.label}.`)}>${powerZoneRange(zone, ftp)}</span></th><td${titleAttribute(`Time spent in power zone ${zone.label}.`)}>${formatDuration(zone.durationSeconds)}</td><td${titleAttribute(`Share of the selection spent in power zone ${zone.label}.`)}>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;
const heartRateZoneRange = (zone, maxHeartRate) => `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(maxHeartRate * ratio), "bpm")} · ${percentageRange(zone.minimum, zone.maximum, "Max HR")}`;
const heartRateZones = (result, maxHeartRate) => !result.heartRateZones.length ? "" : `<section class="panel"${titleAttribute("Time spent in heart-rate zones, calculated from your configured maximum heart rate.")}><h2${titleAttribute("Time spent in heart-rate zones, calculated from your configured maximum heart rate.")}>Heart rate zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col"${titleAttribute("Heart-rate zone and its beats-per-minute range.")}>Zone</th><th scope="col"${titleAttribute("Time spent in this heart-rate zone.")}>Duration</th><th scope="col"${titleAttribute("Share of the selected activity spent in this heart-rate zone.")}>Share</th></tr></thead><tbody>${result.heartRateZones.map((zone) => `<tr${titleAttribute(`Heart-rate zone ${zone.label}.`)}><th scope="row"${titleAttribute(`Heart-rate zone ${zone.label}. ${heartRateZoneRange(zone, maxHeartRate)}.`)}>${zone.label}<span class="zone-range"${titleAttribute(`Beats-per-minute range for heart-rate zone ${zone.label}.`)}>${heartRateZoneRange(zone, maxHeartRate)}</span></th><td${titleAttribute(`Time spent in heart-rate zone ${zone.label}.`)}>${formatDuration(zone.durationSeconds)}</td><td${titleAttribute(`Share of the selection spent in heart-rate zone ${zone.label}.`)}>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;

const laps = (lapsResult, showLaps) => !showLaps || !lapsResult.length ? "" : `<section class="panel"${titleAttribute("Individual laps recorded in the activity.")}><h2${titleAttribute("Individual laps recorded in the activity.")}>Laps</h2><div class="lap-table-wrap"><table class="lap-table"><thead><tr><th scope="col"${titleAttribute("Recorded lap name.")}>Lap</th><th scope="col"${titleAttribute("Active duration of the lap.")}>Duration</th><th scope="col"${titleAttribute("Distance recorded during the lap.")}>Distance</th><th scope="col"${titleAttribute("Normalized Power for the lap.")}>NP</th><th scope="col"${titleAttribute("Average cycling power for the lap.")}>Power</th><th scope="col"${titleAttribute("Average heart rate for the lap.")}>HR</th><th scope="col"><span class="sr-only">Selection</span></th></tr></thead><tbody>${lapsResult.map((lap) => `<tr${titleAttribute(`Recorded activity lap: ${lapName(lap)}.`)}><th scope="row"${titleAttribute(`Recorded activity lap: ${lapName(lap)}.`)}>${escape(lapName(lap))}</th><td${titleAttribute("Active duration of this lap.")}>${formatDuration(lap.summary.activeDurationSeconds)}</td><td${titleAttribute("Distance recorded during this lap.")}>${formatMetricDistance(lap.summary.distanceMeters)}</td><td${titleAttribute("Normalized Power for this lap.")}>${formatMetric(lap.power.normalizedPowerWatts, "W")}</td><td${titleAttribute("Average cycling power for this lap.")}>${formatMetric(lap.power.averageWatts, "W")}</td><td${titleAttribute("Average heart rate for this lap.")}>${formatMetric(lap.heartRate.averageBpm, "bpm")}</td><td><button type="button" data-action="select-lap" data-index="${lap.index}"${titleAttribute(`Analyse ${lapName(lap)}.`)}>Select lap</button></td></tr>`).join("")}</tbody></table></div></section>`;

const qualityMetric = (label, value) => {
  const description = metricDescription(label);
  return `<div${titleAttribute(description)}><dt${titleAttribute(description)}>${label}</dt><dd${titleAttribute(description)}>${value}</dd></div>`;
};
const quality = (result) => `<section class="panel"${titleAttribute("Coverage and timing checks for the selected activity data.")}><h2${titleAttribute("Coverage and timing checks for the selected activity data.")}>Data quality</h2><dl class="quality">
  ${qualityMetric("Records", result.quality.recordCount)}
  ${qualityMetric("Power coverage", formatPercent(result.quality.powerCoverage.percentage))}
  ${qualityMetric("Heart-rate coverage", formatPercent(result.quality.heartRateCoverage.percentage))}
  ${qualityMetric("Cadence coverage", formatPercent(result.quality.cadenceCoverage.percentage))}
  ${qualityMetric("Median interval", formatMetric(result.quality.medianRecordIntervalSeconds, "s", 1))}
  ${qualityMetric("Largest gap", formatMetric(result.quality.largestActiveRecordGapSeconds, "s", 1))}
</dl>${result.warnings.length ? `<ul class="warnings"${titleAttribute("Warnings about missing, irregular, or incomplete activity data.")}>${result.warnings.map((warning) => `<li${titleAttribute(warning)}>${escape(warning)}</li>`).join("")}</ul>` : `<p class="quiet"${titleAttribute("No activity data-quality warnings were found.")}>No warnings.</p>`}</section>`;

const scoreOptions = (value) => `<option value=""${value == null || value === "" ? " selected" : ""}${titleAttribute("No rating has been provided.")}>Not specified</option>${Array.from({ length: 10 }, (_, index) => index + 1).map((score) => `<option value="${score}"${selected(String(value), String(score))}${titleAttribute(`Rating ${score} out of 10.`)}>${score}</option>`).join("")}`;
const athleteContext = (athleteNotes, exportOptions) => `<section class="panel athlete-context"${titleAttribute("Your subjective workout context, included in exports.")}><h2${titleAttribute("Your subjective workout context, included in exports.")}>Athlete Notes</h2><div class="athlete-context-controls"><label${titleAttribute("Rate how hard the activity felt, from 1 to 10.")}><span${titleAttribute("Rate how hard the activity felt, from 1 to 10.")}>RPE (1-10)</span><select name="rpe"${titleAttribute("Rate of perceived exertion, from 1 to 10.")}>${scoreOptions(athleteNotes.rpe)}</select></label><label${titleAttribute("Rate your fatigue, where 10 is extremely fatigued.")}><span${titleAttribute("Rate your fatigue, where 10 is extremely fatigued.")}>Fatigue (1-10, 10 = extremely fatigued)</span><select name="fatigue"${titleAttribute("Fatigue rating, from 1 to 10.")}>${scoreOptions(athleteNotes.fatigue)}</select></label><label${titleAttribute("Your riding position during the activity.")}><span${titleAttribute("Your riding position during the activity.")}>Position</span><select name="position"${titleAttribute("Choose seated, standing, mixed, or not specified.")}><option value=""${athleteNotes.position ? "" : " selected"}${titleAttribute("No riding position has been specified.")}>Not specified</option><option value="seated"${selected(athleteNotes.position, "seated")}${titleAttribute("Ridden primarily seated.")}>Seated</option><option value="standing"${selected(athleteNotes.position, "standing")}${titleAttribute("Ridden primarily standing.")}>Standing</option><option value="mixed"${selected(athleteNotes.position, "mixed")}${titleAttribute("A mix of seated and standing riding.")}>Mixed</option></select></label></div><label class="athlete-notes"${titleAttribute("Optional free-text context for this workout.")}><span${titleAttribute("Optional free-text context for this workout.")}>Notes</span><textarea name="athlete-notes" placeholder="Optional workout context"${titleAttribute("Optional free-text context for this workout.")}>${escape(athleteNotes.notes)}</textarea></label><label class="export-laps"${titleAttribute("Include each individual lap in exported data.")}><input name="include-individual-laps" type="checkbox"${checked(exportOptions.includeIndividualLaps)} /> Include individual laps in exports</label></section>`;

export const renderApp = (state) => {
  if (state.status === "empty") return `<main class="empty"><header><p class="eyebrow"${titleAttribute("Actex analyses cycling activity data locally in your browser.")}>actex</p><h1${titleAttribute("Import activity data for analysis.")}>Activity data, ready for AI.</h1><p${titleAttribute("FIT files are analysed locally and are not uploaded.")}>Drop a FIT file here or choose a file. Your activity stays on this device.</p></header><label class="drop-zone" for="fit-file"${titleAttribute("Choose a FIT activity file to analyse.")}>Drop a FIT file here <span${titleAttribute("Choose a FIT activity file to analyse.")}>or choose file</span></label><input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /><p class="error" role="alert"${titleAttribute(state.error ?? "")}>${escape(state.error ?? "")}</p></main>`;
  if (state.status === "parsing") return `<main class="empty"><p class="eyebrow"${titleAttribute("Actex analyses cycling activity data locally in your browser.")}>actex</p><h1${titleAttribute("The selected FIT activity file is being read.")}>Reading your activity…</h1><p${titleAttribute("FIT files are analysed locally and are not uploaded.")}>Your activity stays on this device.</p></main>`;
  const { activity, selection, result, lapsResult, settings, ftp, maxHeartRate, chartOptions, athleteNotes, exportOptions, intervalSets = [], intervalSessionSummary = null, betweenSetRecoveries = [] } = state;
  const start = activity.metadata.startTime;
  return `<main><header class="app-header"><div><p class="eyebrow"${titleAttribute("Actex analyses cycling activity data locally in your browser.")}>actex</p><h1${titleAttribute("Sport recorded in the activity file.")}>${escape(capitalizeFirstLetter(activity.metadata.sport))}</h1><p${titleAttribute("Activity date, active duration, and recorded distance.")}>${formatDate(start)} · ${formatDuration(result.summary.activeDurationSeconds)} · ${formatMetricDistance(result.summary.distanceMeters)}</p>${activity.metadata.productName ? `<p class="quiet"${titleAttribute("Device that recorded this activity.")}>Device: ${escape(activity.metadata.productName)}</p>` : ""}</div><div class="header-actions"><button type="button" data-action="new-file"${titleAttribute("Choose a different FIT activity file.")}>New file</button><button type="button" data-action="copy-json"${titleAttribute("Copy the current analysis as JSON.")}>Copy JSON</button><button class="primary" type="button" data-action="copy-markdown"${titleAttribute("Copy the current analysis as Markdown.")}>${state.copyStatus ?? "Copy Markdown"}</button></div></header>
  <section class="panel profile"${titleAttribute("Fitness reference values used in intensity and zone calculations.")}><h2${titleAttribute("Fitness reference values used in intensity and zone calculations.")}>Profile</h2><div class="profile-controls"><label${titleAttribute(metricDescription("FTP"))}><span${titleAttribute(metricDescription("FTP"))}>FTP</span><span><input name="ftp" type="number" min="1" inputmode="numeric" value="${ftp ?? ""}" aria-label="FTP in watts"${titleAttribute(metricDescription("FTP"))} /> W</span></label><label${titleAttribute("Maximum heart rate used for heart-rate zones and HRmax thresholds.")}><span${titleAttribute("Maximum heart rate used for heart-rate zones and HRmax thresholds.")}>Max HR</span><span><input name="max-heart-rate" type="number" min="1" inputmode="numeric" value="${maxHeartRate ?? ""}" aria-label="Maximum heart rate"${titleAttribute("Maximum heart rate used for heart-rate zones and HRmax thresholds.")} /> bpm</span></label><button type="button" data-action="apply-fitness-inputs"${titleAttribute("Apply these fitness values to the current analysis.")}>Apply</button><button type="button" data-action="save-fitness-inputs"${titleAttribute("Save these fitness values as the default for future activities.")}>Save default</button></div></section>
  ${athleteContext(athleteNotes, exportOptions)}
  ${activity.sessions.length > 1 ? `<section class="panel compact"${titleAttribute("Choose which recorded session to analyse.")}><label${titleAttribute("Recorded session to analyse.")}>Session <select name="session"${titleAttribute("Recorded session to analyse.")}>${activity.sessions.map((session) => `<option value="${session.index}"${selected(session.index, selection.sessionIndex)}${titleAttribute(`Recorded session ${session.index + 1}.`)}>Session ${session.index + 1}</option>`).join("")}</select></label><button type="button" data-action="select-session"${titleAttribute("Analyse the selected recorded session.")}>Select session</button></section>` : ""}
  ${timeline(activity, selection, chartOptions)}
  ${summary(result, ftp)}
  ${intervalAnalysis(intervalSets, intervalSessionSummary, betweenSetRecoveries)}${zones(result, ftp)}${heartRateZones(result, maxHeartRate)}${laps(lapsResult, activity.laps.length > 1)}${quality(result)}
  <details class="panel"${titleAttribute("Configure the lower bounds for power and heart-rate zones.")}><summary${titleAttribute("Show or hide zone settings.")}>Settings</summary><h3${titleAttribute("Configure power-zone lower bounds as percentages of FTP.")}>Power zones</h3><div class="zone-settings">${settings.zones.filter((zone) => zone.id !== "coasting").map((zone) => `<label class="settings-zone"${titleAttribute(`Lower bound for ${zone.label}, as a percentage of FTP.`)}><span${titleAttribute(`Power zone ${zone.label}.`)}>${zone.label}</span><input name="zone-${zone.id}" type="number" min="0" step="1" value="${Math.round(zone.minimum * 100)}"${titleAttribute(`Lower bound for power zone ${zone.label}, as a percentage of FTP.`)} /></label>`).join("")}</div><h3${titleAttribute("Configure heart-rate-zone lower bounds as percentages of maximum heart rate.")}>Heart rate zones</h3><div class="zone-settings">${settings.heartRateZones.map((zone) => `<label class="settings-zone"${titleAttribute(`Lower bound for ${zone.label}, as a percentage of maximum heart rate.`)}><span${titleAttribute(`Heart-rate zone ${zone.label}.`)}>${zone.label}</span><input name="heart-rate-zone-${zone.id}" type="number" min="0" max="100" step="1" value="${Math.round(zone.minimum * 100)}"${titleAttribute(`Lower bound for heart-rate zone ${zone.label}, as a percentage of maximum heart rate.`)} /></label>`).join("")}</div><div class="settings-actions"><button type="button" data-action="save-settings"${titleAttribute("Save zone settings as the default for future activities.")}>Save settings</button><button type="button" data-action="reset-settings"${titleAttribute("Restore the default zone settings.")}>Reset settings</button></div></details>
  ${state.fallbackText ? `<section class="panel" aria-live="polite"${titleAttribute("Copy the displayed text manually if direct clipboard access is blocked.")}><p${titleAttribute("Direct clipboard access was blocked. Select and copy the text below.")}>Direct clipboard access was blocked. Select and copy the text below.</p><textarea class="copy-fallback" readonly${titleAttribute("Export text ready to select and copy.")}>${escape(state.fallbackText)}</textarea></section>` : ""}
  <input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /></main>`;
};

import { formatDate, formatDuration, formatMetric, formatMetricDistance, formatNumber, formatPercent, formatSpeed } from "../utils/format.js";
import { formatIntervalProtocol } from "../utils/interval-protocol.js";
import { formatRelativeTime } from "../utils/time.js";

const escape = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
const selected = (value, expected) => value === expected ? " selected" : "";
const checked = (value) => value ? " checked" : "";
const active = (value) => value ? " active" : "";
const capitalizeFirstLetter = (value) => `${String(value ?? "Cycling").charAt(0).toUpperCase()}${String(value ?? "Cycling").slice(1)}`;
const metric = (label, value, source = "Calculated") => value == null ? "" : `<div class="metric"><dt>${label}</dt><dd>${value}<span class="source">${source}</span></dd></div>`;

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
  return `<section class="panel timeline"><div class="section-heading"><div><h2>Selection</h2><p class="quiet">Elevation profile, power, cadence, and heart rate</p></div><span class="selection-label">${escape(selectionLabel)}</span></div>
    <div class="selection-presets"><button class="${active(selection.type === "activity")}" data-action="select-activity" type="button">Whole activity</button><button class="${active(selection.type === "range")}" data-action="select-range" type="button">Custom range</button>${activity.laps.length > 1 ? activity.laps.map((lap) => `<button class="${active(selection.type === "lap" && selection.lapIndex === lap.index)}" type="button" data-action="select-lap" data-index="${lap.index}">${escape(lap.title)}</button>`).join("") : ""}</div>
    <div class="chart-toggles">${elevation ? `<label><input type="checkbox" name="chart-elevation"${checked(chartOptions.elevation)} /> Elevation</label>` : ""}${power ? `<label><input type="checkbox" name="chart-power"${checked(chartOptions.power)} /> Power</label>` : ""}${cadence ? `<label><input type="checkbox" name="chart-cadence"${checked(chartOptions.cadence)} /> Cadence</label>` : ""}${heartRate ? `<label><input type="checkbox" name="chart-heartRate"${checked(chartOptions.heartRate)} /> Heart rate</label>` : ""}</div>
    <div class="chart-stage"><svg class="range-timeline" viewBox="0 0 100 44" preserveAspectRatio="none" role="img" aria-label="Elevation profile, power in watts, cadence, and heart rate over the activity. Hover for exact sample values; drag the handles on the shaded window to select a range.">${chartOptions.elevation && elevation ? `<polygon class="elevation-profile" points="${elevationFill}" />` : ""}<rect class="selection-window" x="${selectionStartPercent}" y="0" width="${selectionWidthPercent}" height="44" />${lapMarkers.map((lap) => `<line class="lap-marker" x1="${lap.percent}" x2="${lap.percent}" y1="0" y2="44" />`).join("")}${chartOptions.power && power ? `<polyline class="power-line" points="${power.points}" />` : ""}${chartOptions.cadence && cadence ? `<polyline class="cadence-line" points="${cadence.points}" />` : ""}${chartOptions.heartRate && heartRate ? `<polyline class="heart-rate-line" points="${heartRate.points}" />` : ""}<line class="hover-cursor" x1="0" x2="0" y1="0" y2="44" /><line class="selection-handle" data-edge="start" x1="${selectionStartPercent}" x2="${selectionStartPercent}" y1="0" y2="44" /><line class="selection-handle" data-edge="end" x1="${selectionStartPercent + selectionWidthPercent}" x2="${selectionStartPercent + selectionWidthPercent}" y1="0" y2="44" /><line class="selection-hit-area" data-handle="start" data-edge="start" x1="${selectionStartPercent}" x2="${selectionStartPercent}" y1="0" y2="44" /><line class="selection-hit-area" data-handle="end" data-edge="end" x1="${selectionStartPercent + selectionWidthPercent}" x2="${selectionStartPercent + selectionWidthPercent}" y1="0" y2="44" /></svg><div class="chart-tooltip" role="tooltip" hidden></div></div>
    <p class="timeline-key"><span class="key-window"></span>Selected range · drag either edge to adjust${lapMarkers.length ? ` · <span class="key-line"></span>Lap boundary` : ""}</p></section>`;
};

const summary = (result, ftp) => `<section class="panel"><h2>Summary</h2><dl class="metrics">
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

const intervalMetric = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
const pairedMetric = (firstValue, secondValue, unit) => firstValue == null && secondValue == null
  ? "Unavailable"
  : `${firstValue == null ? "Unavailable" : formatNumber(firstValue)} / ${secondValue == null ? "Unavailable" : formatNumber(secondValue)} ${unit}`;
const exposureBar = (label, seconds, totalSeconds, className) => {
  if (seconds == null) return "";
  const percentage = totalSeconds > 0 ? Math.min(100, Math.max(0, seconds / totalSeconds * 100)) : 0;
  const percentageLabel = formatPercent(percentage / 100);
  return `<div class="interval-exposure__row"><div><span>${label}</span><strong>${percentageLabel}</strong></div><div class="interval-exposure__track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}" aria-valuetext="${percentageLabel}"><span class="interval-exposure__fill ${className}" style="width: ${percentage}%"></span></div></div>`;
};
const intervalSet = (set) => `<article class="interval-set"><div class="interval-set__heading"><div><h3>Set ${set.number} · ${formatIntervalProtocol({ repetitions: set.repetitions, ...set.pattern })}</h3>${set.partial ? `<p class="quiet">${set.includedRepetitions} of ${set.repetitions} repetitions in selection</p>` : ""}</div></div><dl class="interval-set__metrics">
  ${intervalMetric("Work power", formatMetric(set.power.workAverageWatts, "W"))}
  ${intervalMetric("Recovery power", formatMetric(set.power.recoveryAverageWatts, "W"))}
  ${intervalMetric("Power fade", formatPercent(set.power.fadePercent))}
  ${intervalMetric("Avg / max HR", pairedMetric(set.heartRate.averageBpm, set.heartRate.maximumBpm, "bpm"))}
  ${intervalMetric(">=90% HRmax", formatDuration(set.heartRate.timeAtOrAbove90Seconds))}
  ${intervalMetric("Work / recovery cadence", pairedMetric(set.cadence.workAverageRpm, set.cadence.recoveryAverageRpm, "rpm"))}
</dl><details class="interval-set__details"><summary>Details</summary><dl class="interval-set__details-grid">
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
const betweenSetRecovery = (recovery) => `<div class="between-set-recovery${recovery.partial ? " partial" : ""}"><span>${recovery.partial ? "Partial recovery" : "Recovery"} ${formatDuration(recovery.elapsedDurationSeconds)}</span><span>${formatMetric(recovery.averageActivePowerWatts, "W")}</span><span>HR ${formatMetric(recovery.lowestHeartRateBpm, "bpm")} → ${formatMetric(recovery.heartRateAtNextSetStartBpm, "bpm")}</span></div>`;
const intervalAnalysis = (intervalSets, sessionSummary, recoveries) => {
  if (!sessionSummary || !intervalSets.length) return "";
  const recoveriesByNextSet = new Map(recoveries.map((recovery) => [recovery.beforeSetNumber, recovery]));
  return `<section class="panel interval-analysis"><div class="section-heading"><div><h2>Interval analysis</h2><p class="interval-analysis__protocol">${sessionSummary.protocols.map(formatIntervalProtocol).join(" + ")}</p></div><span class="selection-label">${sessionSummary.setCount} ${sessionSummary.setCount === 1 ? "set" : "sets"}</span></div><dl class="interval-session-metrics">
    ${intervalMetric("Total interval-set time", formatDuration(sessionSummary.totalSetDurationSeconds))}
    ${intervalMetric("Hard work", formatDuration(sessionSummary.totalHardWorkDurationSeconds))}
    ${intervalMetric("Avg work power", formatMetric(sessionSummary.averageWorkPowerWatts, "W"))}
    ${intervalMetric("Time >=90% HRmax", formatDuration(sessionSummary.timeAtOrAbove90Seconds))}
    ${intervalMetric("Time >=95% HRmax", formatDuration(sessionSummary.timeAtOrAbove95Seconds))}
    ${intervalMetric("Max HR", formatMetric(sessionSummary.maximumHeartRateBpm, "bpm"))}
  </dl><div class="interval-exposure"><h3>HR exposure within interval sets</h3>${exposureBar(">=90% HRmax", sessionSummary.timeAtOrAbove90Seconds, sessionSummary.totalSetDurationSeconds, "interval-exposure__fill--90")}${exposureBar(">=95% HRmax", sessionSummary.timeAtOrAbove95Seconds, sessionSummary.totalSetDurationSeconds, "interval-exposure__fill--95")}</div><div class="interval-sets">${intervalSets.map((set) => `${intervalSet(set)}${recoveriesByNextSet.has(set.number + 1) ? betweenSetRecovery(recoveriesByNextSet.get(set.number + 1)) : ""}`).join("")}</div></section>`;
};

const numericRange = (minimum, maximum, value, unit) => maximum == null ? `${value(minimum)} ${unit}+` : `${value(minimum)}-${value(maximum)} ${unit}`;
const percentageRange = (minimum, maximum, reference) => maximum == null ? `${formatNumber(minimum * 100)}% ${reference}+` : `${formatNumber(minimum * 100)}-${formatNumber(maximum * 100)}% ${reference}`;
const powerZoneRange = (zone, ftp) => zone.id === "coasting" ? "0 W" : `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(ratio * ftp), "W")} · ${percentageRange(zone.minimum, zone.maximum, "FTP")}`;
const zones = (result, ftp) => !result.zones.length ? "" : `<section class="panel"><h2>Power zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col">Zone</th><th scope="col">Duration</th><th scope="col">Share</th></tr></thead><tbody>${result.zones.map((zone) => `<tr><th scope="row">${zone.label}<span class="zone-range">${powerZoneRange(zone, ftp)}</span></th><td>${formatDuration(zone.durationSeconds)}</td><td>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;
const heartRateZoneRange = (zone, maxHeartRate) => `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(maxHeartRate * ratio), "bpm")} · ${percentageRange(zone.minimum, zone.maximum, "Max HR")}`;
const heartRateZones = (result, maxHeartRate) => !result.heartRateZones.length ? "" : `<section class="panel"><h2>Heart rate zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col">Zone</th><th scope="col">Duration</th><th scope="col">Share</th></tr></thead><tbody>${result.heartRateZones.map((zone) => `<tr><th scope="row">${zone.label}<span class="zone-range">${heartRateZoneRange(zone, maxHeartRate)}</span></th><td>${formatDuration(zone.durationSeconds)}</td><td>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;

const laps = (lapsResult, showLaps) => !showLaps || !lapsResult.length ? "" : `<section class="panel"><h2>Laps</h2><div class="lap-table-wrap"><table class="lap-table"><thead><tr><th scope="col">Lap</th><th scope="col">Duration</th><th scope="col">Distance</th><th scope="col">NP</th><th scope="col">Power</th><th scope="col">HR</th><th scope="col"><span class="sr-only">Selection</span></th></tr></thead><tbody>${lapsResult.map((lap) => `<tr><th scope="row">${escape(lap.title)}</th><td>${formatDuration(lap.summary.activeDurationSeconds)}</td><td>${formatMetricDistance(lap.summary.distanceMeters)}</td><td>${formatMetric(lap.power.normalizedPowerWatts, "W")}</td><td>${formatMetric(lap.power.averageWatts, "W")}</td><td>${formatMetric(lap.heartRate.averageBpm, "bpm")}</td><td><button type="button" data-action="select-lap" data-index="${lap.index}">Select lap</button></td></tr>`).join("")}</tbody></table></div></section>`;

const quality = (result) => `<section class="panel"><h2>Data quality</h2><dl class="quality"><div><dt>Records</dt><dd>${result.quality.recordCount}</dd></div><div><dt>Power coverage</dt><dd>${formatPercent(result.quality.powerCoverage.percentage)}</dd></div><div><dt>Heart-rate coverage</dt><dd>${formatPercent(result.quality.heartRateCoverage.percentage)}</dd></div><div><dt>Cadence coverage</dt><dd>${formatPercent(result.quality.cadenceCoverage.percentage)}</dd></div><div><dt>Median interval</dt><dd>${formatMetric(result.quality.medianRecordIntervalSeconds, "s", 1)}</dd></div><div><dt>Largest gap</dt><dd>${formatMetric(result.quality.largestActiveRecordGapSeconds, "s", 1)}</dd></div></dl>${result.warnings.length ? `<ul class="warnings">${result.warnings.map((warning) => `<li>${escape(warning)}</li>`).join("")}</ul>` : "<p class=\"quiet\">No warnings.</p>"}</section>`;

const scoreOptions = (value) => `<option value=""${value == null || value === "" ? " selected" : ""}>Not specified</option>${Array.from({ length: 10 }, (_, index) => index + 1).map((score) => `<option value="${score}"${selected(String(value), String(score))}>${score}</option>`).join("")}`;
const athleteContext = (athleteNotes, exportOptions) => `<section class="panel athlete-context"><h2>Athlete Notes</h2><div class="athlete-context-controls"><label><span>RPE (1-10)</span><select name="rpe">${scoreOptions(athleteNotes.rpe)}</select></label><label><span>Fatigue (1-10, 10 = extremely fatigued)</span><select name="fatigue">${scoreOptions(athleteNotes.fatigue)}</select></label><label><span>Position</span><select name="position"><option value=""${athleteNotes.position ? "" : " selected"}>Not specified</option><option value="seated"${selected(athleteNotes.position, "seated")}>Seated</option><option value="standing"${selected(athleteNotes.position, "standing")}>Standing</option><option value="mixed"${selected(athleteNotes.position, "mixed")}>Mixed</option></select></label></div><label class="athlete-notes"><span>Notes</span><textarea name="athlete-notes" placeholder="Optional workout context">${escape(athleteNotes.notes)}</textarea></label><label class="export-laps"><input name="include-individual-laps" type="checkbox"${checked(exportOptions.includeIndividualLaps)} /> Include individual laps in exports</label></section>`;

export const renderApp = (state) => {
  if (state.status === "empty") return `<main class="empty"><header><p class="eyebrow">actex</p><h1>Activity data, ready for AI.</h1><p>Drop a FIT file here or choose a file. Your activity stays on this device.</p></header><label class="drop-zone" for="fit-file">Drop a FIT file here <span>or choose file</span></label><input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /><p class="error" role="alert">${escape(state.error ?? "")}</p></main>`;
  if (state.status === "parsing") return `<main class="empty"><p class="eyebrow">actex</p><h1>Reading your activity…</h1><p>Your activity stays on this device.</p></main>`;
  const { activity, selection, result, lapsResult, settings, ftp, maxHeartRate, chartOptions, athleteNotes, exportOptions, intervalSets = [], intervalSessionSummary = null, betweenSetRecoveries = [] } = state;
  const start = activity.metadata.startTime;
  return `<main><header class="app-header"><div><p class="eyebrow">actex</p><h1>${escape(capitalizeFirstLetter(activity.metadata.sport))}</h1><p>${formatDate(start)} · ${formatDuration(result.summary.activeDurationSeconds)} · ${formatMetricDistance(result.summary.distanceMeters)}</p>${activity.metadata.productName ? `<p class="quiet">Device: ${escape(activity.metadata.productName)}</p>` : ""}</div><div class="header-actions"><button type="button" data-action="new-file">New file</button><button type="button" data-action="copy-json">Copy JSON</button><button class="primary" type="button" data-action="copy-markdown">${state.copyStatus ?? "Copy Markdown"}</button></div></header>
  <section class="panel profile"><h2>Profile</h2><div class="profile-controls"><label><span>FTP</span><span><input name="ftp" type="number" min="1" inputmode="numeric" value="${ftp ?? ""}" aria-label="FTP in watts" /> W</span></label><label><span>Max HR</span><span><input name="max-heart-rate" type="number" min="1" inputmode="numeric" value="${maxHeartRate ?? ""}" aria-label="Maximum heart rate" /> bpm</span></label><button type="button" data-action="apply-fitness-inputs">Apply</button><button type="button" data-action="save-fitness-inputs">Save default</button></div></section>
  ${athleteContext(athleteNotes, exportOptions)}
  ${activity.sessions.length > 1 ? `<section class="panel compact"><label>Session <select name="session">${activity.sessions.map((session) => `<option value="${session.index}"${selected(session.index, selection.sessionIndex)}>Session ${session.index + 1}</option>`).join("")}</select></label><button type="button" data-action="select-session">Select session</button></section>` : ""}
  ${timeline(activity, selection, chartOptions)}
  ${summary(result, ftp)}
  ${intervalAnalysis(intervalSets, intervalSessionSummary, betweenSetRecoveries)}${zones(result, ftp)}${heartRateZones(result, maxHeartRate)}${laps(lapsResult, activity.laps.length > 1)}${quality(result)}
  <details class="panel"><summary>Settings</summary><h3>Power zones</h3><div class="zone-settings">${settings.zones.filter((zone) => zone.id !== "coasting").map((zone) => `<label class="settings-zone"><span>${zone.label}</span><input name="zone-${zone.id}" type="number" min="0" step="1" value="${Math.round(zone.minimum * 100)}" /></label>`).join("")}</div><h3>Heart rate zones</h3><div class="zone-settings">${settings.heartRateZones.map((zone) => `<label class="settings-zone"><span>${zone.label}</span><input name="heart-rate-zone-${zone.id}" type="number" min="0" max="100" step="1" value="${Math.round(zone.minimum * 100)}" /></label>`).join("")}</div><div class="settings-actions"><button type="button" data-action="save-settings">Save settings</button><button type="button" data-action="reset-settings">Reset settings</button></div></details>
  ${state.fallbackText ? `<section class="panel" aria-live="polite"><p>Direct clipboard access was blocked. Select and copy the text below.</p><textarea class="copy-fallback" readonly>${escape(state.fallbackText)}</textarea></section>` : ""}
  <input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /></main>`;
};

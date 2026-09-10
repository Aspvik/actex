import { formatDate, formatDuration, formatMetric, formatMetricDistance, formatNumber, formatPercent, formatSpeed } from "../utils/format.js";
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

const numericRange = (minimum, maximum, value, unit) => maximum == null ? `${value(minimum)} ${unit}+` : `${value(minimum)}-${value(maximum)} ${unit}`;
const percentageRange = (minimum, maximum, reference) => maximum == null ? `${formatNumber(minimum * 100)}% ${reference}+` : `${formatNumber(minimum * 100)}-${formatNumber(maximum * 100)}% ${reference}`;
const powerZoneRange = (zone, ftp) => zone.id === "coasting" ? "0 W" : `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(ratio * ftp), "W")} · ${percentageRange(zone.minimum, zone.maximum, "FTP")}`;
const zones = (result, ftp) => !result.zones.length ? "" : `<section class="panel"><h2>Power zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col">Zone</th><th scope="col">Duration</th><th scope="col">Share</th></tr></thead><tbody>${result.zones.map((zone) => `<tr><th scope="row">${zone.label}<span class="zone-range">${powerZoneRange(zone, ftp)}</span></th><td>${formatDuration(zone.durationSeconds)}</td><td>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;
const heartRateZoneRange = (zone, maxHeartRate) => `${numericRange(zone.minimum, zone.maximum, (ratio) => formatNumber(maxHeartRate * ratio), "bpm")} · ${percentageRange(zone.minimum, zone.maximum, "Max HR")}`;
const heartRateZones = (result, maxHeartRate) => !result.heartRateZones.length ? "" : `<section class="panel"><h2>Heart rate zones</h2><div class="zone-table-wrap"><table class="zone-table"><thead><tr><th scope="col">Zone</th><th scope="col">Duration</th><th scope="col">Share</th></tr></thead><tbody>${result.heartRateZones.map((zone) => `<tr><th scope="row">${zone.label}<span class="zone-range">${heartRateZoneRange(zone, maxHeartRate)}</span></th><td>${formatDuration(zone.durationSeconds)}</td><td>${formatPercent(zone.percentage)}</td></tr>`).join("")}</tbody></table></div></section>`;

const laps = (lapsResult, showLaps) => !showLaps || !lapsResult.length ? "" : `<section class="panel"><h2>Laps</h2><div class="laps">${lapsResult.map((lap) => `<article><h3>${lap.title}</h3><p>${formatDuration(lap.summary.activeDurationSeconds)} · ${formatMetricDistance(lap.summary.distanceMeters)}</p><p>NP ${formatMetric(lap.power.normalizedPowerWatts, "W")} · Power ${formatMetric(lap.power.averageWatts, "W")} · HR ${formatMetric(lap.heartRate.averageBpm, "bpm")}</p><button type="button" data-action="select-lap" data-index="${lap.index}">Select lap</button></article>`).join("")}</div></section>`;

const quality = (result) => `<section class="panel"><h2>Data quality</h2><dl class="quality"><div><dt>Records</dt><dd>${result.quality.recordCount}</dd></div><div><dt>Power coverage</dt><dd>${formatPercent(result.quality.powerCoverage.percentage)}</dd></div><div><dt>Heart-rate coverage</dt><dd>${formatPercent(result.quality.heartRateCoverage.percentage)}</dd></div><div><dt>Cadence coverage</dt><dd>${formatPercent(result.quality.cadenceCoverage.percentage)}</dd></div><div><dt>Median interval</dt><dd>${formatMetric(result.quality.medianRecordIntervalSeconds, "s", 1)}</dd></div><div><dt>Largest gap</dt><dd>${formatMetric(result.quality.largestActiveRecordGapSeconds, "s", 1)}</dd></div></dl>${result.warnings.length ? `<ul class="warnings">${result.warnings.map((warning) => `<li>${escape(warning)}</li>`).join("")}</ul>` : "<p class=\"quiet\">No warnings.</p>"}</section>`;

export const renderApp = (state) => {
  if (state.status === "empty") return `<main class="empty"><header><p class="eyebrow">actex</p><h1>Activity data, ready for AI.</h1><p>Drop a FIT file here or choose a file. Your activity stays on this device.</p></header><label class="drop-zone" for="fit-file">Drop a FIT file here <span>or choose file</span></label><input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /><p class="error" role="alert">${escape(state.error ?? "")}</p></main>`;
  if (state.status === "parsing") return `<main class="empty"><p class="eyebrow">actex</p><h1>Reading your activity…</h1><p>Your activity stays on this device.</p></main>`;
  const { activity, selection, result, lapsResult, settings, ftp, maxHeartRate, exportOptions, chartOptions } = state;
  const start = activity.metadata.startTime;
  return `<main><header class="app-header"><div><p class="eyebrow">actex</p><h1>${escape(capitalizeFirstLetter(activity.metadata.sport))}</h1><p>${formatDate(start)} · ${formatDuration(result.summary.activeDurationSeconds)} · ${formatMetricDistance(result.summary.distanceMeters)}</p>${activity.metadata.productName ? `<p class="quiet">Device: ${escape(activity.metadata.productName)}</p>` : ""}</div><button class="primary" type="button" data-action="copy-markdown">${state.copyStatus ?? "Copy for AI"}</button></header>
  <section class="fitness-inputs"><label><span>FTP</span><span><input name="ftp" type="number" min="1" inputmode="numeric" value="${ftp ?? ""}" aria-label="FTP in watts" /> W</span></label><label><span>Max HR</span><span><input name="max-heart-rate" type="number" min="1" inputmode="numeric" value="${maxHeartRate ?? ""}" aria-label="Maximum heart rate" /> bpm</span></label><button type="button" data-action="apply-fitness-inputs">Apply</button><button type="button" data-action="save-fitness-inputs">Save default</button></section>
  ${activity.sessions.length > 1 ? `<section class="panel compact"><label>Session <select name="session">${activity.sessions.map((session) => `<option value="${session.index}"${selected(session.index, selection.sessionIndex)}>Session ${session.index + 1}</option>`).join("")}</select></label><button type="button" data-action="select-session">Select session</button></section>` : ""}
  ${timeline(activity, selection, chartOptions)}
  ${summary(result, ftp)}
  ${zones(result, ftp)}${heartRateZones(result, maxHeartRate)}${laps(lapsResult, activity.laps.length > 1)}${quality(result)}
  <section class="panel export"><h2>Export</h2><div class="toggles"><label><input name="compact" type="checkbox"${checked(exportOptions.compact)} /> Compact text</label><label><input name="includeLaps" type="checkbox"${checked(exportOptions.includeLaps)} /> Include laps in AI copy</label>${selection.type === "range" ? `<label><input name="includeOverlappingLaps" type="checkbox"${checked(exportOptions.includeOverlappingLaps)} /> Include overlapping laps</label>` : ""}</div><div class="actions"><button type="button" class="primary" data-action="copy-markdown">Copy for AI</button><button type="button" data-action="copy-json">Copy JSON</button></div></section>
  <details class="panel"><summary>Settings</summary><h3>Power zones</h3><div class="zone-settings">${settings.zones.filter((zone) => zone.id !== "coasting").map((zone) => `<label class="settings-zone"><span>${zone.label}</span><input name="zone-${zone.id}" type="number" min="0" step="1" value="${Math.round(zone.minimum * 100)}" /></label>`).join("")}</div><h3>Heart rate zones</h3><div class="zone-settings">${settings.heartRateZones.map((zone) => `<label class="settings-zone"><span>${zone.label}</span><input name="heart-rate-zone-${zone.id}" type="number" min="0" max="100" step="1" value="${Math.round(zone.minimum * 100)}" /></label>`).join("")}</div><div class="settings-actions"><button type="button" data-action="save-settings">Save settings</button><button type="button" data-action="reset-settings">Reset settings</button></div></details>
  ${state.fallbackText ? `<section class="panel" aria-live="polite"><p>Direct clipboard access was blocked. Select and copy the text below.</p><textarea class="copy-fallback" readonly>${escape(state.fallbackText)}</textarea></section>` : ""}
  <input id="fit-file" type="file" accept=".fit,application/octet-stream" hidden /><label class="new-file" for="fit-file">Choose another FIT file</label></main>`;
};

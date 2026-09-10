import "./styles.css";
import { decodeFitFile } from "./fit/decode-fit.js";
import { normalizeFit } from "./fit/normalize-fit.js";
import { buildTimerSegments } from "./activity/build-timer-state.js";
import { createSelection, selectionForActivity, selectionForLap, selectionForSession } from "./activity/selection.js";
import { calculateSelection } from "./metrics/summary.js";
import { analyzeIntervalSets } from "./analysis/interval-sets.js";
import { buildExportModel } from "./output/build-export-model.js";
import { buildMarkdown } from "./output/markdown.js";
import { buildJson } from "./output/json.js";
import { loadSettings, resetSettings, saveSettings } from "./storage/settings.js";
import { formatRelativeTime } from "./utils/time.js";
import { renderApp } from "./ui/render.js";

const app = document.querySelector("#app");
let state = { status: "empty", error: null };

const selectedSession = () => state.activity.sessions.find((session) => session.index === state.selection.sessionIndex) ?? state.activity.sessions[0];
const resolvedFtp = () => {
  if (state.currentFtp) return { value: state.currentFtp, source: "current activity" };
  if (state.settings.defaultFtp) return { value: state.settings.defaultFtp, source: "saved default" };
  if (selectedSession()?.fileFtpWatts) return { value: selectedSession().fileFtpWatts, source: "FIT metadata" };
  return { value: null, source: "unavailable" };
};
const resolvedMaxHeartRate = () => {
  if (state.currentMaxHeartRate) return { value: state.currentMaxHeartRate, source: "current activity" };
  if (state.settings.defaultMaxHeartRate) return { value: state.settings.defaultMaxHeartRate, source: "saved default" };
  if (state.activity.metadata.maxHeartRateBpm) return { value: state.activity.metadata.maxHeartRateBpm, source: "FIT metadata" };
  return { value: null, source: "unavailable" };
};
const timerSegments = () => buildTimerSegments({ startTime: state.activity.metadata.startTime, endTime: state.activity.metadata.endTime, timerEvents: state.activity.timerEvents });

const calculateLaps = (ftp, maxHeartRate) => state.activity.laps.flatMap((lap) => {
  try {
    const result = calculateSelection({ activity: state.activity, selection: selectionForLap(lap), timerSegments: timerSegments(), ftp, zones: state.settings.zones, heartRateZones: state.settings.heartRateZones, maxHeartRate, session: state.activity.sessions.find((session) => session.index === lap.sessionIndex) });
    return [{ ...result, index: lap.index, title: lap.title }];
  } catch { return []; }
});

const refresh = () => {
  if (state.status !== "parsed") { app.innerHTML = renderApp(state); bind(); return; }
  try {
    const ftp = resolvedFtp();
    const maxHeartRate = resolvedMaxHeartRate();
    const result = calculateSelection({ activity: state.activity, selection: state.selection, timerSegments: timerSegments(), ftp: ftp.value, zones: state.settings.zones, heartRateZones: state.settings.heartRateZones, maxHeartRate: maxHeartRate.value, session: selectedSession() });
    const intervalAnalysis = analyzeIntervalSets({ activity: state.activity, timerSegments: timerSegments(), selection: state.selection, maxHeartRate: maxHeartRate.value });
    state = { ...state, result, lapsResult: calculateLaps(ftp.value, maxHeartRate.value), ...intervalAnalysis, ftp: ftp.value, ftpSource: ftp.source, maxHeartRate: maxHeartRate.value, maxHeartRateSource: maxHeartRate.source };
  } catch (error) {
    state = { status: "empty", error: error.message };
  }
  app.innerHTML = renderApp(state);
  bind();
};

const selectionFromSeconds = (startSeconds, endSeconds) => {
  const activityStart = state.activity.metadata.startTime;
  const activityEnd = state.activity.metadata.endTime;
  const start = new Date(activityStart.getTime() + startSeconds * 1000);
  const end = new Date(activityStart.getTime() + endSeconds * 1000);
  state.selection = createSelection({ type: "range", startTimestamp: start, endTimestamp: end > activityEnd ? activityEnd : end });
};

const exportLaps = () => state.exportOptions.includeIndividualLaps ? state.lapsResult : [];

const outputText = (format) => {
  const model = buildExportModel({
    activity: state.activity,
    result: state.result,
    ftp: state.ftp,
    maxHeartRate: state.maxHeartRate,
    intervalSets: state.intervalSets,
    intervalSessionSummary: state.intervalSessionSummary,
    betweenSetRecoveries: state.betweenSetRecoveries,
    athleteNotes: state.athleteNotes,
    includeIndividualLaps: state.exportOptions.includeIndividualLaps,
    laps: exportLaps()
  });
  if (format === "json") return buildJson(model);
  return buildMarkdown(model);
};

const copy = async (format) => {
  const text = outputText(format);
  try {
    await navigator.clipboard.writeText(text);
    state.copyStatus = "Copied";
    state.fallbackText = null;
    refresh();
    window.setTimeout(() => { if (state.status === "parsed") { state.copyStatus = null; refresh(); } }, 2000);
  } catch {
    state.fallbackText = text;
    refresh();
    app.querySelector(".copy-fallback")?.select();
  }
};

const loadFile = async (file) => {
  if (!file) return;
  state = { status: "parsing" };
  refresh();
  try {
    const activity = normalizeFit(await decodeFitFile(file));
    if (!String(activity.metadata.sport ?? "cycling").toLowerCase().includes("cycling")) throw new Error("This MVP currently supports cycling FIT activities only.");
    state = {
      status: "parsed", activity, settings: loadSettings(), selection: selectionForActivity(activity), currentFtp: null, currentMaxHeartRate: null,
      chartOptions: { elevation: true, power: true, cadence: true, heartRate: true },
      exportOptions: { includeIndividualLaps: false },
      athleteNotes: { rpe: null, fatigue: null, position: null, notes: "" },
      intervalSets: [], intervalSessionSummary: null, betweenSetRecoveries: [], copyStatus: null, fallbackText: null
    };
    refresh();
  } catch (error) {
    state = { status: "empty", error: error.message || "The FIT file could not be read." };
    refresh();
  }
};

const bind = () => {
  const fileInput = app.querySelector("#fit-file");
  fileInput?.addEventListener("change", (event) => loadFile(event.target.files[0]));
  app.querySelector(".drop-zone")?.addEventListener("dragover", (event) => event.preventDefault());
  app.querySelector(".drop-zone")?.addEventListener("drop", (event) => { event.preventDefault(); loadFile(event.dataTransfer.files[0]); });
  app.querySelectorAll("input, textarea, select").forEach((input) => input.addEventListener("input", (event) => {
    const target = event.target;
    if (target.name.startsWith("chart-")) {
      state.chartOptions[target.name.slice(6)] = target.checked;
      refresh();
      return;
    }
    if (target.name === "include-individual-laps") {
      state.exportOptions.includeIndividualLaps = target.checked;
      return;
    }
    if (target.name === "rpe" || target.name === "fatigue" || target.name === "position" || target.name === "athlete-notes") {
      const key = target.name === "athlete-notes" ? "notes" : target.name;
      state.athleteNotes[key] = target.value;
      return;
    }
    if (target.name === "rangeStart" || target.name === "rangeEnd") return;
  }));
  const rangeTimeline = app.querySelector(".range-timeline");
  if (rangeTimeline) {
    const activityStart = state.activity.metadata.startTime;
    const activityDuration = (state.activity.metadata.endTime - activityStart) / 1000;
    const hoverCursor = rangeTimeline.querySelector(".hover-cursor");
    const hoverTooltip = app.querySelector(".chart-tooltip");
    let draggedHandle = null;
    let draftStart = (state.selection.startTimestamp - activityStart) / 1000;
    let draftEnd = (state.selection.endTimestamp - activityStart) / 1000;
    const secondsAtPointer = (event) => {
      const bounds = rangeTimeline.getBoundingClientRect();
      return Math.max(0, Math.min(activityDuration, (event.clientX - bounds.left) / bounds.width * activityDuration));
    };
    const recordAt = (seconds) => {
      const target = activityStart.getTime() + seconds * 1000;
      const records = state.activity.records;
      let low = 0;
      let high = records.length - 1;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (records[middle].timestamp.getTime() < target) low = middle + 1;
        else high = middle;
      }
      const next = records[low];
      const previous = records[Math.max(0, low - 1)];
      return Math.abs(next.timestamp.getTime() - target) < Math.abs(previous.timestamp.getTime() - target) ? next : previous;
    };
    const updateHover = (seconds) => {
      const record = recordAt(seconds);
      const percent = seconds / activityDuration * 100;
      const value = (number, unit, decimals = 0) => number == null ? "—" : `${number.toFixed(decimals)} ${unit}`;
      hoverCursor.setAttribute("x1", percent);
      hoverCursor.setAttribute("x2", percent);
      hoverTooltip.hidden = false;
      hoverTooltip.style.left = `${percent}%`;
      hoverTooltip.classList.toggle("align-right", percent > 72);
      const rows = [
        ["Time", formatRelativeTime(activityStart, record.timestamp)],
        ["Distance", record.distanceMeters == null ? "—" : `${(record.distanceMeters / 1000).toFixed(2)} km`],
        ["Elevation", value(record.altitudeMeters, "m")],
        ["Power", value(record.powerWatts, "W")],
        ["Cadence", value(record.cadenceRpm, "rpm")],
        ["Heart rate", value(record.heartRateBpm, "bpm")]
      ];
      hoverTooltip.innerHTML = rows.map(([label, metric]) => `<span>${label}</span><strong>${metric}</strong>`).join("");
    };
    const updateTimelineWindow = () => {
      const startPercent = draftStart / activityDuration * 100;
      const endPercent = draftEnd / activityDuration * 100;
      const window = rangeTimeline.querySelector(".selection-window");
      const startHandles = rangeTimeline.querySelectorAll('[data-edge="start"]');
      const endHandles = rangeTimeline.querySelectorAll('[data-edge="end"]');
      window.setAttribute("x", startPercent);
      window.setAttribute("width", Math.max(.5, endPercent - startPercent));
      startHandles.forEach((handle) => { handle.setAttribute("x1", startPercent); handle.setAttribute("x2", startPercent); });
      endHandles.forEach((handle) => { handle.setAttribute("x1", endPercent); handle.setAttribute("x2", endPercent); });
    };
    rangeTimeline.addEventListener("pointerdown", (event) => {
      const handle = event.target.dataset.handle;
      if (!handle) return;
      draggedHandle = handle;
      rangeTimeline.setPointerCapture(event.pointerId);
      updateHover(secondsAtPointer(event));
      event.preventDefault();
    });
    rangeTimeline.addEventListener("pointermove", (event) => {
      const seconds = secondsAtPointer(event);
      updateHover(seconds);
      if (!draggedHandle) return;
      if (draggedHandle === "start") draftStart = Math.min(seconds, draftEnd - 1);
      else draftEnd = Math.max(seconds, draftStart + 1);
      updateTimelineWindow();
    });
    const finishRangeDrag = (event) => {
      if (!draggedHandle) return;
      if (rangeTimeline.hasPointerCapture(event.pointerId)) rangeTimeline.releasePointerCapture(event.pointerId);
      draggedHandle = null;
      selectionFromSeconds(draftStart, draftEnd);
      refresh();
    };
    rangeTimeline.addEventListener("pointerup", finishRangeDrag);
    rangeTimeline.addEventListener("pointercancel", finishRangeDrag);
    rangeTimeline.addEventListener("pointerleave", () => { if (!draggedHandle) hoverTooltip.hidden = true; });
  }
  app.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
    const action = button.dataset.action;
    if (action === "new-file") return app.querySelector("#fit-file")?.click();
    if (action === "copy-markdown") return copy("markdown");
    if (action === "copy-json") return copy("json");
    if (action === "select-activity") { state.selection = selectionForActivity(state.activity); return refresh(); }
    if (action === "select-session") { const session = state.activity.sessions.find((item) => item.index === Number(app.querySelector('[name="session"]').value)); if (session) state.selection = selectionForSession(session); return refresh(); }
    if (action === "select-lap") {
      const lapIndex = Number(button.dataset.index);
      const lap = state.activity.laps.find((item) => item.index === lapIndex);
      if (lap) state.selection = state.selection.type === "lap" && state.selection.lapIndex === lapIndex ? selectionForActivity(state.activity) : selectionForLap(lap);
      return refresh();
    }
    if (action === "select-range") { state.selection = createSelection({ ...state.selection, type: "range" }); return refresh(); }
    if (action === "apply-fitness-inputs" || action === "save-fitness-inputs") {
      const ftp = Number(app.querySelector('[name="ftp"]').value);
      const maxHeartRateInput = app.querySelector('[name="max-heart-rate"]').value;
      state.currentFtp = Number.isFinite(ftp) && ftp > 0 ? ftp : null;
      const maxHeartRate = Number(maxHeartRateInput);
      const hasMaxHeartRateInput = maxHeartRateInput;
      if (hasMaxHeartRateInput && (!Number.isFinite(maxHeartRate) || maxHeartRate <= 0)) return alert("Max HR must be a positive number.");
      state.currentMaxHeartRate = hasMaxHeartRateInput ? maxHeartRate : null;
      if (action === "save-fitness-inputs") {
        if (state.currentFtp) state.settings.defaultFtp = state.currentFtp;
        if (hasMaxHeartRateInput) {
          state.settings.defaultMaxHeartRate = maxHeartRate;
        }
        saveSettings(state.settings);
      }
      return refresh();
    }
    if (action === "save-settings") {
      const editable = state.settings.zones.filter((zone) => zone.id !== "coasting").map((zone) => ({ ...zone, minimum: Number(app.querySelector(`[name="zone-${zone.id}"]`).value) / 100 }));
      if (editable.some((zone, index) => !Number.isFinite(zone.minimum) || zone.minimum < 0 || (index && zone.minimum <= editable[index - 1].minimum))) return alert("Zone starts must be increasing non-negative percentages.");
      const editableHeartRateZones = state.settings.heartRateZones.map((zone) => ({ ...zone, minimum: Number(app.querySelector(`[name="heart-rate-zone-${zone.id}"]`).value) / 100 }));
      if (editableHeartRateZones.some((zone, index) => !Number.isFinite(zone.minimum) || zone.minimum < 0 || zone.minimum > 1 || (index && zone.minimum <= editableHeartRateZones[index - 1].minimum))) return alert("Heart-rate zone starts must be increasing percentages from 0 to 100.");
      state.settings.zones = [{ ...state.settings.zones[0] }, ...editable.map((zone, index) => ({ ...zone, maximum: editable[index + 1]?.minimum ?? null }))];
      state.settings.heartRateZones = editableHeartRateZones.map((zone, index) => ({ ...zone, maximum: editableHeartRateZones[index + 1]?.minimum ?? 1 }));
      saveSettings(state.settings); return refresh();
    }
    if (action === "reset-settings") { state.settings = resetSettings(); state.currentFtp = null; state.currentMaxHeartRate = null; return refresh(); }
  }));
};

refresh();

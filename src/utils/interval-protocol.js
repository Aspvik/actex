import { formatDuration } from "./format.js";

const COMMON_INTERVAL_DURATIONS_SECONDS = [5, 10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 900, 1200];
const DISPLAY_INTERVAL_DURATION_TOLERANCE_SECONDS = 2;

const normalizedIntervalDuration = (seconds) => {
  const nearest = COMMON_INTERVAL_DURATIONS_SECONDS.reduce((closest, candidate) => Math.abs(candidate - seconds) < Math.abs(closest - seconds) ? candidate : closest, COMMON_INTERVAL_DURATIONS_SECONDS[0]);
  return Math.abs(nearest - seconds) <= DISPLAY_INTERVAL_DURATION_TOLERANCE_SECONDS ? nearest : null;
};

export const formatIntervalDuration = (seconds) => {
  if (seconds == null) return "Unavailable";
  const normalized = normalizedIntervalDuration(seconds);
  const displaySeconds = normalized ?? Math.round(seconds);
  return displaySeconds >= 60 ? formatDuration(displaySeconds).replace(/^0:/, "") : String(displaySeconds);
};

export const formatIntervalProtocol = ({ repetitions, workDurationSeconds, recoveryDurationSeconds, recoveryDurationConsistent }) => `${repetitions} x ${formatIntervalDuration(workDurationSeconds)}${recoveryDurationConsistent === false ? "" : `/${formatIntervalDuration(recoveryDurationSeconds)}`}`;

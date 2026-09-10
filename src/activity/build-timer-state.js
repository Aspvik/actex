import { asDate } from "../utils/time.js";

const stateFromEvent = (event) => {
  const raw = String(event.timerState ?? event.eventType ?? event.type ?? "").replaceAll(/[_\-\s]/g, "").toLowerCase();
  if (["start", "resume"].includes(raw)) return true;
  if (["stop", "stopdisable", "stopall", "pause", "suspend"].includes(raw)) return false;
  return null;
};

/**
 * Timer state is driven only by FIT timer events. If none exist the bounded
 * session/activity is considered active; a recording gap never creates a pause.
 */
export const buildTimerSegments = ({ startTime, endTime, timerEvents = [] }) => {
  const start = asDate(startTime);
  const end = asDate(endTime);
  if (!start || !end || end <= start) return [];
  const events = timerEvents
    .map((event) => ({ ...event, timestamp: asDate(event.timestamp), state: stateFromEvent(event) }))
    .filter((event) => event.timestamp && event.state !== null && event.timestamp > start && event.timestamp < end)
    .toSorted((left, right) => left.timestamp - right.timestamp);
  let running = true;
  let cursor = start;
  const segments = [];
  for (const event of events) {
    if (event.timestamp > cursor) segments.push({ startTimestamp: cursor, endTimestamp: event.timestamp, timerRunning: running });
    running = event.state;
    cursor = event.timestamp;
  }
  if (cursor < end) segments.push({ startTimestamp: cursor, endTimestamp: end, timerRunning: running });
  return segments;
};

export const activeTimerSeconds = (segments, selection) => segments.reduce((total, segment) => {
  if (!segment.timerRunning) return total;
  const start = new Date(Math.max(segment.startTimestamp, selection.startTimestamp));
  const end = new Date(Math.min(segment.endTimestamp, selection.endTimestamp));
  return end > start ? total + (end - start) / 1000 : total;
}, 0);

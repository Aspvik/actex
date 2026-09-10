import { asDate } from "../utils/time.js";

export const createSelection = ({ type = "activity", startTimestamp, endTimestamp, sessionIndex = null, lapIndex = null }) => {
  const start = asDate(startTimestamp);
  const end = asDate(endTimestamp);
  if (!start || !end || end <= start) throw new Error("The selected range must have an end after its start.");
  return { type, startTimestamp: start, endTimestamp: end, sessionIndex, lapIndex };
};

export const selectionForActivity = (activity) => createSelection({
  type: "activity",
  startTimestamp: activity.metadata.startTime,
  endTimestamp: activity.metadata.endTime
});

export const selectionForSession = (session) => createSelection({
  type: "session",
  startTimestamp: session.startTime,
  endTimestamp: session.endTime,
  sessionIndex: session.index
});

export const selectionForLap = (lap) => createSelection({
  type: "lap",
  startTimestamp: lap.startTime,
  endTimestamp: lap.endTime,
  sessionIndex: lap.sessionIndex,
  lapIndex: lap.index
});

export const selectionsOverlap = (left, right) => left.startTimestamp < right.endTimestamp && right.startTimestamp < left.endTimestamp;

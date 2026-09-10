import { intervalsForField } from "../activity/sample-durations.js";

export const weightedField = (intervals, field) => {
  const valid = intervalsForField(intervals, field);
  const seconds = valid.reduce((total, interval) => total + interval.validSeconds, 0);
  return seconds ? valid.reduce((total, interval) => total + interval.record[field] * interval.validSeconds, 0) / seconds : null;
};

export const maximumField = (intervals, field) => {
  const values = intervalsForField(intervals, field).map((interval) => interval.record[field]);
  return values.length ? Math.max(...values) : null;
};

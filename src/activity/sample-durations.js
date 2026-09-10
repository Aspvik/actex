import { NORMAL_SAMPLE_GAP_SECONDS } from "../utils/constants.js";

const overlap = (start, end, segment) => {
  const clippedStart = new Date(Math.max(start, segment.startTimestamp));
  const clippedEnd = new Date(Math.min(end, segment.endTimestamp));
  return clippedEnd > clippedStart ? { startTimestamp: clippedStart, endTimestamp: clippedEnd } : null;
};

/** A sample is step-held only for NORMAL_SAMPLE_GAP_SECONDS from its timestamp. */
export const buildSampleIntervals = (records, selection, timerSegments) => {
  const sorted = records.filter((record) => record.timestamp).toSorted((a, b) => a.timestamp - b.timestamp);
  return sorted.flatMap((record, index) => {
    const nextTimestamp = sorted[index + 1]?.timestamp ?? selection.endTimestamp;
    if (nextTimestamp <= record.timestamp) return [];
    const sourceEnd = new Date(Math.min(nextTimestamp, selection.endTimestamp));
    const sourceStart = new Date(Math.max(record.timestamp, selection.startTimestamp));
    if (sourceEnd <= sourceStart) return [];
    const validUntil = new Date(record.timestamp.getTime() + NORMAL_SAMPLE_GAP_SECONDS * 1000);
    return timerSegments
      .filter((segment) => segment.timerRunning)
      .map((segment) => overlap(sourceStart, sourceEnd, segment))
      .filter(Boolean)
      .map((interval) => ({
        record,
        ...interval,
        durationSeconds: (interval.endTimestamp - interval.startTimestamp) / 1000,
        validUntil
      }));
  });
};

export const validIntervalSeconds = (interval) => Math.max(0, (Math.min(interval.endTimestamp, interval.validUntil) - interval.startTimestamp) / 1000);

export const intervalsForField = (intervals, field) => intervals
  .filter((interval) => interval.record[field] !== null && interval.record[field] !== undefined)
  .map((interval) => ({ ...interval, validSeconds: validIntervalSeconds(interval) }))
  .filter((interval) => interval.validSeconds > 0);

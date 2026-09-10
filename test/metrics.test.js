import { describe, expect, it } from "vitest";
import { buildTimerSegments, activeTimerSeconds } from "../src/activity/build-timer-state.js";
import { createSelection } from "../src/activity/selection.js";
import { calculateSelection } from "../src/metrics/summary.js";
import { DEFAULT_ZONE_BOUNDARIES } from "../src/utils/constants.js";

const at = (seconds) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
const records = (duration, values = {}) => Array.from({ length: duration + 1 }, (_, index) => ({ timestamp: at(index), powerWatts: values.power ? values.power(index) : 300, heartRateBpm: values.hr ? values.hr(index) : 150, cadenceRpm: values.cadence ? values.cadence(index) : 90, speedMps: 10, distanceMeters: index * 10, altitudeMeters: 100 + index }));
const activity = (dataRecords = records(600), events = []) => ({ metadata: { startTime: at(0), endTime: at(600), sport: "cycling" }, records: dataRecords, timerEvents: events, diagnostics: { decodeWarnings: [] } });
const selection = (end = 600) => createSelection({ type: "activity", startTimestamp: at(0), endTimestamp: at(end) });
const result = ({ dataRecords, events = [], end = 600, ftp = 300 } = {}) => {
  const item = activity(dataRecords, events);
  return calculateSelection({ activity: item, selection: selection(end), timerSegments: buildTimerSegments({ startTime: at(0), endTime: at(600), timerEvents: events }), ftp, zones: structuredClone(DEFAULT_ZONE_BOUNDARIES), session: {} });
};

describe("timer and sample policies", () => {
  it("uses timer events rather than gaps to exclude a pause", () => {
    const events = [{ timestamp: at(120), eventType: "stop" }, { timestamp: at(240), eventType: "start" }];
    const segments = buildTimerSegments({ startTime: at(0), endTime: at(600), timerEvents: events });
    expect(activeTimerSeconds(segments, selection())).toBe(480);
    const calculated = result({ events });
    expect(calculated.summary.activeDurationSeconds).toBe(480);
    expect(calculated.power.workJoules).toBe(144000);
  });

  it("keeps explicit zero power but excludes missing power", () => {
    const dataRecords = records(10, { power: (index) => index < 5 ? 0 : (index < 8 ? null : 300) });
    const calculated = result({ dataRecords, end: 10 });
    expect(calculated.power.averageWatts).toBeCloseTo(600 / 7);
    expect(calculated.quality.powerCoverage.validSeconds).toBe(7);
  });

  it("does not invent power across long record gaps", () => {
    const dataRecords = [{ ...records(1)[0] }, { ...records(1)[0], timestamp: at(40), distanceMeters: 400 }, { ...records(1)[0], timestamp: at(599), distanceMeters: 5990 }];
    const calculated = result({ dataRecords });
    expect(calculated.quality.powerCoverage.validSeconds).toBe(11);
    expect(calculated.quality.largestActiveRecordGapSeconds).toBe(559);
    expect(calculated.warnings.join(" ")).toMatch(/559 seconds/);
  });
});

describe("cycling calculations", () => {
  it("calculates steady normalized power, work, VI and IF", () => {
    const calculated = result();
    expect(calculated.power.averageWatts).toBe(300);
    expect(calculated.power.workJoules).toBe(180000);
    expect(calculated.power.normalizedPowerWatts).toBe(300);
    expect(calculated.power.variabilityIndex).toBe(1);
    expect(calculated.power.intensityFactor).toBe(1);
  });

  it("classifies exact zone boundaries without overlap", () => {
    const dataRecords = records(8, { power: (index) => [0, 164.999, 165, 228, 264, 285, 318, 363, 400][index] });
    const calculated = result({ dataRecords, end: 8 });
    expect(calculated.zones.map((zone) => zone.durationSeconds)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it("warns when Normalized Power is requested for a short range", () => {
    const calculated = result({ dataRecords: records(29), end: 29 });
    expect(calculated.power.normalizedPowerWatts).toBeNull();
    expect(calculated.warnings.join(" ")).toMatch(/shorter than 30 seconds/);
  });

  it("retains and flags an obvious isolated power outlier", () => {
    const dataRecords = records(10, { power: (index) => index === 5 ? 2600 : 300 });
    const calculated = result({ dataRecords, end: 10 });
    expect(calculated.power.maximumWatts).toBe(2600);
    expect(calculated.warnings.join(" ")).toMatch(/isolated power spike/);
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { decodeFitFile } from "../src/fit/decode-fit.js";
import { normalizeFit } from "../src/fit/normalize-fit.js";
import { buildTimerSegments, activeTimerSeconds } from "../src/activity/build-timer-state.js";
import { selectionForActivity } from "../src/activity/selection.js";
import { buildExportModel } from "../src/output/build-export-model.js";
import { buildMarkdown } from "../src/output/markdown.js";
import { buildJson } from "../src/output/json.js";

const time = (second) => new Date(Date.UTC(2026, 7, 9, 0, 0, second));

describe("FIT normalization", () => {
  it("owns safe values and excludes coordinates and serial numbers", () => {
    const activity = normalizeFit({ messages: {
      fileIdMesgs: [{ timeCreated: time(0), serialNumber: 123, productName: "Edge" }],
      sessionMesgs: [{ startTime: time(0), timestamp: time(20), sport: "cycling", totalTimerTime: 20, totalDistance: 100 }],
      recordMesgs: [{ timestamp: time(0), power: 0, positionLat: 123 }, { timestamp: time(20), power: 300, positionLong: 123 }],
      eventMesgs: [{ timestamp: time(5), event: "timer", eventType: "stop" }],
      timeInZoneMesgs: [{ maxHeartRate: 185, restingHeartRate: 39 }]
    } });
    expect(activity.records[0].powerWatts).toBe(0);
    expect(activity.records[0]).not.toHaveProperty("positionLat");
    expect(activity.metadata).not.toHaveProperty("serialNumber");
    expect(activity.timerEvents).toHaveLength(1);
    expect(activity.metadata.maxHeartRateBpm).toBe(185);
    expect(activity.metadata).not.toHaveProperty("restingHeartRateBpm");
  });

  it("uses elapsed time when test.fit has a start-equivalent session timestamp", async () => {
    const file = new File([await readFile(new URL("../docs/test.fit", import.meta.url))], "test.fit");
    const activity = normalizeFit(await decodeFitFile(file));
    expect(activity.metadata.endTime).toEqual(new Date("2026-08-09T09:56:27.107Z"));
    const segments = buildTimerSegments({ startTime: activity.metadata.startTime, endTime: activity.metadata.endTime, timerEvents: activity.timerEvents });
    expect(activeTimerSeconds(segments, selectionForActivity(activity))).toBe(10518);
  });
});

describe("versioned exports", () => {
  const model = buildExportModel({
    activity: { metadata: { sport: "cycling", startTime: time(0) } },
    result: { selection: { type: "activity", startTimestamp: time(0), endTimestamp: time(60) }, summary: { activeDurationSeconds: 60, elapsedDurationSeconds: 60, distanceMeters: 1000, averageSpeedMps: 16.67, maximumSpeedMps: 18 }, power: { averageWatts: 300, normalizedPowerWatts: 300, maximumWatts: 500, workJoules: 18000, variabilityIndex: 1, intensityFactor: 1 }, heartRate: { averageBpm: 150, maximumBpm: 170 }, cadence: { averageRpm: 90, maximumRpm: 100 }, elevation: { gainMeters: 10, source: "Calculated" }, zones: [], quality: { recordCount: 60, powerCoverage: { percentage: 1 }, heartRateCoverage: { percentage: 1 }, cadenceCoverage: { percentage: 1 }, medianRecordIntervalSeconds: 1, largestActiveRecordGapSeconds: 1 }, warnings: [] },
    ftp: 300, laps: []
  });
  it("has schema identifiers and no private device details", () => {
    expect(buildMarkdown(model)).toContain("actex schema: 1");
    const json = buildJson(model);
    expect(JSON.parse(json).schemaVersion).toBe(1);
    expect(json).not.toMatch(/serial|position/i);
  });

  it("formats power-zone boundaries without floating-point decimals", () => {
    const markdown = buildMarkdown({
      ...model,
      powerZones: [{ id: "recovery", label: "Active Recovery", minimum: 0, maximum: 0.55, durationSeconds: 10, percentage: 0.1 }]
    });
    expect(markdown).toContain("| Active Recovery | 0:00:10 | 10.0% | 0 W | 165 W |");
    expect(markdown).not.toContain("55.00000000000001");
  });

  it("exports heart-rate zones as a table with BPM boundaries", () => {
    const markdown = buildMarkdown({
      ...model,
      heartRate: { ...model.heartRate, configuredMaximumBpm: 190 },
      heartRateZones: [{ id: "zone1", label: "Warm Up", minimum: 0.55, maximum: 0.72, durationSeconds: 10, percentage: 0.1 }]
    });
    expect(markdown).toContain("| Warm Up | 0:00:10 | 10.0% | 105 bpm | 137 bpm |");
  });
});

import { describe, expect, it } from "vitest";
import { renderApp } from "../src/ui/render.js";

const at = (seconds) => new Date(Date.UTC(2026, 8, 10, 0, 0, seconds));

const state = {
  status: "parsed",
  activity: {
    metadata: { sport: "cycling", startTime: at(0), endTime: at(120), productName: null },
    records: [],
    sessions: [],
    laps: [{ index: 0 }, { index: 1 }]
  },
  selection: { type: "activity", startTimestamp: at(0), endTimestamp: at(120) },
  result: {
    summary: { activeDurationSeconds: 120, elapsedDurationSeconds: 120, distanceMeters: 1000 },
    power: {}, heartRate: {}, cadence: {}, elevation: {}, zones: [], heartRateZones: [],
    quality: { recordCount: 0, powerCoverage: {}, heartRateCoverage: {}, cadenceCoverage: {}, medianRecordIntervalSeconds: null, largestActiveRecordGapSeconds: null },
    warnings: []
  },
  lapsResult: [
    { index: 0, title: "Lap 1", summary: { activeDurationSeconds: 60, distanceMeters: 1000 }, power: { normalizedPowerWatts: 300, averageWatts: 280 }, heartRate: { averageBpm: 150 } },
    { index: 1, title: "Lap 2", summary: { activeDurationSeconds: 60, distanceMeters: 1100 }, power: { normalizedPowerWatts: 310, averageWatts: 290 }, heartRate: { averageBpm: 155 } }
  ],
  settings: { zones: [], heartRateZones: [] },
  ftp: null,
  maxHeartRate: null,
  chartOptions: {},
  athleteNotes: { rpe: null, fatigue: null, position: null, notes: "" },
  exportOptions: { includeIndividualLaps: false }
};

describe("lap presentation", () => {
  it("renders lap metrics and selection controls in a table", () => {
    const markup = renderApp(state);

    expect(markup).toContain('<table class="lap-table">');
    expect(markup).toContain('<th scope="col">Duration</th>');
    expect(markup).toContain('<th scope="col">Distance</th>');
    expect(markup).toContain('<th scope="col">NP</th>');
    expect(markup).toContain('<th scope="col">Power</th>');
    expect(markup).toContain('<th scope="col">HR</th>');
    expect(markup).toContain('<th scope="row">Lap 1</th>');
    expect(markup).toContain('data-action="select-lap" data-index="1"');
    expect(markup).not.toContain('<div class="laps">');
  });
});

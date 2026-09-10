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

describe("interval analysis presentation", () => {
  it("renders interval summary, exposure, compact sets, recoveries, and details before zones", () => {
    const markup = renderApp({
      ...state,
      result: { ...state.result, zones: [{ id: "z1", label: "Z1", minimum: 0, maximum: .5, durationSeconds: 60, percentage: .5 }] },
      intervalSessionSummary: {
        setCount: 2,
        protocols: [
          { repetitions: 4, workDurationSeconds: 301, recoveryDurationSeconds: 240, recoveryDurationConsistent: false },
          { repetitions: 9, workDurationSeconds: 30, recoveryDurationSeconds: 15, recoveryDurationConsistent: true }
        ],
        totalSetDurationSeconds: 2446,
        totalHardWorkDurationSeconds: 1476,
        averageWorkPowerWatts: 487,
        timeAtOrAbove90Seconds: 1367,
        timeAtOrAbove95Seconds: 577,
        maximumHeartRateBpm: 186
      },
      intervalSets: [
        {
          number: 1, partial: false, repetitions: 4, includedRepetitions: 4,
          pattern: { workDurationSeconds: 301, recoveryDurationSeconds: 240, recoveryDurationConsistent: false },
          durationSeconds: 1400, hardWorkDurationSeconds: 1200,
          power: { workAverageWatts: 480, recoveryAverageWatts: 73, fadePercent: .005, minimumRepAverageWatts: 470, maximumRepAverageWatts: 490, firstHalfAverageWatts: 482, secondHalfAverageWatts: 480, wholeSetAverageWatts: 390 },
          heartRate: { averageBpm: 155, maximumBpm: 186, startBpm: 130, endBpm: 180, timeAtOrAbove90Seconds: 1031, timeAtOrAbove95Seconds: 426, timeToFirst90Seconds: 85 },
          cadence: { workAverageRpm: 102, recoveryAverageRpm: 41 }
        },
        {
          number: 2, partial: false, repetitions: 9, includedRepetitions: 9,
          pattern: { workDurationSeconds: 30, recoveryDurationSeconds: 15, recoveryDurationConsistent: true },
          durationSeconds: 1046, hardWorkDurationSeconds: 276,
          power: { workAverageWatts: 518, recoveryAverageWatts: 220, fadePercent: -.004, minimumRepAverageWatts: 500, maximumRepAverageWatts: 530, firstHalfAverageWatts: 516, secondHalfAverageWatts: 518, wholeSetAverageWatts: 410 },
          heartRate: { averageBpm: 176, maximumBpm: 184, startBpm: 165, endBpm: 183, timeAtOrAbove90Seconds: 336, timeAtOrAbove95Seconds: 151, timeToFirst90Seconds: 30 },
          cadence: { workAverageRpm: 104, recoveryAverageRpm: 87 }
        }
      ],
      betweenSetRecoveries: [{ beforeSetNumber: 2, partial: false, elapsedDurationSeconds: 203, averageActivePowerWatts: 35, lowestHeartRateBpm: 98, heartRateAtNextSetStartBpm: 125 }]
    });

    expect(markup).toContain("Interval analysis");
    expect(markup).toContain("4 x 05:00 + 9 x 30/15");
    expect(markup).toContain("Time >=90% HRmax");
    expect(markup).toContain("Time >=95% HRmax");
    expect(markup).toContain("HR exposure within interval sets");
    expect(markup).toContain('aria-valuetext="55.9%"');
    expect(markup).toContain("Set 1 · 4 x 05:00");
    expect(markup).toContain("Set 2 · 9 x 30/15");
    expect(markup).toContain("Recovery 0:03:23");
    expect(markup).toContain("Time to 90% HRmax");
    expect(markup.indexOf("Interval analysis")).toBeLessThan(markup.indexOf("Power zones"));
  });
});

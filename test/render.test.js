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
  it("shows selected-range HRmax time without a detected interval protocol", () => {
    const markup = renderApp({
      ...state,
      maxHeartRate: 187,
      result: { ...state.result, heartRate: { timeAtOrAbove90Seconds: 64, timeAtOrAbove95Seconds: 12 } }
    });
    expect(markup).toContain('<dt title="Total valid recorded heart-rate time during the selected active range at or above 90 percent of configured Max HR. Unavailable until Max HR is set.">Time >=90% HRmax</dt>');
    expect(markup).toContain("0:01:04");
    expect(markup).toContain("0:00:12");
    expect(markup).not.toContain("Interval analysis");

    const unavailable = renderApp(state);
    expect(unavailable).toContain('>Time >=90% HRmax</dt><dd title="Total valid recorded heart-rate time during the selected active range at or above 90 percent of configured Max HR. Unavailable until Max HR is set.">Unavailable');
    expect(unavailable).toContain('>Time >=95% HRmax</dt><dd title="Total valid recorded heart-rate time during the selected active range at or above 95 percent of configured Max HR. Unavailable until Max HR is set.">Unavailable');
  });

  it("renders lap metrics and selection controls in a table", () => {
    const markup = renderApp(state);

    expect(markup).toContain('<table class="lap-table">');
    expect(markup).toContain('<th scope="col" title="Active duration of the lap.">Duration</th>');
    expect(markup).toContain('<th scope="col" title="Distance recorded during the lap.">Distance</th>');
    expect(markup).toContain('<th scope="col" title="Normalized Power for the lap.">NP</th>');
    expect(markup).toContain('<th scope="col" title="Average cycling power for the lap.">Power</th>');
    expect(markup).toContain('<th scope="col" title="Average heart rate for the lap.">HR</th>');
    expect(markup).toContain('<th scope="row" title="Recorded activity lap: Lap 1.">Lap 1</th>');
    expect(markup).toContain('data-action="select-lap" data-index="1"');
    expect(markup).not.toContain('<div class="laps">');
  });

  it("adds explanatory titles from profile metrics through zone settings", () => {
    const markup = renderApp({
      ...state,
      ftp: 300,
      maxHeartRate: 190,
      result: {
        ...state.result,
        power: { normalizedPowerWatts: 300 },
        zones: [{ id: "z5", label: "Z5 - Maximum", minimum: 1.05, maximum: null, durationSeconds: 60, percentage: .5 }],
        heartRateZones: [{ id: "z5", label: "Z5", minimum: .9, maximum: null, durationSeconds: 60, percentage: .5 }]
      },
      settings: {
        zones: [{ id: "z5", label: "Z5 - Maximum", minimum: 1.05 }],
        heartRateZones: [{ id: "z5", label: "Z5", minimum: .9 }]
      }
    });

    expect(markup).toContain('name="ftp" type="number" min="1" inputmode="numeric" value="300" aria-label="FTP in watts" title="Functional Threshold Power.');
    expect(markup).toContain('name="max-heart-rate" type="number" min="1" inputmode="numeric" value="190" aria-label="Maximum heart rate" title="Maximum heart rate used for heart-rate zones and HRmax thresholds."');
    expect(markup).toContain('<dt title="Estimated physiological cost of variable power, calculated from rolling 30-second power values.">Normalized Power</dt>');
    expect(markup).toContain('title="Power zone Z5 - Maximum. 315 W+ · 105% FTP+."');
    expect(markup).toContain('title="Lower bound for Z5 - Maximum, as a percentage of FTP."><span title="Power zone Z5 - Maximum.">Z5 - Maximum</span>');
    expect(markup).toContain('title="Lower bound for Z5, as a percentage of maximum heart rate."><span title="Heart-rate zone Z5.">Z5</span>');
  });
});

describe("interval analysis presentation", () => {
  it("shows grouped over/under sets with phase-specific labels and explanations", () => {
    const pattern = { kind: "overUnder", setDurationSeconds: 719, workDurationSeconds: 119, recoveryDurationSeconds: 119, repetitions: 3 };
    const intervalSets = [1, 2, 3].map((number) => ({
      number, partial: false, repetitions: 3, includedRepetitions: 3, pattern,
      durationSeconds: 719, hardWorkDurationSeconds: 357,
      power: { workAverageWatts: 428, recoveryAverageWatts: 367, minimumRepAverageWatts: 422, maximumRepAverageWatts: 432, firstHalfAverageWatts: 429, secondHalfAverageWatts: 427, fadePercent: .005, wholeSetAverageWatts: 398 },
      heartRate: { averageBpm: 166, maximumBpm: 177, startBpm: 155, endBpm: 176, timeAtOrAbove90Seconds: null, timeAtOrAbove95Seconds: null, timeToFirst90Seconds: null },
      cadence: { workAverageRpm: 92, recoveryAverageRpm: 90 }
    }));
    const markup = renderApp({
      ...state,
      intervalSets,
      intervalSessionSummary: {
        setCount: 3, protocols: intervalSets.map((set) => ({ repetitions: set.repetitions, ...set.pattern })),
        totalSetDurationSeconds: 2157, totalHardWorkDurationSeconds: 1071, averageWorkPowerWatts: 428,
        timeAtOrAbove90Seconds: null, timeAtOrAbove95Seconds: null, maximumHeartRateBpm: 177
      },
      betweenSetRecoveries: []
    });

    expect(markup).toContain("3 x 12:00 over/under (3 x 02:00 under / 02:00 over)");
    expect(markup).toContain("Set 1 · 12:00 over/under (3 x 02:00 under / 02:00 over)");
    expect(markup).toContain('<dt title="Average recorded power during the higher-power phases identified from the lap pattern in this over/under set.">Over power</dt>');
    expect(markup).toContain('<dt title="Average recorded power during the lower-power phases identified from the lap pattern in this over/under set.">Under power</dt>');
    expect(markup).toContain('<dt title="Combined active duration of the higher-power phases of detected over/under sets in the selection.">Time over</dt>');
    expect(markup).toContain('<dt title="Active duration of the higher-power phases of this detected over/under set within the selection.">Time over</dt>');
    expect(markup).toContain('<dt title="Valid recorded heart-rate time within detected interval sets at or above 90 percent of configured Max HR.">Time >=90% HRmax</dt><dd title="Valid recorded heart-rate time within detected interval sets at or above 90 percent of configured Max HR.">Unavailable</dd>');
  });

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

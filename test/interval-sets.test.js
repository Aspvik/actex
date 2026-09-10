import { describe, expect, it } from "vitest";
import { analyzeIntervalSets } from "../src/analysis/interval-sets.js";
import { buildMarkdown } from "../src/output/markdown.js";

const at = (seconds) => new Date(Date.UTC(2026, 8, 9, 0, 0, seconds));
const selection = (start, end) => ({ type: "range", startTimestamp: at(start), endTimestamp: at(end) });

const buildActivity = (laps, timerSegments, valueAt = () => ({ powerWatts: 300, heartRateBpm: 150, cadenceRpm: 90 })) => {
  const end = laps.at(-1).end;
  return {
    metadata: { startTime: at(0), endTime: at(end) },
    laps: laps.map((lap, index) => ({ index, startTime: at(lap.start), endTime: at(lap.end), lapTrigger: lap.lapTrigger ?? "manual", workoutStepIndex: lap.workoutStepIndex ?? null })),
    records: Array.from({ length: end }, (_, second) => ({ timestamp: at(second), ...valueAt(second) })),
    diagnostics: { decodeWarnings: [] },
    timerEvents: [],
    sessions: []
  };
};

const vo2Laps = [
  { start: 0, end: 30, workoutStepIndex: 4 }, { start: 30, end: 45, workoutStepIndex: 5 },
  { start: 45, end: 74, workoutStepIndex: 4 }, { start: 74, end: 88, workoutStepIndex: 5 },
  { start: 88, end: 118, workoutStepIndex: 4 }, { start: 118, end: 133, workoutStepIndex: 5 },
  { start: 133, end: 193 },
  { start: 193, end: 233, workoutStepIndex: 8 }, { start: 233, end: 253, workoutStepIndex: 9 },
  { start: 253, end: 293, workoutStepIndex: 8 }, { start: 293, end: 313, workoutStepIndex: 9 }
];

const vo2Values = (second) => {
  if (second < 30) return { powerWatts: 500, heartRateBpm: 168, cadenceRpm: 98 };
  if (second < 45) return { powerWatts: 220, heartRateBpm: 160, cadenceRpm: 103 };
  if (second < 74) return { powerWatts: 510, heartRateBpm: 169, cadenceRpm: 99 };
  if (second < 88) return { powerWatts: 220, heartRateBpm: 160, cadenceRpm: 103 };
  if (second < 118) return { powerWatts: 520, heartRateBpm: 170, cadenceRpm: 100 };
  if (second < 133) return { powerWatts: 220, heartRateBpm: 160, cadenceRpm: 103 };
  if (second < 193) return { powerWatts: 180, heartRateBpm: second < 173 ? 130 : 145, cadenceRpm: 85 };
  if (second < 233) return { powerWatts: 540, heartRateBpm: 171, cadenceRpm: 101 };
  if (second < 253) return { powerWatts: 220, heartRateBpm: 162, cadenceRpm: 103 };
  if (second < 293) return { powerWatts: 545, heartRateBpm: 174, cadenceRpm: 102 };
  return { powerWatts: 220, heartRateBpm: 163, cadenceRpm: 103 };
};

describe("interval set analysis", () => {
  it("groups jittered executed workout steps, calculates exact HR thresholds, and reports paused recovery", () => {
    const activity = buildActivity(vo2Laps, [], vo2Values);
    activity.workoutSteps = [
      { index: 4, durationSeconds: 30 }, { index: 5, durationSeconds: 15 },
      { index: 8, durationSeconds: 40 }, { index: 9, durationSeconds: 20 }
    ];
    const timerSegments = [
      { startTimestamp: at(0), endTimestamp: at(143), timerRunning: true },
      { startTimestamp: at(143), endTimestamp: at(173), timerRunning: false },
      { startTimestamp: at(173), endTimestamp: at(313), timerRunning: true }
    ];
    const analysis = analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 313), maxHeartRate: 187 });

    expect(analysis.intervalSets).toHaveLength(2);
    expect(analysis.intervalSets[0]).toMatchObject({
      repetitions: 3,
      includedRepetitions: 3,
      executionMetadataSource: "workoutStepIndex",
      workoutStepIndexes: [4, 4, 4, 5, 5, 5],
      pattern: { workDurationSeconds: 29.666666666666668, recoveryDurationSeconds: 14.666666666666666 },
      power: { minimumRepAverageWatts: 500, maximumRepAverageWatts: 520 },
      heartRate: { timeAtOrAbove90Seconds: 59, timeToFirst90Seconds: 45 }
    });
    expect(analysis.intervalSets[0].heartRate.timeAtOrAbove95Seconds).toBe(0);
    expect(analysis.intervalSets[0].power.fadePercent).toBeLessThan(0);
    expect(analysis.betweenSetRecoveries).toEqual([expect.objectContaining({
      beforeSetNumber: 2,
      elapsedDurationSeconds: 60,
      activeDurationSeconds: 30,
      pausedDurationSeconds: 30,
      averageActivePowerWatts: 180,
      lowestHeartRateBpm: 130
    })]);
    expect(analysis.intervalSessionSummary).toMatchObject({
      setCount: 2,
      totalSetDurationSeconds: 253,
      totalHardWorkDurationSeconds: 169,
      timeAtOrAbove90Seconds: 139,
      timeAtOrAbove95Seconds: 0,
      maximumHeartRateBpm: 174
    });
    expect(analysis.intervalSessionSummary.averageWorkPowerWatts).toBeCloseTo(525.4, 1);

    const markdown = buildMarkdown({
      schemaVersion: 2,
      activity: { sport: "cycling", startTimestamp: at(0).toISOString(), selectionType: "activity" },
      selection: { startTimestamp: at(0).toISOString(), endTimestamp: at(313).toISOString() },
      summary: { activeDurationSeconds: 283, elapsedDurationSeconds: 313 },
      power: {}, heartRate: { configuredMaximumBpm: 187, threshold90Bpm: 168.3, threshold95Bpm: 177.65 }, cadence: {}, elevation: {},
      powerZones: [], heartRateZones: [], intervalSets: analysis.intervalSets, intervalSessionSummary: analysis.intervalSessionSummary, betweenSetRecoveries: analysis.betweenSetRecoveries,
      athleteNotes: null, dataQuality: { recordCount: 313, powerCoverage: {}, heartRateCoverage: {}, cadenceCoverage: {} }, warnings: []
    });
    expect(markdown).toContain("## Interval Session Summary");
    expect(markdown).toContain("Sets: 2");
    expect(markdown).toContain("Protocol: 3 x 30/15 + 2 x 40/20");
    expect(markdown).toContain("Total Interval Set Duration: 0:04:13");
    expect(markdown).toContain("Total Hard Work: 0:02:49");
    expect(markdown).toContain("### Set 1 - 3 x 30/15");
    expect(markdown).toMatch(/### Set 1[\s\S]*Recovery Average: 103 rpm\n\n### Set 2/);
    expect(markdown).toContain("Time >= 90% HRmax: 0:00:59");
    expect(markdown).toContain("Elapsed Recovery: 0:01:00");
    expect(markdown).toContain("Active Recovery: 0:00:30");
    expect(markdown).toContain("Paused: 0:00:30");
    expect(markdown).not.toContain("## Laps");
  });

  it("retains selected partial sets and clips their repetition summaries", () => {
    const activity = buildActivity(vo2Laps, [], vo2Values);
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(313), timerRunning: true }];
    const analysis = analyzeIntervalSets({ activity, timerSegments, selection: selection(45, 120), maxHeartRate: 187 });

    expect(analysis.intervalSets).toHaveLength(1);
    expect(analysis.intervalSets[0]).toMatchObject({ partial: true, repetitions: 3, includedRepetitions: 2, durationSeconds: 75, hardWorkDurationSeconds: 59 });
    expect(analysis.betweenSetRecoveries).toEqual([]);
  });

  it("recognizes two five-minute work repetitions and rejects non-interval laps", () => {
    const intervals = [
      { start: 0, end: 300 }, { start: 300, end: 540 }, { start: 540, end: 840 }, { start: 840, end: 1080 }
    ];
    const activity = buildActivity(intervals, [], (second) => ({ powerWatts: second % 540 < 300 ? 420 : 180, heartRateBpm: 160, cadenceRpm: 90 }));
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(1080), timerRunning: true }];
    expect(analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 1080) }).intervalSets).toMatchObject([
      { repetitions: 2, pattern: { workDurationSeconds: 300, recoveryDurationSeconds: 240 } }
    ]);

    const nonIntervals = buildActivity([
      { start: 0, end: 30 }, { start: 30, end: 60 }, { start: 60, end: 90 }, { start: 90, end: 120 }
    ], [], () => ({ powerWatts: 250, heartRateBpm: 150, cadenceRpm: 90 }));
    expect(analyzeIntervalSets({ activity: nonIntervals, timerSegments: [{ startTimestamp: at(0), endTimestamp: at(120), timerRunning: true }], selection: selection(0, 120) }).intervalSets).toEqual([]);
  });
});

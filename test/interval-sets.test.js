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

  it("recognizes complete low-first over/under blocks despite individual pairs below the normal contrast threshold", () => {
    const laps = [];
    const lapPowers = [];
    const addLap = (duration, power) => {
      const start = laps.at(-1)?.end ?? 0;
      laps.push({ start, end: start + duration });
      lapPowers.push(power);
    };
    addLap(60, 180);
    const blocks = [
      [367, 430, 365, 427, 370, 430],
      [364, 427, 368, 428, 370, 429],
      [365, 422, 370, 424, 370, 432]
    ];
    blocks.forEach((powers, index) => {
      powers.forEach((power) => addLap(120, power));
      if (index < 2) addLap(index === 0 ? 240 : 330, 150);
    });
    const end = laps.at(-1).end;
    const activity = buildActivity(laps, [], (second) => ({
      powerWatts: lapPowers[laps.findIndex((lap) => second < lap.end)],
      heartRateBpm: 170,
      cadenceRpm: 90
    }));
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(end), timerRunning: true }];
    const analysis = analyzeIntervalSets({ activity, timerSegments, selection: selection(0, end), maxHeartRate: 190 });

    expect(analysis.intervalSets).toHaveLength(3);
    expect(analysis.intervalSets.map((set) => ({ kind: set.pattern.kind, repetitions: set.repetitions, duration: set.durationSeconds, hardWork: set.hardWorkDurationSeconds }))).toEqual([
      { kind: "overUnder", repetitions: 3, duration: 720, hardWork: 360 },
      { kind: "overUnder", repetitions: 3, duration: 720, hardWork: 360 },
      { kind: "overUnder", repetitions: 3, duration: 720, hardWork: 360 }
    ]);
    expect(analysis.intervalSets[2].power.workAverageWatts).toBeCloseTo(426, 0);
    expect(analysis.intervalSets[2].power.recoveryAverageWatts).toBeCloseTo(368, 0);
    expect(analysis.betweenSetRecoveries.map((recovery) => recovery.elapsedDurationSeconds)).toEqual([240, 330]);
    expect(analysis.intervalSessionSummary).toMatchObject({ setCount: 3, totalSetDurationSeconds: 2160, totalHardWorkDurationSeconds: 1080 });

    const partial = analyzeIntervalSets({ activity, timerSegments, selection: selection(60, 180) });
    expect(partial.intervalSets).toMatchObject([{ partial: true, includedRepetitions: 1, durationSeconds: 120, hardWorkDurationSeconds: 0 }]);

    const markdown = buildMarkdown({
      schemaVersion: 2,
      activity: { sport: "cycling", startTimestamp: at(0).toISOString(), selectionType: "activity" },
      selection: { startTimestamp: at(0).toISOString(), endTimestamp: at(end).toISOString() },
      summary: { activeDurationSeconds: end, elapsedDurationSeconds: end },
      power: {}, heartRate: {}, cadence: {}, elevation: {}, powerZones: [], heartRateZones: [],
      intervalSets: analysis.intervalSets, intervalSessionSummary: analysis.intervalSessionSummary, betweenSetRecoveries: analysis.betweenSetRecoveries,
      athleteNotes: null, dataQuality: { recordCount: end, powerCoverage: {}, heartRateCoverage: {}, cadenceCoverage: {} }, warnings: []
    });
    expect(markdown).toContain("Protocol: 3 x 12:00 over/under (3 x 02:00 under / 02:00 over)");
    expect(markdown).toContain("Total Time Over: 0:18:00");
    expect(markdown).toContain("### Set 3 - 12:00 over/under (3 x 02:00 under / 02:00 over)");
    expect(markdown).toContain("Over Power:");
    expect(markdown).toContain("Under Power:");
  });

  it("keeps a high-first work/recovery run distinct from over/under blocks", () => {
    const laps = Array.from({ length: 8 }, (_, index) => ({ start: index * 120, end: (index + 1) * 120 }));
    const activity = buildActivity(laps, [], (second) => ({ powerWatts: Math.floor(second / 120) % 2 ? 370 : 430, heartRateBpm: 160, cadenceRpm: 90 }));
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(960), timerRunning: true }];
    const analysis = analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 960) });
    expect(analysis.intervalSets).toMatchObject([{ repetitions: 4, pattern: { kind: "workRecovery" } }]);
  });

  it("selects one maximal non-overlapping long-interval set despite variable recoveries", () => {
    const intervals = [
      { start: 0, end: 300 }, { start: 300, end: 484 },
      { start: 484, end: 784 }, { start: 784, end: 1047 },
      { start: 1047, end: 1347 }, { start: 1347, end: 1664 },
      { start: 1664, end: 1964 }, { start: 1964, end: 2264 }
    ];
    const workWindows = [[0, 300], [484, 784], [1047, 1347], [1664, 1964]];
    const isWork = (second) => workWindows.some(([start, end]) => second >= start && second < end);
    const activity = buildActivity(intervals, [], (second) => isWork(second)
      ? { powerWatts: 420, heartRateBpm: 185, cadenceRpm: 92 }
      : { powerWatts: 180, heartRateBpm: 145, cadenceRpm: 82 });
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(2264), timerRunning: true }];
    const analysis = analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 2264), maxHeartRate: 200 });

    expect(analysis.intervalSets).toMatchObject([{
      repetitions: 4,
      pattern: { workDurationSeconds: 300, recoveryDurationSeconds: 254.66666666666666, recoveryDurationConsistent: false },
      durationSeconds: 1964,
      hardWorkDurationSeconds: 1200
    }]);
    expect(analysis.intervalSets).toHaveLength(1);
    expect(analysis.intervalSets[0].hardWorkDurationSeconds).toBeLessThanOrEqual(analysis.intervalSets[0].durationSeconds);
    expect(analysis.intervalSessionSummary).toMatchObject({
      setCount: 1,
      totalSetDurationSeconds: 1964,
      totalHardWorkDurationSeconds: 1200,
      timeAtOrAbove90Seconds: 1200
    });
    const markdown = buildMarkdown({
      schemaVersion: 2,
      activity: { sport: "cycling", startTimestamp: at(0).toISOString(), selectionType: "activity" },
      selection: { startTimestamp: at(0).toISOString(), endTimestamp: at(2264).toISOString() },
      summary: { activeDurationSeconds: 2264, elapsedDurationSeconds: 2264 },
      power: {}, heartRate: {}, cadence: {}, elevation: {}, powerZones: [], heartRateZones: [],
      intervalSets: analysis.intervalSets, intervalSessionSummary: analysis.intervalSessionSummary, betweenSetRecoveries: [], athleteNotes: null,
      dataQuality: { recordCount: 2264, powerCoverage: {}, heartRateCoverage: {}, cadenceCoverage: {} }, warnings: []
    });
    expect(markdown).toContain("Protocol: 4 x 05:00");
    expect(markdown).not.toContain("Protocol: 4 x 05:00/04:15");
  });

  it("includes a trailing long-interval recovery only when it repeats an executed recovery step", () => {
    const intervals = [
      { start: 0, end: 300, workoutStepIndex: 4 }, { start: 300, end: 484, workoutStepIndex: 5 },
      { start: 484, end: 784, workoutStepIndex: 4 }, { start: 784, end: 1047, workoutStepIndex: 5 },
      { start: 1047, end: 1347, workoutStepIndex: 4 }, { start: 1347, end: 1664, workoutStepIndex: 5 },
      { start: 1664, end: 1964, workoutStepIndex: 4 }, { start: 1964, end: 2264, workoutStepIndex: 5 }
    ];
    const workWindows = [[0, 300], [484, 784], [1047, 1347], [1664, 1964]];
    const isWork = (second) => workWindows.some(([start, end]) => second >= start && second < end);
    const activity = buildActivity(intervals, [], (second) => isWork(second)
      ? { powerWatts: 420, heartRateBpm: 185, cadenceRpm: 92 }
      : { powerWatts: 180, heartRateBpm: 145, cadenceRpm: 82 });
    activity.workoutSteps = [{ index: 4, durationSeconds: 300 }, { index: 5, durationSeconds: 180 }];
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(2264), timerRunning: true }];

    expect(analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 2264) }).intervalSets).toMatchObject([
      { repetitions: 4, durationSeconds: 2264 }
    ]);
  });

  it("keeps recovery timing strict for microintervals", () => {
    const intervals = [
      { start: 0, end: 30 }, { start: 30, end: 45 },
      { start: 45, end: 75 }, { start: 75, end: 100 },
      { start: 100, end: 130 }
    ];
    const activity = buildActivity(intervals, [], (second) => second < 30 || (second >= 45 && second < 75) || second >= 100
      ? { powerWatts: 450, heartRateBpm: 170, cadenceRpm: 96 }
      : { powerWatts: 180, heartRateBpm: 150, cadenceRpm: 84 });
    const timerSegments = [{ startTimestamp: at(0), endTimestamp: at(130), timerRunning: true }];

    expect(analyzeIntervalSets({ activity, timerSegments, selection: selection(0, 130) }).intervalSets).toMatchObject([
      { repetitions: 2, pattern: { workDurationSeconds: 30, recoveryDurationSeconds: 15 } }
    ]);
  });
});

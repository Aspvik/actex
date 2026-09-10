import { activeTimerSeconds } from "../activity/build-timer-state.js";
import { buildSampleIntervals, intervalsForField } from "../activity/sample-durations.js";
import { maximumField, weightedField } from "../metrics/common.js";
import { secondsBetween } from "../utils/time.js";

const SHORT_DURATION_TOLERANCE_SECONDS = 2;
const LONG_DURATION_TOLERANCE_RATIO = .05;
const MINIMUM_POWER_DIFFERENCE_WATTS = 25;
const MINIMUM_POWER_DIFFERENCE_RATIO = .15;
const MINIMUM_BETWEEN_SET_RECOVERY_SECONDS = 60;

const selectionFor = (startTimestamp, endTimestamp) => ({ type: "range", startTimestamp, endTimestamp });
const durationTolerance = (seconds) => seconds <= 60 ? SHORT_DURATION_TOLERANCE_SECONDS : seconds * LONG_DURATION_TOLERANCE_RATIO;
const durationMatches = (left, right) => Math.abs(left - right) <= Math.max(durationTolerance(left), durationTolerance(right));
const overlaps = (left, right) => left.startTimestamp < right.endTimestamp && right.startTimestamp < left.endTimestamp;
const clip = (window, selection) => {
  const startTimestamp = new Date(Math.max(window.startTimestamp, selection.startTimestamp));
  const endTimestamp = new Date(Math.min(window.endTimestamp, selection.endTimestamp));
  return endTimestamp > startTimestamp ? { startTimestamp, endTimestamp } : null;
};
const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
const first = (values) => values.length ? values[0] : null;
const last = (values) => values.length ? values.at(-1) : null;

const activeIntervalsFor = (activity, timerSegments, window) => buildSampleIntervals(activity.records, selectionFor(window.startTimestamp, window.endTimestamp), timerSegments);
const activeDurationFor = (timerSegments, window) => activeTimerSeconds(timerSegments, selectionFor(window.startTimestamp, window.endTimestamp));

const intervalSamplesFor = (intervals, field) => intervalsForField(intervals, field)
  .toSorted((left, right) => left.startTimestamp - right.startTimestamp);

const heartRateSummary = (intervals, startTimestamp, maxHeartRate) => {
  const heartRateIntervals = intervalSamplesFor(intervals, "heartRateBpm");
  const threshold90Bpm = maxHeartRate == null ? null : maxHeartRate * .9;
  const threshold95Bpm = maxHeartRate == null ? null : maxHeartRate * .95;
  // FIT heart-rate samples are whole BPM. Round the mathematical threshold up,
  // never down, while retaining the precise threshold for export.
  const sampleThreshold = (threshold) => threshold == null ? null : Math.ceil(threshold);
  const threshold90SampleBpm = sampleThreshold(threshold90Bpm);
  const threshold95SampleBpm = sampleThreshold(threshold95Bpm);
  const timeAtOrAbove = (threshold) => threshold == null ? null : heartRateIntervals
    .filter((interval) => interval.record.heartRateBpm >= threshold)
    .reduce((total, interval) => total + interval.validSeconds, 0);
  const firstAtOrAbove90 = threshold90SampleBpm == null ? null : heartRateIntervals.find((interval) => interval.record.heartRateBpm >= threshold90SampleBpm);
  return {
    startBpm: first(heartRateIntervals)?.record.heartRateBpm ?? null,
    averageBpm: weightedField(intervals, "heartRateBpm"),
    maximumBpm: maximumField(intervals, "heartRateBpm"),
    endBpm: last(heartRateIntervals)?.record.heartRateBpm ?? null,
    timeAtOrAbove90Seconds: timeAtOrAbove(threshold90SampleBpm),
    timeAtOrAbove95Seconds: timeAtOrAbove(threshold95SampleBpm),
    timeToFirst90Seconds: firstAtOrAbove90 ? secondsBetween(startTimestamp, firstAtOrAbove90.startTimestamp) : null
  };
};

const isWorkRecoveryPair = (work, recovery) => work.averagePowerWatts != null
  && recovery.averagePowerWatts != null
  && work.averagePowerWatts - recovery.averagePowerWatts >= MINIMUM_POWER_DIFFERENCE_WATTS
  && work.averagePowerWatts >= recovery.averagePowerWatts * (1 + MINIMUM_POWER_DIFFERENCE_RATIO);

const buildLapUnits = ({ activity, timerSegments }) => {
  const workoutStepsByIndex = new Map((activity.workoutSteps ?? []).map((step) => [step.index, step]));
  return activity.laps
  .toSorted((left, right) => left.startTime - right.startTime)
  .map((lap) => {
    const window = { startTimestamp: lap.startTime, endTimestamp: lap.endTime };
    const intervals = activeIntervalsFor(activity, timerSegments, window);
    const workoutStep = lap.workoutStepIndex == null ? null : workoutStepsByIndex.get(lap.workoutStepIndex) ?? null;
    return {
      ...window,
      lapIndex: lap.index,
      lapTrigger: lap.lapTrigger,
      workoutStepIndex: lap.workoutStepIndex,
      executionMetadataSource: lap.workoutStepIndex != null ? "workoutStepIndex" : lap.lapTrigger ? "lapTrigger" : "lap",
      durationSeconds: secondsBetween(lap.startTime, lap.endTime),
      patternDurationSeconds: workoutStep?.durationSeconds ?? secondsBetween(lap.startTime, lap.endTime),
      activeDurationSeconds: activeDurationFor(timerSegments, window),
      averagePowerWatts: weightedField(intervals, "powerWatts")
    };
  })
  .filter((lap) => lap.durationSeconds > 0);
};

const detectSetAt = (units, startIndex) => {
  const firstWork = units[startIndex];
  const firstRecovery = units[startIndex + 1];
  if (!firstWork || !firstRecovery || !isWorkRecoveryPair(firstWork, firstRecovery)) return null;

  const works = [firstWork];
  const recoveries = [];
  let cursor = startIndex;
  while (cursor + 2 < units.length) {
    const work = units[cursor];
    const recovery = units[cursor + 1];
    const nextWork = units[cursor + 2];
    if (!isWorkRecoveryPair(work, recovery)
      || !durationMatches(firstRecovery.patternDurationSeconds, recovery.patternDurationSeconds)
      || !durationMatches(firstWork.patternDurationSeconds, nextWork.patternDurationSeconds)) break;
    recoveries.push(recovery);
    works.push(nextWork);
    cursor += 2;
  }

  if (works.length < 2) return null;
  const trailingRecovery = units[cursor + 1];
  if (trailingRecovery
    && isWorkRecoveryPair(works.at(-1), trailingRecovery)
    && durationMatches(firstRecovery.patternDurationSeconds, trailingRecovery.patternDurationSeconds)) recoveries.push(trailingRecovery);

  const endUnit = recoveries.at(-1) ?? works.at(-1);
  return {
    startIndex,
    endIndex: units.indexOf(endUnit),
    startTimestamp: firstWork.startTimestamp,
    endTimestamp: endUnit.endTimestamp,
    // Keep execution timing in the canonical model. Planned step durations are
    // used only to recognize a pattern, never to replace measured timing.
    workDurationSeconds: average(works.map((work) => work.durationSeconds)),
    recoveryDurationSeconds: average(recoveries.map((recovery) => recovery.durationSeconds)),
    workUnits: works,
    recoveryUnits: recoveries,
    workoutStepIndexes: works.concat(recoveries)
      .map((unit) => unit.workoutStepIndex)
      .filter((index) => index != null)
  };
};

const detectSets = (units) => {
  const sets = [];
  let index = 0;
  while (index < units.length) {
    const set = detectSetAt(units, index);
    if (!set) { index += 1; continue; }
    sets.push(set);
    index = Math.max(index + 1, set.endIndex + 1);
  }
  return sets;
};

const summarizeSet = ({ set, setNumber, activity, timerSegments, selection, maxHeartRate }) => {
  const setWindow = { startTimestamp: set.startTimestamp, endTimestamp: set.endTimestamp };
  if (!overlaps(setWindow, selection)) return null;
  const clippedSet = clip(setWindow, selection);
  const workWindows = set.workUnits.map((unit) => clip(unit, selection)).filter(Boolean);
  if (!workWindows.length) return null;
  const recoveryWindows = set.recoveryUnits.map((unit) => clip(unit, selection)).filter(Boolean);
  const workIntervalsByRep = workWindows.map((window) => activeIntervalsFor(activity, timerSegments, window));
  const recoveryIntervals = recoveryWindows.flatMap((window) => activeIntervalsFor(activity, timerSegments, window));
  const workIntervals = workIntervalsByRep.flat();
  const setIntervals = activeIntervalsFor(activity, timerSegments, clippedSet);
  const repPowers = workIntervalsByRep.map((intervals) => weightedField(intervals, "powerWatts")).filter((value) => value != null);
  const splitAt = Math.max(1, Math.floor(workIntervalsByRep.length / 2));
  const firstHalfIntervals = workIntervalsByRep.slice(0, splitAt).flat();
  const secondHalfIntervals = workIntervalsByRep.slice(splitAt).flat();
  const firstHalfAverageWatts = weightedField(firstHalfIntervals, "powerWatts");
  const secondHalfAverageWatts = weightedField(secondHalfIntervals, "powerWatts");
  const partial = clippedSet.startTimestamp > set.startTimestamp || clippedSet.endTimestamp < set.endTimestamp;
  return {
    number: setNumber,
    partial,
    repetitions: set.workUnits.length,
    includedRepetitions: workWindows.length,
    workoutStepIndexes: set.workoutStepIndexes,
    executionMetadataSource: set.workoutStepIndexes.length ? "workoutStepIndex" : set.workUnits[0].executionMetadataSource,
    pattern: { workDurationSeconds: set.workDurationSeconds, recoveryDurationSeconds: set.recoveryDurationSeconds },
    durationSeconds: secondsBetween(clippedSet.startTimestamp, clippedSet.endTimestamp),
    hardWorkDurationSeconds: workWindows.reduce((total, window) => total + activeDurationFor(timerSegments, window), 0),
    power: {
      workAverageWatts: weightedField(workIntervals, "powerWatts"),
      minimumRepAverageWatts: repPowers.length ? Math.min(...repPowers) : null,
      maximumRepAverageWatts: repPowers.length ? Math.max(...repPowers) : null,
      firstHalfAverageWatts,
      secondHalfAverageWatts,
      fadePercent: firstHalfAverageWatts && secondHalfAverageWatts != null ? (firstHalfAverageWatts - secondHalfAverageWatts) / firstHalfAverageWatts : null,
      workPowerDurationSeconds: intervalsForField(workIntervals, "powerWatts").reduce((total, interval) => total + interval.validSeconds, 0),
      recoveryAverageWatts: weightedField(recoveryIntervals, "powerWatts"),
      wholeSetAverageWatts: weightedField(setIntervals, "powerWatts")
    },
    heartRate: heartRateSummary(setIntervals, clippedSet.startTimestamp, maxHeartRate),
    cadence: {
      workAverageRpm: weightedField(workIntervals, "cadenceRpm"),
      recoveryAverageRpm: weightedField(recoveryIntervals, "cadenceRpm")
    }
  };
};

const recoveryHeartRate = (records, startTimestamp, endTimestamp) => records
  .filter((record) => record.timestamp >= startTimestamp && record.timestamp < endTimestamp && record.heartRateBpm != null)
  .map((record) => record.heartRateBpm);

const heartRateAtSetStart = (records, set) => records
  .find((record) => record.timestamp >= set.startTimestamp && record.timestamp < set.endTimestamp && record.heartRateBpm != null)
  ?.heartRateBpm ?? null;

const summarizeRecoveries = ({ detectedSets, exportedSets, activity, timerSegments, selection }) => {
  const includedSetNumbers = new Set(exportedSets.map((set) => set.number));
  return detectedSets.slice(1).flatMap((nextSet, index) => {
    const previousSet = detectedSets[index];
    const previousSetNumber = index + 1;
    const nextSetNumber = index + 2;
    if (!includedSetNumbers.has(previousSetNumber) || !includedSetNumbers.has(nextSetNumber)) return [];
    const window = { startTimestamp: previousSet.endTimestamp, endTimestamp: nextSet.startTimestamp };
    if (secondsBetween(window.startTimestamp, window.endTimestamp) < MINIMUM_BETWEEN_SET_RECOVERY_SECONDS || !overlaps(window, selection)) return [];
    const clippedWindow = clip(window, selection);
    const activeDurationSeconds = activeDurationFor(timerSegments, clippedWindow);
    const elapsedDurationSeconds = secondsBetween(clippedWindow.startTimestamp, clippedWindow.endTimestamp);
    const heartRates = recoveryHeartRate(activity.records, clippedWindow.startTimestamp, clippedWindow.endTimestamp);
    return [{
      beforeSetNumber: nextSetNumber,
      partial: clippedWindow.startTimestamp > window.startTimestamp || clippedWindow.endTimestamp < window.endTimestamp,
      elapsedDurationSeconds,
      activeDurationSeconds,
      pausedDurationSeconds: elapsedDurationSeconds - activeDurationSeconds,
      averageActivePowerWatts: weightedField(activeIntervalsFor(activity, timerSegments, clippedWindow), "powerWatts"),
      lowestHeartRateBpm: heartRates.length ? Math.min(...heartRates) : null,
      heartRateAtNextSetStartBpm: heartRateAtSetStart(activity.records, nextSet)
    }];
  });
};

const totalWhenAvailable = (sets, value) => {
  const values = sets.map(value);
  return values.length && values.every((item) => item != null) ? values.reduce((total, item) => total + item, 0) : null;
};

const summarizeIntervalSession = (intervalSets) => {
  if (!intervalSets.length) return null;
  const protocols = intervalSets.map((set) => ({ repetitions: set.repetitions, ...set.pattern }));
  const workPowerDurationSeconds = intervalSets.reduce((total, set) => total + set.power.workPowerDurationSeconds, 0);
  const maximumHeartRates = intervalSets.map((set) => set.heartRate.maximumBpm).filter((value) => value != null);
  return {
    setCount: intervalSets.length,
    partial: intervalSets.some((set) => set.partial),
    protocols,
    totalSetDurationSeconds: intervalSets.reduce((total, set) => total + set.durationSeconds, 0),
    totalHardWorkDurationSeconds: intervalSets.reduce((total, set) => total + set.hardWorkDurationSeconds, 0),
    averageWorkPowerWatts: workPowerDurationSeconds
      ? intervalSets.reduce((total, set) => total + set.power.workAverageWatts * set.power.workPowerDurationSeconds, 0) / workPowerDurationSeconds
      : null,
    timeAtOrAbove90Seconds: totalWhenAvailable(intervalSets, (set) => set.heartRate.timeAtOrAbove90Seconds),
    timeAtOrAbove95Seconds: totalWhenAvailable(intervalSets, (set) => set.heartRate.timeAtOrAbove95Seconds),
    maximumHeartRateBpm: maximumHeartRates.length ? Math.max(...maximumHeartRates) : null
  };
};

export const analyzeIntervalSets = ({ activity, timerSegments, selection, maxHeartRate = null }) => {
  const detectedSets = detectSets(buildLapUnits({ activity, timerSegments }));
  const intervalSets = detectedSets
    .map((set, index) => summarizeSet({ set, setNumber: index + 1, activity, timerSegments, selection, maxHeartRate }))
    .filter(Boolean);
  return {
    intervalSets,
    intervalSessionSummary: summarizeIntervalSession(intervalSets),
    betweenSetRecoveries: summarizeRecoveries({ detectedSets, exportedSets: intervalSets, activity, timerSegments, selection })
  };
};

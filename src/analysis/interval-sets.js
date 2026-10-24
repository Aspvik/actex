import { activeTimerSeconds } from "../activity/build-timer-state.js";
import { buildSampleIntervals, intervalsForField } from "../activity/sample-durations.js";
import { maximumField, weightedField } from "../metrics/common.js";
import { calculateHeartRateExposure } from "../metrics/heart-rate.js";
import { secondsBetween } from "../utils/time.js";

const SHORT_DURATION_TOLERANCE_SECONDS = 2;
const LONG_DURATION_TOLERANCE_RATIO = .05;
const MINIMUM_POWER_DIFFERENCE_WATTS = 25;
const MINIMUM_POWER_DIFFERENCE_RATIO = .15;
const MINIMUM_BETWEEN_SET_RECOVERY_SECONDS = 60;
const LONG_WORK_INTERVAL_SECONDS = 120;
const MINIMUM_OVER_UNDER_PHASE_SECONDS = 60;
const MINIMUM_OVER_UNDER_POWER_RATIO = 1.1;
const MINIMUM_UNDER_TO_OVER_POWER_RATIO = .75;
const MAXIMUM_PHASE_POWER_VARIATION_RATIO = .1;
const MAXIMUM_PHASE_GAP_SECONDS = 5;

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
const uniqueWindows = (windows) => windows
  .toSorted((left, right) => left.startTimestamp - right.startTimestamp)
  .reduce((merged, window) => {
    const previous = merged.at(-1);
    if (previous && window.startTimestamp <= previous.endTimestamp) {
      previous.endTimestamp = new Date(Math.max(previous.endTimestamp, window.endTimestamp));
    } else {
      merged.push({ ...window });
    }
    return merged;
  }, []);
const durationOf = (windows) => windows.reduce((total, window) => total + secondsBetween(window.startTimestamp, window.endTimestamp), 0);

const activeIntervalsFor = (activity, timerSegments, window) => buildSampleIntervals(activity.records, selectionFor(window.startTimestamp, window.endTimestamp), timerSegments);
const activeDurationFor = (timerSegments, window) => activeTimerSeconds(timerSegments, selectionFor(window.startTimestamp, window.endTimestamp));

const intervalSamplesFor = (intervals, field) => intervalsForField(intervals, field)
  .toSorted((left, right) => left.startTimestamp - right.startTimestamp);

const heartRateSummary = (intervals, startTimestamp, maxHeartRate) => {
  const heartRateIntervals = intervalSamplesFor(intervals, "heartRateBpm");
  const threshold90Bpm = maxHeartRate == null ? null : maxHeartRate * .9;
  // FIT heart-rate samples are whole BPM. Round the mathematical threshold up,
  // never down, while retaining the precise threshold for export.
  const sampleThreshold = (threshold) => threshold == null ? null : Math.ceil(threshold);
  const threshold90SampleBpm = sampleThreshold(threshold90Bpm);
  const firstAtOrAbove90 = threshold90SampleBpm == null ? null : heartRateIntervals.find((interval) => interval.record.heartRateBpm >= threshold90SampleBpm);
  return {
    startBpm: first(heartRateIntervals)?.record.heartRateBpm ?? null,
    averageBpm: weightedField(intervals, "heartRateBpm"),
    maximumBpm: maximumField(intervals, "heartRateBpm"),
    endBpm: last(heartRateIntervals)?.record.heartRateBpm ?? null,
    ...calculateHeartRateExposure(intervals, maxHeartRate),
    timeToFirst90Seconds: firstAtOrAbove90 ? secondsBetween(startTimestamp, firstAtOrAbove90.startTimestamp) : null
  };
};

const isWorkRecoveryPair = (work, recovery) => work.averagePowerWatts != null
  && recovery.averagePowerWatts != null
  && work.averagePowerWatts - recovery.averagePowerWatts >= MINIMUM_POWER_DIFFERENCE_WATTS
  && work.averagePowerWatts >= recovery.averagePowerWatts * (1 + MINIMUM_POWER_DIFFERENCE_RATIO);

const isOverUnderPair = (under, over) => under?.averagePowerWatts != null
  && over?.averagePowerWatts != null
  && over.averagePowerWatts - under.averagePowerWatts >= MINIMUM_POWER_DIFFERENCE_WATTS
  && over.averagePowerWatts >= under.averagePowerWatts * MINIMUM_OVER_UNDER_POWER_RATIO
  && under.averagePowerWatts >= over.averagePowerWatts * MINIMUM_UNDER_TO_OVER_POWER_RATIO;
const phasePowerMatches = (first, next) => Math.abs(first.averagePowerWatts - next.averagePowerWatts) <= first.averagePowerWatts * MAXIMUM_PHASE_POWER_VARIATION_RATIO;
const phasesAreAdjacent = (first, next) => {
  const gap = secondsBetween(first.endTimestamp, next.startTimestamp);
  return gap >= 0 && gap <= MAXIMUM_PHASE_GAP_SECONDS;
};

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

// A work repetition can be recognised from either adjacent recovery. Keeping
// this as a separate pass prevents a final work lap from being lost merely
// because it has no trailing recovery lap.
const buildWorkRepetitions = (units) => units.flatMap((work, unitIndex) => {
  const previousRecovery = units[unitIndex - 1];
  const followingRecovery = units[unitIndex + 1];
  const hasPreviousRecovery = previousRecovery && isWorkRecoveryPair(work, previousRecovery);
  const hasFollowingRecovery = followingRecovery && isWorkRecoveryPair(work, followingRecovery);
  return hasPreviousRecovery || hasFollowingRecovery ? [{ work, unitIndex }] : [];
});

const recoveryTimingMustMatch = (work) => work.patternDurationSeconds < LONG_WORK_INTERVAL_SECONDS;
const isExplicitRepeatedRecoveryStep = (trailingRecovery, recoveries) => trailingRecovery.workoutStepIndex != null
  && recoveries.some((recovery) => recovery.workoutStepIndex === trailingRecovery.workoutStepIndex);

const detectSetAt = (units, workRepetitions, startIndex) => {
  const firstRepetition = workRepetitions.find((repetition) => repetition.unitIndex === startIndex);
  const firstWork = firstRepetition?.work;
  const firstRecovery = units[startIndex + 1];
  if (!firstWork || !firstRecovery || !isWorkRecoveryPair(firstWork, firstRecovery)) return null;

  const works = [firstWork];
  const recoveries = [];
  let cursor = startIndex;
  while (cursor + 2 < units.length) {
    const work = units[cursor];
    const recovery = units[cursor + 1];
    const nextRepetition = workRepetitions.find((repetition) => repetition.unitIndex === cursor + 2);
    const nextWork = nextRepetition?.work;
    if (!isWorkRecoveryPair(work, recovery)
      || !nextWork
      || !isWorkRecoveryPair(nextWork, recovery)
      || !durationMatches(firstWork.patternDurationSeconds, nextWork.patternDurationSeconds)
      || (recoveryTimingMustMatch(firstWork) && !durationMatches(firstRecovery.patternDurationSeconds, recovery.patternDurationSeconds))) break;
    recoveries.push(recovery);
    works.push(nextWork);
    cursor += 2;
  }

  if (works.length < 2) return null;
  const trailingRecovery = units[cursor + 1];
  let includedTrailingRecovery = null;
  if (trailingRecovery
    && isWorkRecoveryPair(works.at(-1), trailingRecovery)
    && (recoveryTimingMustMatch(firstWork)
      ? durationMatches(firstRecovery.patternDurationSeconds, trailingRecovery.patternDurationSeconds)
      : isExplicitRepeatedRecoveryStep(trailingRecovery, recoveries))) {
    recoveries.push(trailingRecovery);
    includedTrailingRecovery = trailingRecovery;
  }

  const endUnit = includedTrailingRecovery ?? works.at(-1);
  const recoveryDurationConsistent = recoveries.every((recovery) => durationMatches(firstRecovery.patternDurationSeconds, recovery.patternDurationSeconds));
  return {
    startIndex,
    endIndex: units.indexOf(endUnit),
    startTimestamp: firstWork.startTimestamp,
    endTimestamp: endUnit.endTimestamp,
    // Keep execution timing in the canonical model. Planned step durations are
    // used only to recognize a pattern, never to replace measured timing.
    workDurationSeconds: average(works.map((work) => work.durationSeconds)),
    recoveryDurationSeconds: average(recoveries.map((recovery) => recovery.durationSeconds)),
    recoveryDurationConsistent,
    workUnits: works,
    recoveryUnits: recoveries,
    workoutStepIndexes: works.concat(recoveries)
      .map((unit) => unit.workoutStepIndex)
      .filter((index) => index != null)
  };
};

const detectOverUnderAt = (units, startIndex) => {
  const firstUnder = units[startIndex];
  const firstOver = units[startIndex + 1];
  if (!firstUnder || !firstOver
    || firstUnder.patternDurationSeconds < MINIMUM_OVER_UNDER_PHASE_SECONDS
    || !durationMatches(firstUnder.patternDurationSeconds, firstOver.patternDurationSeconds)
    || !phasesAreAdjacent(firstUnder, firstOver)
    || !isOverUnderPair(firstUnder, firstOver)) return null;

  // A conventional work/recovery run can contain the same low/high pairs
  // after its first work lap. Only start a block at its first low phase.
  const previous = units[startIndex - 1];
  if (previous && phasesAreAdjacent(previous, firstUnder)
    && durationMatches(previous.patternDurationSeconds, firstOver.patternDurationSeconds)
    && isOverUnderPair(firstUnder, previous)) return null;

  const unders = [];
  const overs = [];
  for (let cursor = startIndex; cursor + 1 < units.length; cursor += 2) {
    const under = units[cursor];
    const over = units[cursor + 1];
    if (!durationMatches(firstUnder.patternDurationSeconds, under.patternDurationSeconds)
      || !durationMatches(firstOver.patternDurationSeconds, over.patternDurationSeconds)
      || !phasesAreAdjacent(under, over)
      || (overs.length && !phasesAreAdjacent(overs.at(-1), under))
      || !isOverUnderPair(under, over)
      || !phasePowerMatches(firstUnder, under)
      || !phasePowerMatches(firstOver, over)) break;
    unders.push(under);
    overs.push(over);
  }
  if (overs.length < 3) return null;

  return {
    kind: "overUnder",
    startIndex,
    endIndex: units.indexOf(overs.at(-1)),
    startTimestamp: firstUnder.startTimestamp,
    endTimestamp: overs.at(-1).endTimestamp,
    setDurationSeconds: secondsBetween(firstUnder.startTimestamp, overs.at(-1).endTimestamp),
    workDurationSeconds: average(overs.map((over) => over.durationSeconds)),
    recoveryDurationSeconds: average(unders.map((under) => under.durationSeconds)),
    recoveryDurationConsistent: true,
    workUnits: overs,
    recoveryUnits: unders,
    workoutStepIndexes: unders.concat(overs)
      .map((unit) => unit.workoutStepIndex)
      .filter((index) => index != null)
  };
};

const detectSets = (units) => {
  const workRepetitions = buildWorkRepetitions(units);
  const candidates = workRepetitions
    .map(({ unitIndex }) => detectSetAt(units, workRepetitions, unitIndex))
    .concat(units.map((_, unitIndex) => detectOverUnderAt(units, unitIndex)))
    .filter(Boolean)
    // A complete alternating block is more specific than a work/recovery run
    // that extends through the between-set recovery and absorbs another lap.
    // Within each kind, claim the largest run before its overlapping subsets.
    .toSorted((left, right) => Number(right.kind === "overUnder") - Number(left.kind === "overUnder")
      || right.workUnits.length - left.workUnits.length
      || left.startIndex - right.startIndex);
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((set) => overlaps(candidate, set))) continue;
    selected.push(candidate);
  }
  return selected.toSorted((left, right) => left.startTimestamp - right.startTimestamp);
};

const assertDetectedSetInvariants = (sets) => {
  const workIntervals = [];
  for (const set of sets) {
    const setWindow = { startTimestamp: set.startTimestamp, endTimestamp: set.endTimestamp };
    if (sets.some((otherSet) => otherSet !== set && overlaps(setWindow, otherSet))) throw new Error("Detected interval sets must not overlap.");
    for (const work of set.workUnits) {
      const workWindow = { startTimestamp: work.startTimestamp, endTimestamp: work.endTimestamp };
      if (workIntervals.some((otherWork) => overlaps(workWindow, otherWork))) throw new Error("A work interval cannot belong to more than one detected set.");
      workIntervals.push(workWindow);
    }
  }
};

const summarizeSet = ({ set, setNumber, activity, timerSegments, selection, maxHeartRate }) => {
  const setWindow = { startTimestamp: set.startTimestamp, endTimestamp: set.endTimestamp };
  if (!overlaps(setWindow, selection)) return null;
  const clippedSet = clip(setWindow, selection);
  const workWindows = set.workUnits.map((unit) => clip(unit, selection)).filter(Boolean);
  const recoveryWindows = uniqueWindows(set.recoveryUnits.map((unit) => clip(unit, selection)).filter(Boolean));
  if (!workWindows.length && !(set.kind === "overUnder" && recoveryWindows.length)) return null;
  const uniqueWorkWindows = uniqueWindows(workWindows);
  const workIntervalsByRep = workWindows.map((window) => activeIntervalsFor(activity, timerSegments, window));
  const recoveryIntervals = recoveryWindows.flatMap((window) => activeIntervalsFor(activity, timerSegments, window));
  const workIntervals = uniqueWorkWindows.flatMap((window) => activeIntervalsFor(activity, timerSegments, window));
  const setIntervals = activeIntervalsFor(activity, timerSegments, clippedSet);
  const repPowers = workIntervalsByRep.map((intervals) => weightedField(intervals, "powerWatts")).filter((value) => value != null);
  const splitAt = Math.max(1, Math.floor(workIntervalsByRep.length / 2));
  const firstHalfIntervals = workIntervalsByRep.slice(0, splitAt).flat();
  const secondHalfIntervals = workIntervalsByRep.slice(splitAt).flat();
  const firstHalfAverageWatts = weightedField(firstHalfIntervals, "powerWatts");
  const secondHalfAverageWatts = weightedField(secondHalfIntervals, "powerWatts");
  const partial = clippedSet.startTimestamp > set.startTimestamp || clippedSet.endTimestamp < set.endTimestamp;
  const hardWorkDurationSeconds = uniqueWorkWindows.reduce((total, window) => total + activeDurationFor(timerSegments, window), 0);
  const durationSeconds = secondsBetween(clippedSet.startTimestamp, clippedSet.endTimestamp);
  if (hardWorkDurationSeconds > durationSeconds) throw new Error("Hard work duration cannot exceed set duration.");
  return {
    number: setNumber,
    partial,
    repetitions: set.workUnits.length,
    includedRepetitions: set.kind === "overUnder"
      ? set.workUnits.filter((work, index) => overlaps(work, selection) || overlaps(set.recoveryUnits[index], selection)).length
      : workWindows.length,
    workoutStepIndexes: set.workoutStepIndexes,
    executionMetadataSource: set.workoutStepIndexes.length ? "workoutStepIndex" : set.workUnits[0].executionMetadataSource,
    pattern: {
      kind: set.kind ?? "workRecovery",
      ...(set.kind === "overUnder" ? { setDurationSeconds: set.setDurationSeconds } : {}),
      workDurationSeconds: set.workDurationSeconds,
      recoveryDurationSeconds: set.recoveryDurationSeconds,
      recoveryDurationConsistent: set.recoveryDurationConsistent
    },
    durationSeconds,
    hardWorkDurationSeconds,
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

const summarizeIntervalSession = ({ includedSets, activity, timerSegments, selection, maxHeartRate }) => {
  if (!includedSets.length) return null;
  const intervalSets = includedSets.map(({ intervalSet }) => intervalSet);
  const setWindows = uniqueWindows(includedSets.map(({ detectedSet }) => clip(detectedSet, selection)).filter(Boolean));
  const workWindows = uniqueWindows(includedSets.flatMap(({ detectedSet }) => detectedSet.workUnits.map((work) => clip(work, selection)).filter(Boolean)));
  const workIntervals = workWindows.flatMap((window) => activeIntervalsFor(activity, timerSegments, window));
  const setIntervals = setWindows.flatMap((window) => activeIntervalsFor(activity, timerSegments, window));
  const heartRate = heartRateSummary(setIntervals, setWindows[0].startTimestamp, maxHeartRate);
  const protocols = intervalSets.map((set) => ({ repetitions: set.repetitions, ...set.pattern }));
  const workPowerDurationSeconds = intervalsForField(workIntervals, "powerWatts").reduce((total, interval) => total + interval.validSeconds, 0);
  return {
    setCount: intervalSets.length,
    partial: intervalSets.some((set) => set.partial),
    protocols,
    totalSetDurationSeconds: durationOf(setWindows),
    totalHardWorkDurationSeconds: workWindows.reduce((total, window) => total + activeDurationFor(timerSegments, window), 0),
    averageWorkPowerWatts: workPowerDurationSeconds
      ? weightedField(workIntervals, "powerWatts")
      : null,
    timeAtOrAbove90Seconds: heartRate.timeAtOrAbove90Seconds,
    timeAtOrAbove95Seconds: heartRate.timeAtOrAbove95Seconds,
    maximumHeartRateBpm: heartRate.maximumBpm
  };
};

export const analyzeIntervalSets = ({ activity, timerSegments, selection, maxHeartRate = null }) => {
  const detectedSets = detectSets(buildLapUnits({ activity, timerSegments }));
  assertDetectedSetInvariants(detectedSets);
  const includedSets = detectedSets
    .map((detectedSet, index) => ({ detectedSet, intervalSet: summarizeSet({ set: detectedSet, setNumber: index + 1, activity, timerSegments, selection, maxHeartRate }) }))
    .filter(({ intervalSet }) => intervalSet);
  const intervalSets = includedSets.map(({ intervalSet }) => intervalSet);
  return {
    intervalSets,
    intervalSessionSummary: summarizeIntervalSession({ includedSets, activity, timerSegments, selection, maxHeartRate }),
    betweenSetRecoveries: summarizeRecoveries({ detectedSets, exportedSets: intervalSets, activity, timerSegments, selection })
  };
};

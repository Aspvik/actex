import { SCHEMA_VERSION } from "../utils/constants.js";

const score = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 10 ? number : null;
};

const normalizeAthleteNotes = (athleteNotes = {}) => {
  const normalized = {
    rpe: score(athleteNotes.rpe),
    fatigue: score(athleteNotes.fatigue),
    position: ["seated", "standing", "mixed"].includes(athleteNotes.position) ? athleteNotes.position : null,
    notes: String(athleteNotes.notes ?? "").trim() || null
  };
  return Object.values(normalized).some((value) => value != null) ? normalized : null;
};

export const buildExportModel = ({ activity, result, ftp, maxHeartRate, intervalSets = [], intervalSessionSummary = null, betweenSetRecoveries = [], athleteNotes, includeIndividualLaps = false, laps = [] }) => ({
  schemaVersion: SCHEMA_VERSION,
  activity: {
    sport: activity.metadata.sport,
    date: activity.metadata.startTime?.toISOString().slice(0, 10) ?? null,
    device: activity.metadata.productName ?? null,
    selectionType: result.selection.type,
    startTimestamp: result.selection.startTimestamp.toISOString(),
    endTimestamp: result.selection.endTimestamp.toISOString()
  },
  selection: {
    type: result.selection.type,
    startTimestamp: result.selection.startTimestamp.toISOString(),
    endTimestamp: result.selection.endTimestamp.toISOString()
  },
  summary: result.summary,
  power: { ftpWatts: ftp ?? null, ...result.power },
  heartRate: {
    ...result.heartRate,
    configuredMaximumBpm: maxHeartRate ?? null,
    threshold90Bpm: maxHeartRate == null ? null : maxHeartRate * .9,
    threshold95Bpm: maxHeartRate == null ? null : maxHeartRate * .95
  },
  cadence: result.cadence,
  elevation: result.elevation,
  powerZones: result.zones,
  heartRateZones: result.heartRateZones ?? [],
  intervalSets,
  intervalSessionSummary,
  betweenSetRecoveries,
  athleteNotes: normalizeAthleteNotes(athleteNotes),
  dataQuality: result.quality,
  warnings: result.warnings,
  ...(includeIndividualLaps ? { laps } : {})
});

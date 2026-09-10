import { SCHEMA_VERSION } from "../utils/constants.js";

export const buildExportModel = ({ activity, result, ftp, maxHeartRate, includeLaps, laps }) => ({
  schemaVersion: SCHEMA_VERSION,
  activity: {
    sport: activity.metadata.sport,
    date: activity.metadata.startTime?.toISOString().slice(0, 10) ?? null,
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
  heartRate: { configuredMaximumBpm: maxHeartRate ?? null, ...result.heartRate },
  cadence: result.cadence,
  elevation: result.elevation,
  powerZones: result.zones,
  heartRateZones: result.heartRateZones ?? [],
  dataQuality: result.quality,
  warnings: result.warnings,
  laps: includeLaps ? laps : []
});

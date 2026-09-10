import { SCHEMA_VERSION } from "../utils/constants.js";
import { asDate } from "../utils/time.js";

const nullableNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const messageEnd = (message) => {
  const startTime = asDate(message.startTime);
  const timestamp = asDate(message.timestamp);
  const elapsedTime = nullableNumber(message.totalElapsedTime);
  const calculatedEnd = startTime && elapsedTime != null ? new Date(startTime.getTime() + elapsedTime * 1000) : null;
  // Some devices write the session/lap timestamp as its start. Prefer a valid
  // elapsed-time boundary in that case; a timestamp after the start remains authoritative.
  if (timestamp && (!startTime || timestamp > startTime)) return timestamp;
  return calculatedEnd ?? timestamp;
};
const first = (messages, key) => messages[key]?.[0] ?? {};

const normalizeSession = (message, index) => ({
  index,
  sport: message.sport ?? null,
  subSport: message.subSport ?? null,
  startTime: asDate(message.startTime),
  endTime: messageEnd(message),
  elapsedTimeSeconds: nullableNumber(message.totalElapsedTime),
  timerTimeSeconds: nullableNumber(message.totalTimerTime),
  distanceMeters: nullableNumber(message.totalDistance),
  totalAscentMeters: nullableNumber(message.totalAscent),
  totalDescentMeters: nullableNumber(message.totalDescent),
  averagePowerWatts: nullableNumber(message.avgPower),
  maxPowerWatts: nullableNumber(message.maxPower),
  averageHeartRateBpm: nullableNumber(message.avgHeartRate),
  maxHeartRateBpm: nullableNumber(message.maxHeartRate),
  averageCadenceRpm: nullableNumber(message.avgCadence),
  maxCadenceRpm: nullableNumber(message.maxCadence),
  averageSpeedMps: nullableNumber(message.avgSpeed),
  maxSpeedMps: nullableNumber(message.maxSpeed),
  workJoules: nullableNumber(message.totalWork),
  deviceNormalizedPowerWatts: nullableNumber(message.normalizedPower),
  fileFtpWatts: nullableNumber(message.thresholdPower)
});

const normalizeRecord = (message) => ({
  timestamp: asDate(message.timestamp),
  elapsedSeconds: null,
  timerSeconds: null,
  timerRunning: null,
  powerWatts: nullableNumber(message.power),
  heartRateBpm: nullableNumber(message.heartRate),
  cadenceRpm: nullableNumber(message.cadence),
  speedMps: nullableNumber(message.enhancedSpeed ?? message.speed),
  distanceMeters: nullableNumber(message.distance),
  altitudeMeters: nullableNumber(message.enhancedAltitude ?? message.altitude),
  temperatureC: nullableNumber(message.temperature)
});

const sessionIndexFor = (sessions, timestamp) => sessions.find((session) => session.startTime <= timestamp && timestamp <= session.endTime)?.index ?? null;
const normalizeLap = (message, index, sessions) => {
  const startTime = asDate(message.startTime);
  const endTime = messageEnd(message);
  return {
    index,
    sessionIndex: startTime ? sessionIndexFor(sessions, startTime) : null,
    title: `Lap ${index + 1}`,
    startTime,
    endTime,
    elapsedTimeSeconds: nullableNumber(message.totalElapsedTime),
    timerTimeSeconds: nullableNumber(message.totalTimerTime),
    distanceMeters: nullableNumber(message.totalDistance),
    averagePowerWatts: nullableNumber(message.avgPower),
    normalizedPowerWatts: nullableNumber(message.normalizedPower),
    averageHeartRateBpm: nullableNumber(message.avgHeartRate),
    averageCadenceRpm: nullableNumber(message.avgCadence),
    averageSpeedMps: nullableNumber(message.avgSpeed)
  };
};

const normalizeTimerEvent = (message) => ({ timestamp: asDate(message.timestamp), event: message.event, eventType: message.eventType, timerState: message.eventType });

export const normalizeFit = ({ messages, errors = [], integrityWarning = false }) => {
  const sessions = (messages.sessionMesgs ?? []).map(normalizeSession).filter((session) => session.startTime && session.endTime);
  const records = (messages.recordMesgs ?? []).map(normalizeRecord).filter((record) => record.timestamp).toSorted((left, right) => left.timestamp - right.timestamp);
  if (!sessions.length) throw new Error("The FIT file contains no usable session data.");
  if (!records.length) throw new Error("The FIT file contains no record messages with timestamps.");
  if (records.some((record, index) => index && record.timestamp < records[index - 1].timestamp)) throw new Error("The activity has impossible timestamp ordering.");
  const laps = (messages.lapMesgs ?? []).map((message, index) => normalizeLap(message, index, sessions)).filter((lap) => lap.startTime && lap.endTime);
  const fileId = first(messages, "fileIdMesgs");
  const startTime = sessions[0].startTime;
  const endTime = sessions.at(-1).endTime;
  return {
    schemaVersion: SCHEMA_VERSION,
    metadata: {
      sport: sessions[0].sport,
      subSport: sessions[0].subSport,
      startTime,
      endTime,
      fileCreationTime: asDate(fileId.timeCreated),
      manufacturer: fileId.manufacturer ?? null,
      productName: fileId.productName ?? (fileId.garminProduct ?? fileId.product ?? null)
    },
    sessions,
    laps,
    records,
    timerEvents: (messages.eventMesgs ?? []).filter((message) => String(message.event).toLowerCase() === "timer").map(normalizeTimerEvent).filter((event) => event.timestamp),
    devices: (messages.deviceInfoMesgs ?? []).map((message) => ({ manufacturer: message.manufacturer ?? null, productName: message.productName ?? message.garminProduct ?? message.product ?? null })),
    diagnostics: { decodeWarnings: errors.map((error) => error.message ?? String(error)), integrityWarning }
  };
};

import { ELEVATION_HYSTERESIS_METERS } from "../utils/constants.js";
import { median } from "../utils/math.js";

const smoothAltitude = (records) => records.map((record, index) => {
  const values = records.slice(Math.max(0, index - 1), Math.min(records.length, index + 2)).map((item) => item.altitudeMeters);
  return median(values);
});

export const calculateElevation = (records, selection, referenceAscentMeters = null, referenceDescentMeters = null) => {
  if (referenceAscentMeters != null && selection.type !== "range") return { gainMeters: referenceAscentMeters, lossMeters: referenceDescentMeters, source: "FIT" };
  const selected = records.filter((record) => record.timestamp >= selection.startTimestamp && record.timestamp < selection.endTimestamp && record.altitudeMeters != null);
  if (selected.length < 2) return { gainMeters: null, lossMeters: null, source: null };
  const altitudes = smoothAltitude(selected);
  let gain = 0;
  let loss = 0;
  let pivot = altitudes[0];
  for (const altitude of altitudes.slice(1)) {
    const delta = altitude - pivot;
    if (delta >= ELEVATION_HYSTERESIS_METERS) {
      gain += delta;
      pivot = altitude;
    } else if (delta <= -ELEVATION_HYSTERESIS_METERS) {
      loss += Math.abs(delta);
      pivot = altitude;
    }
  }
  return { gainMeters: gain, lossMeters: loss, source: "Calculated" };
};

import { NP_SHORT_SELECTION_SECONDS, NP_WINDOW_SECONDS } from "../utils/constants.js";

export const calculateNormalizedPower = (powerSeries, activeSeconds) => {
  if (activeSeconds < NP_WINDOW_SECONDS) return { watts: null, warning: "Normalized Power is unavailable for selections shorter than 30 seconds." };
  const fourthPowers = [];
  let segment = [];
  const flush = () => {
    for (let index = NP_WINDOW_SECONDS - 1; index < segment.length; index += 1) {
      const average = segment.slice(index - NP_WINDOW_SECONDS + 1, index + 1).reduce((sum, sample) => sum + sample.watts, 0) / NP_WINDOW_SECONDS;
      fourthPowers.push(average ** 4);
    }
  };
  for (const sample of powerSeries) {
    if (segment.length && sample.timestamp - segment.at(-1).timestamp !== 1000) {
      flush();
      segment = [];
    }
    segment.push(sample);
  }
  flush();
  if (!fourthPowers.length) return { watts: null, warning: "Normalized Power is unavailable because no complete 30-second power window exists." };
  const watts = (fourthPowers.reduce((sum, value) => sum + value, 0) / fourthPowers.length) ** 0.25;
  return { watts, warning: activeSeconds < NP_SHORT_SELECTION_SECONDS ? "This selection is shorter than 10 minutes. Normalized Power is less useful for short ranges." : null };
};

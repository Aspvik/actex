export const asDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const secondsBetween = (start, end) => Math.max(0, (end.getTime() - start.getTime()) / 1000);

export const formatDuration = (seconds) => {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.round(Math.max(0, seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return [hours, minutes, remaining]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
    .join(":");
};

export const parseDuration = (value) => {
  const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
};

export const formatRelativeTime = (activityStart, timestamp) => formatDuration(secondsBetween(activityStart, timestamp));

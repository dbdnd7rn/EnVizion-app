export function coverageMinutesLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "No completed data yet";

  const rounded = Math.max(0, Math.round(value));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function coverageWeekdayLabel(weekdayIso: number) {
  const labels = [
    "",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return labels[weekdayIso] ?? "Unknown day";
}

export function coverageHourLabel(hour: number) {
  const normalized = Math.min(23, Math.max(0, Math.round(hour)));
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export function coveragePercentWidth(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

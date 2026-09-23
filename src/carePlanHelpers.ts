import type {
  CarePlanCompletion,
  CarePlanItem,
} from "./carePlan";

const weekdayMap: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export const carePlanWeekdayLabels = [
  { iso: 1, label: "Mon" },
  { iso: 2, label: "Tue" },
  { iso: 3, label: "Wed" },
  { iso: 4, label: "Thu" },
  { iso: 5, label: "Fri" },
  { iso: 6, label: "Sat" },
  { iso: 7, label: "Sun" },
] as const;

export function carePlanLocalDateKey(
  value = new Date(),
  timezone = "UTC",
) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {
    // Fall through to UTC.
  }

  return value.toISOString().slice(0, 10);
}

export function carePlanWeekdayIso(
  value = new Date(),
  timezone = "UTC",
) {
  try {
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    }).format(value);

    return weekdayMap[weekday] ?? 1;
  } catch {
    const day = value.getUTCDay();
    return day === 0 ? 7 : day;
  }
}

export function carePlanItemIsForToday(
  item: Pick<CarePlanItem, "daysOfWeek" | "timezone">,
  now = new Date(),
) {
  return item.daysOfWeek.includes(carePlanWeekdayIso(now, item.timezone));
}

export function carePlanCompletionForItemToday(
  item: Pick<CarePlanItem, "id" | "timezone">,
  completions: CarePlanCompletion[],
  now = new Date(),
) {
  const key = carePlanLocalDateKey(now, item.timezone);
  return (
    completions.find(
      (completion) =>
        completion.itemId === item.id &&
        completion.completedOn === key,
    ) ?? null
  );
}

export function carePlanTodaySummary(
  items: CarePlanItem[],
  completions: CarePlanCompletion[],
  now = new Date(),
) {
  const today = items.filter((item) => carePlanItemIsForToday(item, now));
  const completed = today.filter((item) =>
    carePlanCompletionForItemToday(item, completions, now),
  ).length;

  return {
    total: today.length,
    completed,
    remaining: Math.max(0, today.length - completed),
  };
}

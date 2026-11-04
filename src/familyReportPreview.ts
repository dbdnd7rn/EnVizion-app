import type { CarePlanItem, CarePlanCompletion } from "./carePlan";

export type FamilyReportPeriod = "daily" | "weekly";
export type FamilyReportActivity = {
  date: string;
  title: string;
  category: "meal" | "mobility" | "hygiene" | "comfort";
  completed: boolean;
};
export type FamilyReportPreview = {
  period: FamilyReportPeriod;
  startOn: string;
  plannedCount: number;
  completedCount: number;
  activities: FamilyReportActivity[];
};

// Share only non-clinical routine titles, never medication, monitoring, task
// notes, vitals, names of staff, diagnoses, or raw records by default.
const FAMILY_SAFE_CATEGORIES = new Set(["meal", "mobility", "hygiene", "comfort"]);

export function localDateKey(date: Date): string {
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function shiftLocalDate(day: string, days: number): string {
  const parts = day.split("-").map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) {
    throw new Error("Invalid care report date.");
  }
  return localDateKey(new Date(parts[0], parts[1] - 1, parts[2] + days, 12));
}
export function weekStarting(day: string): string {
  const parts = day.split("-").map(Number);
  const dow = new Date(parts[0], parts[1] - 1, parts[2], 12).getDay();
  return shiftLocalDate(day, -(dow === 0 ? 6 : dow - 1));
}
export function reportPeriodStart(period: FamilyReportPeriod, day: string): string {
  return period === "weekly" ? weekStarting(day) : day;
}
export function familyReportDateLabel(period: FamilyReportPeriod, start: string): string {
  const human = (day: string) => new Date(day + "T12:00:00").toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
  return period === "daily" ? human(start) : `${human(start)} – ${human(shiftLocalDate(start, 6))}`;
}

/**
 * Generate a reviewable snapshot from real, recipient-scoped care-plan records.
 * Incomplete activities are labelled "not recorded", NOT "missed care".
 * Historical snapshots remain fixed after approval, even if routines later change.
 */
export function buildFamilyReportPreview(
  items: CarePlanItem[],
  completions: CarePlanCompletion[],
  period: FamilyReportPeriod,
  startOn: string,
  todayOn: string = localDateKey(new Date()),
): FamilyReportPreview {
  const start = reportPeriodStart(period, startOn);
  if (start > todayOn) throw new Error("Future care periods cannot be shared.");
  const end = period === "daily" ? start : shiftLocalDate(start, 6);
  const completionIds = new Set(
    completions.map((row) => `${row.itemId}:${row.completedOn}`),
  );
  const activities: FamilyReportActivity[] = [];
  let plannedCount = 0;
  let completedCount = 0;
  const eligible = items.filter((item) => item.active && FAMILY_SAFE_CATEGORIES.has(item.category));

  for (let date = start; date <= end && date <= todayOn; date = shiftLocalDate(date, 1)) {
    const [y, m, d] = date.split("-").map(Number);
    const weekday = new Date(y, m - 1, d, 12).getDay() || 7;
    for (const item of eligible) {
      if (!item.daysOfWeek.includes(weekday)) continue;
      if (item.createdAt && item.createdAt.slice(0, 10) > date) continue;
      plannedCount++;
      const completed = completionIds.has(`${item.id}:${date}`);
      if (completed) completedCount++;
      activities.push({
        date, category: item.category as FamilyReportActivity["category"],
        title: item.title.slice(0, 140), completed,
      });
    }
  }
  // Limit the items sent to family while keeping the actual denominator accurate.
  activities.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
  return { period, startOn: start, plannedCount, completedCount, activities: activities.slice(0, 60) };
}


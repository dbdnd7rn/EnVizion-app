import { supabase } from "./supabase";
import { loadCarePlan, type CarePlanItem, type CarePlanCompletion } from "./carePlan";

export type FamilyReportPeriod = "daily" | "weekly";
export type FamilyReportActivity = {
  date: string;
  title: string;
  category: "meal" | "mobility" | "hygiene" | "comfort";
  completed: boolean;
};
export type FamilyCareReport = {
  id: string;
  care_recipient_id: string;
  period: FamilyReportPeriod;
  start_on: string;
  planned_count: number;
  completed_count: number;
  activities: FamilyReportActivity[];
  summary_note: string;
  published: boolean;
  published_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
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

export async function loadFamilyReportSource(careRecipientId: string) {
  return loadCarePlan(careRecipientId);
}

export async function loadApprovedFamilyReports(careRecipientId: string): Promise<FamilyCareReport[]> {
  const { data, error } = await supabase.from("family_care_reports")
    .select("id,care_recipient_id,period,start_on,planned_count,completed_count,activities,summary_note,published,published_by,published_at,created_at,updated_at")
    .eq("care_recipient_id", careRecipientId).eq("published", true)
    .order("start_on", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as FamilyCareReport[];
}

export async function loadFamilyReportsForReview(careRecipientId: string): Promise<FamilyCareReport[]> {
  const { data, error } = await supabase.from("family_care_reports")
    .select("id,care_recipient_id,period,start_on,planned_count,completed_count,activities,summary_note,published,published_by,published_at,created_at,updated_at")
    .eq("care_recipient_id", careRecipientId)
    .order("start_on", { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as FamilyCareReport[];
}

export async function publishFamilyReport(
  careRecipientId: string, preview: FamilyReportPreview, note: string,
): Promise<void> {
  if (note.trim().length > 800) throw new Error("Keep the family summary under 800 characters.");
  if (preview.plannedCount === 0 && !note.trim()) {
    throw new Error("There are no shareable activities. Add a short summary before publishing.");
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please sign in again.");
  // Database policy additionally requires the Primary Advocate to own this care profile.
  const { error } = await supabase.from("family_care_reports").upsert({
    care_recipient_id: careRecipientId,
    period: preview.period,
    start_on: preview.startOn,
    planned_count: preview.plannedCount,
    completed_count: preview.completedCount,
    activities: preview.activities,
    summary_note: note.trim(),
    published: true,
    published_by: user.id,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: user.id,
  }, { onConflict: "care_recipient_id,period,start_on" });
  if (error) throw error;
}

export async function unpublishFamilyReport(
  careRecipientId: string, id: string,
): Promise<void> {
  const { data, error } = await supabase.from("family_care_reports")
    .update({ published: false, published_by: null, published_at: null,
      updated_at: new Date().toISOString() })
    .eq("care_recipient_id", careRecipientId).eq("id", id).eq("published", true)
    .select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This report is no longer shared or you do not have permission.");
}

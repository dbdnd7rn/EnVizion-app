import { supabase } from "./supabase";
import { loadCarePlan } from "./carePlan";
import type { FamilyReportActivity, FamilyReportPeriod, FamilyReportPreview } from "./familyReportPreview";
export type { FamilyReportActivity, FamilyReportPeriod, FamilyReportPreview } from "./familyReportPreview";
export { localDateKey, shiftLocalDate, weekStarting, reportPeriodStart, familyReportDateLabel,
  buildFamilyReportPreview } from "./familyReportPreview";

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
  const { data: existing, error: lookupError } = await supabase
    .from("family_care_reports").select("id")
    .eq("care_recipient_id", careRecipientId)
    .eq("period", preview.period).eq("start_on", preview.startOn)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const publishedAt = new Date().toISOString();
  const values = {
    planned_count: preview.plannedCount,
    completed_count: preview.completedCount,
    activities: preview.activities,
    summary_note: note.trim(),
    published: true,
    published_by: user.id,
    published_at: publishedAt,
    updated_at: publishedAt,
  };
  // Update only columns explicitly granted to the Primary Advocate. Using
  // upsert would try to UPDATE immutable ownership/identity columns too.
  if (existing) {
    const { data, error } = await supabase.from("family_care_reports")
      .update(values).eq("id", existing.id)
      .eq("care_recipient_id", careRecipientId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The report could not be updated with your permissions.");
  } else {
    const { error } = await supabase.from("family_care_reports").insert({
      ...values,
      care_recipient_id: careRecipientId, period: preview.period,
      start_on: preview.startOn, created_by: user.id,
    });
    if (error) throw error;
  }
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

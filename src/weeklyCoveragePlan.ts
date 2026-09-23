import { supabase } from "./supabase";
import type { WeeklyCoverageDraftSlot } from "./weeklyCoveragePlanHelpers";

export type WeeklyCoveragePlanStatus =
  | "draft"
  | "published"
  | "closed"
  | "cancelled";

export type WeeklyCoverageSlotStatus =
  | "proposed"
  | "pending"
  | "accepted"
  | "declined"
  | "open_coverage"
  | "cancelled";

export type CareWeeklyCoveragePlan = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  weekStart: string;
  timezone: string;
  status: WeeklyCoveragePlanStatus;
  note: string;
  publishedAt: string | null;
  closedAt: string | null;
  approvalDeadlineAt: string | null;
  approvalDeadlineProcessedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareWeeklyCoverageSlot = {
  id: string;
  planId: string;
  careRecipientId: string;
  createdBy: string | null;
  sourceType: "coverage_requirement" | "coverage_request";
  sourceId: string;
  caregiverId: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  status: WeeklyCoverageSlotStatus;
  responseNote: string;
  respondedAt: string | null;
  shiftId: string | null;
  coverageRequestId: string | null;
  timedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapPlan(row: any): CareWeeklyCoveragePlan {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    weekStart: row.week_start,
    timezone: row.timezone,
    status: row.status as WeeklyCoveragePlanStatus,
    note: row.note ?? "",
    publishedAt: row.published_at ?? null,
    closedAt: row.closed_at ?? null,
    approvalDeadlineAt: row.approval_deadline_at ?? null,
    approvalDeadlineProcessedAt: row.approval_deadline_processed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlot(row: any): CareWeeklyCoverageSlot {
  return {
    id: row.id,
    planId: row.plan_id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    sourceType: row.source_type,
    sourceId: row.source_id,
    caregiverId: row.caregiver_id ?? null,
    label: row.label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as WeeklyCoverageSlotStatus,
    responseNote: row.response_note ?? "",
    respondedAt: row.responded_at ?? null,
    shiftId: row.shift_id ?? null,
    coverageRequestId: row.coverage_request_id ?? null,
    timedOutAt: row.timed_out_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadWeeklyCoveragePlans(careRecipientId: string) {
  const { data: planRows, error: planError } = await supabase
    .from("care_weekly_coverage_plans")
    .select(
      "id, care_recipient_id, created_by, week_start, timezone, status, note, published_at, closed_at, approval_deadline_at, approval_deadline_processed_at, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("week_start", { ascending: false })
    .limit(24);

  if (planError) throw planError;

  const plans = (planRows ?? []).map(mapPlan);
  if (!plans.length) return { plans, slots: [] as CareWeeklyCoverageSlot[] };

  const { data: slotRows, error: slotError } = await supabase
    .from("care_weekly_coverage_slots")
    .select(
      "id, plan_id, care_recipient_id, created_by, source_type, source_id, caregiver_id, label, starts_at, ends_at, status, response_note, responded_at, shift_id, coverage_request_id, timed_out_at, created_at, updated_at",
    )
    .in(
      "plan_id",
      plans.map((plan) => plan.id),
    )
    .order("starts_at", { ascending: true });

  if (slotError) throw slotError;
  return {
    plans,
    slots: (slotRows ?? []).map(mapSlot),
  };
}

export async function saveWeeklyCoveragePlanDraft(input: {
  careRecipientId: string;
  weekStart: string;
  timezone: string;
  note: string;
  approvalDeadlineAt: string | null;
  slots: WeeklyCoverageDraftSlot[];
}) {
  const { data, error } = await supabase.rpc(
    "save_weekly_coverage_plan_draft",
    {
      p_care_recipient_id: input.careRecipientId,
      p_week_start: input.weekStart,
      p_timezone: input.timezone,
      p_note: input.note.trim() || null,
      p_slots: input.slots,
      p_approval_deadline_at: input.approvalDeadlineAt,
    },
  );

  if (error) throw error;
  if (!data) throw new Error("Weekly coverage draft was not saved.");
  return String(data);
}

export async function publishWeeklyCoveragePlan(planId: string) {
  const { error } = await supabase.rpc("publish_weekly_coverage_plan", {
    p_plan_id: planId,
  });
  if (error) throw error;
}

export async function respondWeeklyCoverageSlot(input: {
  slotId: string;
  response: "accepted" | "declined";
  note?: string;
}) {
  const { data, error } = await supabase.rpc(
    "respond_weekly_coverage_slot",
    {
      p_slot_id: input.slotId,
      p_response: input.response,
      p_note: input.note?.trim() || null,
    },
  );

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.slot_id) throw new Error("Weekly coverage response was not saved.");

  return {
    slotId: String(row.slot_id),
    status: String(row.slot_status) as WeeklyCoverageSlotStatus,
    shiftId: row.shift_id ? String(row.shift_id) : null,
    coverageRequestId: row.coverage_request_id
      ? String(row.coverage_request_id)
      : null,
  };
}

export async function currentWeeklyCoverageUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

import { supabase } from "./supabase";

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

export type WeeklyCoveragePlan = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  weekStart: string;
  timezone: string;
  status: WeeklyCoveragePlanStatus;
  note: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WeeklyCoverageSlot = {
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
  createdAt: string;
  updatedAt: string;
};

export type WeeklyCoverageDraftSlot = {
  sourceType: "coverage_requirement" | "coverage_request";
  sourceId: string;
  caregiverId: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
};

const planFields =
  "id, care_recipient_id, created_by, week_start, timezone, status, note, published_at, closed_at, created_at, updated_at";

const slotFields =
  "id, plan_id, care_recipient_id, created_by, source_type, source_id, caregiver_id, label, starts_at, ends_at, status, response_note, responded_at, shift_id, coverage_request_id, created_at, updated_at";

function mapPlan(row: any): WeeklyCoveragePlan {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSlot(row: any): WeeklyCoverageSlot {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadWeeklyCoveragePlans(careRecipientId: string) {
  const { data: plans, error: planError } = await supabase
    .from("care_weekly_coverage_plans")
    .select(planFields)
    .eq("care_recipient_id", careRecipientId)
    .order("week_start", { ascending: false })
    .limit(12);

  if (planError) throw planError;

  const planRows = (plans ?? []).map(mapPlan);
  const planIds = planRows.map((plan) => plan.id);

  if (!planIds.length) {
    return { plans: planRows, slots: [] as WeeklyCoverageSlot[] };
  }

  const { data: slots, error: slotError } = await supabase
    .from("care_weekly_coverage_slots")
    .select(slotFields)
    .in("plan_id", planIds)
    .order("starts_at", { ascending: true });

  if (slotError) throw slotError;

  return {
    plans: planRows,
    slots: (slots ?? []).map(mapSlot),
  };
}

export async function saveWeeklyCoveragePlanDraft(input: {
  careRecipientId: string;
  weekStart: string;
  timezone: string;
  note: string;
  slots: WeeklyCoverageDraftSlot[];
}) {
  const { data, error } = await supabase.rpc(
    "save_weekly_coverage_plan_draft",
    {
      p_care_recipient_id: input.careRecipientId,
      p_week_start: input.weekStart,
      p_timezone: input.timezone,
      p_note: input.note.trim() || null,
      p_slots: input.slots.map((slot) => ({
        sourceType: slot.sourceType,
        sourceId: slot.sourceId,
        caregiverId: slot.caregiverId,
        label: slot.label,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      })),
    },
  );

  if (error) throw error;
  if (!data) throw new Error("Weekly coverage plan draft was not saved.");
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
  if (!row?.slot_id || !row?.slot_status) {
    throw new Error("Weekly coverage response was not completed.");
  }

  return {
    slotId: String(row.slot_id),
    status: String(row.slot_status) as WeeklyCoverageSlotStatus,
    shiftId: row.shift_id ? String(row.shift_id) : null,
    coverageRequestId: row.coverage_request_id
      ? String(row.coverage_request_id)
      : null,
  };
}

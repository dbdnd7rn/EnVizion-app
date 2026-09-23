import { supabase } from "./supabase";

export type CareCoverageRequirement = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  label: string;
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CareCoverageRequirementInput = {
  label: string;
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  note: string;
};

export type CareCoverageRequirementOccurrence = {
  requirementId: string;
  careRecipientId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  note: string;
};

const fields =
  "id, care_recipient_id, created_by, label, days_of_week, start_local_time, end_local_time, timezone, effective_from, effective_until, note, created_at, updated_at";

function clock(value: string) {
  return value.slice(0, 5);
}

function mapRequirement(row: any): CareCoverageRequirement {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    label: row.label,
    daysOfWeek: (row.days_of_week ?? []).map(Number),
    startLocalTime: clock(row.start_local_time),
    endLocalTime: clock(row.end_local_time),
    timezone: row.timezone,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until ?? null,
    note: row.note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function payload(input: CareCoverageRequirementInput) {
  return {
    label: input.label.trim(),
    days_of_week: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
    start_local_time: input.startLocalTime,
    end_local_time: input.endLocalTime,
    timezone: input.timezone.trim(),
    effective_from: input.effectiveFrom,
    effective_until: input.effectiveUntil || null,
    note: input.note.trim() || null,
  };
}

async function currentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

export async function loadCareCoverageRequirements(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_coverage_requirements")
    .select(fields)
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapRequirement);
}

export async function createCareCoverageRequirement(
  careRecipientId: string,
  input: CareCoverageRequirementInput,
) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_coverage_requirements")
    .insert({
      care_recipient_id: careRecipientId,
      created_by: userId,
      ...payload(input),
    })
    .select(fields)
    .single();

  if (error) throw error;
  return mapRequirement(data);
}

export async function updateCareCoverageRequirement(
  careRecipientId: string,
  requirementId: string,
  input: CareCoverageRequirementInput,
) {
  const { data, error } = await supabase
    .from("care_coverage_requirements")
    .update(payload(input))
    .eq("id", requirementId)
    .eq("care_recipient_id", careRecipientId)
    .select(fields)
    .single();

  if (error) throw error;
  return mapRequirement(data);
}

export async function deleteCareCoverageRequirement(
  careRecipientId: string,
  requirementId: string,
) {
  const { error } = await supabase
    .from("care_coverage_requirements")
    .delete()
    .eq("id", requirementId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export async function loadCareCoverageRequirementOccurrences(input: {
  careRecipientId: string;
  startsAt: string;
  endsAt: string;
}) {
  const { data, error } = await supabase.rpc(
    "list_care_coverage_requirement_occurrences",
    {
      p_care_recipient_id: input.careRecipientId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
    },
  );

  if (error) throw error;
  return (data ?? []).map(
    (row: any): CareCoverageRequirementOccurrence => ({
      requirementId: row.requirement_id,
      careRecipientId: row.care_recipient_id,
      label: row.label,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      timezone: row.timezone,
      note: row.note ?? "",
    }),
  );
}

export async function scheduleCareCoverageRequirementGap(input: {
  requirementId: string;
  caregiverId: string;
  startsAt: string;
  endsAt: string;
  note?: string;
}) {
  const { data, error } = await supabase.rpc(
    "schedule_care_coverage_requirement_gap",
    {
      p_requirement_id: input.requirementId,
      p_caregiver_id: input.caregiverId,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_note: input.note?.trim() || null,
    },
  );

  if (error) throw error;
  if (!data) throw new Error("Coverage requirement shift was not created.");
  return String(data);
}

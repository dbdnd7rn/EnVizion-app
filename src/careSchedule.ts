import { supabase } from "./supabase";

export const availabilityStatuses = [
  "available",
  "preferred",
  "unavailable",
] as const;
export type AvailabilityStatus = (typeof availabilityStatuses)[number];

export const availabilityStatusLabels: Record<AvailabilityStatus, string> = {
  available: "Available",
  preferred: "Preferred",
  unavailable: "Unavailable",
};

export type CaregiverAvailability = {
  id: string;
  careRecipientId: string;
  caregiverId: string;
  createdBy: string | null;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CaregiverAvailabilityRule = {
  id: string;
  careRecipientId: string;
  caregiverId: string;
  createdBy: string | null;
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  status: AvailabilityStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CareShift = {
  id: string;
  careRecipientId: string;
  caregiverId: string;
  createdBy: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "completed" | "cancelled";
  note: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareShiftSwapRequest = {
  id: string;
  careRecipientId: string;
  shiftId: string;
  requestedBy: string;
  requestedTo: string;
  status: "open" | "accepted" | "declined" | "cancelled";
  message: string;
  responseNote: string;
  createdAt: string;
  respondedAt: string | null;
};

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function mapAvailability(row: any): CaregiverAvailability {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    caregiverId: row.caregiver_id,
    createdBy: row.created_by ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.availability_status as AvailabilityStatus,
    note: row.note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAvailabilityRule(row: any): CaregiverAvailabilityRule {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    caregiverId: row.caregiver_id,
    createdBy: row.created_by ?? null,
    daysOfWeek: (row.days_of_week ?? []).map((value: unknown) => Number(value)),
    startLocalTime: String(row.start_local_time).slice(0, 5),
    endLocalTime: String(row.end_local_time).slice(0, 5),
    timezone: row.timezone,
    status: row.availability_status as AvailabilityStatus,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until ?? null,
    note: row.note ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapShift(row: any): CareShift {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    caregiverId: row.caregiver_id,
    createdBy: row.created_by ?? null,
    label: row.label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    note: row.note ?? "",
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSwap(row: any): CareShiftSwapRequest {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    shiftId: row.shift_id,
    requestedBy: row.requested_by,
    requestedTo: row.requested_to,
    status: row.status,
    message: row.message ?? "",
    responseNote: row.response_note ?? "",
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? null,
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

export async function loadCareSchedule(careRecipientId: string) {
  const [
    availabilityResult,
    recurringAvailabilityResult,
    shiftsResult,
    swapsResult,
  ] = await Promise.all([
    supabase
      .from("caregiver_availability")
      .select(
        "id, care_recipient_id, caregiver_id, created_by, starts_at, ends_at, availability_status, note, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("caregiver_availability_rules")
      .select(
        "id, care_recipient_id, caregiver_id, created_by, days_of_week, start_local_time, end_local_time, timezone, availability_status, effective_from, effective_until, note, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("care_shifts")
      .select(
        "id, care_recipient_id, caregiver_id, created_by, label, starts_at, ends_at, status, note, completed_at, cancelled_at, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("starts_at", { ascending: true }),
    supabase
      .from("care_shift_swap_requests")
      .select(
        "id, care_recipient_id, shift_id, requested_by, requested_to, status, message, response_note, created_at, responded_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (availabilityResult.error) throw availabilityResult.error;
  if (recurringAvailabilityResult.error) throw recurringAvailabilityResult.error;
  if (shiftsResult.error) throw shiftsResult.error;
  if (swapsResult.error) throw swapsResult.error;

  return {
    availability: (availabilityResult.data ?? []).map(mapAvailability),
    recurringAvailability: (recurringAvailabilityResult.data ?? []).map(
      mapAvailabilityRule,
    ),
    shifts: (shiftsResult.data ?? []).map(mapShift),
    swaps: (swapsResult.data ?? []).map(mapSwap),
  };
}

export async function createCaregiverAvailability(input: {
  careRecipientId: string;
  caregiverId: string;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
  note: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("caregiver_availability")
    .insert({
      care_recipient_id: input.careRecipientId,
      caregiver_id: input.caregiverId,
      created_by: userId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      availability_status: input.status,
      note: clean(input.note),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, care_recipient_id, caregiver_id, created_by, starts_at, ends_at, availability_status, note, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapAvailability(data);
}

export async function createCaregiverAvailabilityRule(input: {
  careRecipientId: string;
  caregiverId: string;
  daysOfWeek: number[];
  startLocalTime: string;
  endLocalTime: string;
  timezone: string;
  status: AvailabilityStatus;
  effectiveFrom: string;
  effectiveUntil: string | null;
  note: string;
}) {
  const userId = await currentUserId();
  const days = [...new Set(input.daysOfWeek)]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b);

  const { data, error } = await supabase
    .from("caregiver_availability_rules")
    .insert({
      care_recipient_id: input.careRecipientId,
      caregiver_id: input.caregiverId,
      created_by: userId,
      days_of_week: days,
      start_local_time: input.startLocalTime,
      end_local_time: input.endLocalTime,
      timezone: input.timezone,
      availability_status: input.status,
      effective_from: input.effectiveFrom,
      effective_until: input.effectiveUntil || null,
      note: clean(input.note),
    })
    .select(
      "id, care_recipient_id, caregiver_id, created_by, days_of_week, start_local_time, end_local_time, timezone, availability_status, effective_from, effective_until, note, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapAvailabilityRule(data);
}

export async function deleteCaregiverAvailabilityRule(
  careRecipientId: string,
  ruleId: string,
) {
  const { error } = await supabase
    .from("caregiver_availability_rules")
    .delete()
    .eq("id", ruleId)
    .eq("care_recipient_id", careRecipientId);
  if (error) throw error;
}

export async function deleteCaregiverAvailability(
  careRecipientId: string,
  availabilityId: string,
) {
  const { error } = await supabase
    .from("caregiver_availability")
    .delete()
    .eq("id", availabilityId)
    .eq("care_recipient_id", careRecipientId);
  if (error) throw error;
}

export async function createCareShift(input: {
  careRecipientId: string;
  caregiverId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  note: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_shifts")
    .insert({
      care_recipient_id: input.careRecipientId,
      caregiver_id: input.caregiverId,
      created_by: userId,
      label: input.label.trim() || "Caregiver shift",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      note: clean(input.note),
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, care_recipient_id, caregiver_id, created_by, label, starts_at, ends_at, status, note, completed_at, cancelled_at, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapShift(data);
}

export async function cancelCareShift(
  careRecipientId: string,
  shiftId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("care_shifts")
    .update({
      status: "cancelled",
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", shiftId)
    .eq("care_recipient_id", careRecipientId);
  if (error) throw error;
}

export async function requestCareShiftSwap(input: {
  careRecipientId: string;
  shiftId: string;
  requestedTo: string;
  message: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_shift_swap_requests")
    .insert({
      care_recipient_id: input.careRecipientId,
      shift_id: input.shiftId,
      requested_by: userId,
      requested_to: input.requestedTo,
      message: clean(input.message),
    })
    .select(
      "id, care_recipient_id, shift_id, requested_by, requested_to, status, message, response_note, created_at, responded_at",
    )
    .single();

  if (error) throw error;
  return mapSwap(data);
}

export async function respondToCareShiftSwap(
  careRecipientId: string,
  swapId: string,
  status: "accepted" | "declined" | "cancelled",
  responseNote: string,
) {
  const { data, error } = await supabase
    .from("care_shift_swap_requests")
    .update({
      status,
      response_note: clean(responseNote),
    })
    .eq("id", swapId)
    .eq("care_recipient_id", careRecipientId)
    .select(
      "id, care_recipient_id, shift_id, requested_by, requested_to, status, message, response_note, created_at, responded_at",
    )
    .single();

  if (error) throw error;
  return mapSwap(data);
}

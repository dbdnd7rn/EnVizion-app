import { supabase } from "./supabase";

export type CareCoverageRequestStatus =
  | "open"
  | "reserved"
  | "filled"
  | "cancelled";
export type CareCoverageResponseValue = "accepted" | "declined";

export type CareCoverageRequest = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  note: string;
  status: CareCoverageRequestStatus;
  claimedBy: string | null;
  filledShiftId: string | null;
  claimedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareCoverageRequestResponse = {
  id: string;
  careRecipientId: string;
  requestId: string;
  responderId: string | null;
  response: CareCoverageResponseValue;
  note: string;
  respondedAt: string;
};

function mapRequest(row: any): CareCoverageRequest {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    label: row.label,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    note: row.note ?? "",
    status: row.status as CareCoverageRequestStatus,
    claimedBy: row.claimed_by ?? null,
    filledShiftId: row.filled_shift_id ?? null,
    claimedAt: row.claimed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResponse(row: any): CareCoverageRequestResponse {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    requestId: row.request_id,
    responderId: row.responder_id ?? null,
    response: row.response as CareCoverageResponseValue,
    note: row.note ?? "",
    respondedAt: row.responded_at,
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

export async function loadCareCoverageRequests(careRecipientId: string) {
  const [requestsResult, responsesResult] = await Promise.all([
    supabase
      .from("care_coverage_requests")
      .select(
        "id, care_recipient_id, created_by, label, starts_at, ends_at, note, status, claimed_by, filled_shift_id, claimed_at, cancelled_at, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("starts_at", { ascending: true })
      .limit(100),
    supabase
      .from("care_coverage_request_responses")
      .select(
        "id, care_recipient_id, request_id, responder_id, response, note, responded_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("responded_at", { ascending: false })
      .limit(200),
  ]);

  if (requestsResult.error) throw requestsResult.error;
  if (responsesResult.error) throw responsesResult.error;

  return {
    requests: (requestsResult.data ?? []).map(mapRequest),
    responses: (responsesResult.data ?? []).map(mapResponse),
  };
}

export async function createCareCoverageRequest(input: {
  careRecipientId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  note: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_coverage_requests")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: userId,
      label: input.label.trim() || "Open caregiver coverage",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      note: input.note.trim() || null,
    })
    .select(
      "id, care_recipient_id, created_by, label, starts_at, ends_at, note, status, claimed_by, filled_shift_id, claimed_at, cancelled_at, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapRequest(data);
}

export async function respondCareCoverageRequest(input: {
  requestId: string;
  response: CareCoverageResponseValue;
  note?: string;
}) {
  const { data, error } = await supabase.rpc(
    "respond_care_coverage_request",
    {
      p_request_id: input.requestId,
      p_response: input.response,
      p_note: input.note?.trim() || null,
    },
  );

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.request_id || !row?.request_status) {
    throw new Error("Coverage response was not recorded.");
  }

  return {
    requestId: String(row.request_id),
    response: String(row.response) as CareCoverageResponseValue,
    shiftId: row.shift_id ? String(row.shift_id) : null,
    requestStatus: String(row.request_status) as CareCoverageRequestStatus,
  };
}

export async function assignCareCoverageRequest(input: {
  requestId: string;
  caregiverId: string;
  note?: string;
}) {
  const { data, error } = await supabase.rpc("assign_care_coverage_request", {
    p_request_id: input.requestId,
    p_caregiver_id: input.caregiverId,
    p_note: input.note?.trim() || null,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.request_id || !row?.caregiver_id || !row?.shift_id) {
    throw new Error("Coverage assignment was not completed.");
  }

  return {
    requestId: String(row.request_id),
    caregiverId: String(row.caregiver_id),
    shiftId: String(row.shift_id),
    requestStatus: String(row.request_status) as CareCoverageRequestStatus,
  };
}

export async function cancelCareCoverageRequest(requestId: string) {
  const { error } = await supabase.rpc("cancel_care_coverage_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}


export type CareCoverageCommandParticipant = {
  userId: string;
  displayName: string;
  firstNotifiedAt: string | null;
  lastNotifiedAt: string | null;
  notificationCount: number;
  highestEscalationStage: 1 | 2 | 3 | null;
  response: CareCoverageResponseValue | null;
  responseNote: string;
  respondedAt: string | null;
  isClaimed: boolean;
  claimedAt: string | null;
};

export async function loadCareCoverageRequestCommandCenter(
  requestId: string,
): Promise<CareCoverageCommandParticipant[]> {
  const { data, error } = await supabase.rpc(
    "care_coverage_request_command_center",
    { p_request_id: requestId },
  );

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    userId: String(row.user_id),
    displayName: String(row.display_name || "Caregiver"),
    firstNotifiedAt: row.first_notified_at ?? null,
    lastNotifiedAt: row.last_notified_at ?? null,
    notificationCount: Number(row.notification_count ?? 0),
    highestEscalationStage:
      row.highest_escalation_stage == null
        ? null
        : (Number(row.highest_escalation_stage) as 1 | 2 | 3),
    response: row.response
      ? (String(row.response) as CareCoverageResponseValue)
      : null,
    responseNote: String(row.response_note || ""),
    respondedAt: row.responded_at ?? null,
    isClaimed: Boolean(row.is_claimed),
    claimedAt: row.claimed_at ?? null,
  }));
}

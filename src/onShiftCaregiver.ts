import { supabase } from "./supabase";
import type {
  HandoffAppointmentSnapshot,
  HandoffCommunicationSnapshot,
  HandoffCoordinationSnapshot,
  HandoffFollowUpSnapshot,
  HandoffMedicationSnapshot,
} from "./shiftBriefingHelpers";

export type CaregiverShiftSession = {
  id: string;
  careRecipientId: string;
  caregiverId: string | null;
  sourceHandoffId: string;
  sourceAcknowledgementId: string;
  startedAt: string;
  endedAt: string | null;
  endNote: string;
  outgoingHandoffId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CaregiverShiftSessionNote = {
  id: string;
  careRecipientId: string;
  sessionId: string;
  createdBy: string | null;
  body: string;
  createdAt: string;
};

function mapSession(row: any): CaregiverShiftSession {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    caregiverId: row.caregiver_id ?? null,
    sourceHandoffId: row.source_handoff_id,
    sourceAcknowledgementId: row.source_acknowledgement_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
    endNote: row.end_note ?? "",
    outgoingHandoffId: row.outgoing_handoff_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNote(row: any): CaregiverShiftSessionNote {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    sessionId: row.session_id,
    createdBy: row.created_by ?? null,
    body: row.body,
    createdAt: row.created_at,
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

export async function loadActiveCaregiverShiftSession(
  careRecipientId: string,
): Promise<CaregiverShiftSession | null> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("caregiver_shift_sessions")
    .select(
      "id, care_recipient_id, caregiver_id, source_handoff_id, source_acknowledgement_id, started_at, ended_at, end_note, outgoing_handoff_id, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .eq("caregiver_id", userId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapSession(data) : null;
}

export async function loadCaregiverShiftSessionNotes(
  careRecipientId: string,
  sessionId: string,
): Promise<CaregiverShiftSessionNote[]> {
  const { data, error } = await supabase
    .from("caregiver_shift_session_notes")
    .select(
      "id, care_recipient_id, session_id, created_by, body, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data ?? []).map(mapNote);
}

export async function addCaregiverShiftSessionNote(input: {
  careRecipientId: string;
  sessionId: string;
  body: string;
}) {
  const userId = await currentUserId();
  const body = input.body.trim();
  if (!body) throw new Error("Add a short shift note first.");

  const { data, error } = await supabase
    .from("caregiver_shift_session_notes")
    .insert({
      care_recipient_id: input.careRecipientId,
      session_id: input.sessionId,
      created_by: userId,
      body: body.slice(0, 2000),
    })
    .select(
      "id, care_recipient_id, session_id, created_by, body, created_at",
    )
    .single();

  if (error) throw error;
  return mapNote(data);
}

export async function finishOnShiftWithHandoff(input: {
  sessionId: string;
  handoffTo: string | null;
  shiftLabel: string;
  note: string;
  openTaskSnapshot: Array<Record<string, unknown>>;
  completedTaskSnapshot: Array<Record<string, unknown>>;
  briefingWindowStart: string;
  medicationActivitySnapshot: HandoffMedicationSnapshot[];
  communicationSnapshot: HandoffCommunicationSnapshot[];
  coordinationSnapshot: HandoffCoordinationSnapshot[];
  nextAppointmentSnapshot: HandoffAppointmentSnapshot | null;
  followUpSnapshot: HandoffFollowUpSnapshot[];
}) {
  const { data, error } = await supabase.rpc(
    "finish_on_shift_with_handoff",
    {
      p_session_id: input.sessionId,
      p_handoff_to: input.handoffTo,
      p_shift_label: input.shiftLabel.trim() || "Caregiver handoff",
      p_note: input.note.trim() || null,
      p_open_task_snapshot: input.openTaskSnapshot,
      p_completed_task_snapshot: input.completedTaskSnapshot,
      p_briefing_window_start: input.briefingWindowStart,
      p_medication_activity_snapshot: input.medicationActivitySnapshot,
      p_communication_snapshot: input.communicationSnapshot,
      p_coordination_snapshot: input.coordinationSnapshot,
      p_next_appointment_snapshot: input.nextAppointmentSnapshot,
      p_follow_up_snapshot: input.followUpSnapshot,
    },
  );

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.handoff_id || !row?.ended_at) {
    throw new Error("The shift could not be closed.");
  }

  return {
    handoffId: String(row.handoff_id),
    endedAt: String(row.ended_at),
  };
}

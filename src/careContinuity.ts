import { supabase } from "./supabase";
import type {
  CaregiverShiftSession,
  CaregiverShiftSessionNote,
} from "./onShiftCaregiver";
import {
  loadCareShiftHandoffAcknowledgements,
  loadCareShiftHandoffs,
  type CareShiftHandoff,
  type CareShiftHandoffAcknowledgement,
} from "./shiftBoard";
import {
  loadShiftAttendance,
  type CareShiftAttendance,
} from "./shiftAttendance";

export type CareContinuityData = {
  sessions: CaregiverShiftSession[];
  notes: CaregiverShiftSessionNote[];
  handoffs: CareShiftHandoff[];
  acknowledgements: CareShiftHandoffAcknowledgement[];
  attendance: CareShiftAttendance[];
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

export async function loadCareContinuityData(
  careRecipientId: string,
): Promise<CareContinuityData> {
  const [
    sessionsResult,
    notesResult,
    handoffs,
    acknowledgements,
    attendance,
  ] = await Promise.all([
    supabase
      .from("caregiver_shift_sessions")
      .select(
        "id, care_recipient_id, caregiver_id, source_handoff_id, source_acknowledgement_id, started_at, ended_at, end_note, outgoing_handoff_id, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("started_at", { ascending: false })
      .limit(80),
    supabase
      .from("caregiver_shift_session_notes")
      .select(
        "id, care_recipient_id, session_id, created_by, body, created_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: false })
      .limit(160),
    loadCareShiftHandoffs(careRecipientId),
    loadCareShiftHandoffAcknowledgements(careRecipientId),
    loadShiftAttendance(careRecipientId),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (notesResult.error) throw notesResult.error;

  return {
    sessions: (sessionsResult.data ?? []).map(mapSession),
    notes: (notesResult.data ?? []).map(mapNote),
    handoffs,
    acknowledgements,
    attendance,
  };
}

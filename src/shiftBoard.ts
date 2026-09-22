import { supabase } from "./supabase";
import type { CareTask, CareTaskCompletion } from "./careTasks";
import type {
  HandoffAppointmentSnapshot,
  HandoffCommunicationSnapshot,
  HandoffCoordinationSnapshot,
  HandoffFollowUpSnapshot,
  HandoffMedicationSnapshot,
} from "./shiftBriefingHelpers";

export type CareShiftHandoff = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  handoffTo: string | null;
  shiftLabel: string;
  note: string;
  openTaskSnapshot: Array<Record<string, unknown>>;
  completedTaskSnapshot: Array<Record<string, unknown>>;
  briefingVersion: number;
  briefingWindowStart: string | null;
  medicationActivitySnapshot: HandoffMedicationSnapshot[];
  communicationSnapshot: HandoffCommunicationSnapshot[];
  coordinationSnapshot: HandoffCoordinationSnapshot[];
  nextAppointmentSnapshot: HandoffAppointmentSnapshot | null;
  followUpSnapshot: HandoffFollowUpSnapshot[];
  createdAt: string;
};

function mapHandoff(row: any): CareShiftHandoff {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    handoffTo: row.handoff_to ?? null,
    shiftLabel: row.shift_label,
    note: row.note ?? "",
    openTaskSnapshot: Array.isArray(row.open_task_snapshot)
      ? row.open_task_snapshot
      : [],
    completedTaskSnapshot: Array.isArray(row.completed_task_snapshot)
      ? row.completed_task_snapshot
      : [],
    briefingVersion: Number(row.briefing_version ?? 1),
    briefingWindowStart: row.briefing_window_start ?? null,
    medicationActivitySnapshot: Array.isArray(row.medication_activity_snapshot)
      ? row.medication_activity_snapshot
      : [],
    communicationSnapshot: Array.isArray(row.communication_snapshot)
      ? row.communication_snapshot
      : [],
    coordinationSnapshot: Array.isArray(row.coordination_snapshot)
      ? row.coordination_snapshot
      : [],
    nextAppointmentSnapshot:
      row.next_appointment_snapshot &&
      typeof row.next_appointment_snapshot === "object"
        ? row.next_appointment_snapshot
        : null,
    followUpSnapshot: Array.isArray(row.follow_up_snapshot)
      ? row.follow_up_snapshot
      : [],
    createdAt: row.created_at,
  };
}

export async function loadCareShiftHandoffs(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_shift_handoffs")
    .select(
      "id, care_recipient_id, created_by, handoff_to, shift_label, note, open_task_snapshot, completed_task_snapshot, briefing_version, briefing_window_start, medication_activity_snapshot, communication_snapshot, coordination_snapshot, next_appointment_snapshot, follow_up_snapshot, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []).map(mapHandoff);
}

export async function createCareShiftHandoff(input: {
  careRecipientId: string;
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("care_shift_handoffs")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: user.id,
      handoff_to: input.handoffTo,
      shift_label: input.shiftLabel.trim() || "Caregiver handoff",
      note: input.note.trim() || null,
      open_task_snapshot: input.openTaskSnapshot,
      completed_task_snapshot: input.completedTaskSnapshot,
      briefing_version: 2,
      briefing_window_start: input.briefingWindowStart,
      medication_activity_snapshot: input.medicationActivitySnapshot,
      communication_snapshot: input.communicationSnapshot,
      coordination_snapshot: input.coordinationSnapshot,
      next_appointment_snapshot: input.nextAppointmentSnapshot,
      follow_up_snapshot: input.followUpSnapshot,
    })
    .select(
      "id, care_recipient_id, created_by, handoff_to, shift_label, note, open_task_snapshot, completed_task_snapshot, briefing_version, briefing_window_start, medication_activity_snapshot, communication_snapshot, coordination_snapshot, next_appointment_snapshot, follow_up_snapshot, created_at",
    )
    .single();

  if (error) throw error;
  return mapHandoff(data);
}

export async function reassignCareTask(
  careRecipientId: string,
  taskId: string,
  assignedTo: string | null,
) {
  const { error } = await supabase
    .from("care_tasks")
    .update({
      assigned_to: assignedTo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId)
    .eq("status", "open");

  if (error) throw error;
}

export function openTasksForShift(tasks: CareTask[]) {
  return tasks.filter((task) => task.status === "open");
}

export function todayCompletions(
  completions: CareTaskCompletion[],
  now = new Date(),
) {
  return completions.filter((item) => {
    const value = new Date(item.completedAt);
    return (
      value.getFullYear() === now.getFullYear() &&
      value.getMonth() === now.getMonth() &&
      value.getDate() === now.getDate()
    );
  });
}

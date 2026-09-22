import { supabase } from "./supabase";
import type { CareTask, CareTaskCompletion } from "./careTasks";

export type CareShiftHandoff = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  handoffTo: string | null;
  shiftLabel: string;
  note: string;
  openTaskSnapshot: Array<Record<string, unknown>>;
  completedTaskSnapshot: Array<Record<string, unknown>>;
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
    createdAt: row.created_at,
  };
}

export async function loadCareShiftHandoffs(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_shift_handoffs")
    .select(
      "id, care_recipient_id, created_by, handoff_to, shift_label, note, open_task_snapshot, completed_task_snapshot, created_at",
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
    })
    .select(
      "id, care_recipient_id, created_by, handoff_to, shift_label, note, open_task_snapshot, completed_task_snapshot, created_at",
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

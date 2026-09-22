import { supabase } from "./supabase";
import type {
  CareTaskAssignment,
  CareTaskAssignmentStatus,
} from "./careTaskAssignmentHelpers";

function mapAssignment(row: any): CareTaskAssignment {
  return {
    id: row.id,
    taskId: row.task_id,
    careRecipientId: row.care_recipient_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by ?? null,
    status: row.status as CareTaskAssignmentStatus,
    responseNote: row.response_note ?? "",
    respondedAt: row.responded_at ?? null,
    supersededAt: row.superseded_at ?? null,
    createdAt: row.created_at,
  };
}

export async function loadCareTaskAssignments(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_task_assignments")
    .select(
      "id, task_id, care_recipient_id, assigned_to, assigned_by, status, response_note, responded_at, superseded_at, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw error;
  return (data ?? []).map(mapAssignment);
}

export async function respondCareTaskAssignment(input: {
  assignmentId: string;
  response: "accepted" | "declined";
  note?: string;
}) {
  const { data, error } = await supabase.functions.invoke("task-assignment", {
    body: {
      assignmentId: input.assignmentId,
      response: input.response,
      note: input.note?.trim() || "",
    },
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as {
    ok: true;
    assignmentId: string;
    taskId: string;
    status: "accepted" | "declined";
  };
}

export async function claimCareTask(
  careRecipientId: string,
  taskId: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("care_tasks")
    .update({
      assigned_to: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId)
    .eq("status", "open")
    .is("assigned_to", null)
    .select("id, assigned_to")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      "This task is no longer unassigned. Refresh the shared care plan.",
    );
  }

  return {
    taskId: data.id as string,
    assignedTo: data.assigned_to as string,
  };
}

import { supabase } from "./supabase";
import type {
  CareTaskCategory,
  CareTaskPriority,
  CareTaskRecurrence,
  CareTaskStatus,
} from "./careTaskHelpers";

export type CareTask = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  assignedTo: string | null;
  category: CareTaskCategory;
  title: string;
  details: string;
  dueAt: string;
  timezone: string;
  recurrence: CareTaskRecurrence;
  priority: CareTaskPriority;
  status: CareTaskStatus;
  medicationId: string | null;
  appointmentId: string | null;
  contactId: string | null;
  communicationId: string | null;
  lastCompletedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareTaskInput = {
  assignedTo: string | null;
  category: CareTaskCategory;
  title: string;
  details: string;
  dueAt: string;
  timezone: string;
  recurrence: CareTaskRecurrence;
  priority: CareTaskPriority;
  medicationId: string | null;
  appointmentId: string | null;
  contactId: string | null;
  communicationId: string | null;
};

export type CareTaskCompletion = {
  id: string;
  taskId: string;
  careRecipientId: string;
  completedBy: string | null;
  completedAt: string;
  note: string;
  createdAt: string;
};

const taskFields =
  "id, care_recipient_id, created_by, assigned_to, category, title, details, due_at, timezone, recurrence, priority, status, medication_id, appointment_id, contact_id, communication_id, last_completed_at, completed_at, cancelled_at, created_at, updated_at";

function mapTask(row: any): CareTask {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    assignedTo: row.assigned_to ?? null,
    category: row.category as CareTaskCategory,
    title: row.title,
    details: row.details ?? "",
    dueAt: row.due_at,
    timezone: row.timezone,
    recurrence: row.recurrence as CareTaskRecurrence,
    priority: row.priority as CareTaskPriority,
    status: row.status as CareTaskStatus,
    medicationId: row.medication_id ?? null,
    appointmentId: row.appointment_id ?? null,
    contactId: row.contact_id ?? null,
    communicationId: row.communication_id ?? null,
    lastCompletedAt: row.last_completed_at ?? null,
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCompletion(row: any): CareTaskCompletion {
  return {
    id: row.id,
    taskId: row.task_id,
    careRecipientId: row.care_recipient_id,
    completedBy: row.completed_by ?? null,
    completedAt: row.completed_at,
    note: row.note ?? "",
    createdAt: row.created_at,
  };
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function taskPayload(input: CareTaskInput) {
  return {
    assigned_to: input.assignedTo,
    category: input.category,
    title: input.title.trim(),
    details: clean(input.details),
    due_at: input.dueAt,
    timezone: input.timezone,
    recurrence: input.recurrence,
    priority: input.priority,
    medication_id: input.medicationId,
    appointment_id: input.appointmentId,
    contact_id: input.contactId,
    communication_id: input.communicationId,
    updated_at: new Date().toISOString(),
  };
}

export async function currentCareTaskUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

export async function loadCareTasks(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_tasks")
    .select(taskFields)
    .eq("care_recipient_id", careRecipientId)
    .order("due_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapTask);
}

export async function loadCareTaskCompletions(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_task_completions")
    .select("id, task_id, care_recipient_id, completed_by, completed_at, note, created_at")
    .eq("care_recipient_id", careRecipientId)
    .order("completed_at", { ascending: false })
    .limit(80);

  if (error) throw error;
  return (data ?? []).map(mapCompletion);
}

export async function createCareTask(
  careRecipientId: string,
  input: CareTaskInput,
) {
  const userId = await currentCareTaskUserId();

  const { data, error } = await supabase
    .from("care_tasks")
    .insert({
      care_recipient_id: careRecipientId,
      created_by: userId,
      ...taskPayload(input),
    })
    .select(taskFields)
    .single();

  if (error) throw error;
  return mapTask(data);
}

export async function updateCareTask(
  careRecipientId: string,
  taskId: string,
  input: CareTaskInput,
) {
  const { data, error } = await supabase
    .from("care_tasks")
    .update(taskPayload(input))
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId)
    .select(taskFields)
    .single();

  if (error) throw error;
  return mapTask(data);
}

export async function completeCareTask(
  careRecipientId: string,
  taskId: string,
  note: string,
) {
  const userId = await currentCareTaskUserId();

  const { data, error } = await supabase
    .from("care_task_completions")
    .insert({
      task_id: taskId,
      care_recipient_id: careRecipientId,
      completed_by: userId,
      note: clean(note),
    })
    .select("id, task_id, care_recipient_id, completed_by, completed_at, note, created_at")
    .single();

  if (error) throw error;
  return mapCompletion(data);
}

export async function cancelCareTask(
  careRecipientId: string,
  taskId: string,
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("care_tasks")
    .update({
      status: "cancelled",
      cancelled_at: now,
      completed_at: null,
      updated_at: now,
    })
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export async function reopenCareTask(
  careRecipientId: string,
  taskId: string,
) {
  const { error } = await supabase
    .from("care_tasks")
    .update({
      status: "open",
      cancelled_at: null,
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export async function deleteCareTask(
  careRecipientId: string,
  taskId: string,
) {
  const { error } = await supabase
    .from("care_tasks")
    .delete()
    .eq("id", taskId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

import { supabase } from "./supabase";
import {
  type CareReminder,
  type ReminderNotifyScope,
  type ReminderRecurrence,
  type ReminderType,
} from "./reminderHelpers";

export {
  detectedTimezone,
  localDateTimeToIso,
  reminderLocalParts,
  reminderStatus,
} from "./reminderHelpers";
export type {
  CareReminder,
  ReminderNotifyScope,
  ReminderRecurrence,
  ReminderType,
} from "./reminderHelpers";

function mapReminder(row: any): CareReminder {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    createdBy: row.created_by ?? null,
    title: row.title,
    note: row.note ?? "",
    reminderType: row.reminder_type as ReminderType,
    scheduledFor: row.scheduled_for,
    timezone: row.timezone,
    recurrence: row.recurrence as ReminderRecurrence,
    notifyScope: row.notify_scope as ReminderNotifyScope,
    completedAt: row.completed_at ?? null,
    dismissedAt: row.dismissed_at ?? null,
    snoozedUntil: row.snoozed_until ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadCareReminders(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_reminders")
    .select(
      "id, care_recipient_id, created_by, title, note, reminder_type, scheduled_for, timezone, recurrence, notify_scope, completed_at, dismissed_at, snoozed_until, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("scheduled_for", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapReminder);
}

export async function createCareReminder(input: {
  careRecipientId: string;
  title: string;
  note: string;
  reminderType: ReminderType;
  scheduledFor: string;
  timezone: string;
  recurrence: ReminderRecurrence;
  notifyScope: ReminderNotifyScope;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("care_reminders")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: user.id,
      title: input.title.trim(),
      note: input.note.trim() || null,
      reminder_type: input.reminderType,
      scheduled_for: input.scheduledFor,
      timezone: input.timezone,
      recurrence: input.recurrence,
      notify_scope: input.notifyScope,
    })
    .select(
      "id, care_recipient_id, created_by, title, note, reminder_type, scheduled_for, timezone, recurrence, notify_scope, completed_at, dismissed_at, snoozed_until, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapReminder(data);
}

export async function updateCareReminder(
  reminderId: string,
  values: {
    title: string;
    note: string;
    reminderType: ReminderType;
    scheduledFor: string;
    timezone: string;
    recurrence: ReminderRecurrence;
    notifyScope: ReminderNotifyScope;
  },
) {
  const { data, error } = await supabase
    .from("care_reminders")
    .update({
      title: values.title.trim(),
      note: values.note.trim() || null,
      reminder_type: values.reminderType,
      scheduled_for: values.scheduledFor,
      timezone: values.timezone,
      recurrence: values.recurrence,
      notify_scope: values.notifyScope,
      completed_at: null,
      dismissed_at: null,
      snoozed_until: null,
    })
    .eq("id", reminderId)
    .select(
      "id, care_recipient_id, created_by, title, note, reminder_type, scheduled_for, timezone, recurrence, notify_scope, completed_at, dismissed_at, snoozed_until, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapReminder(data);
}

export async function snoozeCareReminder(reminderId: string, minutes: number) {
  const value = new Date(Date.now() + minutes * 60_000).toISOString();

  const { error } = await supabase
    .from("care_reminders")
    .update({
      snoozed_until: value,
      last_fired_for: null,
      completed_at: null,
      dismissed_at: null,
    })
    .eq("id", reminderId);

  if (error) throw error;
  return value;
}

export async function completeCareReminder(reminderId: string) {
  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("care_reminders")
    .update({ completed_at: completedAt })
    .eq("id", reminderId);

  if (error) throw error;
  return completedAt;
}

export async function dismissCareReminder(reminderId: string) {
  const dismissedAt = new Date().toISOString();
  const { error } = await supabase
    .from("care_reminders")
    .update({ dismissed_at: dismissedAt })
    .eq("id", reminderId);

  if (error) throw error;
  return dismissedAt;
}

export async function deleteCareReminder(reminderId: string) {
  const { error } = await supabase
    .from("care_reminders")
    .delete()
    .eq("id", reminderId);

  if (error) throw error;
}

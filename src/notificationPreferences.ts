import { supabase } from "./supabase";

export type NotificationPreferences = {
  pushEnabled: boolean;
  reminderPush: boolean;
  supportPush: boolean;
  coachingPush: boolean;
  careTeamPush: boolean;
  taskPush: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

export function notificationTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function defaults(): NotificationPreferences {
  return {
    pushEnabled: false,
    reminderPush: true,
    supportPush: true,
    coachingPush: true,
    careTeamPush: true,
    taskPush: true,
    quietHoursEnabled: false,
    quietStart: "22:00",
    quietEnd: "07:00",
    timezone: notificationTimezone(),
  };
}

function mapRow(row: any): NotificationPreferences {
  return {
    pushEnabled: Boolean(row.push_enabled),
    reminderPush: Boolean(row.reminder_push),
    supportPush: Boolean(row.support_push),
    coachingPush: Boolean(row.coaching_push),
    careTeamPush: Boolean(row.care_team_push),
    taskPush: row.task_push === undefined ? true : Boolean(row.task_push),
    quietHoursEnabled: Boolean(row.quiet_hours_enabled),
    quietStart: String(row.quiet_start ?? "22:00").slice(0, 5),
    quietEnd: String(row.quiet_end ?? "07:00").slice(0, 5),
    timezone: row.timezone || notificationTimezone(),
  };
}

export async function loadNotificationPreferences() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "push_enabled, reminder_push, support_push, coaching_push, care_team_push, task_push, quiet_hours_enabled, quiet_start, quiet_end, timezone",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return mapRow(data);

  const initial = defaults();
  const { data: created, error: createError } = await supabase
    .from("notification_preferences")
    .insert({
      user_id: user.id,
      push_enabled: initial.pushEnabled,
      reminder_push: initial.reminderPush,
      support_push: initial.supportPush,
      coaching_push: initial.coachingPush,
      care_team_push: initial.careTeamPush,
      task_push: initial.taskPush,
      quiet_hours_enabled: initial.quietHoursEnabled,
      quiet_start: initial.quietStart,
      quiet_end: initial.quietEnd,
      timezone: initial.timezone,
    })
    .select(
      "push_enabled, reminder_push, support_push, coaching_push, care_team_push, quiet_hours_enabled, quiet_start, quiet_end, timezone",
    )
    .single();

  if (createError) throw createError;
  return mapRow(created);
}

export async function saveNotificationPreferences(
  next: NotificationPreferences,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: user.id,
      push_enabled: next.pushEnabled,
      reminder_push: next.reminderPush,
      support_push: next.supportPush,
      coaching_push: next.coachingPush,
      care_team_push: next.careTeamPush,
      task_push: next.taskPush,
      quiet_hours_enabled: next.quietHoursEnabled,
      quiet_start: next.quietHoursEnabled ? next.quietStart : null,
      quiet_end: next.quietHoursEnabled ? next.quietEnd : null,
      timezone: next.timezone || notificationTimezone(),
    })
    .select(
      "push_enabled, reminder_push, support_push, coaching_push, care_team_push, quiet_hours_enabled, quiet_start, quiet_end, timezone",
    )
    .single();

  if (error) throw error;
  return mapRow(data);
}

export function validQuietTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

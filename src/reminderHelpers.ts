export type ReminderType =
  | "general"
  | "appointment"
  | "transition"
  | "medication_record";

export type ReminderRecurrence = "none" | "daily" | "weekly";
export type ReminderNotifyScope = "creator" | "care_team";

export type CareReminder = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  title: string;
  note: string;
  reminderType: ReminderType;
  scheduledFor: string;
  timezone: string;
  recurrence: ReminderRecurrence;
  notifyScope: ReminderNotifyScope;
  completedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
};

export function detectedTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function localDateTimeToIso(date: string, time: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time.trim())) return null;

  const [, y, m, d] = match.map(Number);
  const [hour, minute] = time.trim().split(":").map(Number);
  const value = new Date(y, m - 1, d, hour, minute, 0, 0);

  if (
    value.getFullYear() !== y ||
    value.getMonth() !== m - 1 ||
    value.getDate() !== d ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute
  ) {
    return null;
  }

  return value.toISOString();
}

export function reminderLocalParts(iso: string) {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return { date: "", time: "" };

  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

export function reminderStatus(reminder: CareReminder, now = new Date()) {
  if (reminder.completedAt) return "completed" as const;
  if (reminder.dismissedAt) return "dismissed" as const;

  const due = new Date(reminder.snoozedUntil ?? reminder.scheduledFor);
  if (Number.isFinite(due.getTime()) && due.getTime() <= now.getTime()) {
    return "due" as const;
  }

  return "upcoming" as const;
}

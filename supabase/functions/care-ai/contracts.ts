// Pure AI draft validation: safe to load in Node tests without mobile/Supabase bootstrapping.
export type ReminderDraft = {
  type: "create_reminder";
  title: string;
  note: string;
  date: string;
  time: string;
  recurrence: "none" | "daily" | "weekly";
};
export type NoteDraft = { type: "add_care_note"; summary: string; notes: string };
export type AssistantDraft = ReminderDraft | NoteDraft;
export type AssistantHistory = { role: "user" | "assistant"; content: string };
export type CareAIAnswer = { reply: string; action: AssistantDraft | null; resource?: ToolkitResource; suggestions?: string[]; trends?: CareTrends };

const trimmed = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

export function validateAssistantDraft(value: unknown): AssistantDraft | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  if (a.type === "create_reminder") {
    const title = trimmed(a.title, 140);
    const note = trimmed(a.note, 1000);
    const date = trimmed(a.date, 10);
    const time = trimmed(a.time, 5);
    const recurrence = a.recurrence;
    if (!title || !isCalendarDate(date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    return {
      type: "create_reminder", title, note, date, time,
      recurrence: recurrence === "daily" || recurrence === "weekly" ? recurrence : "none",
    };
  }
  if (a.type === "add_care_note") {
    const summary = trimmed(a.summary, 180);
    if (!summary) return null;
    return { type: "add_care_note", summary, notes: trimmed(a.notes, 1400) };
  }
  return null;
}


export const toolkitDestinations = [
  "Appointments", "CareCalendar", "CareTasks", "CarePlan", "CareCommunicationLog",
  "CareContacts", "CareDocuments", "CareTeam", "Emergency", "Wellness", "PrivacyData",
  "Accessibility", "Medications", "Resources", "Summary", "Transition",
] as const;
export type ToolkitDestination = typeof toolkitDestinations[number];
export type ToolkitResource = { label: string; destination: ToolkitDestination };
export function validateToolkitResource(value: unknown): ToolkitResource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (!toolkitDestinations.includes(v.destination as ToolkitDestination)) return undefined;
  const label = trimmed(v.label, 70);
  return label ? { label, destination: v.destination as ToolkitDestination } : undefined;
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type CareTrends = {
  updatedAt: string; timezone: string;
  days: { date: string; notes: number; completedReminders: number }[];
};
export function validateCareTrends(value: unknown): CareTrends | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as CareTrends;
  if (!Array.isArray(v.days) || v.days.length !== 7 || !Number.isFinite(Date.parse(v.updatedAt)) || typeof v.timezone !== "string") return undefined;
  try { new Intl.DateTimeFormat("en", {timeZone: v.timezone}); } catch { return undefined; }
  if (!v.days.every((d, i) => d && typeof d === "object" && typeof d.date === "string" && isCalendarDate(d.date) && (!i || d.date > v.days[i-1].date) &&
    [d.notes, d.completedReminders].every(n => Number.isSafeInteger(n) && n >= 0))) return undefined;
  return { updatedAt: v.updatedAt, timezone: v.timezone, days: v.days.map(d => ({date:d.date, notes:d.notes, completedReminders:d.completedReminders})) };
}

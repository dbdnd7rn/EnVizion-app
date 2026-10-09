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
export type CareAIAnswer = { reply: string; action: AssistantDraft | null };

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
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
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


import { supabase } from "../supabase";
import { detectedTimezone } from "../reminders";

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

export async function askCareAI(input: {
  message: string;
  history: AssistantHistory[];
  careRecipientId: string | null;
  includeCareData: boolean;
}): Promise<CareAIAnswer> {
  const message = input.message.trim().slice(0, 1800);
  if (!message) throw new Error("Enter a message before sending.");
  if (input.includeCareData && !input.careRecipientId)
    throw new Error("Select a care profile before sharing its information.");

  const { data, error } = await supabase.functions.invoke("care-ai", {
    body: {
      message, history: input.history.slice(-12).map((turn) => ({
        role: turn.role, content: turn.content.slice(0, 1800),
      })),
      includeCareData: input.includeCareData,
      careRecipientId: input.includeCareData ? input.careRecipientId : null,
      timezone: detectedTimezone(),
    },
  });

  if (error) {
    let explanation = "The AI couldn't connect. Check your connection and try again.";
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json() as { error?: unknown };
        if (typeof body?.error === "string") explanation = body.error;
      } catch { /* Network errors may not have a JSON body. */ }
    }
    throw new Error(explanation);
  }
  const reply = trimmed(data?.reply, 3500);
  if (!reply) throw new Error("The assistant returned no answer. Please retry.");
  return {
    reply,
    // No AI draft is executable. The UI always requires explicit confirmation.
    action: input.includeCareData ? validateAssistantDraft(data?.action) : null,
  };
}

import { supabase } from "../supabase";
import { detectedTimezone } from "../reminders";
import { validateAssistantDraft, type AssistantDraft } from "./validateAssistantDraft";
export { validateAssistantDraft } from "./validateAssistantDraft";
export type { ReminderDraft, NoteDraft, AssistantDraft, AssistantHistory, CareAIAnswer } from "./validateAssistantDraft";

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
  const reply = typeof data?.reply === "string" ? data.reply.trim().slice(0, 3500) : "";
  if (!reply) throw new Error("The assistant returned no answer. Please retry.");
  return {
    reply,
    // No AI draft is executable. The UI always requires explicit confirmation.
    action: input.includeCareData ? validateAssistantDraft(data?.action) : null,
  };
}

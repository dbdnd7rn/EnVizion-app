import { supabase } from "../supabase";
import { detectedTimezone } from "../reminders";
import { toolkitReply } from "../../supabase/functions/care-ai/toolkit";
import { validateAssistantDraft, validateToolkitResource, validateCareTrends, type AssistantHistory, type CareAIAnswer } from "./validateAssistantDraft";
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

  // General toolkit guidance contains no private profile information. Run the
  // same reviewed deterministic engine on-device so greetings and app-help
  // work even with a slow or temporarily disconnected network.
  if (!input.includeCareData) {
    const local = toolkitReply(message, input.history.slice(-12), {
      includeCareData: false,
      canDraft: false,
      timezone: detectedTimezone(),
      now: new Date(),
      records: {},
    });
    return {
      reply: local.reply,
      resource: validateToolkitResource(local.resource),
      suggestions: local.suggestions?.filter(s => typeof s === "string" && s.length <= 80).slice(0, 3),
      action: null,
    };
  }

  // Care-profile answers must always be authenticated and RLS-scoped on
  // Supabase. Never substitute mock data or an offline clinical answer.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let data: any;
  let error: any;
  try {
    ({ data, error } = await Promise.race([
      supabase.functions.invoke("care-ai", {
    body: {
      message, history: input.history.slice(-12).map((turn) => ({
        role: turn.role, content: turn.content.slice(0, 1800),
      })),
      includeCareData: input.includeCareData,
      careRecipientId: input.includeCareData ? input.careRecipientId : null,
      timezone: detectedTimezone(),
    },
    signal: controller.signal,
  }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Live care information is taking too long to respond. Please check your connection and retry. No care records were changed."));
        }, 15000);
      }),
    ]));
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  if (error) {
    let explanation = "Live care information is temporarily unavailable. Check your connection and retry. No care records were changed.";
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
    trends: input.includeCareData ? validateCareTrends(data?.trends) : undefined,
    suggestions: Array.isArray(data?.suggestions) ? data.suggestions.filter((s: unknown) => typeof s === "string" && s.length <= 80).slice(0, 3) : [],
    resource: validateToolkitResource(data?.resource),
    // No AI draft is executable. The UI always requires explicit confirmation.
    action: input.includeCareData ? validateAssistantDraft(data?.action) : null,
  };
}

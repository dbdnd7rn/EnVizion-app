// Shared pure contract used by the app and the provider-free server assistant.
export {
  validateAssistantDraft, validateToolkitResource,
  type ReminderDraft, type NoteDraft, type AssistantDraft,
  type AssistantHistory, type CareAIAnswer, type ToolkitResource,
} from "../../supabase/functions/care-ai/contracts.ts";

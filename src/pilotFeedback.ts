import { Platform } from "react-native";
import { submitTechnicalDiagnostic } from "./diagnostics";
import { supabase } from "./supabase";

export type PilotFeedbackCategory = "bug" | "experience" | "suggestion";

export async function submitPilotFeedback(input: {
  category: PilotFeedbackCategory;
  summary: string;
  detail: string;
  careRecipientId?: string | null;
}) {
  const summary = input.summary.trim();
  const detail = input.detail.trim();

  if (!summary || !detail) {
    throw new Error("Add a short summary and a little detail before sending.");
  }

  if (input.category === "bug") {
    return submitTechnicalDiagnostic({
      careRecipientId: input.careRecipientId ?? null,
      area: "pilot_feedback_bug",
      summary,
      details: {
        feedback: detail,
        source: "pilot_feedback",
        platform: Platform.OS,
      },
    });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const topic =
    input.category === "experience"
      ? "Pilot feedback · Experience"
      : "Pilot feedback · Suggestion";

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      care_recipient_id: input.careRecipientId ?? null,
      topic,
      context: summary + "\n\n" + detail,
      preferred_channel: "In-app inbox",
      include_assistant_context: false,
      status: "submitted",
    })
    .select("id, created_at")
    .single();

  if (error) throw error;

  return {
    id: String(data.id),
    createdAt: String(data.created_at),
  };
}

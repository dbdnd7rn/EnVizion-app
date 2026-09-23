import { Platform } from "react-native";
import { supabase } from "./supabase";

export async function submitTechnicalDiagnostic(input: {
  careRecipientId?: string | null;
  area: string;
  summary: string;
  details?: Record<string, unknown>;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("app_diagnostic_reports")
    .insert({
      user_id: user.id,
      care_recipient_id: input.careRecipientId ?? null,
      area: input.area.trim().slice(0, 80),
      summary: input.summary.trim().slice(0, 500),
      details: input.details ?? {},
      platform: Platform.OS,
      app_version: "0.1.0",
      status: "open",
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return {
    id: String(data.id),
    createdAt: String(data.created_at),
  };
}

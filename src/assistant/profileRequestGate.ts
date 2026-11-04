import { requestedToolkitRecords, wantsTrends } from "../../supabase/functions/care-ai/toolkit.ts";

export type ProfileRequestGate = "ready" | "select-profile" | "enable-profile";

/** Pure, shared with the UI: do not let profile-only shortcuts fall into a repeated FAQ loop.
 * Consent changes only after the user explicitly turns on profile access.
 */
export function profileRequestGate(
  message: string,
  input: { careRecipientId: string | null; includeCareData: boolean },
): ProfileRequestGate {
  const text = message.trim();
  const needsRecords = wantsTrends(text) || requestedToolkitRecords(text).length > 0 ||
    /\b(?:remind me|set|create|schedule|prepare|draft)\b.{0,35}\breminder\b/i.test(text) ||
    /\b(?:write|add|create|prepare|draft|record)\b.{0,65}\b(?:care |communication )?notes?\b/i.test(text);
  if (!needsRecords) return "ready";
  if (!input.careRecipientId) return "select-profile";
  return input.includeCareData ? "ready" : "enable-profile";
}

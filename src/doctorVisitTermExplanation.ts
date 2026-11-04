import { supabase } from "./supabase";
import {
  parseTermExplanation,
  type TermExplanation,
} from "../supabase/functions/doctor-visit-terms/contracts";

/**
 * Invokes the authenticated Supabase Edge Function.
 * No saved notes, transcript, care profile or identity is included in the body.
 * This never writes a care record or publishes anything to the family feed.
 */
export async function explainDoctorVisitTerm(input: {
  visitId: string;
  term: string;
  context?: string;
}): Promise<TermExplanation> {
  const { data, error } = await supabase.functions.invoke("doctor-visit-terms", {
    body: {
      visitId: input.visitId,
      term: input.term.trim(),
      context: input.context?.trim() ?? "",
      confirmAiSharing: true,
    },
  });
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context && typeof context === "object" && "json" in context) {
      try {
        const details = await (context as Response).json();
        if (details && typeof details.error === "string") {
          throw new Error(details.error);
        }
      } catch (detailError) {
        if (detailError instanceof Error && detailError.message !== "Unexpected end of JSON input") {
          throw detailError;
        }
      }
    }
    throw new Error("The medical term explainer is unavailable. Please retry or ask the clinician.");
  }
  if (data?.error && typeof data.error === "string") throw new Error(data.error);
  const explanation = parseTermExplanation(data?.explanation);
  if (!explanation) throw new Error("The AI response could not be verified. Please try another term.");
  return explanation;
}

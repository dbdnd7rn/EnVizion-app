import { parseTermRequest, type TermExplanation, type TermRequest } from "./contracts.ts";
import { explainKnownMedicalTerm } from "./glossary.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });

type Result = { data: any; error: unknown };
interface ReadQuery extends PromiseLike<Result> {
  select(columns: string): ReadQuery;
  eq(column: string, value: unknown): ReadQuery;
  maybeSingle(): PromiseLike<Result>;
}
export interface ReadClient {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  from(table: string): ReadQuery;
}

/**
 * The caller's JWT is passed to a non-privileged Supabase client.
 * Both the visit and the membership must be readable by that client.
 * Only the two explicitly typed strings are sent to external inference.
 */
export function createMedicalTermHandler(
  makeClient: (authorization: string) => ReadClient,
  explain: (input: TermRequest) => Promise<TermExplanation>,
) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ") || auth.length < 20) {
      return json({ error: "Sign in before explaining a medical term." }, 401);
    }
    try {
      const raw = await req.text();
      if (raw.length > 1800) return json({ error: "Please shorten the medical term and phrase." }, 413);
      let payload: unknown;
      try { payload = JSON.parse(raw); }
      catch { return json({ error: "Please send a valid explanation request." }, 400); }
      const validated = parseTermRequest(payload);
      if (!validated.ok) return json({ error: validated.error }, 400);

      const client = makeClient(auth);
      const { data: { user }, error: authError } = await client.auth.getUser(auth.slice(7));
      if (authError || !user) return json({ error: "Your session has expired. Sign in again." }, 401);

      const { data: visit, error: visitError } = await client
        .from("doctor_visits")
        .select("id,care_recipient_id")
        .eq("id", validated.value.visitId)
        .maybeSingle();
      if (visitError || !visit?.care_recipient_id) {
        return json({ error: "This visit is not accessible to your account." }, 403);
      }

      const { data: member, error: membershipError } = await client
        .from("care_recipient_members")
        .select("role,status")
        .eq("care_recipient_id", visit.care_recipient_id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (membershipError || !member) {
        return json({ error: "Care team access could not be verified." }, 403);
      }

      let explanation: TermExplanation;
      try {
        // No visit records, patient name, provider name or membership data are sent.
        explanation = await explain(validated.value);
        return json({ explanation, source: "ai" });
      } catch (error) {
        // Log ONLY a short operational reason code, never a term, context,
        // model message, patient identifier, access token, or provider response.
        const reason = error instanceof Error ? error.message : "";
        const safeReason = /^AI_(?:NOT_CONFIGURED|INVALID_RESPONSE|PROVIDER_HTTP_[1-5][0-9]{2}|TIMEOUT)$/.test(reason)
          ? reason
          : error instanceof Error && error.name === "AbortError" ? "AI_TIMEOUT" : "AI_UNKNOWN";
        console.error("medical_term_provider_failure", safeReason);
        const glossary = explainKnownMedicalTerm(validated.value.term);
        if (glossary) {
          return json({
            explanation: glossary,
            source: "glossary",
            notice: "The live AI service could not respond. This general definition is from the built-in glossary and does not interpret your visit details.",
          });
        }
        const notConfigured = safeReason === "AI_NOT_CONFIGURED";
        return json({
          error: notConfigured
            ? "The AI provider has not been configured by the app administrator. Try a common term or ask the clinician."
            : "The AI service could not respond. Try another common term or ask the app administrator to check provider access and billing.",
          code: notConfigured ? "AI_NOT_CONFIGURED" : "AI_SERVICE_UNAVAILABLE",
        }, 503);
      }
    } catch {
      return json({ error: "Could not explain this term right now. Please try again." }, 500);
    }
  };
}

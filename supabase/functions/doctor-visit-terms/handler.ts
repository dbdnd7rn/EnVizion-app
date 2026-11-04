import { parseTermRequest, type TermExplanation, type TermRequest } from "./contracts.ts";

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
        // Do not pass visit records, patient name, provider name or member data.
        explanation = await explain(validated.value);
      } catch (error) {
        if (error instanceof Error && error.message === "AI_NOT_CONFIGURED") {
          return json({ error: "Medical term explanations are not configured yet. Ask your clinician for clarification." }, 503);
        }
        return json({ error: "The explainer is temporarily unavailable. Please try again or ask the clinician directly." }, 503);
      }
      return json({ explanation });
    } catch {
      return json({ error: "Could not explain this term right now. Please try again." }, 500);
    }
  };
}

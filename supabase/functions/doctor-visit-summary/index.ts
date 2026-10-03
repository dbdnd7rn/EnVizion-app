import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function cleanList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const model = Deno.env.get("OPENAI_VISIT_MODEL") ?? "gpt-5-mini";

    if (!supabaseUrl || !anonKey) {
      return json({ error: "Server configuration unavailable" }, 500);
    }

    const token = authHeader.replace("Bearer ", "");
    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser(token);

    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const payload = await req.json().catch(() => ({}));
    const visitId = String(payload.visitId ?? "");
    if (!visitId) return json({ error: "Visit is required." }, 400);

    const { data: visit, error: visitError } = await client
      .from("doctor_visits")
      .select(
        "id, care_recipient_id, physician_name, specialty, appointment_datetime, raw_notes, transcript_text",
      )
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return json({ error: "Visit was not found or is not accessible." }, 404);
    }

    const rawNotes = String(visit.raw_notes ?? "").trim();
    const transcript = String(visit.transcript_text ?? "").trim();
    const source = [
      rawNotes && `CAREGIVER NOTES:\n${rawNotes}`,
      transcript && `TRANSCRIPT:\n${transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 30000);

    if (!source) {
      return json(
        { error: "Add visit notes or a transcript before generating a summary." },
        400,
      );
    }

    if (!openAiKey) {
      return json(
        {
          error:
            "AI visit summarization is not configured yet. You can still create a manual summary.",
          code: "AI_NOT_CONFIGURED",
        },
        503,
      );
    }

    const systemPrompt = `You are a medical visit note extraction assistant inside a caregiver coordination app.
Your job is to summarize ONLY what is explicitly present in the supplied caregiver notes or transcript.
Do not diagnose. Do not add medical advice. Do not infer medication changes, orders, red flags, or follow-up instructions.
For red_flags, include only warnings or symptoms that the clinician explicitly said should prompt a call, urgent evaluation, or emergency action.
If something is uncertain, omit it rather than guessing.
Return valid JSON only with this exact shape:
{
  "summary_text": "brief neutral recap",
  "new_orders": ["explicit clinician order or medication change"],
  "action_items": ["explicit next step"],
  "red_flags": ["explicit clinician-stated warning"],
  "generation_notes": "brief note about uncertainty or source limitations"
}`;

    const completionResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Visit with ${visit.physician_name}${visit.specialty ? ` (${visit.specialty})` : ""}.\n\n${source}`,
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!completionResponse.ok) {
      const detail = await completionResponse.text();
      console.error("OpenAI visit summary error", completionResponse.status, detail);
      return json(
        { error: "AI summary could not be generated. Create a manual summary or try again." },
        502,
      );
    }

    const completion = await completionResponse.json();
    const content = completion?.choices?.[0]?.message?.content;
    if (!content) return json({ error: "AI summary returned no content." }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ error: "AI summary could not be parsed safely." }, 502);
    }

    const summaryText = String(parsed.summary_text ?? "").trim().slice(0, 5000);
    const newOrders = cleanList(parsed.new_orders);
    const actionItems = cleanList(parsed.action_items);
    const redFlags = cleanList(parsed.red_flags);
    const generationNotes = String(parsed.generation_notes ?? "")
      .trim()
      .slice(0, 2000);

    await client
      .from("doctor_visit_summaries")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("visit_id", visit.id)
      .eq("status", "draft");

    const { data: summary, error: summaryError } = await client
      .from("doctor_visit_summaries")
      .insert({
        visit_id: visit.id,
        care_recipient_id: visit.care_recipient_id,
        source_type: "ai",
        status: "draft",
        summary_text: summaryText || null,
        new_orders: newOrders,
        action_items: actionItems,
        red_flags: redFlags,
        generation_notes: generationNotes || null,
        model_name: model,
        created_by: user.id,
      })
      .select(
        "id, visit_id, care_recipient_id, source_type, status, summary_text, new_orders, action_items, red_flags, generation_notes, model_name, created_by, created_at, approved_by, approved_at, updated_at",
      )
      .single();

    if (summaryError) throw summaryError;

    await client
      .from("doctor_visits")
      .update({ status: "review", updated_at: new Date().toISOString() })
      .eq("id", visit.id);

    return json({ summary });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected doctor visit summary error",
      },
      500,
    );
  }
});

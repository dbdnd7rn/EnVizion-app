import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { createMedicalTermHandler } from "./handler.ts";
import { generateTermExplanation } from "./model.ts";

Deno.serve(createMedicalTermHandler(
  authorization => createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  ),
  request => generateTermExplanation(
    request,
    Deno.env.get("OPENAI_API_KEY") ?? "",
    Deno.env.get("OPENAI_VISIT_MODEL") || "gpt-5-mini",
  ),
));

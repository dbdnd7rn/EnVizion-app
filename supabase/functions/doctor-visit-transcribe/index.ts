import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function extensionForMime(mime: string) {
  const value = mime.toLowerCase();
  if (value.includes("webm")) return "webm";
  if (value.includes("3gpp")) return "3gp";
  if (value.includes("wav")) return "wav";
  if (value.includes("aac")) return "aac";
  return "m4a";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const openAiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const transcriptionModel =
    Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") ?? "gpt-4o-mini-transcribe";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration unavailable" }, 500);
  }

  if (!openAiKey) {
    return json(
      {
        error:
          "Voice transcription is not configured yet. The recording remains stored securely.",
        code: "AI_NOT_CONFIGURED",
      },
      503,
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) return json({ error: "Invalid session" }, 401);

  try {
    const payload = await req.json().catch(() => ({}));
    const visitId = String(payload.visitId ?? "");
    if (!visitId) return json({ error: "Visit is required." }, 400);

    const { data: visit, error: visitError } = await userClient
      .from("doctor_visits")
      .select(
        "id, care_recipient_id, audio_path, audio_mime_type, audio_size_bytes, transcription_status",
      )
      .eq("id", visitId)
      .single();

    if (visitError || !visit) {
      return json({ error: "Visit was not found or is not accessible." }, 404);
    }

    if (!visit.audio_path) {
      return json({ error: "Record and upload the visit audio first." }, 400);
    }

    const size = Number(visit.audio_size_bytes ?? 0);
    if (size > 24 * 1024 * 1024) {
      return json(
        {
          error:
            "This recording is too large for automatic transcription. The audio is still stored securely; add a transcript manually or record a shorter segment.",
          code: "AUDIO_TOO_LARGE",
        },
        413,
      );
    }

    const now = new Date().toISOString();
    const { data: editable, error: editableError } = await userClient
      .from("doctor_visits")
      .update({
        transcription_status: "processing",
        transcription_error: null,
        updated_at: now,
      })
      .eq("id", visitId)
      .select("id")
      .maybeSingle();

    if (editableError) throw editableError;
    if (!editable?.id) {
      return json({ error: "You do not have permission to transcribe this visit." }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: audioBlob, error: downloadError } = await admin.storage
      .from("doctor-visit-audio")
      .download(visit.audio_path);

    if (downloadError || !audioBlob) {
      await userClient
        .from("doctor_visits")
        .update({
          transcription_status: "failed",
          transcription_error: "Stored audio could not be opened.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visitId);
      return json({ error: "Stored audio could not be opened." }, 500);
    }

    const mime = String(visit.audio_mime_type || audioBlob.type || "audio/mp4");
    const form = new FormData();
    form.append(
      "file",
      audioBlob,
      `doctor-visit.${extensionForMime(mime)}`,
    );
    form.append("model", transcriptionModel);
    form.append("response_format", "json");
    form.append(
      "prompt",
      "Transcribe this medical appointment accurately. Preserve medication names, dosages, clinician names, dates, measurements, and follow-up instructions exactly as spoken. Do not summarize or add medical advice.",
    );

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Visit transcription error", response.status, detail);
      await userClient
        .from("doctor_visits")
        .update({
          transcription_status: "failed",
          transcription_error: "Automatic transcription failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visitId);
      return json(
        {
          error:
            "Automatic transcription failed. The audio is still stored securely.",
        },
        502,
      );
    }

    const transcription = await response.json();
    const text = String(transcription?.text ?? "").trim();

    if (!text) {
      await userClient
        .from("doctor_visits")
        .update({
          transcription_status: "failed",
          transcription_error: "The transcription service returned no text.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", visitId);
      return json({ error: "The transcription returned no text." }, 502);
    }

    const { error: saveError } = await userClient
      .from("doctor_visits")
      .update({
        transcript_text: text.slice(0, 120000),
        transcription_status: "completed",
        transcription_error: null,
        status: "in_visit",
        updated_at: new Date().toISOString(),
      })
      .eq("id", visitId);

    if (saveError) throw saveError;

    return json({
      ok: true,
      visitId,
      transcriptText: text,
      model: transcriptionModel,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected visit transcription error",
      },
      500,
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function jwtSessionId(token: string) {
  try {
    const payload = token.split(".")[1] ?? "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = JSON.parse(atob(padded));
    return String(decoded?.session_id ?? "");
  } catch {
    return "";
  }
}

const roleSteps: Record<string, string[]> = {
  owner: [
    "owner_dashboard",
    "daily_care_plan",
    "medications",
    "emergency_center",
    "document_vault",
    "family_communication",
  ],
  caregiver: [
    "schedule_shift",
    "daily_care_plan",
    "family_communication",
    "care_packet",
    "notifications",
    "handoff",
  ],
  patient: [
    "patient_profile_read",
    "patient_medications_read",
    "patient_visits_read",
    "patient_emergency_read",
    "patient_documents_read",
    "patient_read_only_boundaries",
  ],
  viewer: [
    "profile_read",
    "documents_read",
    "family_updates_read",
    "no_edit_controls",
    "emergency_read",
    "notifications",
  ],
};

const commonDeviceChecks = [
  "navigation_safe",
  "content_not_clipped",
  "text_scaling",
  "keyboard_safe",
  "resume_refresh",
  "offline_state",
  "action_feedback",
];

const platformDeviceChecks: Record<string, string[]> = {
  ios: [...commonDeviceChecks, "ios_safe_area"],
  android: [...commonDeviceChecks, "android_system_nav"],
  web: [...commonDeviceChecks, "responsive_layout"],
};

const drillTypes = new Set([
  "network_reconnect",
  "session_revocation",
  "packet_recovery",
  "notification_recovery",
]);

function allTrue(source: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => source[key] === true);
}

async function pilotContext(admin: any, userId: string) {
  const { data: enrollment, error: enrollmentError } = await admin
    .from("pilot_enrollments")
    .select("user_id, status, cohort")
    .eq("user_id", userId)
    .maybeSingle();

  if (enrollmentError) throw enrollmentError;
  if (!enrollment || enrollment.status !== "active") {
    return { active: false, cohort: "", consentCurrent: false };
  }

  const now = new Date().toISOString();
  const { data: docs, error: docsError } = await admin
    .from("program_documents")
    .select("id")
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${now}`);

  if (docsError) throw docsError;

  const documentIds = (docs ?? []).map((row: any) => row.id);
  if (!documentIds.length) {
    return {
      active: true,
      cohort: enrollment.cohort ?? "",
      consentCurrent: true,
    };
  }

  const { data: accepted, error: acceptedError } = await admin
    .from("user_document_acceptances")
    .select("document_id")
    .eq("user_id", userId)
    .in("document_id", documentIds);

  if (acceptedError) throw acceptedError;

  const acceptedIds = new Set((accepted ?? []).map((row: any) => row.document_id));
  return {
    active: true,
    cohort: enrollment.cohort ?? "",
    consentCurrent: documentIds.every((id: string) => acceptedIds.has(id)),
  };
}

async function activeWave(admin: any, waveId: string, cohort: string) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("pilot_launch_waves")
    .select(
      "id, name, cohort, status, required_platforms, notes, starts_at, ends_at, created_at, updated_at",
    )
    .eq("id", waveId)
    .eq("cohort", cohort)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  if (data.starts_at && data.starts_at > now) return null;
  if (data.ends_at && data.ends_at < now) return null;
  return data;
}

async function activeMembership(
  admin: any,
  userId: string,
  careRecipientId: string,
) {
  const { data, error } = await admin
    .from("care_recipient_members")
    .select("care_recipient_id, user_id, role, status")
    .eq("user_id", userId)
    .eq("care_recipient_id", careRecipientId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  if (!data || !["owner", "caregiver", "patient", "viewer"].includes(data.role)) return null;
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Server configuration unavailable" }, 500);
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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sessionId = jwtSessionId(token);
    if (!sessionId) return json({ error: "Session is no longer active" }, 401);

    const { data: sessionActive, error: sessionError } = await admin.rpc(
      "service_session_is_active",
      {
        target_user_id: user.id,
        target_session_id: sessionId,
      },
    );
    if (sessionError || sessionActive !== true) {
      return json({ error: "Session is no longer active" }, 401);
    }

    const context = await pilotContext(admin, user.id);
    if (!context.active) return json({ error: "Active pilot enrollment required" }, 403);
    if (!context.consentCurrent) {
      return json({ error: "Required pilot documents must be accepted first" }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "");

    if (action === "workspace") {
      const now = new Date().toISOString();
      const { data: waves, error: waveError } = await admin
        .from("pilot_launch_waves")
        .select(
          "id, name, cohort, status, required_platforms, notes, starts_at, ends_at, created_at, updated_at",
        )
        .eq("cohort", context.cohort)
        .eq("status", "active")
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("created_at", { ascending: false });

      if (waveError) throw waveError;
      const waveIds = (waves ?? []).map((row: any) => row.id);

      const { data: memberships, error: memberError } = await admin
        .from("care_recipient_members")
        .select("care_recipient_id, role")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["owner", "caregiver", "patient", "viewer"]);

      if (memberError) throw memberError;
      const recipientIds = (memberships ?? []).map((row: any) => row.care_recipient_id);

      const { data: recipients, error: recipientError } = recipientIds.length
        ? await admin
            .from("care_recipients")
            .select("id, display_name")
            .in("id", recipientIds)
        : { data: [], error: null };
      if (recipientError) throw recipientError;

      const recipientMap = new Map(
        (recipients ?? []).map((row: any) => [row.id, row.display_name || "Care profile"]),
      );

      const { data: runs, error: runError } = waveIds.length
        ? await admin
            .from("pilot_acceptance_runs")
            .select(
              "id, wave_id, care_recipient_id, role, platform, device_class, app_version, steps, device_checks, status, notes, started_at, completed_at, updated_at",
            )
            .eq("tester_user_id", user.id)
            .in("wave_id", waveIds)
            .order("started_at", { ascending: false })
        : { data: [], error: null };
      if (runError) throw runError;

      const { data: drills, error: drillError } = waveIds.length
        ? await admin
            .from("pilot_recovery_drills")
            .select(
              "id, wave_id, drill_type, status, evidence, notes, performed_at",
            )
            .eq("tester_user_id", user.id)
            .in("wave_id", waveIds)
            .order("performed_at", { ascending: false })
        : { data: [], error: null };
      if (drillError) throw drillError;

      return json({
        cohort: context.cohort,
        waves: waves ?? [],
        profiles: (memberships ?? []).map((row: any) => ({
          careRecipientId: row.care_recipient_id,
          displayName: recipientMap.get(row.care_recipient_id) ?? "Care profile",
          role: row.role,
        })),
        runs: runs ?? [],
        drills: drills ?? [],
      });
    }

    if (action === "start_acceptance") {
      const waveId = String(payload.waveId ?? "");
      const careRecipientId = String(payload.careRecipientId ?? "");
      const platform = String(payload.platform ?? "");
      const deviceClass = String(payload.deviceClass ?? "");
      const appVersion = String(payload.appVersion ?? "").slice(0, 60);

      if (!["ios", "android", "web"].includes(platform)) {
        return json({ error: "Unsupported validation platform" }, 400);
      }
      if (!["phone", "tablet", "desktop"].includes(deviceClass)) {
        return json({ error: "Unsupported device class" }, 400);
      }

      const wave = await activeWave(admin, waveId, context.cohort);
      if (!wave) return json({ error: "Launch wave is not active" }, 409);

      const membership = await activeMembership(admin, user.id, careRecipientId);
      if (!membership) return json({ error: "Active care-profile membership required" }, 403);

      const { data, error } = await admin
        .from("pilot_acceptance_runs")
        .insert({
          wave_id: waveId,
          tester_user_id: user.id,
          care_recipient_id: careRecipientId,
          role: membership.role,
          platform,
          device_class: deviceClass,
          app_version: appVersion || null,
          status: "in_progress",
        })
        .select(
          "id, wave_id, care_recipient_id, role, platform, device_class, app_version, steps, device_checks, status, notes, started_at, completed_at, updated_at",
        )
        .single();

      if (error) throw error;
      return json({ run: data });
    }

    if (action === "save_acceptance") {
      const runId = String(payload.runId ?? "");
      const status = String(payload.status ?? "in_progress");
      const steps =
        payload.steps && typeof payload.steps === "object" ? payload.steps : {};
      const deviceChecks =
        payload.deviceChecks && typeof payload.deviceChecks === "object"
          ? payload.deviceChecks
          : {};
      const notes = String(payload.notes ?? "").trim().slice(0, 2000);

      if (!["in_progress", "passed", "failed", "blocked"].includes(status)) {
        return json({ error: "Unsupported acceptance status" }, 400);
      }

      const { data: run, error: runError } = await admin
        .from("pilot_acceptance_runs")
        .select(
          "id, wave_id, tester_user_id, care_recipient_id, role, platform, status",
        )
        .eq("id", runId)
        .eq("tester_user_id", user.id)
        .maybeSingle();

      if (runError) throw runError;
      if (!run) return json({ error: "Acceptance run not found" }, 404);

      const wave = await activeWave(admin, run.wave_id, context.cohort);
      if (!wave) return json({ error: "Launch wave is not active" }, 409);

      const membership = await activeMembership(
        admin,
        user.id,
        run.care_recipient_id,
      );
      if (!membership || membership.role !== run.role) {
        return json({ error: "Care-profile role changed; start a new run" }, 409);
      }

      if (status === "passed") {
        if (!allTrue(steps, roleSteps[run.role] ?? [])) {
          return json({ error: "Complete every role acceptance step before passing" }, 409);
        }
        if (!allTrue(deviceChecks, platformDeviceChecks[run.platform] ?? commonDeviceChecks)) {
          return json({ error: "Complete every device QA check before passing" }, 409);
        }
      }

      const completedAt = status === "in_progress" ? null : new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from("pilot_acceptance_runs")
        .update({
          steps,
          device_checks: deviceChecks,
          status,
          notes: notes || null,
          completed_at: completedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", run.id)
        .select(
          "id, wave_id, care_recipient_id, role, platform, device_class, app_version, steps, device_checks, status, notes, started_at, completed_at, updated_at",
        )
        .single();

      if (updateError) throw updateError;
      return json({ run: updated });
    }

    if (action === "record_drill") {
      const waveId = String(payload.waveId ?? "");
      const drillType = String(payload.drillType ?? "");
      const status = String(payload.status ?? "");
      const notes = String(payload.notes ?? "").trim().slice(0, 2000);
      const evidence =
        payload.evidence && typeof payload.evidence === "object"
          ? payload.evidence
          : {};

      if (!drillTypes.has(drillType)) {
        return json({ error: "Unsupported recovery drill" }, 400);
      }
      if (!["passed", "failed", "blocked"].includes(status)) {
        return json({ error: "Unsupported drill status" }, 400);
      }

      const wave = await activeWave(admin, waveId, context.cohort);
      if (!wave) return json({ error: "Launch wave is not active" }, 409);

      const { data, error } = await admin
        .from("pilot_recovery_drills")
        .insert({
          wave_id: waveId,
          tester_user_id: user.id,
          drill_type: drillType,
          status,
          evidence,
          notes: notes || null,
        })
        .select("id, wave_id, drill_type, status, evidence, notes, performed_at")
        .single();

      if (error) throw error;
      return json({ drill: data });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("launch-validation error", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      500,
    );
  }
});

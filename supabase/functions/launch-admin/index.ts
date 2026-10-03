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

const allowedPlatforms = new Set(["ios", "android", "web"]);
const requiredRoles = ["owner", "caregiver", "patient", "viewer"];
const requiredDrills = [
  "network_reconnect",
  "session_revocation",
  "packet_recovery",
  "notification_recovery",
];

async function currentPublishedDocuments(admin: any) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("program_documents")
    .select("id")
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${now}`);
  if (error) throw error;
  return data ?? [];
}

async function consentCompletionCount(
  admin: any,
  userIds: string[],
  documentIds: string[],
) {
  if (!userIds.length) return 0;
  if (!documentIds.length) return userIds.length;

  const { data, error } = await admin
    .from("user_document_acceptances")
    .select("user_id, document_id")
    .in("user_id", userIds)
    .in("document_id", documentIds);
  if (error) throw error;

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = map.get(row.user_id) ?? new Set<string>();
    set.add(row.document_id);
    map.set(row.user_id, set);
  }

  return userIds.filter((userId) => {
    const accepted = map.get(userId) ?? new Set<string>();
    return documentIds.every((documentId) => accepted.has(documentId));
  }).length;
}

async function pilotFoundation(admin: any) {
  const now = new Date().toISOString();

  const [{ data: documents, error: documentError }, { data: enrollments, error: enrollmentError }] =
    await Promise.all([
      admin
        .from("program_documents")
        .select("id, document_type, status, effective_at")
        .eq("status", "published")
        .or(`effective_at.is.null,effective_at.lte.${now}`),
      admin
        .from("pilot_enrollments")
        .select("user_id, cohort, status"),
    ]);

  if (documentError) throw documentError;
  if (enrollmentError) throw enrollmentError;

  const currentDocuments = documents ?? [];
  const documentIds = currentDocuments.map((row: any) => row.id);
  const publishedTypes = new Set(
    currentDocuments.map((row: any) => String(row.document_type)),
  );
  const requiredDocumentTypes = [
    "privacy_notice",
    "pilot_consent",
    "terms_of_use",
  ];
  const missingDocumentTypes = requiredDocumentTypes.filter(
    (type) => !publishedTypes.has(type),
  );

  const cohortNames = Array.from(
    new Set(
      (enrollments ?? [])
        .map((row: any) => String(row.cohort ?? "").trim())
        .filter(Boolean),
    ),
  ).sort();

  const cohorts: any[] = [];

  for (const cohort of cohortNames) {
    const cohortRows = (enrollments ?? []).filter(
      (row: any) => String(row.cohort ?? "").trim() === cohort,
    );
    const activeRows = cohortRows.filter((row: any) => row.status === "active");
    const activeUserIds = activeRows.map((row: any) => row.user_id);

    const consentCurrent = await consentCompletionCount(
      admin,
      activeUserIds,
      documentIds,
    );

    const { data: memberships, error: membershipError } = activeUserIds.length
      ? await admin
          .from("care_recipient_members")
          .select("user_id, role, status")
          .in("user_id", activeUserIds)
          .eq("status", "active")
          .in("role", requiredRoles)
      : { data: [], error: null };

    if (membershipError) throw membershipError;

    const roleUsers = {
      owner: new Set<string>(),
      caregiver: new Set<string>(),
      patient: new Set<string>(),
      viewer: new Set<string>(),
    };

    for (const row of memberships ?? []) {
      if (row.role in roleUsers) {
        roleUsers[row.role as keyof typeof roleUsers].add(row.user_id);
      }
    }

    const activationBlockers: string[] = [];
    if (!activeUserIds.length) {
      activationBlockers.push("No active pilot participants");
    }
    for (const type of missingDocumentTypes) {
      activationBlockers.push(
        `Required document not published: ${type.replaceAll("_", " ")}`,
      );
    }
    if (
      activeUserIds.length &&
      documentIds.length &&
      consentCurrent < activeUserIds.length
    ) {
      activationBlockers.push(
        `${activeUserIds.length - consentCurrent} active participant(s) have outstanding required documents`,
      );
    }

    cohorts.push({
      cohort,
      totalParticipants: cohortRows.length,
      activeParticipants: activeUserIds.length,
      invitedParticipants: cohortRows.filter((row: any) => row.status === "invited").length,
      pausedParticipants: cohortRows.filter((row: any) => row.status === "paused").length,
      consentCurrent,
      roleCoverage: {
        owner: roleUsers.owner.size,
        caregiver: roleUsers.caregiver.size,
        patient: roleUsers.patient.size,
        viewer: roleUsers.viewer.size,
      },
      activationBlockers,
      activationReady: activationBlockers.length === 0,
    });
  }

  return {
    publishedRequiredDocuments: currentDocuments.length,
    publishedDocumentTypes: Array.from(publishedTypes).sort(),
    missingDocumentTypes,
    cohorts,
    foundationReady:
      cohortNames.length > 0 &&
      missingDocumentTypes.length === 0 &&
      cohorts.some((item) => item.activationReady),
  };
}

async function operationsSnapshot(admin: any) {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const staleBefore = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [diagnostics, packets, support, push] = await Promise.all([
    admin
      .from("app_diagnostic_reports")
      .select("id", { head: true, count: "exact" })
      .eq("status", "open"),
    admin
      .from("care_packet_exports")
      .select("id", { head: true, count: "exact" })
      .eq("status", "failed")
      .gte("failed_at", since24h),
    admin
      .from("support_requests")
      .select("id", { head: true, count: "exact" })
      .in("status", ["submitted", "in_review"])
      .lte("created_at", staleBefore),
    admin
      .from("push_delivery_attempts")
      .select("id", { head: true, count: "exact" })
      .eq("status", "error")
      .gte("attempted_at", since24h),
  ]);

  const failed = [diagnostics.error, packets.error, support.error, push.error].find(Boolean);
  if (failed) throw failed;

  return {
    openDiagnostics: diagnostics.count ?? 0,
    failedPacketExports24h: packets.count ?? 0,
    staleSupportRequests: support.count ?? 0,
    pushDeliveryErrors24h: push.count ?? 0,
  };
}

async function gateForWave(admin: any, wave: any, operations?: any) {
  const docs = await currentPublishedDocuments(admin);
  const { data: enrollments, error: enrollmentError } = await admin
    .from("pilot_enrollments")
    .select("user_id")
    .eq("cohort", wave.cohort)
    .eq("status", "active");
  if (enrollmentError) throw enrollmentError;

  const userIds = (enrollments ?? []).map((row: any) => row.user_id);
  const consentComplete = await consentCompletionCount(
    admin,
    userIds,
    docs.map((row: any) => row.id),
  );

  const [{ data: runs, error: runError }, { data: drills, error: drillError }, { data: signoff, error: signoffError }] =
    await Promise.all([
      admin
        .from("pilot_acceptance_runs")
        .select("id, role, platform, status, completed_at")
        .eq("wave_id", wave.id),
      admin
        .from("pilot_recovery_drills")
        .select("id, drill_type, status, performed_at")
        .eq("wave_id", wave.id),
      admin
        .from("pilot_launch_signoffs")
        .select("id, status, readiness_snapshot, notes, signed_by, signed_at")
        .eq("wave_id", wave.id)
        .maybeSingle(),
    ]);

  if (runError) throw runError;
  if (drillError) throw drillError;
  if (signoffError) throw signoffError;

  const passedRuns = (runs ?? []).filter((row: any) => row.status === "passed");
  const rolePasses = Object.fromEntries(
    requiredRoles.map((role) => [
      role,
      passedRuns.filter((row: any) => row.role === role).length,
    ]),
  );
  const platformPasses = Object.fromEntries(
    ["ios", "android", "web"].map((platform) => [
      platform,
      passedRuns.filter((row: any) => row.platform === platform).length,
    ]),
  );
  const drillPasses = Object.fromEntries(
    requiredDrills.map((drillType) => [
      drillType,
      (drills ?? []).filter(
        (row: any) => row.drill_type === drillType && row.status === "passed",
      ).length,
    ]),
  );

  const ops = operations ?? (await operationsSnapshot(admin));
  const blockers: string[] = [];

  if (!["active", "completed"].includes(wave.status)) {
    blockers.push("Launch wave is not active");
  }
  if (!userIds.length) blockers.push("No active pilot participants are in this cohort");
  if (!docs.length) blockers.push("No required pilot documents are currently published");
  if (userIds.length && consentComplete < userIds.length) {
    blockers.push(
      `${userIds.length - consentComplete} active pilot participant(s) are not current on required documents`,
    );
  }

  for (const role of requiredRoles) {
    if ((rolePasses[role] ?? 0) < 1) {
      blockers.push(`No passed ${role} acceptance journey`);
    }
  }

  for (const platform of wave.required_platforms ?? []) {
    if ((platformPasses[platform] ?? 0) < 1) {
      blockers.push(`No passed ${platform} device validation`);
    }
  }

  for (const drillType of requiredDrills) {
    if ((drillPasses[drillType] ?? 0) < 1) {
      blockers.push(
        `Recovery drill not passed: ${drillType.replaceAll("_", " ")}`,
      );
    }
  }

  if (ops.failedPacketExports24h > 0) {
    blockers.push(
      `${ops.failedPacketExports24h} Care Packet export failure(s) in the last 24 hours`,
    );
  }
  if (ops.staleSupportRequests > 0) {
    blockers.push(
      `${ops.staleSupportRequests} support request(s) open longer than 24 hours`,
    );
  }
  if (ops.pushDeliveryErrors24h > 5) {
    blockers.push(
      `${ops.pushDeliveryErrors24h} push delivery errors in the last 24 hours`,
    );
  }
  if (ops.openDiagnostics > 5) {
    blockers.push(`${ops.openDiagnostics} open technical diagnostic reports`);
  }

  return {
    waveId: wave.id,
    participants: {
      active: userIds.length,
      consentCurrent: consentComplete,
    },
    documents: {
      publishedRequired: docs.length,
    },
    acceptance: {
      totalRuns: (runs ?? []).length,
      passedRuns: passedRuns.length,
      rolePasses,
      platformPasses,
    },
    drills: {
      totalRuns: (drills ?? []).length,
      passes: drillPasses,
    },
    operations: ops,
    blockers,
    ready: blockers.length === 0,
    signoff: signoff ?? null,
  };
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

    const { data: membership, error: membershipError } = await admin
      .from("staff_members")
      .select("role, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership?.active || membership.role !== "admin") {
      return json({ error: "Administrator access required" }, 403);
    }

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "");

    if (action === "dashboard") {
      const { data: waves, error: waveError } = await admin
        .from("pilot_launch_waves")
        .select(
          "id, name, cohort, status, required_platforms, notes, starts_at, ends_at, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);
      if (waveError) throw waveError;

      const [ops, foundation] = await Promise.all([
        operationsSnapshot(admin),
        pilotFoundation(admin),
      ]);
      const gates = [];
      for (const wave of waves ?? []) {
        gates.push(await gateForWave(admin, wave, ops));
      }

      return json({
        waves: waves ?? [],
        gates,
        operations: ops,
        foundation,
      });
    }

    if (action === "save_wave") {
      const waveId = String(payload.waveId ?? "");
      const name = String(payload.name ?? "").trim().slice(0, 120);
      const cohort = String(payload.cohort ?? "").trim().slice(0, 120);
      const status = String(payload.status ?? "draft");
      const notes = String(payload.notes ?? "").trim().slice(0, 2000);
      const startsAt = String(payload.startsAt ?? "").trim() || null;
      const endsAt = String(payload.endsAt ?? "").trim() || null;
      const requestedPlatforms = Array.isArray(payload.requiredPlatforms)
        ? payload.requiredPlatforms.map((value: unknown) => String(value))
        : ["ios", "android", "web"];
      const requiredPlatforms = [...new Set(requestedPlatforms)].filter((value) =>
        allowedPlatforms.has(value),
      );

      if (!name || !cohort) return json({ error: "Wave name and cohort are required" }, 400);
      if (!["draft", "active", "cancelled"].includes(status)) {
        return json(
          {
            error:
              status === "completed"
                ? "Launch waves can only be completed by approved sign-off"
                : "Unsupported launch-wave status",
          },
          400,
        );
      }
      if (!requiredPlatforms.length) {
        return json({ error: "Select at least one validation platform" }, 400);
      }
      if (startsAt && !Number.isFinite(new Date(startsAt).getTime())) {
        return json({ error: "Invalid start date" }, 400);
      }
      if (endsAt && !Number.isFinite(new Date(endsAt).getTime())) {
        return json({ error: "Invalid end date" }, 400);
      }
      if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
        return json({ error: "End date must be after start date" }, 400);
      }

      const foundation = await pilotFoundation(admin);
      const targetCohort = foundation.cohorts.find(
        (item: any) => item.cohort === cohort,
      );
      if (!targetCohort) {
        return json(
          { error: "Select an existing pilot cohort with real participants" },
          409,
        );
      }
      if (status === "active" && !targetCohort.activationReady) {
        return json(
          {
            error: "Pilot foundation is not ready for activation",
            blockers: targetCohort.activationBlockers,
          },
          409,
        );
      }

      let existing: any = null;
      if (waveId) {
        const { data, error } = await admin
          .from("pilot_launch_waves")
          .select("id")
          .eq("id", waveId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return json({ error: "Launch wave not found" }, 404);

        const { data: signed, error: signoffError } = await admin
          .from("pilot_launch_signoffs")
          .select("status")
          .eq("wave_id", waveId)
          .eq("status", "approved")
          .maybeSingle();
        if (signoffError) throw signoffError;
        if (signed) {
          return json({ error: "Approved launch waves are locked" }, 409);
        }
        existing = data;
      }

      const values = {
        name,
        cohort,
        status,
        required_platforms: requiredPlatforms,
        notes: notes || null,
        starts_at: startsAt,
        ends_at: endsAt,
        updated_at: new Date().toISOString(),
      };

      const query = existing
        ? admin
            .from("pilot_launch_waves")
            .update(values)
            .eq("id", waveId)
        : admin
            .from("pilot_launch_waves")
            .insert({ ...values, created_by: user.id });

      const { data: saved, error } = await query
        .select(
          "id, name, cohort, status, required_platforms, notes, starts_at, ends_at, created_by, created_at, updated_at",
        )
        .single();

      if (error) throw error;

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          action: existing ? "launch_wave_update" : "launch_wave_create",
          details: {
            wave_id: saved.id,
            name: saved.name,
            cohort: saved.cohort,
            status: saved.status,
            required_platforms: saved.required_platforms,
          },
        });
      if (auditError) throw auditError;

      return json({ wave: saved });
    }

    if (action === "signoff") {
      const waveId = String(payload.waveId ?? "");
      const signoffStatus = String(payload.status ?? "approved");
      const notes = String(payload.notes ?? "").trim().slice(0, 3000);

      if (!["approved", "held"].includes(signoffStatus)) {
        return json({ error: "Unsupported sign-off status" }, 400);
      }

      const { data: wave, error: waveError } = await admin
        .from("pilot_launch_waves")
        .select(
          "id, name, cohort, status, required_platforms, notes, starts_at, ends_at, created_at, updated_at",
        )
        .eq("id", waveId)
        .maybeSingle();

      if (waveError) throw waveError;
      if (!wave) return json({ error: "Launch wave not found" }, 404);

      const gate = await gateForWave(admin, wave);
      if (signoffStatus === "approved" && gate.blockers.length) {
        return json(
          {
            error: "Launch blockers remain",
            blockers: gate.blockers,
          },
          409,
        );
      }

      const snapshot = {
        ...gate,
        evaluatedAt: new Date().toISOString(),
      };

      const { data: signoff, error: signoffError } = await admin
        .from("pilot_launch_signoffs")
        .upsert(
          {
            wave_id: wave.id,
            status: signoffStatus,
            readiness_snapshot: snapshot,
            notes: notes || null,
            signed_by: user.id,
            signed_at: new Date().toISOString(),
          },
          { onConflict: "wave_id" },
        )
        .select(
          "id, wave_id, status, readiness_snapshot, notes, signed_by, signed_at",
        )
        .single();

      if (signoffError) throw signoffError;

      if (signoffStatus === "approved") {
        const { error: waveUpdateError } = await admin
          .from("pilot_launch_waves")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", wave.id);
        if (waveUpdateError) throw waveUpdateError;
      }

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          action: "launch_signoff",
          details: {
            wave_id: wave.id,
            status: signoffStatus,
            blocker_count: gate.blockers.length,
          },
        });
      if (auditError) throw auditError;

      return json({ signoff, gate });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("launch-admin error", error);
    return json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      500,
    );
  }
});

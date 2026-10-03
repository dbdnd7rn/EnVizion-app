import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
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

const participantStatuses = new Set(["invited", "active", "paused", "exited"]);
const documentTypes = new Set(["privacy_notice", "pilot_consent", "terms_of_use"]);
const requiredDocumentTypes = ["privacy_notice", "pilot_consent", "terms_of_use"];

async function listAllUsers(admin: any) {
  const users: any[] = [];
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

async function findUserByEmail(admin: any, email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find(
      (account: any) => account.email?.toLowerCase() === email,
    );
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Auth user lookup exceeded the safe pagination limit.");
}

async function currentPublishedDocuments(admin: any) {
  const { data, error } = await admin
    .from("program_documents")
    .select("id, document_type, title, version, effective_at")
    .eq("status", "published")
    .or(`effective_at.is.null,effective_at.lte.${new Date().toISOString()}`)
    .order("document_type", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function consentCompletionMap(
  admin: any,
  userIds: string[],
  documentIds: string[],
) {
  const complete = new Map<string, boolean>();

  if (!userIds.length) return complete;
  if (!documentIds.length) {
    for (const userId of userIds) complete.set(userId, true);
    return complete;
  }

  const { data, error } = await admin
    .from("user_document_acceptances")
    .select("user_id, document_id")
    .in("user_id", userIds)
    .in("document_id", documentIds);

  if (error) throw error;

  const acceptedByUser = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = acceptedByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.document_id);
    acceptedByUser.set(row.user_id, set);
  }

  for (const userId of userIds) {
    const accepted = acceptedByUser.get(userId) ?? new Set<string>();
    complete.set(
      userId,
      documentIds.every((documentId) => accepted.has(documentId)),
    );
  }

  return complete;
}


async function buildParticipantOnboarding(admin: any, rows: any[]) {
  const userIds = rows.map((row) => row.user_id);
  const documents = await currentPublishedDocuments(admin);
  const currentTypeSet = new Set(
    documents.map((document: any) => String(document.document_type)),
  );
  const missingDocumentTypes = requiredDocumentTypes.filter(
    (type) => !currentTypeSet.has(type),
  );

  const [
    userEntries,
    profilesResult,
    acceptancesResult,
    membershipsResult,
    ownedRecipientsResult,
    passedRunsResult,
    completionEventsResult,
  ] = await Promise.all([
      Promise.all(
        userIds.map(async (userId) => {
          const { data, error } = await admin.auth.admin.getUserById(userId);
          return [userId, error ? null : data.user] as const;
        }),
      ),
      userIds.length
        ? admin.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length && documents.length
        ? admin
            .from("user_document_acceptances")
            .select("user_id, document_id, accepted_at")
            .in("user_id", userIds)
            .in("document_id", documents.map((document: any) => document.id))
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin
            .from("care_recipient_members")
            .select("user_id, care_recipient_id, role, status")
            .in("user_id", userIds)
            .eq("status", "active")
            .in("role", ["owner", "caregiver", "patient", "viewer"])
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin
            .from("care_recipients")
            .select("id, owner_id")
            .in("owner_id", userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin
            .from("pilot_acceptance_runs")
            .select("tester_user_id, id, completed_at")
            .in("tester_user_id", userIds)
            .eq("status", "passed")
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? admin.rpc("pilot_completion_events_for_users", {
            target_user_ids: userIds,
          })
        : Promise.resolve({ data: [], error: null }),
    ]);

  const failed = [
    profilesResult.error,
    acceptancesResult.error,
    membershipsResult.error,
    ownedRecipientsResult.error,
    passedRunsResult.error,
    completionEventsResult.error,
  ].find(Boolean);
  if (failed) throw failed;

  const userMap = new Map(userEntries);
  const profileMap = new Map(
    (profilesResult.data ?? []).map((row: any) => [row.id, row.full_name]),
  );

  const acceptedByUser = new Map<string, Set<string>>();
  for (const row of acceptancesResult.data ?? []) {
    const set = acceptedByUser.get(row.user_id) ?? new Set<string>();
    set.add(row.document_id);
    acceptedByUser.set(row.user_id, set);
  }

  const roleState = new Map<
    string,
    {
      profileIds: Set<string>;
      owner: Set<string>;
      caregiver: Set<string>;
      patient: Set<string>;
      viewer: Set<string>;
    }
  >();

  for (const userId of userIds) {
    roleState.set(userId, {
      profileIds: new Set<string>(),
      owner: new Set<string>(),
      caregiver: new Set<string>(),
      patient: new Set<string>(),
      viewer: new Set<string>(),
    });
  }

  for (const row of membershipsResult.data ?? []) {
    const state = roleState.get(row.user_id);
    if (!state) continue;
    state.profileIds.add(row.care_recipient_id);
    if (row.role === "owner") state.owner.add(row.care_recipient_id);
    if (row.role === "caregiver") state.caregiver.add(row.care_recipient_id);
    if (row.role === "patient") state.patient.add(row.care_recipient_id);
    if (row.role === "viewer") state.viewer.add(row.care_recipient_id);
  }

  for (const row of ownedRecipientsResult.data ?? []) {
    const state = roleState.get(row.owner_id);
    if (!state) continue;
    state.profileIds.add(row.id);
    state.owner.add(row.id);
  }

  const passedRunsByUser = new Map<string, number>();
  for (const row of passedRunsResult.data ?? []) {
    passedRunsByUser.set(
      row.tester_user_id,
      (passedRunsByUser.get(row.tester_user_id) ?? 0) + 1,
    );
  }

  const completionByUser = new Map<string, any>();
  for (const row of completionEventsResult.data ?? []) {
    if (!completionByUser.has(row.user_id)) {
      completionByUser.set(row.user_id, row);
    }
  }

  return rows.map((row) => {
    const account = userMap.get(row.user_id);
    const acceptedIds = acceptedByUser.get(row.user_id) ?? new Set<string>();
    const acceptedDocuments = documents.filter((document: any) =>
      acceptedIds.has(document.id),
    );
    const outstandingDocuments = documents.filter(
      (document: any) => !acceptedIds.has(document.id),
    );
    const roles = roleState.get(row.user_id) ?? {
      profileIds: new Set<string>(),
      owner: new Set<string>(),
      caregiver: new Set<string>(),
      patient: new Set<string>(),
      viewer: new Set<string>(),
    };

    const emailConfirmedAt =
      account?.email_confirmed_at ?? account?.confirmed_at ?? null;
    const lastSignInAt = account?.last_sign_in_at ?? null;
    const authInvitedAt = account?.invited_at ?? null;
    const accountConfirmed = Boolean(emailConfirmedAt);
    const signedIn = Boolean(lastSignInAt);
    const documentsPublished = missingDocumentTypes.length === 0;
    const consentComplete =
      documentsPublished &&
      documents.length > 0 &&
      acceptedDocuments.length === documents.length;
    const careProfileCount = roles.profileIds.size;
    const roleReady = careProfileCount > 0;

    const activationBlockers: string[] = [];
    if (!accountConfirmed) {
      activationBlockers.push("Invitation/account setup has not been completed");
    }
    if (accountConfirmed && !signedIn) {
      activationBlockers.push("Participant has not completed a first sign-in");
    }
    for (const type of missingDocumentTypes) {
      activationBlockers.push(
        `Required document not published: ${type.replaceAll("_", " ")}`,
      );
    }
    if (documentsPublished && !consentComplete) {
      activationBlockers.push(
        `${outstandingDocuments.length} required document acceptance(s) remain`,
      );
    }
    if (!roleReady) {
      activationBlockers.push(
        "No active Primary Advocate, Co-Caregiver, Care Recipient or Family Member care-profile role is assigned",
      );
    }

    const readyForActivation = activationBlockers.length === 0;
    let onboardingStage = "ready_for_activation";

    if (row.status === "exited") onboardingStage = "exited";
    else if (!accountConfirmed) onboardingStage = "invitation_pending";
    else if (!signedIn) onboardingStage = "first_sign_in_pending";
    else if (!documentsPublished || !consentComplete)
      onboardingStage = "documents_pending";
    else if (!roleReady) onboardingStage = "role_pending";
    else if (row.status === "active") onboardingStage = "active_ready";
    else if (row.status === "paused") onboardingStage = "paused_ready";

    const stageStartedAt =
      onboardingStage === "invitation_pending"
        ? authInvitedAt ?? row.created_at
        : onboardingStage === "first_sign_in_pending"
          ? emailConfirmedAt ?? row.updated_at
          : onboardingStage === "documents_pending"
            ? lastSignInAt ?? row.updated_at
            : row.updated_at;

    const stalledHours =
      row.status === "exited" || !stageStartedAt
        ? 0
        : Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(stageStartedAt).getTime()) /
                (60 * 60 * 1000),
            ),
          );
    const stalled =
      !["ready_for_activation", "active_ready", "paused_ready", "exited"].includes(
        onboardingStage,
      ) && stalledHours >= 72;

    const nextAction =
      onboardingStage === "invitation_pending"
        ? "Follow up on the account invitation"
        : onboardingStage === "first_sign_in_pending"
          ? "Ask the participant to complete first sign-in"
          : onboardingStage === "documents_pending"
            ? "Complete current participation-document review"
            : onboardingStage === "role_pending"
              ? "Have a care owner grant real care-team access"
              : onboardingStage === "ready_for_activation"
                ? "Activate participant for pilot testing"
                : onboardingStage === "active_ready"
                  ? "Run pilot launch validation"
                  : onboardingStage === "paused_ready"
                    ? "Resume when the participant is ready"
                    : "No onboarding action required";

    const passedValidationRuns = passedRunsByUser.get(row.user_id) ?? 0;
    const completion = completionByUser.get(row.user_id) ?? null;

    return {
      userId: row.user_id,
      email: account?.email ?? "",
      displayName:
        profileMap.get(row.user_id) ||
        String(account?.user_metadata?.full_name ?? "") ||
        "Pilot participant",
      status: row.status,
      cohort: row.cohort ?? "",
      enrolledAt: row.enrolled_at,
      exitedAt: row.exited_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      invitation: {
        authInvitedAt,
        emailConfirmedAt,
        lastSignInAt,
        accountConfirmed,
        signedIn,
      },
      documents: {
        required: documents.length,
        accepted: acceptedDocuments.length,
        complete: consentComplete,
        publishedRequiredTypesComplete: documentsPublished,
        missingRequiredTypes: missingDocumentTypes,
        outstanding: outstandingDocuments.map((document: any) => ({
          id: document.id,
          documentType: document.document_type,
          title: document.title,
          version: document.version,
        })),
      },
      roles: {
        owner: roles.owner.size,
        caregiver: roles.caregiver.size,
        patient: roles.patient.size,
        viewer: roles.viewer.size,
        careProfileCount,
        ready: roleReady,
      },
      consentComplete,
      careProfileCount,
      onboardingStage,
      activationBlockers,
      readyForActivation,
      launchTestingReady: row.status === "active" && readyForActivation,
      stalled,
      stalledHours,
      stageStartedAt,
      nextAction,
      validation: {
        passedRuns: passedValidationRuns,
        canCompletePilot:
          row.status === "active" &&
          readyForActivation &&
          passedValidationRuns > 0,
      },
      completion: completion
        ? {
            id: completion.id,
            outcome: completion.outcome,
            passedValidationRuns: Number(
              completion.passed_validation_runs ?? 0,
            ),
            note: completion.note ?? "",
            createdAt: completion.created_at,
          }
        : null,
    };
  });
}

async function participantReadiness(admin: any, targetUserId: string) {
  const { data: row, error } = await admin
    .from("pilot_enrollments")
    .select(
      "user_id, status, cohort, enrolled_at, exited_at, created_at, updated_at",
    )
    .eq("user_id", targetUserId)
    .single();
  if (error) throw error;

  const [participant] = await buildParticipantOnboarding(admin, [row]);
  return participant;
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
    if (!sessionId) {
      return json({ error: "Session is no longer active" }, 401);
    }

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

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "");

    if (action === "claim_initial_admin") {
      const normalizedEmail = (user.email ?? "").trim().toLowerCase();
      if (!normalizedEmail) return json({ claimed: false });

      const { count: adminCount, error: adminCountError } = await admin
        .from("staff_members")
        .select("user_id", { head: true, count: "exact" })
        .eq("active", true)
        .eq("role", "admin");

      if (adminCountError) throw adminCountError;
      if ((adminCount ?? 0) > 0) return json({ claimed: false });

      const { data: allowlisted, error: allowlistError } = await admin
        .from("staff_bootstrap_allowlist")
        .select("normalized_email, display_name, claimed_at")
        .eq("normalized_email", normalizedEmail)
        .maybeSingle();

      if (allowlistError) throw allowlistError;
      if (!allowlisted || allowlisted.claimed_at) return json({ claimed: false });

      const now = new Date().toISOString();

      const { error: staffError } = await admin.from("staff_members").upsert({
        user_id: user.id,
        display_name: allowlisted.display_name,
        role: "admin",
        active: true,
        updated_at: now,
      });
      if (staffError) throw staffError;

      const { error: allowlistUpdateError } = await admin
        .from("staff_bootstrap_allowlist")
        .update({ claimed_at: now })
        .eq("normalized_email", normalizedEmail)
        .is("claimed_at", null);
      if (allowlistUpdateError) throw allowlistUpdateError;

      const { error: staffAuditError } = await admin
        .from("staff_admin_audit")
        .insert({
          actor_user_id: user.id,
          target_user_id: user.id,
          action: "activate",
          details: {
            bootstrap: true,
            email: normalizedEmail,
            role: "admin",
          },
        });
      if (staffAuditError) throw staffAuditError;

      const { error: pilotAuditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          target_user_id: user.id,
          action: "bootstrap_admin",
          details: { email: normalizedEmail },
        });
      if (pilotAuditError) throw pilotAuditError;

      return json({
        claimed: true,
        membership: {
          userId: user.id,
          displayName: allowlisted.display_name,
          role: "admin",
        },
      });
    }

    const { data: membership, error: membershipError } = await admin
      .from("staff_members")
      .select("user_id, display_name, role, active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership?.active || membership.role !== "admin") {
      return json({ error: "Administrator access required" }, 403);
    }

    if (action === "summary") {
      const [allUsers, documents, enrollmentsResult, careRecipientsResult, supportResult, coachingResult] =
        await Promise.all([
          listAllUsers(admin),
          currentPublishedDocuments(admin),
          admin
            .from("pilot_enrollments")
            .select(
              "user_id, status, cohort, enrolled_at, exited_at, created_at, updated_at",
            ),
          admin
            .from("care_recipients")
            .select("id", { head: true, count: "exact" }),
          admin
            .from("support_requests")
            .select("id", { head: true, count: "exact" })
            .in("status", ["submitted", "in_review"]),
          admin
            .from("coaching_requests")
            .select("id", { head: true, count: "exact" })
            .in("status", ["submitted", "in_review", "scheduled"]),
        ]);

      const failed = [
        enrollmentsResult.error,
        careRecipientsResult.error,
        supportResult.error,
        coachingResult.error,
      ].find(Boolean);
      if (failed) throw failed;

      const enrollments = enrollmentsResult.data ?? [];
      const participantStates = await buildParticipantOnboarding(
        admin,
        enrollments,
      );

      return json({
        summary: {
          totalAccounts: allUsers.length,
          invitedPilot: enrollments.filter((row) => row.status === "invited").length,
          activePilot: enrollments.filter((row) => row.status === "active").length,
          pausedPilot: enrollments.filter((row) => row.status === "paused").length,
          exitedPilot: enrollments.filter((row) => row.status === "exited").length,
          activeConsentComplete: participantStates.filter(
            (item: any) => item.status === "active" && item.consentComplete,
          ).length,
          currentRequiredDocuments: documents.length,
          careProfiles: careRecipientsResult.count ?? 0,
          openSupport: supportResult.count ?? 0,
          activeCoaching: coachingResult.count ?? 0,
          readyForActivation: participantStates.filter(
            (item: any) =>
              item.status !== "active" &&
              item.status !== "exited" &&
              item.readyForActivation,
          ).length,
          activeLaunchReady: participantStates.filter(
            (item: any) => item.launchTestingReady,
          ).length,
          onboardingBlocked: participantStates.filter(
            (item: any) =>
              item.status !== "exited" && !item.readyForActivation,
          ).length,
          stalledParticipants: participantStates.filter(
            (item: any) => item.stalled,
          ).length,
        },
        cohorts: Array.from(
          new Set(
            participantStates
              .map((item: any) => item.cohort || "Unassigned")
              .filter(Boolean),
          ),
        ).map((cohort) => {
          const items = participantStates.filter(
            (item: any) => (item.cohort || "Unassigned") === cohort,
          );
          return {
            cohort,
            total: items.length,
            invited: items.filter((item: any) => item.status === "invited").length,
            active: items.filter((item: any) => item.status === "active").length,
            paused: items.filter((item: any) => item.status === "paused").length,
            exited: items.filter((item: any) => item.status === "exited").length,
            readyForActivation: items.filter(
              (item: any) =>
                item.status !== "active" &&
                item.status !== "exited" &&
                item.readyForActivation,
            ).length,
            launchReady: items.filter(
              (item: any) => item.launchTestingReady,
            ).length,
            stalled: items.filter((item: any) => item.stalled).length,
            consentComplete: items.filter(
              (item: any) => item.consentComplete,
            ).length,
            passedValidation: items.filter(
              (item: any) => item.validation.passedRuns > 0,
            ).length,
            completed: items.filter(
              (item: any) => item.completion?.outcome === "completed",
            ).length,
          };
        }),
      });
    }

    if (action === "operations") {
      const now = Date.now();
      const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const staleSupportBefore = new Date(
        now - 24 * 60 * 60 * 1000,
      ).toISOString();

      const [
        diagnosticsResult,
        failedPacketsResult,
        staleSupportResult,
        pushErrorsResult,
      ] = await Promise.all([
        admin
          .from("app_diagnostic_reports")
          .select(
            "id, user_id, area, summary, details, platform, app_version, status, reviewed_at, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(25),
        admin
          .from("care_packet_exports")
          .select("id", { head: true, count: "exact" })
          .eq("status", "failed")
          .gte("failed_at", since24h),
        admin
          .from("support_requests")
          .select("id", { head: true, count: "exact" })
          .in("status", ["submitted", "in_review"])
          .lte("created_at", staleSupportBefore),
        admin
          .from("push_delivery_attempts")
          .select("id", { head: true, count: "exact" })
          .eq("status", "error")
          .gte("attempted_at", since24h),
      ]);

      const failed = [
        diagnosticsResult.error,
        failedPacketsResult.error,
        staleSupportResult.error,
        pushErrorsResult.error,
      ].find(Boolean);
      if (failed) throw failed;

      const diagnostics = diagnosticsResult.data ?? [];
      const diagnosticUserIds = [
        ...new Set(diagnostics.map((row) => row.user_id).filter(Boolean)),
      ];

      const { data: profiles, error: profileError } = diagnosticUserIds.length
        ? await admin
            .from("profiles")
            .select("id, full_name")
            .in("id", diagnosticUserIds)
        : { data: [], error: null };
      if (profileError) throw profileError;

      const profileMap = new Map(
        (profiles ?? []).map((row) => [row.id, row.full_name || "Caregiver"]),
      );

      return json({
        operations: {
          openDiagnostics: diagnostics.filter((row) => row.status === "open").length,
          failedPacketExports24h: failedPacketsResult.count ?? 0,
          staleSupportRequests: staleSupportResult.count ?? 0,
          pushDeliveryErrors24h: pushErrorsResult.count ?? 0,
          recentDiagnostics: diagnostics.map((row) => ({
            id: row.id,
            userId: row.user_id,
            displayName: profileMap.get(row.user_id) ?? "Caregiver",
            area: row.area,
            summary: row.summary,
            details: row.details ?? {},
            platform: row.platform ?? "",
            appVersion: row.app_version ?? "",
            status: row.status,
            reviewedAt: row.reviewed_at,
            createdAt: row.created_at,
          })),
        },
      });
    }

    if (action === "resolve_diagnostic") {
      const diagnosticId = String(payload.diagnosticId ?? "");
      if (!diagnosticId) {
        return json({ error: "Diagnostic report is required." }, 400);
      }

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from("app_diagnostic_reports")
        .update({
          status: "resolved",
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq("id", diagnosticId)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) return json({ error: "Diagnostic report not found." }, 404);

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          action: "diagnostic_resolved",
          details: { diagnostic_id: diagnosticId },
        });
      if (auditError) throw auditError;

      return json({ ok: true });
    }

    if (action === "list_participants") {
      const { data: enrollments, error: enrollmentError } = await admin
        .from("pilot_enrollments")
        .select(
          "user_id, status, cohort, enrolled_at, exited_at, created_at, updated_at",
        )
        .order("created_at", { ascending: true });
      if (enrollmentError) throw enrollmentError;

      const participants = await buildParticipantOnboarding(
        admin,
        enrollments ?? [],
      );

      return json({ participants });
    }

    if (action === "invite_participant") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const displayName = String(payload.displayName ?? "").trim();
      const cohort = String(payload.cohort ?? "").trim();

      if (!email || !email.includes("@")) {
        return json({ error: "A valid participant email is required." }, 400);
      }

      let target = await findUserByEmail(admin, email);
      let invitationEmailSent = false;

      if (!target) {
        const { data: invited, error: inviteError } =
          await admin.auth.admin.inviteUserByEmail(email, {
            data: { full_name: displayName || "Pilot participant" },
            redirectTo: "https://envizion-life-caregiver.onrender.com",
          });
        if (inviteError) throw inviteError;
        target = invited.user;
        invitationEmailSent = true;
      }

      if (!target) {
        return json({ error: "Could not resolve participant account." }, 500);
      }

      const now = new Date().toISOString();
      const { error: enrollmentError } = await admin
        .from("pilot_enrollments")
        .upsert({
          user_id: target.id,
          status: "invited",
          cohort: cohort || null,
          enrolled_by: user.id,
          enrolled_at: null,
          exited_at: null,
          updated_at: now,
        });
      if (enrollmentError) throw enrollmentError;

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          target_user_id: target.id,
          action: "participant_invite",
          details: {
            email,
            display_name: displayName || null,
            cohort: cohort || null,
            invitation_email_sent: invitationEmailSent,
          },
        });
      if (auditError) throw auditError;

      if (!invitationEmailSent) {
        await admin.from("notifications").insert({
          user_id: target.id,
          audience: "caregiver",
          kind: "pilot_invitation",
          title: "EnVizion Life pilot invitation",
          body: "You were invited to participate in the EnVizion Life pilot.",
          entity_type: null,
          entity_id: null,
        });
      }

      return json({
        ok: true,
        invitationEmailSent,
        userId: target.id,
      });
    }

    if (action === "update_participant") {
      const targetUserId = String(payload.userId ?? "");
      const status = String(payload.status ?? "");
      const cohort = String(payload.cohort ?? "").trim();

      if (!targetUserId || !participantStatuses.has(status)) {
        return json(
          { error: "Valid participant and status are required." },
          400,
        );
      }

      const { data: before, error: beforeError } = await admin
        .from("pilot_enrollments")
        .select("status, cohort, enrolled_at")
        .eq("user_id", targetUserId)
        .single();
      if (beforeError) throw beforeError;

      if (status === "active") {
        const readiness = await participantReadiness(admin, targetUserId);
        if (!readiness.readyForActivation) {
          return json(
            {
              error: "Participant is not ready for pilot activation.",
              blockers: readiness.activationBlockers,
            },
            409,
          );
        }
      }

      const now = new Date().toISOString();
      const { error: updateError } = await admin
        .from("pilot_enrollments")
        .update({
          status,
          cohort: cohort || null,
          enrolled_at:
            status === "active" ? before.enrolled_at ?? now : before.enrolled_at,
          exited_at: status === "exited" ? now : null,
          updated_at: now,
        })
        .eq("user_id", targetUserId);
      if (updateError) throw updateError;

      if (before.status !== status) {
        const { error: auditError } = await admin
          .from("pilot_admin_audit")
          .insert({
            actor_user_id: user.id,
            target_user_id: targetUserId,
            action: "participant_status_change",
            details: {
              previous_status: before.status,
              new_status: status,
              activation_gate_enforced: status === "active",
            },
          });
        if (auditError) throw auditError;
      }

      if ((before.cohort ?? "") !== cohort) {
        const { error: cohortAuditError } = await admin
          .from("pilot_admin_audit")
          .insert({
            actor_user_id: user.id,
            target_user_id: targetUserId,
            action: "participant_cohort_change",
            details: {
              previous_cohort: before.cohort ?? null,
              new_cohort: cohort || null,
            },
          });
        if (cohortAuditError) throw cohortAuditError;
      }

      return json({ ok: true });
    }


    if (action === "list_pilot_feedback") {
      const { data: enrollmentRows, error: enrollmentError } = await admin
        .from("pilot_enrollments")
        .select("user_id");
      if (enrollmentError) throw enrollmentError;

      const pilotUserIds = (enrollmentRows ?? []).map((row) => row.user_id);
      if (!pilotUserIds.length) return json({ feedback: [] });

      const [supportResult, diagnosticResult, profilesResult] = await Promise.all([
        admin
          .from("support_requests")
          .select("id, user_id, topic, context, status, created_at, updated_at")
          .in("user_id", pilotUserIds)
          .ilike("topic", "Pilot feedback ·%")
          .order("created_at", { ascending: false })
          .limit(50),
        admin
          .from("app_diagnostic_reports")
          .select("id, user_id, summary, details, status, platform, app_version, created_at, reviewed_at")
          .in("user_id", pilotUserIds)
          .eq("area", "pilot_feedback_bug")
          .order("created_at", { ascending: false })
          .limit(50),
        admin
          .from("profiles")
          .select("id, full_name")
          .in("id", pilotUserIds),
      ]);

      const feedbackError =
        supportResult.error ?? diagnosticResult.error ?? profilesResult.error;
      if (feedbackError) throw feedbackError;

      const profileMap = new Map(
        (profilesResult.data ?? []).map((row) => [row.id, row.full_name]),
      );

      const supportItems = (supportResult.data ?? []).map((row) => ({
        id: row.id,
        source: "support",
        userId: row.user_id,
        displayName: profileMap.get(row.user_id) ?? "Pilot participant",
        category: row.topic.replace("Pilot feedback · ", ""),
        summary: row.topic,
        detail: row.context,
        status: row.status,
        platform: "",
        appVersion: "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      const diagnosticItems = (diagnosticResult.data ?? []).map((row) => ({
        id: row.id,
        source: "diagnostic",
        userId: row.user_id,
        displayName: profileMap.get(row.user_id) ?? "Pilot participant",
        category: "Bug",
        summary: row.summary,
        detail: String(row.details?.feedback ?? row.details?.detail ?? ""),
        status: row.status,
        platform: row.platform ?? "",
        appVersion: row.app_version ?? "",
        createdAt: row.created_at,
        updatedAt: row.reviewed_at ?? row.created_at,
      }));

      return json({
        feedback: [...supportItems, ...diagnosticItems].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        ),
      });
    }

    if (action === "update_pilot_feedback") {
      const feedbackId = String(payload.feedbackId ?? "");
      const source = String(payload.source ?? "");
      const status = String(payload.status ?? "");
      if (!feedbackId || !["support", "diagnostic"].includes(source)) {
        return json({ error: "Valid pilot feedback item is required." }, 400);
      }

      if (source === "support") {
        if (!["in_review", "closed"].includes(status)) {
          return json({ error: "Unsupported support feedback status." }, 400);
        }
        const { error } = await admin
          .from("support_requests")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", feedbackId)
          .ilike("topic", "Pilot feedback ·%");
        if (error) throw error;
      } else {
        if (!["reviewed", "resolved"].includes(status)) {
          return json({ error: "Unsupported bug feedback status." }, 400);
        }
        const { error } = await admin
          .from("app_diagnostic_reports")
          .update({
            status,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", feedbackId)
          .eq("area", "pilot_feedback_bug");
        if (error) throw error;
      }

      await admin.from("pilot_admin_audit").insert({
        actor_user_id: user.id,
        action: "pilot_feedback_status",
        details: { feedback_id: feedbackId, source, status },
      });

      return json({ ok: true });
    }

    if (action === "closeout_participant") {
      const targetUserId = String(payload.userId ?? "");
      const outcome = String(payload.outcome ?? "");
      const note = String(payload.note ?? "").trim().slice(0, 1000);

      if (!targetUserId || !["completed", "withdrawn"].includes(outcome)) {
        return json({ error: "Valid participant and closeout outcome are required." }, 400);
      }

      const readiness = await participantReadiness(admin, targetUserId);
      if (readiness.status === "exited") {
        return json({ error: "This participant has already exited the pilot." }, 409);
      }

      const passedValidationRuns = Number(readiness.validation?.passedRuns ?? 0);
      if (
        outcome === "completed" &&
        (!readiness.launchTestingReady || passedValidationRuns < 1)
      ) {
        return json(
          {
            error:
              "Pilot completion requires an active launch-ready participant with at least one passed validation run.",
          },
          409,
        );
      }

      const now = new Date().toISOString();
      const { error: enrollmentUpdateError } = await admin
        .from("pilot_enrollments")
        .update({
          status: "exited",
          exited_at: now,
          updated_at: now,
        })
        .eq("user_id", targetUserId);
      if (enrollmentUpdateError) throw enrollmentUpdateError;

      const { data: completionId, error: completionError } = await admin.rpc(
        "record_pilot_completion_event",
        {
          target_user_id: targetUserId,
          target_outcome: outcome,
          target_actor_user_id: user.id,
          target_passed_validation_runs: passedValidationRuns,
          target_note: note || null,
        },
      );
      if (completionError) throw completionError;

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          target_user_id: targetUserId,
          action:
            outcome === "completed"
              ? "participant_completed"
              : "participant_withdrawn",
          details: {
            completion_id: completionId,
            passed_validation_runs: passedValidationRuns,
            note: note || null,
          },
        });
      if (auditError) throw auditError;

      await admin.from("notifications").insert({
        user_id: targetUserId,
        audience: "caregiver",
        kind:
          outcome === "completed"
            ? "pilot_completed"
            : "pilot_withdrawn",
        title:
          outcome === "completed"
            ? "Your EnVizion pilot journey is complete"
            : "Your EnVizion pilot participation has ended",
        body:
          outcome === "completed"
            ? "Thank you for completing the EnVizion Life pilot and launch validation."
            : "Your pilot participation has been closed. Your normal account and care access remain governed separately.",
        entity_type: "pilot_enrollment",
        entity_id: null,
      });

      return json({ ok: true, completionId });
    }


    if (action === "intelligence") {
      const participationDocuments = await currentPublishedDocuments(admin);
      const publishedParticipationTypes = new Set(
        participationDocuments.map((item: any) => String(item.document_type)),
      );
      const missingParticipationTypes = requiredDocumentTypes.filter(
        (type) => !publishedParticipationTypes.has(type),
      );

      const [
        enrollmentsResult,
        runsResult,
        drillsResult,
        wavesResult,
        signoffsResult,
        supportFeedbackResult,
        diagnosticFeedbackResult,
        contentResult,
      ] = await Promise.all([
        admin
          .from("pilot_enrollments")
          .select(
            "user_id, status, cohort, enrolled_at, exited_at, created_at, updated_at",
          ),
        admin
          .from("pilot_acceptance_runs")
          .select(
            "id, wave_id, tester_user_id, role, platform, device_class, status, started_at, completed_at",
          ),
        admin
          .from("pilot_recovery_drills")
          .select("id, wave_id, tester_user_id, drill_type, status, performed_at"),
        admin
          .from("pilot_launch_waves")
          .select(
            "id, name, cohort, status, required_platforms, starts_at, ends_at, created_at",
          )
          .order("created_at", { ascending: true }),
        admin
          .from("pilot_launch_signoffs")
          .select("id, wave_id, status, signed_at")
          .order("signed_at", { ascending: false }),
        admin
          .from("support_requests")
          .select("id, user_id, topic, status, created_at")
          .ilike("topic", "Pilot feedback ·%"),
        admin
          .from("app_diagnostic_reports")
          .select("id, user_id, status, created_at")
          .eq("area", "pilot_feedback_bug"),
        admin
          .from("clinical_content")
          .select("id, status"),
      ]);

      const intelligenceError = [
        enrollmentsResult.error,
        runsResult.error,
        drillsResult.error,
        wavesResult.error,
        signoffsResult.error,
        supportFeedbackResult.error,
        diagnosticFeedbackResult.error,
        contentResult.error,
      ].find(Boolean);
      if (intelligenceError) throw intelligenceError;

      const enrollments = enrollmentsResult.data ?? [];
      const participants = await buildParticipantOnboarding(admin, enrollments);
      const runs = runsResult.data ?? [];
      const drills = drillsResult.data ?? [];
      const waves = wavesResult.data ?? [];
      const signoffs = signoffsResult.data ?? [];
      const supportFeedback = supportFeedbackResult.data ?? [];
      const diagnosticFeedback = diagnosticFeedbackResult.data ?? [];
      const content = contentResult.data ?? [];

      const funnel = {
        enrolled: participants.length,
        accountConfirmed: participants.filter(
          (item: any) => item.invitation.accountConfirmed,
        ).length,
        firstSignIn: participants.filter(
          (item: any) => item.invitation.signedIn,
        ).length,
        documentsComplete: participants.filter(
          (item: any) => item.documents.complete,
        ).length,
        roleReady: participants.filter(
          (item: any) => item.roles.ready,
        ).length,
        activeLaunchReady: participants.filter(
          (item: any) => item.launchTestingReady,
        ).length,
        passedValidation: participants.filter(
          (item: any) => item.validation.passedRuns > 0,
        ).length,
        completed: participants.filter(
          (item: any) => item.completion?.outcome === "completed",
        ).length,
      };

      const deviceMap = new Map<string, any>();
      for (const run of runs) {
        const key = `${run.platform}:${run.device_class}`;
        const current = deviceMap.get(key) ?? {
          platform: run.platform,
          deviceClass: run.device_class,
          total: 0,
          passed: 0,
          failed: 0,
          blocked: 0,
          inProgress: 0,
        };
        current.total += 1;
        if (run.status === "passed") current.passed += 1;
        else if (run.status === "failed") current.failed += 1;
        else if (run.status === "blocked") current.blocked += 1;
        else current.inProgress += 1;
        deviceMap.set(key, current);
      }

      const deviceMatrix = Array.from(deviceMap.values())
        .map((item: any) => ({
          ...item,
          passRate:
            item.total > 0
              ? Math.round((item.passed / item.total) * 100)
              : 0,
        }))
        .sort((a: any, b: any) =>
          `${a.platform}:${a.deviceClass}`.localeCompare(
            `${b.platform}:${b.deviceClass}`,
          ),
        );

      const feedbackMap = new Map<string, any>();
      const addFeedback = (
        category: string,
        status: string,
        createdAt: string,
      ) => {
        const current = feedbackMap.get(category) ?? {
          category,
          total: 0,
          open: 0,
          closed: 0,
          last30Days: 0,
        };
        current.total += 1;
        const normalizedClosed = ["closed", "resolved"].includes(status);
        if (normalizedClosed) current.closed += 1;
        else current.open += 1;
        if (
          new Date(createdAt).getTime() >=
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ) {
          current.last30Days += 1;
        }
        feedbackMap.set(category, current);
      };

      for (const row of supportFeedback) {
        addFeedback(
          String(row.topic).replace("Pilot feedback · ", "") || "Feedback",
          row.status,
          row.created_at,
        );
      }
      for (const row of diagnosticFeedback) {
        addFeedback("Bug", row.status, row.created_at);
      }

      const latestSignoffByWave = new Map<string, any>();
      for (const signoff of signoffs) {
        if (!latestSignoffByWave.has(signoff.wave_id)) {
          latestSignoffByWave.set(signoff.wave_id, signoff);
        }
      }

      const waveComparisons = waves.map((wave: any) => {
        const waveRuns = runs.filter((run: any) => run.wave_id === wave.id);
        const waveDrills = drills.filter(
          (drill: any) => drill.wave_id === wave.id,
        );
        const passedRuns = waveRuns.filter(
          (run: any) => run.status === "passed",
        ).length;
        const failedRuns = waveRuns.filter(
          (run: any) => run.status === "failed",
        ).length;
        const blockedRuns = waveRuns.filter(
          (run: any) => run.status === "blocked",
        ).length;
        const passedDrills = waveDrills.filter(
          (drill: any) => drill.status === "passed",
        ).length;

        return {
          id: wave.id,
          name: wave.name,
          cohort: wave.cohort,
          status: wave.status,
          requiredPlatforms: wave.required_platforms ?? [],
          testerCount: new Set(
            waveRuns.map((run: any) => run.tester_user_id),
          ).size,
          runs: waveRuns.length,
          passedRuns,
          failedRuns,
          blockedRuns,
          runPassRate:
            waveRuns.length > 0
              ? Math.round((passedRuns / waveRuns.length) * 100)
              : 0,
          rolesCovered: Array.from(
            new Set(waveRuns.map((run: any) => run.role)),
          ).sort(),
          platformsCovered: Array.from(
            new Set(waveRuns.map((run: any) => run.platform)),
          ).sort(),
          drills: waveDrills.length,
          passedDrills,
          signoffStatus:
            latestSignoffByWave.get(wave.id)?.status ?? null,
          startsAt: wave.starts_at,
          endsAt: wave.ends_at,
        };
      });

      const outcomes = {
        completed: participants.filter(
          (item: any) => item.completion?.outcome === "completed",
        ).length,
        withdrawn: participants.filter(
          (item: any) => item.completion?.outcome === "withdrawn",
        ).length,
        active: participants.filter(
          (item: any) => item.status === "active",
        ).length,
        paused: participants.filter(
          (item: any) => item.status === "paused",
        ).length,
      };

      const contentReadiness = {
        total: content.length,
        draft: content.filter((item: any) => item.status === "draft").length,
        published: content.filter(
          (item: any) => item.status === "published",
        ).length,
        retired: content.filter((item: any) => item.status === "retired").length,
      };

      const launchGaps: string[] = [];
      if (missingParticipationTypes.length) {
        launchGaps.push(
          "Required participation documents missing: " +
            missingParticipationTypes
              .map((type) => type.replaceAll("_", " "))
              .join(", ") +
            ".",
        );
      }
      if (!participants.length)
        launchGaps.push("No real pilot participants are enrolled.");
      if (!waves.length)
        launchGaps.push("No real pilot launch wave has been created.");
      if (!runs.length)
        launchGaps.push("No real role/device acceptance run has been recorded.");
      if (!drills.length)
        launchGaps.push("No real failure/recovery drill evidence has been recorded.");
      if (!signoffs.length)
        launchGaps.push("No launch-wave sign-off has been recorded.");
      if (contentReadiness.published < contentReadiness.total)
        launchGaps.push(
          `${contentReadiness.total - contentReadiness.published} clinical content item(s) still require publication/approval.`,
        );

      return json({
        intelligence: {
          generatedAt: new Date().toISOString(),
          funnel,
          deviceMatrix,
          feedbackTrends: Array.from(feedbackMap.values()).sort(
            (a: any, b: any) => b.total - a.total,
          ),
          waveComparisons,
          outcomes,
          contentReadiness,
          launchGaps,
        },
      });
    }

    if (action === "list_documents") {
      const { data, error } = await admin
        .from("program_documents")
        .select(
          "id, document_type, title, version, body_markdown, status, effective_at, published_at, created_at, updated_at",
        )
        .order("document_type", { ascending: true })
        .order("version", { ascending: false });
      if (error) throw error;

      return json({
        documents: (data ?? []).map((row) => ({
          id: row.id,
          documentType: row.document_type,
          title: row.title,
          version: row.version,
          body: row.body_markdown,
          status: row.status,
          effectiveAt: row.effective_at,
          publishedAt: row.published_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
      });
    }

    if (action === "save_document") {
      const documentId = String(payload.documentId ?? "");
      const documentType = String(payload.documentType ?? "");
      const title = String(payload.title ?? "").trim();
      const body = String(payload.body ?? "").trim();

      if (!documentTypes.has(documentType) || !title || !body) {
        return json({ error: "Document type, title, and content are required." }, 400);
      }

      if (documentId) {
        const { data: before, error: beforeError } = await admin
          .from("program_documents")
          .select("id, status, document_type")
          .eq("id", documentId)
          .single();
        if (beforeError) throw beforeError;
        if (before.status !== "draft") {
          return json({ error: "Published or retired documents are immutable." }, 400);
        }
        if (before.document_type !== documentType) {
          return json(
            { error: "A saved draft cannot change document type. Create a new draft instead." },
            400,
          );
        }

        const { error: updateError } = await admin
          .from("program_documents")
          .update({
            title,
            body_markdown: body,
            updated_at: new Date().toISOString(),
          })
          .eq("id", documentId);
        if (updateError) throw updateError;

        const { error: auditError } = await admin
          .from("pilot_admin_audit")
          .insert({
            actor_user_id: user.id,
            document_id: documentId,
            action: "document_update",
            details: { document_type: documentType, title },
          });
        if (auditError) throw auditError;

        return json({ ok: true, documentId });
      }

      const { data: latest, error: latestError } = await admin
        .from("program_documents")
        .select("version")
        .eq("document_type", documentType)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestError) throw latestError;

      const version = (latest?.version ?? 0) + 1;
      const { data: created, error: createError } = await admin
        .from("program_documents")
        .insert({
          document_type: documentType,
          title,
          version,
          body_markdown: body,
          status: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (createError) throw createError;

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          document_id: created.id,
          action: "document_create",
          details: { document_type: documentType, title, version },
        });
      if (auditError) throw auditError;

      return json({ ok: true, documentId: created.id });
    }

    if (action === "publish_document") {
      const documentId = String(payload.documentId ?? "");
      if (!documentId) return json({ error: "Document is required." }, 400);

      const effectiveAtRaw = String(payload.effectiveAt ?? "").trim();
      const effectiveAt = effectiveAtRaw || new Date().toISOString();

      const { error } = await admin.rpc("publish_program_document", {
        target_document_id: documentId,
        actor_user_id: user.id,
        target_effective_at: effectiveAt,
      });
      if (error) throw error;

      return json({ ok: true });
    }

    if (action === "retire_document") {
      const documentId = String(payload.documentId ?? "");
      if (!documentId) return json({ error: "Document is required." }, 400);

      const { data: before, error: beforeError } = await admin
        .from("program_documents")
        .select("id, document_type, title, status")
        .eq("id", documentId)
        .single();
      if (beforeError) throw beforeError;

      if (before.status !== "published") {
        return json({ error: "Only a published document can be retired." }, 400);
      }

      const { error: updateError } = await admin
        .from("program_documents")
        .update({
          status: "retired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
      if (updateError) throw updateError;

      const { error: auditError } = await admin
        .from("pilot_admin_audit")
        .insert({
          actor_user_id: user.id,
          document_id: documentId,
          action: "document_retire",
          details: {
            document_type: before.document_type,
            title: before.title,
          },
        });
      if (auditError) throw auditError;

      return json({ ok: true });
    }

    if (action === "audit") {
      const { data, error } = await admin
        .from("pilot_admin_audit")
        .select("id, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      return json({
        audit: (data ?? []).map((row) => ({
          id: row.id,
          action: row.action,
          details: row.details ?? {},
          createdAt: row.created_at,
        })),
      });
    }

    return json({ error: "Unsupported pilot admin action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 500);
  }
});

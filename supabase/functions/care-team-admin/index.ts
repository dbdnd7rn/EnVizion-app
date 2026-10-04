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

type CareRole = "owner" | "caregiver" | "patient" | "viewer";
const inviteRoles = new Set<CareRole>(["caregiver", "patient", "viewer"]);

function careRoleForGroupRole(role: string | null | undefined): CareRole | null {
  if (role === "primary_advocate") return "owner";
  if (role === "co_caregiver") return "caregiver";
  if (role === "read_only") return "viewer";
  return null;
}

function directStatusForGroupStatus(status: string | null | undefined) {
  if (status === "active") return "active";
  if (status === "invited") return "invited";
  return "revoked";
}

function roleLabel(role: CareRole) {
  if (role === "owner") return "Primary Advocate";
  if (role === "caregiver") return "Co-Caregiver";
  if (role === "patient") return "Care Recipient";
  return "Family Member";
}

const INVITATION_TTL_DAYS = 14;
const REMINDER_COOLDOWN_HOURS = 24;

function invitationExpiry(from = new Date()) {
  return new Date(
    from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function invitationExpired(expiresAt: string | null | undefined) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function reminderCoolingDown(lastRemindedAt: string | null | undefined) {
  if (!lastRemindedAt) return false;
  return (
    Date.now() - new Date(lastRemindedAt).getTime() <
    REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000
  );
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

async function getUsersById(admin: any, userIds: string[]) {
  const entries = await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      return [userId, error ? null : data.user] as const;
    }),
  );

  return new Map(entries);
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

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const payload = await req.json().catch(() => ({}));
    const action = String(payload.action ?? "");

    if (action === "pending") {
      const { data: pending, error } = await admin
        .from("care_recipient_members")
        .select(
          "care_recipient_id, role, status, invited_by, invited_email, invited_name, invited_at, invite_expires_at, last_reminded_at",
        )
        .eq("user_id", user.id)
        .eq("status", "invited")
        .order("invited_at", { ascending: true });

      if (error) throw error;

      const recipientIds = (pending ?? []).map((row) => row.care_recipient_id);
      const { data: recipients, error: recipientError } = recipientIds.length
        ? await admin
            .from("care_recipients")
            .select("id, display_name, relationship")
            .in("id", recipientIds)
        : { data: [], error: null };

      if (recipientError) throw recipientError;

      const recipientMap = new Map(
        (recipients ?? []).map((row) => [row.id, row]),
      );
      const inviterMap = await getUsersById(
        admin,
        (pending ?? [])
          .map((row) => row.invited_by)
          .filter((value): value is string => Boolean(value)),
      );

      return json({
        invitations: (pending ?? [])
          .filter((row) => !invitationExpired(row.invite_expires_at))
          .map((row) => {
          const recipient = recipientMap.get(row.care_recipient_id);
          const inviter = row.invited_by
            ? inviterMap.get(row.invited_by)
            : null;
          const inviterName =
            String(inviter?.user_metadata?.full_name ?? "").trim() ||
            String(inviter?.email ?? "").trim() ||
            "Your Primary Advocate";

          return {
            careRecipientId: row.care_recipient_id,
            careRecipientName: recipient?.display_name ?? "Care recipient",
            relationship: recipient?.relationship ?? "",
            role: row.role,
            invitedName: row.invited_name ?? "",
            inviterName,
            invitedAt: row.invited_at,
            inviteExpiresAt: row.invite_expires_at,
            lastRemindedAt: row.last_reminded_at,
          };
        }),
      });
    }

    if (action === "accept" || action === "decline") {
      const careRecipientId = String(payload.careRecipientId ?? "");
      if (!careRecipientId) {
        return json({ error: "Care recipient is required" }, 400);
      }

      const { data: membership, error: memberError } = await admin
        .from("care_recipient_members")
        .select("role, status, invite_expires_at")
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", user.id)
        .single();

      if (memberError) throw memberError;
      if (membership.status !== "invited") {
        return json({ error: "This invitation is no longer pending." }, 400);
      }
      if (invitationExpired(membership.invite_expires_at)) {
        return json(
          {
            error:
              "This invitation has expired. Ask the Primary Advocate to send a new invitation.",
          },
          400,
        );
      }

      const accepted = action === "accept";
      const { error: updateError } = await admin
        .from("care_recipient_members")
        .update({
          status: accepted ? "active" : "declined",
          accepted_at: accepted ? new Date().toISOString() : null,
          revoked_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      const { data: recipient, error: recipientError } = await admin
        .from("care_recipients")
        .select("owner_id, display_name")
        .eq("id", careRecipientId)
        .single();

      if (recipientError) throw recipientError;

      const { error: consentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: user.id,
          event_type: accepted ? "invite_accepted" : "invite_declined",
          role: membership.role,
        });

      if (consentError) throw consentError;

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          user_id: recipient.owner_id,
          audience: "caregiver",
          kind: accepted ? "care_invite_accepted" : "care_invite_declined",
          title: accepted ? "Care team invitation accepted" : "Care team invitation declined",
          body: accepted
            ? `A care team member accepted access to ${recipient.display_name}.`
            : `A care team invitation for ${recipient.display_name} was declined.`,
          entity_type: "care_recipient",
          entity_id: careRecipientId,
        });

      if (notificationError) throw notificationError;

      return json({ ok: true, accepted });
    }

    const careRecipientId = String(payload.careRecipientId ?? "");
    if (!careRecipientId) {
      return json({ error: "Care recipient is required" }, 400);
    }

    const { data: recipient, error: recipientError } = await admin
      .from("care_recipients")
      .select("id, owner_id, display_name, care_group_id")
      .eq("id", careRecipientId)
      .single();

    if (recipientError) throw recipientError;

    const isOwner = recipient.owner_id === user.id;

    const [
      { data: callerMembership, error: callerMembershipError },
      { data: callerGroupMembership, error: callerGroupError },
    ] = await Promise.all([
      admin
        .from("care_recipient_members")
        .select("role, status")
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", user.id)
        .maybeSingle(),
      recipient.care_group_id
        ? admin
            .from("care_group_members")
            .select("role, status")
            .eq("care_group_id", recipient.care_group_id)
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (callerMembershipError) throw callerMembershipError;
    if (callerGroupError) throw callerGroupError;

    const groupCallerRole =
      callerGroupMembership?.status === "active"
        ? careRoleForGroupRole(callerGroupMembership.role)
        : null;
    const currentRole: CareRole =
      isOwner
        ? "owner"
        : callerMembership?.status === "active" &&
            callerMembership.role === "patient"
          ? "patient"
          : groupCallerRole ??
            (callerMembership?.status === "active" &&
            ["owner", "caregiver", "viewer"].includes(callerMembership.role)
              ? (callerMembership.role as CareRole)
              : "viewer");

    const canView =
      isOwner ||
      callerMembership?.status === "active" ||
      (callerGroupMembership?.status === "active" && Boolean(groupCallerRole));
    const canManage =
      isOwner ||
      (callerGroupMembership?.status === "active" &&
        callerGroupMembership.role === "primary_advocate") ||
      (callerMembership?.status === "active" &&
        callerMembership.role === "owner");

    if (!canView) return json({ error: "Care team access required" }, 403);

    if (action === "attention") {
      if (!canManage) {
        return json(
          { error: "Only a Primary Advocate can review invitation attention." },
          403,
        );
      }

      const { data: invitationRows, error: invitationError } = await admin
        .from("care_recipient_members")
        .select(
          "user_id, invited_name, invited_email, role, status, invited_at, invite_expires_at",
        )
        .eq("care_recipient_id", careRecipientId)
        .eq("status", "invited")
        .order("invite_expires_at", { ascending: true });

      if (invitationError) throw invitationError;

      const rows = invitationRows ?? [];
      const now = Date.now();
      const nearCutoff = now + 48 * 60 * 60 * 1000;
      const expired = rows.filter(
        (row) =>
          row.invite_expires_at &&
          new Date(row.invite_expires_at).getTime() <= now,
      );
      const nearExpiry = rows.filter((row) => {
        if (!row.invite_expires_at) return false;
        const at = new Date(row.invite_expires_at).getTime();
        return at > now && at <= nearCutoff;
      });
      const next = [...expired, ...nearExpiry][0] ?? null;

      return json({
        pending: rows.length,
        nearExpiry: nearExpiry.length,
        expired: expired.length,
        needsAttention: nearExpiry.length + expired.length,
        next: next
          ? {
              userId: next.user_id,
              displayName:
                String(next.invited_name ?? "").trim() ||
                String(next.invited_email ?? "").trim() ||
                "Care team member",
              role: next.role,
              inviteExpiresAt: next.invite_expires_at,
              isExpired: invitationExpired(next.invite_expires_at),
            }
          : null,
      });
    }

    if (action === "record_access_report") {
      if (!canManage) {
        return json(
          { error: "Only a Primary Advocate can generate care access reports." },
          403,
        );
      }

      const allowedPeriods = new Map([
        ["last_7_days", "Last 7 days"],
        ["last_30_days", "Last 30 days"],
        ["last_90_days", "Last 90 days"],
        ["all_recorded_history", "All recorded history"],
      ]);
      const period = String(payload.period ?? "");
      const periodLabel = allowedPeriods.get(period);

      if (!periodLabel) {
        return json({ error: "A valid report period is required." }, 400);
      }

      const { error: auditError } = await admin
        .from("care_audit_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          action: "access_report_generated",
          entity_type: "care_access_report",
          entity_id: careRecipientId,
          summary: `Care Team Access Report generated · ${periodLabel}`,
        });

      if (auditError) throw auditError;

      return json({ ok: true });
    }

    if (action === "list") {
      const [
        { data: directMembers, error: membersError },
        { data: groupMembers, error: groupMembersError },
      ] = await Promise.all([
        admin
          .from("care_recipient_members")
          .select(
            "user_id, role, status, invited_by, invited_email, invited_name, invited_at, accepted_at, revoked_at, invite_expires_at, last_reminded_at, invite_email_requested_at, created_at, updated_at",
          )
          .eq("care_recipient_id", careRecipientId)
          .order("created_at", { ascending: true }),
        recipient.care_group_id
          ? admin
              .from("care_group_members")
              .select(
                "user_id, role, status, invited_by, joined_at, created_at, updated_at",
              )
              .eq("care_group_id", recipient.care_group_id)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (membersError) throw membersError;
      if (groupMembersError) throw groupMembersError;

      const merged = new Map<string, any>();
      for (const row of directMembers ?? []) {
        merged.set(row.user_id, { ...row });
      }

      for (const row of groupMembers ?? []) {
        const mappedRole = careRoleForGroupRole(row.role);
        if (!mappedRole) continue;

        const existing = merged.get(row.user_id);
        if (existing?.role === "patient") continue;

        const mappedStatus = directStatusForGroupStatus(row.status);
        merged.set(row.user_id, {
          user_id: row.user_id,
          role: mappedRole,
          status: mappedStatus,
          invited_by: existing?.invited_by ?? row.invited_by ?? null,
          invited_email: existing?.invited_email ?? "",
          invited_name: existing?.invited_name ?? "",
          invited_at: existing?.invited_at ?? row.created_at ?? null,
          accepted_at:
            mappedStatus === "active"
              ? existing?.accepted_at ?? row.joined_at ?? null
              : null,
          invite_expires_at: existing?.invite_expires_at ?? null,
          last_reminded_at: existing?.last_reminded_at ?? null,
          invite_email_requested_at:
            existing?.invite_email_requested_at ?? null,
          revoked_at:
            mappedStatus === "revoked"
              ? existing?.revoked_at ?? row.updated_at ?? null
              : null,
          created_at: existing?.created_at ?? row.created_at ?? null,
          updated_at: row.updated_at ?? existing?.updated_at ?? null,
        });
      }

      const members = [...merged.values()];
      const userMap = await getUsersById(
        admin,
        members.map((row) => row.user_id),
      );

      return json({
        canManage,
        currentRole,
        members: members.map((row) => {
          const account = userMap.get(row.user_id);
          return {
            userId: row.user_id,
            displayName:
              row.invited_name ||
              String(account?.user_metadata?.full_name ?? "") ||
              (row.role === "owner" ? "Primary Advocate" : "Care team member"),
            email:
              canManage || row.user_id === user.id
                ? account?.email ?? row.invited_email ?? ""
                : "",
            role: row.role,
            status: row.status,
            invitedAt: row.invited_at,
            acceptedAt: row.accepted_at,
            revokedAt: row.revoked_at,
            inviteExpiresAt: row.invite_expires_at ?? null,
            lastRemindedAt: row.last_reminded_at ?? null,
            emailRequestedAt: row.invite_email_requested_at ?? null,
            isExpired:
              row.status === "invited" &&
              invitationExpired(row.invite_expires_at),
            isCurrentUser: row.user_id === user.id,
          };
        }),
      });
    }

    if (!canManage) {
      return json({ error: "Only a Primary Advocate can manage care access." }, 403);
    }

    if (action === "invite") {
      const email = String(payload.email ?? "").trim().toLowerCase();
      const displayName = String(payload.displayName ?? "").trim();
      const role = String(payload.role ?? "") as CareRole;

      if (!email || !email.includes("@") || !displayName || !inviteRoles.has(role)) {
        return json({ error: "Valid name, email, and access role are required." }, 400);
      }

      let target = await findUserByEmail(admin, email);
      let invitationEmailSent = false;

      const { data: inviterAccount } = await admin.auth.admin.getUserById(user.id);
      const inviterName =
        String(inviterAccount?.user?.user_metadata?.full_name ?? "").trim() ||
        String(inviterAccount?.user?.email ?? "").trim() ||
        "Your care team";
      const invitationRoleLabel = roleLabel(role);

      if (!target) {
        const { data: invited, error: inviteError } =
          await admin.auth.admin.inviteUserByEmail(email, {
            data: {
              full_name: displayName,
              invited_by_name: inviterName,
              care_recipient_name: recipient.display_name,
              care_access_role: invitationRoleLabel,
              invite_context: "EnVizion Life care team",
            },
            redirectTo: "https://envizion-life-caregiver.onrender.com",
          });

        if (inviteError) throw inviteError;
        target = invited.user;
        invitationEmailSent = true;
      }

      if (!target) return json({ error: "Could not resolve invited account." }, 500);
      if (target.id === recipient.owner_id) {
        return json({ error: "The care owner already has access." }, 400);
      }

      const [
        { data: existing },
        { data: existingGroupMembership, error: existingGroupError },
      ] = await Promise.all([
        admin
          .from("care_recipient_members")
          .select("status")
          .eq("care_recipient_id", careRecipientId)
          .eq("user_id", target.id)
          .maybeSingle(),
        recipient.care_group_id
          ? admin
              .from("care_group_members")
              .select("status")
              .eq("care_group_id", recipient.care_group_id)
              .eq("user_id", target.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (existingGroupError) throw existingGroupError;

      if (
        existing?.status === "active" ||
        existingGroupMembership?.status === "active"
      ) {
        return json(
          {
            error:
              "This person already has active access to this CareGroup. Change their role from the existing care-team roster instead.",
          },
          400,
        );
      }

      const eventType =
        existing?.status === "revoked" ||
        existing?.status === "declined" ||
        existingGroupMembership?.status === "revoked"
          ? "access_reinvited"
          : "invite_sent";

      const now = new Date();
      const nowIso = now.toISOString();
      const { error: memberError } = await admin
        .from("care_recipient_members")
        .upsert({
          care_recipient_id: careRecipientId,
          user_id: target.id,
          role,
          status: "invited",
          invited_by: user.id,
          invited_email: email,
          invited_name: displayName,
          invited_at: nowIso,
          invite_expires_at: invitationExpiry(now),
          last_reminded_at: null,
          invite_email_requested_at: invitationEmailSent ? nowIso : null,
          auto_reminded_at: null,
          owner_attention_notified_at: null,
          expired_notified_at: null,
          accepted_at: null,
          revoked_at: null,
          updated_at: nowIso,
        });

      if (memberError) throw memberError;

      const { error: consentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: target.id,
          event_type: eventType,
          role,
        });

      if (consentError) throw consentError;

      const { error: notificationError } = await admin
        .from("notifications")
        .insert({
          user_id: target.id,
          audience: "caregiver",
          kind: "care_invitation",
          title: "Care team invitation",
          body: `You were invited to help care for ${recipient.display_name} as ${invitationRoleLabel}.`,
          entity_type: "care_recipient",
          entity_id: careRecipientId,
        });

      if (notificationError) throw notificationError;

      return json({ ok: true, invitationEmailSent, userId: target.id });
    }

    const targetUserId = String(payload.userId ?? "");
    if (!targetUserId || targetUserId === recipient.owner_id) {
      return json({ error: "A non-owner care team member is required." }, 400);
    }

    const [
      { data: directTarget, error: targetError },
      { data: groupTarget, error: groupTargetError },
    ] = await Promise.all([
      admin
        .from("care_recipient_members")
        .select("role, status, invite_expires_at, last_reminded_at")
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", targetUserId)
        .maybeSingle(),
      recipient.care_group_id
        ? admin
            .from("care_group_members")
            .select("role, status")
            .eq("care_group_id", recipient.care_group_id)
            .eq("user_id", targetUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (targetError) throw targetError;
    if (groupTargetError) throw groupTargetError;

    const groupTargetRole = careRoleForGroupRole(groupTarget?.role);
    const targetMember =
      directTarget?.role === "patient"
        ? directTarget
        : groupTargetRole
          ? {
              role: groupTargetRole,
              status: directStatusForGroupStatus(groupTarget?.status),
            }
          : directTarget;

    if (!targetMember) {
      return json({ error: "Care team member was not found." }, 404);
    }

    if (action === "send_reminder") {
      if (!directTarget || directTarget.status !== "invited") {
        return json({ error: "Only a pending invitation can be reminded." }, 400);
      }
      if (invitationExpired(directTarget.invite_expires_at)) {
        return json(
          {
            error:
              "This invitation has expired. Re-open the invitation before sending a reminder.",
          },
          400,
        );
      }
      if (reminderCoolingDown(directTarget.last_reminded_at)) {
        return json(
          {
            error:
              "A reminder was already sent in the last 24 hours.",
          },
          400,
        );
      }

      const now = new Date().toISOString();
      const { error: reminderUpdateError } = await admin
        .from("care_recipient_members")
        .update({
          last_reminded_at: now,
          updated_at: now,
        })
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", targetUserId);

      if (reminderUpdateError) throw reminderUpdateError;

      const { data: inviterAccount } = await admin.auth.admin.getUserById(user.id);
      const inviterName =
        String(inviterAccount?.user?.user_metadata?.full_name ?? "").trim() ||
        String(inviterAccount?.user?.email ?? "").trim() ||
        "Your Primary Advocate";

      const { error: reminderNotificationError } = await admin
        .from("notifications")
        .insert({
          user_id: targetUserId,
          audience: "caregiver",
          kind: "care_invite_reminder",
          title: "Care invitation reminder",
          body: `${inviterName} is reminding you about your ${roleLabel(targetMember.role)} invitation to ${recipient.display_name}’s care space.`,
          entity_type: "care_recipient",
          entity_id: careRecipientId,
        });

      if (reminderNotificationError) throw reminderNotificationError;

      const { error: reminderConsentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: targetUserId,
          event_type: "invite_reminder_sent",
          role: targetMember.role,
        });

      if (reminderConsentError) throw reminderConsentError;

      return json({ ok: true, remindedAt: now });
    }

    if (action === "update_role") {
      const role = String(payload.role ?? "") as CareRole;
      if (!inviteRoles.has(role)) {
        return json({ error: "Role must be Co-Caregiver, Care Recipient, or Family Member." }, 400);
      }

      const now = new Date().toISOString();
      const directValues = {
        care_recipient_id: careRecipientId,
        user_id: targetUserId,
        role,
        status: targetMember.status,
        invited_by: user.id,
        invited_at: now,
        accepted_at: targetMember.status === "active" ? now : null,
        revoked_at: targetMember.status === "revoked" ? now : null,
        updated_at: now,
      };

      const { error: updateError } = directTarget
        ? await admin
            .from("care_recipient_members")
            .update({ role, updated_at: now })
            .eq("care_recipient_id", careRecipientId)
            .eq("user_id", targetUserId)
        : await admin.from("care_recipient_members").insert(directValues);

      if (updateError) throw updateError;

      const { error: consentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: targetUserId,
          event_type: "role_changed",
          role,
          note: `Previous role: ${targetMember.role}`,
        });
      if (consentError) throw consentError;

      await admin.from("notifications").insert({
        user_id: targetUserId,
        audience: "caregiver",
        kind: "care_role_changed",
        title: "Care team access updated",
        body: `Your access to ${recipient.display_name} is now ${roleLabel(role)}.`,
        entity_type: "care_recipient",
        entity_id: careRecipientId,
      });

      return json({ ok: true });
    }

    if (action === "revoke") {
      if (targetMember.status === "revoked") {
        return json({ error: "Access is already revoked." }, 400);
      }

      const now = new Date().toISOString();
      const { error: updateError } = directTarget
        ? await admin
            .from("care_recipient_members")
            .update({
              status: "revoked",
              revoked_at: now,
              updated_at: now,
            })
            .eq("care_recipient_id", careRecipientId)
            .eq("user_id", targetUserId)
        : await admin.from("care_recipient_members").insert({
            care_recipient_id: careRecipientId,
            user_id: targetUserId,
            role: targetMember.role,
            status: "revoked",
            invited_by: user.id,
            invited_at: now,
            accepted_at: null,
            revoked_at: now,
            updated_at: now,
          });

      if (updateError) throw updateError;

      const { error: consentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: targetUserId,
          event_type: "access_revoked",
          role: targetMember.role,
        });
      if (consentError) throw consentError;

      await admin.from("notifications").insert({
        user_id: targetUserId,
        audience: "caregiver",
        kind: "care_access_revoked",
        title: "Care team access changed",
        body: `Your access to ${recipient.display_name} was revoked by a Primary Advocate.`,
        entity_type: "care_recipient",
        entity_id: careRecipientId,
      });

      return json({ ok: true });
    }

    if (action === "reinvite") {
      const expiredPending =
        directTarget?.status === "invited" &&
        invitationExpired(directTarget.invite_expires_at);

      if (
        !["revoked", "declined"].includes(targetMember.status) &&
        !expiredPending
      ) {
        return json({ error: "This member does not need a new invitation." }, 400);
      }

      const nowDate = new Date();
      const now = nowDate.toISOString();
      const { error: updateError } = directTarget
        ? await admin
            .from("care_recipient_members")
            .update({
              status: "invited",
              invited_by: user.id,
              invited_at: now,
              invite_expires_at: invitationExpiry(nowDate),
              last_reminded_at: null,
              auto_reminded_at: null,
              owner_attention_notified_at: null,
              expired_notified_at: null,
              accepted_at: null,
              revoked_at: null,
              updated_at: now,
            })
            .eq("care_recipient_id", careRecipientId)
            .eq("user_id", targetUserId)
        : await admin.from("care_recipient_members").insert({
            care_recipient_id: careRecipientId,
            user_id: targetUserId,
            role: targetMember.role,
            status: "invited",
            invited_by: user.id,
            invited_at: now,
            invite_expires_at: invitationExpiry(nowDate),
            last_reminded_at: null,
            auto_reminded_at: null,
            owner_attention_notified_at: null,
            expired_notified_at: null,
            accepted_at: null,
            revoked_at: null,
            updated_at: now,
          });

      if (updateError) throw updateError;

      const { error: consentError } = await admin
        .from("care_consent_events")
        .insert({
          care_recipient_id: careRecipientId,
          actor_user_id: user.id,
          subject_user_id: targetUserId,
          event_type: "access_reinvited",
          role: targetMember.role,
        });
      if (consentError) throw consentError;

      await admin.from("notifications").insert({
        user_id: targetUserId,
        audience: "caregiver",
        kind: "care_invitation",
        title: "Care team invitation",
        body: `You were invited again to help care for ${recipient.display_name}.`,
        entity_type: "care_recipient",
        entity_id: careRecipientId,
      });

      return json({ ok: true });
    }

    return json({ error: "Unsupported care team action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, 500);
  }
});

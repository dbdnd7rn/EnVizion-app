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
          "care_recipient_id, role, status, invited_by, invited_email, invited_name, invited_at",
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

      return json({
        invitations: (pending ?? []).map((row) => {
          const recipient = recipientMap.get(row.care_recipient_id);
          return {
            careRecipientId: row.care_recipient_id,
            careRecipientName: recipient?.display_name ?? "Care recipient",
            relationship: recipient?.relationship ?? "",
            role: row.role,
            invitedName: row.invited_name ?? "",
            invitedAt: row.invited_at,
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
        .select("role, status")
        .eq("care_recipient_id", careRecipientId)
        .eq("user_id", user.id)
        .single();

      if (memberError) throw memberError;
      if (membership.status !== "invited") {
        return json({ error: "This invitation is no longer pending." }, 400);
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

    if (action === "list") {
      const [
        { data: directMembers, error: membersError },
        { data: groupMembers, error: groupMembersError },
      ] = await Promise.all([
        admin
          .from("care_recipient_members")
          .select(
            "user_id, role, status, invited_by, invited_email, invited_name, invited_at, accepted_at, revoked_at, created_at, updated_at",
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
          invited_at: new Date().toISOString(),
          accepted_at: null,
          revoked_at: null,
          updated_at: new Date().toISOString(),
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
        .select("role, status")
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
      if (!["revoked", "declined"].includes(targetMember.status)) {
        return json({ error: "This member does not need a new invitation." }, 400);
      }

      const now = new Date().toISOString();
      const { error: updateError } = directTarget
        ? await admin
            .from("care_recipient_members")
            .update({
              status: "invited",
              invited_by: user.id,
              invited_at: now,
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

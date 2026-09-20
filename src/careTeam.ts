import { supabase } from "./supabase";

export type CareRole = "owner" | "caregiver" | "viewer";
export type CareMemberStatus = "invited" | "active" | "declined" | "revoked";

export type CareInvitation = {
  careRecipientId: string;
  careRecipientName: string;
  relationship: string;
  role: Exclude<CareRole, "owner">;
  invitedName: string;
  invitedAt: string | null;
};

export type CareTeamMember = {
  userId: string;
  displayName: string;
  email: string;
  role: CareRole;
  status: CareMemberStatus;
  invitedAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  isCurrentUser: boolean;
};

export type CareTeamRoster = {
  canManage: boolean;
  currentRole: CareRole;
  members: CareTeamMember[];
};

export type CareSpace = {
  careRecipientId: string;
  careRecipientName: string;
  relationship: string;
  role: CareRole;
  active: boolean;
};

export type ConsentEvent = {
  id: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  eventType: string;
  role: CareRole | null;
  note: string | null;
  createdAt: string;
};

export type CareAuditEvent = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
};

async function invokeCareTeam<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("care-team-admin", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function loadPendingCareInvitations(): Promise<CareInvitation[]> {
  const result = await invokeCareTeam<{ invitations: CareInvitation[] }>({
    action: "pending",
  });
  return result.invitations ?? [];
}

export async function respondToCareInvitation(
  careRecipientId: string,
  response: "accept" | "decline",
) {
  await invokeCareTeam({
    action: response,
    careRecipientId,
  });

  if (response === "accept") {
    await setActiveCareRecipient(careRecipientId);
  }
}

export async function loadCareTeam(
  careRecipientId: string,
): Promise<CareTeamRoster> {
  return invokeCareTeam<CareTeamRoster>({
    action: "list",
    careRecipientId,
  });
}

export async function inviteCareTeamMember(input: {
  careRecipientId: string;
  displayName: string;
  email: string;
  role: Exclude<CareRole, "owner">;
}): Promise<{ invitationEmailSent: boolean; userId: string }> {
  return invokeCareTeam({
    action: "invite",
    careRecipientId: input.careRecipientId,
    displayName: input.displayName,
    email: input.email,
    role: input.role,
  });
}

export async function updateCareTeamRole(input: {
  careRecipientId: string;
  userId: string;
  role: Exclude<CareRole, "owner">;
}) {
  await invokeCareTeam({
    action: "update_role",
    careRecipientId: input.careRecipientId,
    userId: input.userId,
    role: input.role,
  });
}

export async function revokeCareTeamAccess(
  careRecipientId: string,
  userId: string,
) {
  await invokeCareTeam({
    action: "revoke",
    careRecipientId,
    userId,
  });
}

export async function reinviteCareTeamMember(
  careRecipientId: string,
  userId: string,
) {
  await invokeCareTeam({
    action: "reinvite",
    careRecipientId,
    userId,
  });
}

export async function loadCareSpaces(): Promise<CareSpace[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return [];

  const [{ data: memberships, error: memberError }, { data: preferences }] =
    await Promise.all([
      supabase
        .from("care_recipient_members")
        .select("care_recipient_id, role")
        .eq("user_id", user.id)
        .eq("status", "active"),
      supabase
        .from("user_preferences")
        .select("active_care_recipient_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  if (memberError) throw memberError;

  const rows = memberships ?? [];
  if (!rows.length) return [];

  const recipientIds = rows.map((row) => row.care_recipient_id);
  const { data: recipients, error: recipientError } = await supabase
    .from("care_recipients")
    .select("id, display_name, relationship")
    .in("id", recipientIds);

  if (recipientError) throw recipientError;

  const recipientMap = new Map(
    (recipients ?? []).map((row) => [row.id, row]),
  );

  const preferredId = preferences?.active_care_recipient_id ?? null;

  return rows
    .map((row) => {
      const recipient = recipientMap.get(row.care_recipient_id);
      if (!recipient) return null;

      return {
        careRecipientId: row.care_recipient_id,
        careRecipientName: recipient.display_name,
        relationship: recipient.relationship ?? "A loved one",
        role: row.role as CareRole,
        active: preferredId
          ? preferredId === row.care_recipient_id
          : row === rows[0],
      };
    })
    .filter((space): space is CareSpace => Boolean(space));
}

export async function setActiveCareRecipient(careRecipientId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data: membership, error: membershipError } = await supabase
    .from("care_recipient_members")
    .select("care_recipient_id")
    .eq("care_recipient_id", careRecipientId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error("You do not have active access to this care profile.");

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    active_care_recipient_id: careRecipientId,
  });

  if (error) throw error;
}

export async function loadConsentHistory(
  careRecipientId: string,
): Promise<ConsentEvent[]> {
  const { data, error } = await supabase
    .from("care_consent_events")
    .select(
      "id, actor_user_id, subject_user_id, event_type, role, note, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    subjectUserId: row.subject_user_id,
    eventType: row.event_type,
    role: (row.role as CareRole | null) ?? null,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function loadCareAuditTrail(
  careRecipientId: string,
): Promise<CareAuditEvent[]> {
  const { data, error } = await supabase
    .from("care_audit_events")
    .select(
      "id, actor_user_id, action, entity_type, entity_id, summary, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    actorUserId: row.actor_user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function recordCareWorkspaceOpen(careRecipientId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase.from("care_audit_events").insert({
    care_recipient_id: careRecipientId,
    actor_user_id: user.id,
    action: "workspace_opened",
    entity_type: "care_workspace",
    entity_id: careRecipientId,
    summary: "Care workspace opened",
  });

  if (error) {
    // Access logging should never block the care experience.
  }
}

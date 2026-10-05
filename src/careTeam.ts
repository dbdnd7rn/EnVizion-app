import { supabase } from "./supabase";

export type CareRole = "owner" | "caregiver" | "patient" | "viewer";
export type CareMemberStatus = "invited" | "active" | "declined" | "revoked";

export type CareInvitation = {
  careRecipientId: string;
  careRecipientName: string;
  relationship: string;
  role: Exclude<CareRole, "owner">;
  invitedName: string;
  inviterName: string;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  lastRemindedAt: string | null;
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
  inviteExpiresAt: string | null;
  lastRemindedAt: string | null;
  emailRequestedAt: string | null;
  isExpired: boolean;
  isCurrentUser: boolean;
};

export type CareTeamRoster = {
  canManage: boolean;
  currentRole: CareRole;
  members: CareTeamMember[];
};

export type CareInvitationAttention = {
  pending: number;
  nearExpiry: number;
  expired: number;
  needsAttention: number;
  next: {
    userId: string;
    displayName: string;
    role: Exclude<CareRole, "owner">;
    inviteExpiresAt: string | null;
    isExpired: boolean;
  } | null;
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

export type CareAccessReportPeriod =
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "all_recorded_history";

export type CareAccessReportData = {
  canManage: boolean;
  currentRole: CareRole;
  members: CareTeamMember[];
  events: ConsentEvent[];
};

export type CareTeamSecurityFinding = {
  id: string;
  severity: "critical" | "warning" | "review";
  category: "permissions" | "invitations" | "activity" | "integrity";
  userId: string | null;
  memberName: string | null;
  title: string;
  detail: string;
  recommendation: string;
};

export type CareTeamSecurityReview = {
  reviewedAt: string;
  thresholds: {
    pendingInvitationDays: number;
    staleAccessDays: number;
  };
  summary: {
    critical: number;
    warning: number;
    review: number;
    total: number;
    status: "action_required" | "attention" | "review" | "clear";
  };
  findings: CareTeamSecurityFinding[];
  checks: string[];
};

export type CareTeamSecurityRemediationOption = {
  key: string;
  label: string;
  before: string;
  after: string;
  impact: string;
  destructive: boolean;
  fingerprint: string;
};

export type CareTeamSecurityRemediationOptions = {
  findingId: string;
  memberName: string;
  options: CareTeamSecurityRemediationOption[];
};

export type CareTeamSecurityRemediationResult = {
  ok: true;
  memberName: string;
  remediationKey: string;
  before: string;
  after: string;
};

export type CareAccessRecertificationDecision =
  | "keep"
  | "change_role"
  | "revoke";

export type CareAccessRecertificationItem = {
  id: string;
  userId: string;
  displayName: string;
  role: Extract<CareRole, "caregiver" | "viewer">;
  status: "scheduled" | "due" | "completed";
  dueAt: string;
  notifiedAt: string | null;
  decision: CareAccessRecertificationDecision | null;
  roleAfter: Extract<CareRole, "caregiver" | "viewer"> | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
};

export type CareAccessRecertificationOverview = {
  dueCount: number;
  upcomingCount: number;
  completedCount: number;
  cadenceDays: number;
  items: CareAccessRecertificationItem[];
};

export type CareAccessRecertificationAttention = {
  due: number;
  upcoming7: number;
  overdue7: number;
  overdue14: number;
  needsAttention: number;
  next: {
    id: string;
    userId: string;
    displayName: string;
    role: Extract<CareRole, "caregiver" | "viewer">;
    dueAt: string;
    isDue: boolean;
    overdueDays: number;
  } | null;
};

export type CareAccessRecertificationResult = {
  ok: true;
  subjectUserId: string;
  decision: CareAccessRecertificationDecision;
  before: string;
  after: string;
  nextDueAt: string | null;
};

async function invokeCareTeam<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("care-team-admin", {
    body,
  });

  if (error) {
    const detail = await error.context?.clone?.().json().catch(() => null);
    throw new Error(detail?.error || error.message || "Care team request failed.");
  }
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

export async function loadCareInvitationAttention(
  careRecipientId: string,
): Promise<CareInvitationAttention> {
  return invokeCareTeam<CareInvitationAttention>({
    action: "attention",
    careRecipientId,
  });
}

export async function loadCareTeamSecurityReview(
  careRecipientId: string,
): Promise<CareTeamSecurityReview> {
  return invokeCareTeam<CareTeamSecurityReview>({
    action: "security_review",
    careRecipientId,
  });
}

export async function loadCareTeamSecurityRemediationOptions(
  careRecipientId: string,
  findingId: string,
): Promise<CareTeamSecurityRemediationOptions> {
  return invokeCareTeam<CareTeamSecurityRemediationOptions>({
    action: "security_remediation_options",
    careRecipientId,
    findingId,
  });
}

export async function applyCareTeamSecurityRemediation(input: {
  careRecipientId: string;
  findingId: string;
  remediationKey: string;
  fingerprint: string;
}): Promise<CareTeamSecurityRemediationResult> {
  return invokeCareTeam<CareTeamSecurityRemediationResult>({
    action: "security_remediation_apply",
    careRecipientId: input.careRecipientId,
    findingId: input.findingId,
    remediationKey: input.remediationKey,
    fingerprint: input.fingerprint,
    confirm: true,
  });
}

export async function loadCareAccessRecertifications(
  careRecipientId: string,
): Promise<CareAccessRecertificationOverview> {
  return invokeCareTeam<CareAccessRecertificationOverview>({
    action: "recertifications",
    careRecipientId,
  });
}

export async function loadCareAccessRecertificationAttention(
  careRecipientId: string,
): Promise<CareAccessRecertificationAttention> {
  return invokeCareTeam<CareAccessRecertificationAttention>({
    action: "recertification_attention",
    careRecipientId,
  });
}

export async function completeCareAccessRecertification(input: {
  careRecipientId: string;
  recertificationId: string;
  decision: CareAccessRecertificationDecision;
  roleAfter?: Extract<CareRole, "caregiver" | "viewer"> | null;
}): Promise<CareAccessRecertificationResult> {
  return invokeCareTeam<CareAccessRecertificationResult>({
    action: "recertify_access",
    careRecipientId: input.careRecipientId,
    recertificationId: input.recertificationId,
    decision: input.decision,
    roleAfter: input.roleAfter ?? null,
    confirm: true,
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

export async function sendCareInvitationReminder(
  careRecipientId: string,
  userId: string,
) {
  await invokeCareTeam({
    action: "send_reminder",
    careRecipientId,
    userId,
  });
}

export type AccessibleCareContext = {
  careRecipientId: string;
  careRecipientName: string;
  relationship: string;
  role: CareRole;
  careGroupId: string | null;
};

function groupRoleToCareRole(role: string | null | undefined): CareRole | null {
  if (role === "primary_advocate") return "owner";
  if (role === "co_caregiver") return "caregiver";
  if (role === "read_only") return "viewer";
  return null;
}

function strongerCareRole(
  directRole: CareRole | null,
  groupRole: CareRole | null,
): CareRole | null {
  if (directRole === "patient") return "patient";

  const rank: Record<Exclude<CareRole, "patient">, number> = {
    owner: 3,
    caregiver: 2,
    viewer: 1,
  };
  const candidates = [directRole, groupRole].filter(
    (role): role is Exclude<CareRole, "patient"> =>
      Boolean(role && role !== "patient"),
  );

  return candidates.sort((a, b) => rank[b] - rank[a])[0] ?? null;
}

export async function loadAccessibleCareContexts(
  userId: string,
): Promise<AccessibleCareContext[]> {
  const [recipientsResult, directMembershipResult, groupMembershipResult] =
    await Promise.all([
      supabase
        .from("care_recipients")
        .select(
          "id, display_name, relationship, owner_id, care_group_id, created_at",
        )
        .order("created_at", { ascending: true }),
      supabase
        .from("care_recipient_members")
        .select("care_recipient_id, role")
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase
        .from("care_group_members")
        .select("care_group_id, role")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

  const error =
    recipientsResult.error ||
    directMembershipResult.error ||
    groupMembershipResult.error;
  if (error) throw error;

  const directByRecipient = new Map(
    (directMembershipResult.data ?? []).map((row) => [
      row.care_recipient_id,
      row.role as CareRole,
    ]),
  );
  const groupById = new Map(
    (groupMembershipResult.data ?? []).map((row) => [
      row.care_group_id,
      groupRoleToCareRole(row.role),
    ]),
  );

  return (recipientsResult.data ?? [])
    .map((recipient) => {
      const directRole = directByRecipient.get(recipient.id) ?? null;
      const groupRole = recipient.care_group_id
        ? (groupById.get(recipient.care_group_id) ?? null)
        : null;
      const role: CareRole | null =
        recipient.owner_id === userId
          ? "owner"
          : strongerCareRole(directRole, groupRole);

      if (!role) return null;

      return {
        careRecipientId: recipient.id,
        careRecipientName: recipient.display_name,
        relationship:
          role === "patient"
            ? "Myself"
            : recipient.relationship ?? "A loved one",
        role,
        careGroupId: recipient.care_group_id ?? null,
      };
    })
    .filter(
      (context): context is AccessibleCareContext => Boolean(context),
    );
}

export async function loadCareSpaces(): Promise<CareSpace[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return [];

  const [{ data: preferences }, contexts] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("active_care_recipient_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    loadAccessibleCareContexts(user.id),
  ]);

  if (!contexts.length) return [];

  const preferredId = preferences?.active_care_recipient_id ?? null;
  const activeId =
    contexts.find((context) => context.careRecipientId === preferredId)
      ?.careRecipientId ?? contexts[0].careRecipientId;

  return contexts.map((context) => ({
    careRecipientId: context.careRecipientId,
    careRecipientName: context.careRecipientName,
    relationship: context.relationship,
    role: context.role,
    active: context.careRecipientId === activeId,
  }));
}

export async function setActiveCareRecipient(careRecipientId: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const contexts = await loadAccessibleCareContexts(user.id);
  if (!contexts.some((item) => item.careRecipientId === careRecipientId)) {
    throw new Error("You do not have active access to this care profile.");
  }

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    active_care_recipient_id: careRecipientId,
  });

  if (error) throw error;
}

export async function loadConsentHistory(
  careRecipientId: string,
  options?: {
    since?: string | null;
    limit?: number;
  },
): Promise<ConsentEvent[]> {
  let query = supabase
    .from("care_consent_events")
    .select(
      "id, actor_user_id, subject_user_id, event_type, role, note, created_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("created_at", { ascending: false });

  if (options?.since) {
    query = query.gte("created_at", options.since);
  }

  const { data, error } = await query.limit(
    Math.min(Math.max(options?.limit ?? 100, 1), 500),
  );

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

function reportPeriodSince(period: CareAccessReportPeriod) {
  if (period === "all_recorded_history") return null;

  const days =
    period === "last_7_days" ? 7 : period === "last_30_days" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function loadCareAccessReportData(
  careRecipientId: string,
  period: CareAccessReportPeriod,
): Promise<CareAccessReportData> {
  const since = reportPeriodSince(period);
  const [roster, events] = await Promise.all([
    loadCareTeam(careRecipientId),
    loadConsentHistory(careRecipientId, {
      since,
      limit: 500,
    }),
  ]);

  return {
    canManage: roster.canManage,
    currentRole: roster.currentRole,
    members: roster.members,
    events,
  };
}

export async function recordCareAccessReportGeneration(
  careRecipientId: string,
  period: CareAccessReportPeriod,
) {
  await invokeCareTeam({
    action: "record_access_report",
    careRecipientId,
    period,
  });
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


export type AdvocateHandoverRequest = {
  id: string;
  fromName: string;
  toName: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  canRespond: boolean;
  canCancel: boolean;
};
export type AdvocateHandoverOverview = { canInitiate: boolean; requests: AdvocateHandoverRequest[] };
export type AdvocateHandoverPreview = { fingerprint: string; fromUserId: string; toUserId: string; before: string; after: string };
export function loadAdvocateHandovers(careRecipientId: string) {
  return invokeCareTeam<AdvocateHandoverOverview>({ action: "handover_list", careRecipientId });
}
export function previewAdvocateHandover(careRecipientId: string, targetUserId: string) {
  return invokeCareTeam<AdvocateHandoverPreview>({ action: "handover", decision: "preview", careRecipientId, targetUserId });
}
export function decideAdvocateHandover(input: {
  careRecipientId: string; decision: "request" | "accept" | "decline" | "cancel";
  targetUserId?: string; requestId?: string; fingerprint?: string;
}) {
  return invokeCareTeam<{ ok: boolean; status: AdvocateHandoverRequest["status"] }>({
    ...input, action: "handover", confirm: true,
  });
}

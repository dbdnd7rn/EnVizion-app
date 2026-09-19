import { supabase } from "./supabase";

export type StaffRole = "admin" | "advocate" | "support";
export type StaffMembership = {
  userId: string;
  displayName: string;
  role: StaffRole;
};

export type StaffSupportRequest = {
  id: string;
  caregiverName: string;
  careRecipientName: string;
  topic: string;
  context: string;
  preferredChannel: "In-app inbox" | "WhatsApp" | "Email";
  status: "submitted" | "in_review" | "responded" | "closed";
  createdAt: string;
};

export type StaffCoachingRequest = {
  id: string;
  caregiverName: string;
  careRecipientName: string;
  topic: string;
  message: string;
  status: "submitted" | "in_review" | "scheduled" | "completed" | "cancelled";
  createdAt: string;
};

export type StaffSupportMessage = {
  id: string;
  senderType: "caregiver" | "staff";
  body: string;
  createdAt: string;
};

export type StaffSupportThread = {
  request: StaffSupportRequest;
  messages: StaffSupportMessage[];
};

async function requireStaff(): Promise<StaffMembership> {
  const membership = await getStaffMembership();
  if (!membership) throw new Error("This account does not have active staff access.");
  return membership;
}

export async function getStaffMembership(): Promise<StaffMembership | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("staff_members")
    .select("user_id, display_name, role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.active) return null;

  return {
    userId: data.user_id,
    displayName: data.display_name,
    role: data.role as StaffRole,
  };
}

async function loadNames(userIds: string[], recipientIds: string[]) {
  const caregiverNames = new Map<string, string>();
  const recipientNames = new Map<string, string>();

  if (userIds.length) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    if (error) throw error;
    for (const row of data ?? []) {
      caregiverNames.set(row.id, row.full_name || "Caregiver");
    }
  }

  if (recipientIds.length) {
    const { data, error } = await supabase
      .from("care_recipients")
      .select("id, display_name")
      .in("id", recipientIds);

    if (error) throw error;
    for (const row of data ?? []) {
      recipientNames.set(row.id, row.display_name || "Care recipient");
    }
  }

  return { caregiverNames, recipientNames };
}

export async function loadStaffDashboard(): Promise<{
  support: StaffSupportRequest[];
  coaching: StaffCoachingRequest[];
}> {
  const membership = await requireStaff();

  const [supportResult, coachingResult] = await Promise.all([
    supabase
      .from("support_requests")
      .select(
        "id, user_id, care_recipient_id, topic, context, preferred_channel, status, created_at",
      )
      .order("created_at", { ascending: false }),
    membership.role === "support"
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("coaching_requests")
          .select(
            "id, user_id, care_recipient_id, topic, message, status, created_at",
          )
          .order("created_at", { ascending: false }),
  ]);

  if (supportResult.error) throw supportResult.error;
  if (coachingResult.error) throw coachingResult.error;

  const supportRows = supportResult.data ?? [];
  const coachingRows = coachingResult.data ?? [];
  const userIds = Array.from(
    new Set(
      [...supportRows, ...coachingRows]
        .map((row) => row.user_id)
        .filter(Boolean),
    ),
  );
  const recipientIds = Array.from(
    new Set(
      [...supportRows, ...coachingRows]
        .map((row) => row.care_recipient_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const { caregiverNames, recipientNames } = await loadNames(
    userIds,
    recipientIds,
  );

  return {
    support: supportRows.map((row) => ({
      id: row.id,
      caregiverName: caregiverNames.get(row.user_id) ?? "Caregiver",
      careRecipientName: row.care_recipient_id
        ? recipientNames.get(row.care_recipient_id) ?? "Care recipient"
        : "Not specified",
      topic: row.topic,
      context: row.context,
      preferredChannel: row.preferred_channel,
      status: row.status as StaffSupportRequest["status"],
      createdAt: row.created_at,
    })),
    coaching: coachingRows.map((row) => ({
      id: row.id,
      caregiverName: caregiverNames.get(row.user_id) ?? "Caregiver",
      careRecipientName: row.care_recipient_id
        ? recipientNames.get(row.care_recipient_id) ?? "Care recipient"
        : "Not specified",
      topic: row.topic,
      message: row.message ?? "",
      status: row.status as StaffCoachingRequest["status"],
      createdAt: row.created_at,
    })),
  };
}

export async function loadStaffSupportThread(
  requestId: string,
): Promise<StaffSupportThread> {
  await requireStaff();

  const { data: request, error } = await supabase
    .from("support_requests")
    .select(
      "id, user_id, care_recipient_id, topic, context, preferred_channel, status, created_at",
    )
    .eq("id", requestId)
    .single();

  if (error) throw error;

  const [{ caregiverNames, recipientNames }, messagesResult] = await Promise.all([
    loadNames(
      [request.user_id],
      request.care_recipient_id ? [request.care_recipient_id] : [],
    ),
    supabase
      .from("support_messages")
      .select("id, sender_type, body, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true }),
  ]);

  if (messagesResult.error) throw messagesResult.error;

  return {
    request: {
      id: request.id,
      caregiverName: caregiverNames.get(request.user_id) ?? "Caregiver",
      careRecipientName: request.care_recipient_id
        ? recipientNames.get(request.care_recipient_id) ?? "Care recipient"
        : "Not specified",
      topic: request.topic,
      context: request.context,
      preferredChannel: request.preferred_channel,
      status: request.status as StaffSupportRequest["status"],
      createdAt: request.created_at,
    },
    messages: (messagesResult.data ?? []).map((row) => ({
      id: row.id,
      senderType: row.sender_type as "caregiver" | "staff",
      body: row.body,
      createdAt: row.created_at,
    })),
  };
}

export async function sendStaffReply(requestId: string, body: string) {
  const staff = await requireStaff();

  const { error } = await supabase.from("support_messages").insert({
    request_id: requestId,
    user_id: staff.userId,
    sender_type: "staff",
    body: body.trim(),
  });

  if (error) throw error;

  const { error: statusError } = await supabase
    .from("support_requests")
    .update({ status: "responded" })
    .eq("id", requestId);

  if (statusError) throw statusError;
}

export async function updateSupportRequestStatus(
  requestId: string,
  status: StaffSupportRequest["status"],
) {
  await requireStaff();

  const { error } = await supabase
    .from("support_requests")
    .update({ status })
    .eq("id", requestId);

  if (error) throw error;
}

export async function updateCoachingRequestStatus(
  requestId: string,
  status: StaffCoachingRequest["status"],
) {
  await requireStaff();

  const { error } = await supabase
    .from("coaching_requests")
    .update({ status })
    .eq("id", requestId);

  if (error) throw error;
}


export type ManagedStaffMember = {
  userId: string;
  displayName: string;
  role: StaffRole;
  active: boolean;
  email: string;
  createdAt: string;
  updatedAt: string;
  isCurrentUser: boolean;
};

export type StaffAdminAuditEntry = {
  id: string;
  action: "invite" | "activate" | "role_change" | "deactivate" | "reactivate";
  details: Record<string, unknown>;
  createdAt: string;
};

async function invokeStaffAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("staff-admin", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function loadManagedStaff(): Promise<ManagedStaffMember[]> {
  const result = await invokeStaffAdmin<{ staff: ManagedStaffMember[] }>({
    action: "list",
  });
  return result.staff ?? [];
}

export async function inviteStaffMember(input: {
  displayName: string;
  email: string;
  role: StaffRole;
}): Promise<{ invited: boolean; userId: string }> {
  return invokeStaffAdmin({
    action: "invite",
    displayName: input.displayName,
    email: input.email,
    role: input.role,
  });
}

export async function updateManagedStaff(input: {
  userId: string;
  role: StaffRole;
  active: boolean;
}) {
  await invokeStaffAdmin({
    action: "update",
    userId: input.userId,
    role: input.role,
    active: input.active,
  });
}

export async function loadStaffAdminAudit(): Promise<StaffAdminAuditEntry[]> {
  const membership = await requireStaff();
  if (membership.role !== "admin") {
    throw new Error("Administrator access required.");
  }

  const { data, error } = await supabase
    .from("staff_admin_audit")
    .select("id, action, details, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action as StaffAdminAuditEntry["action"],
    details: (row.details ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

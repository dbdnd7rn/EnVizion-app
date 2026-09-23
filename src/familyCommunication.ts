import { supabase } from "./supabase";

export const familyUpdateTypes = [
  "general",
  "care_change",
  "appointment",
  "medication",
  "transition",
  "coverage",
] as const;

export type FamilyUpdateType = (typeof familyUpdateTypes)[number];

export const familyUpdateTypeLabels: Record<FamilyUpdateType, string> = {
  general: "General update",
  care_change: "Care change",
  appointment: "Appointment",
  medication: "Medication",
  transition: "Hospital / transition",
  coverage: "Caregiver coverage",
};

export const familyUpdatePriorities = [
  "routine",
  "important",
  "needs_acknowledgement",
] as const;

export type FamilyUpdatePriority =
  (typeof familyUpdatePriorities)[number];

export const familyUpdatePriorityLabels: Record<
  FamilyUpdatePriority,
  string
> = {
  routine: "Routine",
  important: "Important",
  needs_acknowledgement: "Needs acknowledgement",
};

export type FamilyUpdate = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  updateType: FamilyUpdateType;
  title: string;
  body: string;
  priority: FamilyUpdatePriority;
  requiresAcknowledgement: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FamilyUpdateAcknowledgement = {
  id: string;
  updateId: string;
  careRecipientId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
};

function mapUpdate(row: any): FamilyUpdate {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    createdBy: row.created_by ?? null,
    updateType: String(row.update_type) as FamilyUpdateType,
    title: String(row.title),
    body: String(row.body),
    priority: String(row.priority) as FamilyUpdatePriority,
    requiresAcknowledgement: Boolean(row.requires_acknowledgement),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapAck(row: any): FamilyUpdateAcknowledgement {
  return {
    id: String(row.id),
    updateId: String(row.update_id),
    careRecipientId: String(row.care_recipient_id),
    acknowledgedBy: String(row.acknowledged_by),
    acknowledgedAt: String(row.acknowledged_at),
  };
}

async function currentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

export async function loadFamilyCommunicationCenter(careRecipientId: string) {
  const [updatesResult, acknowledgementsResult] = await Promise.all([
    supabase
      .from("care_family_updates")
      .select(
        "id, care_recipient_id, created_by, update_type, title, body, priority, requires_acknowledgement, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("care_family_update_acknowledgements")
      .select(
        "id, update_id, care_recipient_id, acknowledged_by, acknowledged_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("acknowledged_at", { ascending: false })
      .limit(500),
  ]);

  if (updatesResult.error) throw updatesResult.error;
  if (acknowledgementsResult.error) throw acknowledgementsResult.error;

  return {
    updates: (updatesResult.data ?? []).map(mapUpdate),
    acknowledgements: (acknowledgementsResult.data ?? []).map(mapAck),
  };
}

export async function createFamilyUpdate(input: {
  careRecipientId: string;
  updateType: FamilyUpdateType;
  title: string;
  body: string;
  priority: FamilyUpdatePriority;
  requiresAcknowledgement: boolean;
}) {
  const userId = await currentUserId();
  const title = input.title.trim();
  const body = input.body.trim();

  if (!title) throw new Error("Add a short update title.");
  if (!body) throw new Error("Add the family update.");

  const requiresAcknowledgement =
    input.requiresAcknowledgement ||
    input.priority === "needs_acknowledgement";

  const { data, error } = await supabase
    .from("care_family_updates")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: userId,
      update_type: input.updateType,
      title: title.slice(0, 180),
      body: body.slice(0, 4000),
      priority: requiresAcknowledgement
        ? "needs_acknowledgement"
        : input.priority,
      requires_acknowledgement: requiresAcknowledgement,
    })
    .select(
      "id, care_recipient_id, created_by, update_type, title, body, priority, requires_acknowledgement, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapUpdate(data);
}

export async function updateFamilyUpdate(input: {
  careRecipientId: string;
  updateId: string;
  updateType: FamilyUpdateType;
  title: string;
  body: string;
  priority: FamilyUpdatePriority;
  requiresAcknowledgement: boolean;
}) {
  const title = input.title.trim();
  const body = input.body.trim();

  if (!title || !body) {
    throw new Error("Update title and message are required.");
  }

  const requiresAcknowledgement =
    input.requiresAcknowledgement ||
    input.priority === "needs_acknowledgement";

  const { data, error } = await supabase
    .from("care_family_updates")
    .update({
      update_type: input.updateType,
      title: title.slice(0, 180),
      body: body.slice(0, 4000),
      priority: requiresAcknowledgement
        ? "needs_acknowledgement"
        : input.priority,
      requires_acknowledgement: requiresAcknowledgement,
      updated_at: new Date().toISOString(),
    })
    .eq("care_recipient_id", input.careRecipientId)
    .eq("id", input.updateId)
    .select(
      "id, care_recipient_id, created_by, update_type, title, body, priority, requires_acknowledgement, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapUpdate(data);
}

export async function deleteFamilyUpdate(
  careRecipientId: string,
  updateId: string,
) {
  const { error } = await supabase
    .from("care_family_updates")
    .delete()
    .eq("care_recipient_id", careRecipientId)
    .eq("id", updateId);

  if (error) throw error;
}

export async function acknowledgeFamilyUpdate(input: {
  careRecipientId: string;
  updateId: string;
}) {
  const userId = await currentUserId();

  const { data, error } = await supabase
    .from("care_family_update_acknowledgements")
    .upsert(
      {
        care_recipient_id: input.careRecipientId,
        update_id: input.updateId,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      },
      { onConflict: "update_id,acknowledged_by" },
    )
    .select(
      "id, update_id, care_recipient_id, acknowledged_by, acknowledged_at",
    )
    .single();

  if (error) throw error;
  return mapAck(data);
}

export async function removeFamilyUpdateAcknowledgement(input: {
  careRecipientId: string;
  updateId: string;
}) {
  const userId = await currentUserId();

  const { error } = await supabase
    .from("care_family_update_acknowledgements")
    .delete()
    .eq("care_recipient_id", input.careRecipientId)
    .eq("update_id", input.updateId)
    .eq("acknowledged_by", userId);

  if (error) throw error;
}

export async function familyCommunicationCurrentUserId() {
  return currentUserId();
}

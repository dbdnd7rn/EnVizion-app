import { supabase } from "./supabase";

export type CarePlanCategory =
  | "medication"
  | "meal"
  | "mobility"
  | "hygiene"
  | "monitoring"
  | "appointment"
  | "comfort"
  | "other";

export type CarePlanPriority = "routine" | "important";

export type CarePlanItem = {
  id: string;
  careRecipientId: string;
  createdBy: string | null;
  title: string;
  category: CarePlanCategory;
  details: string;
  localTime: string;
  timezone: string;
  daysOfWeek: number[];
  priority: CarePlanPriority;
  assignedTo: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CarePlanCompletion = {
  id: string;
  careRecipientId: string;
  itemId: string;
  completedBy: string | null;
  completedOn: string;
  note: string;
  completedAt: string;
};

function mapItem(row: any): CarePlanItem {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    createdBy: row.created_by ?? null,
    title: String(row.title),
    category: String(row.category) as CarePlanCategory,
    details: String(row.details ?? ""),
    localTime: row.local_time ? String(row.local_time).slice(0, 5) : "",
    timezone: String(row.timezone || "UTC"),
    daysOfWeek: Array.isArray(row.days_of_week)
      ? row.days_of_week.map(Number)
      : [1, 2, 3, 4, 5, 6, 7],
    priority: String(row.priority) as CarePlanPriority,
    assignedTo: row.assigned_to ?? null,
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapCompletion(row: any): CarePlanCompletion {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    itemId: String(row.item_id),
    completedBy: row.completed_by ?? null,
    completedOn: String(row.completed_on),
    note: String(row.note ?? ""),
    completedAt: String(row.completed_at),
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

export async function loadCarePlan(careRecipientId: string) {
  const [itemsResult, completionsResult] = await Promise.all([
    supabase
      .from("care_plan_items")
      .select(
        "id, care_recipient_id, created_by, title, category, details, local_time, timezone, days_of_week, priority, assigned_to, active, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .eq("active", true)
      .order("local_time", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("care_plan_completions")
      .select(
        "id, care_recipient_id, item_id, completed_by, completed_on, note, completed_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .gte(
        "completed_on",
        new Date(Date.now() - 35 * 24 * 60 * 60_000)
          .toISOString()
          .slice(0, 10),
      )
      .order("completed_at", { ascending: false }),
  ]);

  if (itemsResult.error) throw itemsResult.error;
  if (completionsResult.error) throw completionsResult.error;

  return {
    items: (itemsResult.data ?? []).map(mapItem),
    completions: (completionsResult.data ?? []).map(mapCompletion),
  };
}

export async function createCarePlanItem(input: {
  careRecipientId: string;
  title: string;
  category: CarePlanCategory;
  details: string;
  localTime: string;
  timezone: string;
  daysOfWeek: number[];
  priority: CarePlanPriority;
}) {
  const userId = await currentUserId();
  const title = input.title.trim();
  if (!title) throw new Error("Add a routine title first.");
  if (!input.daysOfWeek.length) {
    throw new Error("Choose at least one day for this routine.");
  }

  const { data, error } = await supabase
    .from("care_plan_items")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: userId,
      title: title.slice(0, 160),
      category: input.category,
      details: input.details.trim().slice(0, 2000) || null,
      local_time: input.localTime.trim() || null,
      timezone: input.timezone || "UTC",
      days_of_week: [...new Set(input.daysOfWeek)].sort((a, b) => a - b),
      priority: input.priority,
      assigned_to: null,
      active: true,
    })
    .select(
      "id, care_recipient_id, created_by, title, category, details, local_time, timezone, days_of_week, priority, assigned_to, active, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapItem(data);
}

export async function archiveCarePlanItem(
  careRecipientId: string,
  itemId: string,
) {
  const { error } = await supabase
    .from("care_plan_items")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("care_recipient_id", careRecipientId)
    .eq("id", itemId);

  if (error) throw error;
}

export async function setCarePlanCompletion(input: {
  careRecipientId: string;
  itemId: string;
  completedOn: string;
  completed: boolean;
  note?: string;
}) {
  if (!input.completed) {
    const { error } = await supabase
      .from("care_plan_completions")
      .delete()
      .eq("care_recipient_id", input.careRecipientId)
      .eq("item_id", input.itemId)
      .eq("completed_on", input.completedOn);

    if (error) throw error;
    return null;
  }

  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_plan_completions")
    .upsert(
      {
        care_recipient_id: input.careRecipientId,
        item_id: input.itemId,
        completed_by: userId,
        completed_on: input.completedOn,
        note: input.note?.trim().slice(0, 1000) || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "item_id,completed_on" },
    )
    .select(
      "id, care_recipient_id, item_id, completed_by, completed_on, note, completed_at",
    )
    .single();

  if (error) throw error;
  return mapCompletion(data);
}

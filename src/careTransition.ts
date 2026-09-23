import { supabase } from "./supabase";

export type CareTransitionPlan = {
  id: string;
  careRecipientId: string;
  hospitalName: string;
  dischargeDate: string;
  dischargeSummary: string;
  primaryDiagnosis: string;
  medicationChanges: string;
  followUpPlan: string;
  equipmentPlan: string;
  transportPlan: string;
  warningSigns: string;
  afterHoursContact: string;
  status: "active" | "completed" | "archived";
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CareTransitionFollowUp = {
  id: string;
  planId: string;
  careRecipientId: string;
  title: string;
  dueAt: string | null;
  provider: string;
  details: string;
  status: "open" | "completed" | "cancelled";
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapPlan(row: any): CareTransitionPlan {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    hospitalName: String(row.hospital_name ?? ""),
    dischargeDate: row.discharge_date ? String(row.discharge_date) : "",
    dischargeSummary: String(row.discharge_summary ?? ""),
    primaryDiagnosis: String(row.primary_diagnosis ?? ""),
    medicationChanges: String(row.medication_changes ?? ""),
    followUpPlan: String(row.follow_up_plan ?? ""),
    equipmentPlan: String(row.equipment_plan ?? ""),
    transportPlan: String(row.transport_plan ?? ""),
    warningSigns: String(row.warning_signs ?? ""),
    afterHoursContact: String(row.after_hours_contact ?? ""),
    status: String(row.status) as CareTransitionPlan["status"],
    completedAt: row.completed_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFollowUp(row: any): CareTransitionFollowUp {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    careRecipientId: String(row.care_recipient_id),
    title: String(row.title),
    dueAt: row.due_at ?? null,
    provider: String(row.provider ?? ""),
    details: String(row.details ?? ""),
    status: String(row.status) as CareTransitionFollowUp["status"],
    completedBy: row.completed_by ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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

const planSelect =
  "id, care_recipient_id, hospital_name, discharge_date, discharge_summary, primary_diagnosis, medication_changes, follow_up_plan, equipment_plan, transport_plan, warning_signs, after_hours_contact, status, completed_at, created_at, updated_at";

export async function loadCareTransitionWorkspace(careRecipientId: string) {
  const { data: plans, error: planError } = await supabase
    .from("care_transition_plans")
    .select(planSelect)
    .eq("care_recipient_id", careRecipientId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (planError) throw planError;

  const mappedPlans = (plans ?? []).map(mapPlan);
  const plan =
    mappedPlans.find((item) => item.status === "active") ??
    mappedPlans[0] ??
    null;

  if (!plan) return { plan: null, followUps: [] as CareTransitionFollowUp[] };

  const { data: followUps, error: followUpError } = await supabase
    .from("care_transition_followups")
    .select(
      "id, plan_id, care_recipient_id, title, due_at, provider, details, status, completed_by, completed_at, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .eq("plan_id", plan.id)
    .order("status", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (followUpError) throw followUpError;

  return {
    plan,
    followUps: (followUps ?? []).map(mapFollowUp),
  };
}

export async function saveCareTransitionPlan(input: {
  careRecipientId: string;
  id?: string | null;
  hospitalName: string;
  dischargeDate: string;
  dischargeSummary: string;
  primaryDiagnosis: string;
  medicationChanges: string;
  followUpPlan: string;
  equipmentPlan: string;
  transportPlan: string;
  warningSigns: string;
  afterHoursContact: string;
}) {
  const userId = await currentUserId();
  const values = {
    hospital_name: input.hospitalName.trim().slice(0, 300) || null,
    discharge_date: input.dischargeDate.trim() || null,
    discharge_summary: input.dischargeSummary.trim().slice(0, 5000) || null,
    primary_diagnosis: input.primaryDiagnosis.trim().slice(0, 1000) || null,
    medication_changes: input.medicationChanges.trim().slice(0, 5000) || null,
    follow_up_plan: input.followUpPlan.trim().slice(0, 5000) || null,
    equipment_plan: input.equipmentPlan.trim().slice(0, 5000) || null,
    transport_plan: input.transportPlan.trim().slice(0, 3000) || null,
    warning_signs: input.warningSigns.trim().slice(0, 5000) || null,
    after_hours_contact: input.afterHoursContact.trim().slice(0, 1000) || null,
    status: "active",
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("care_transition_plans")
      .update(values)
      .eq("care_recipient_id", input.careRecipientId)
      .eq("id", input.id)
      .select(planSelect)
      .single();

    if (error) throw error;
    return mapPlan(data);
  }

  const { data, error } = await supabase
    .from("care_transition_plans")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: userId,
      ...values,
    })
    .select(planSelect)
    .single();

  if (error) throw error;
  return mapPlan(data);
}

export async function createTransitionFollowUp(input: {
  careRecipientId: string;
  planId: string;
  title: string;
  dueAt: string;
  provider: string;
  details: string;
}) {
  const userId = await currentUserId();
  if (!input.title.trim()) throw new Error("Add a follow-up title.");

  let dueAt: string | null = null;
  if (input.dueAt.trim()) {
    const parsed = new Date(input.dueAt.trim());
    if (!Number.isFinite(parsed.getTime())) {
      throw new Error("Use a valid follow-up date/time.");
    }
    dueAt = parsed.toISOString();
  }

  const { data, error } = await supabase
    .from("care_transition_followups")
    .insert({
      care_recipient_id: input.careRecipientId,
      plan_id: input.planId,
      created_by: userId,
      title: input.title.trim().slice(0, 200),
      due_at: dueAt,
      provider: input.provider.trim().slice(0, 300) || null,
      details: input.details.trim().slice(0, 2000) || null,
      status: "open",
    })
    .select(
      "id, plan_id, care_recipient_id, title, due_at, provider, details, status, completed_by, completed_at, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapFollowUp(data);
}

export async function setTransitionFollowUpStatus(input: {
  careRecipientId: string;
  followUpId: string;
  status: "open" | "completed" | "cancelled";
}) {
  const userId = await currentUserId();
  const completed = input.status === "completed";
  const { error } = await supabase
    .from("care_transition_followups")
    .update({
      status: input.status,
      completed_by: completed ? userId : null,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("care_recipient_id", input.careRecipientId)
    .eq("id", input.followUpId);

  if (error) throw error;
}

export async function completeCareTransitionPlan(
  careRecipientId: string,
  planId: string,
) {
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("care_transition_plans")
    .update({
      status: "completed",
      completed_at: at,
      updated_at: at,
    })
    .eq("care_recipient_id", careRecipientId)
    .eq("id", planId);

  if (error) throw error;
  return at;
}

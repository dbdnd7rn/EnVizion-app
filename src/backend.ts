import { supabase } from "./supabase";
import type { Appointment, Entry, TrackerKind } from "./domain";
import type { Medication, MedicationRecord } from "./medications";
import { recordCareWorkspaceOpen, type CareRole } from "./careTeam";

export type SavedOnboarding = {
  name: string;
  careName: string;
  relationship: string;
  faith: boolean;
  careRecipientId: string;
  accessRole: CareRole;
};

async function resolveCareContextForUser(userId: string) {
  const [{ data: preferences }, { data: memberships, error: membershipError }] =
    await Promise.all([
      supabase
        .from("user_preferences")
        .select("active_care_recipient_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("care_recipient_members")
        .select("care_recipient_id, role, accepted_at")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

  if (membershipError) throw membershipError;
  const rows = memberships ?? [];
  if (!rows.length) return null;

  const preferredId = preferences?.active_care_recipient_id ?? null;
  const selected =
    rows.find((row) => row.care_recipient_id === preferredId) ??
    rows.find((row) => row.role === "owner") ??
    rows[0];

  const { data: recipient, error: recipientError } = await supabase
    .from("care_recipients")
    .select("id, display_name, relationship")
    .eq("id", selected.care_recipient_id)
    .single();

  if (recipientError) throw recipientError;

  return {
    careRecipientId: recipient.id as string,
    careRecipientName: recipient.display_name as string,
    relationship: (recipient.relationship || "A loved one") as string,
    accessRole: selected.role as CareRole,
  };
}

export async function loadSavedOnboarding(): Promise<SavedOnboarding | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: preferences }, context] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_preferences")
      .select("faith_encouragement")
      .eq("user_id", user.id)
      .maybeSingle(),
    resolveCareContextForUser(user.id),
  ]);

  if (!context) return null;

  return {
    name: profile?.full_name || user.user_metadata?.full_name || "",
    careName: context.careRecipientName,
    relationship: context.relationship,
    faith: preferences?.faith_encouragement ?? false,
    careRecipientId: context.careRecipientId,
    accessRole: context.accessRole,
  };
}

export async function saveOnboarding(input: {
  name: string;
  careName: string;
  relationship: string;
  faith: boolean;
}): Promise<SavedOnboarding> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your session expired. Please sign in again.");
  }

  const name = input.name.trim();
  const careName = input.careName.trim();

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: name,
  });
  if (profileError) throw profileError;

  const { error: preferenceError } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: user.id,
      faith_encouragement: input.faith,
    });
  if (preferenceError) throw preferenceError;

  const { data: existing, error: existingError } = await supabase
    .from("care_recipients")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  let careRecipientId = existing?.id;

  if (careRecipientId) {
    const { error } = await supabase
      .from("care_recipients")
      .update({
        display_name: careName,
        relationship: input.relationship,
      })
      .eq("id", careRecipientId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("care_recipients")
      .insert({
        owner_id: user.id,
        display_name: careName,
        relationship: input.relationship,
      })
      .select("id")
      .single();
    if (error) throw error;
    careRecipientId = data.id;
  }

  const { error: activePreferenceError } = await supabase
    .from("user_preferences")
    .upsert({
      user_id: user.id,
      active_care_recipient_id: careRecipientId,
    });
  if (activePreferenceError) throw activePreferenceError;

  return {
    name,
    careName,
    relationship: input.relationship,
    faith: input.faith,
    careRecipientId,
    accessRole: "owner",
  };
}


export async function updateFaithPreference(faith: boolean) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase.from("user_preferences").upsert({
    user_id: user.id,
    faith_encouragement: faith,
  });

  if (error) throw error;
}

export async function submitCoachingRequest(topic: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const context = await resolveCareContextForUser(user.id);

  const { error } = await supabase.from("coaching_requests").insert({
    user_id: user.id,
    care_recipient_id: context?.careRecipientId ?? null,
    topic,
    status: "submitted",
  });

  if (error) throw error;
}


export type SupportRequestRecord = {
  id: string;
  topic: string;
  context: string;
  preferred_channel: "In-app inbox" | "WhatsApp" | "Email";
  status: "submitted" | "in_review" | "responded" | "closed";
  created_at: string;
};

export type SupportMessageRecord = {
  id: string;
  sender_type: "caregiver" | "staff";
  body: string;
  created_at: string;
};

export async function createSupportRequest(input: {
  topic: string;
  context: string;
  preferredChannel: "In-app inbox" | "WhatsApp" | "Email";
  includeAssistantContext: boolean;
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const context = await resolveCareContextForUser(user.id);

  const { data, error } = await supabase
    .from("support_requests")
    .insert({
      user_id: user.id,
      care_recipient_id: context?.careRecipientId ?? null,
      topic: input.topic,
      context: input.context.trim(),
      preferred_channel: input.preferredChannel,
      include_assistant_context: input.includeAssistantContext,
      status: "submitted",
    })
    .select("id, topic, context, preferred_channel, status, created_at")
    .single();

  if (error) throw error;
  return data as SupportRequestRecord;
}

export async function loadLatestSupportRequest(): Promise<{
  request: SupportRequestRecord | null;
  messages: SupportMessageRecord[];
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { request: null, messages: [] };

  const { data: request, error } = await supabase
    .from("support_requests")
    .select("id, topic, context, preferred_channel, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!request) return { request: null, messages: [] };

  const { data: messages, error: messagesError } = await supabase
    .from("support_messages")
    .select("id, sender_type, body, created_at")
    .eq("request_id", request.id)
    .order("created_at", { ascending: true });

  if (messagesError) throw messagesError;

  return {
    request: request as SupportRequestRecord,
    messages: (messages ?? []) as SupportMessageRecord[],
  };
}

export async function sendSupportMessage(requestId: string, body: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase.from("support_messages").insert({
    request_id: requestId,
    user_id: user.id,
    sender_type: "caregiver",
    body: body.trim(),
  });

  if (error) throw error;
}


export type CareSnapshot = {
  careRecipientId: string;
  careRecipientName: string;
  accessRole: CareRole;
  relationship: string;
  entries: Entry[];
  medications: Medication[];
  medicationRecords: MedicationRecord[];
  transition: number[];
  appointment: Appointment;
  appointmentId: string | null;
  questions: string[];
  questionIds: string[];
  saved: string[];
};

async function requireCareContext() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const context = await resolveCareContextForUser(user.id);
  if (!context) {
    throw new Error("Finish setting up or accept a care invitation first.");
  }

  return { user, ...context };
}

async function requireEditableCareContext() {
  const context = await requireCareContext();
  if (context.accessRole === "viewer") {
    throw new Error(
      "Viewer access is read-only. Ask the care owner for Caregiver access to make changes.",
    );
  }
  return context;
}

function appointmentFromRow(
  row:
    | {
        id: string;
        title: string;
        starts_at: string | null;
        appointment_date: string | null;
        appointment_time: string | null;
        location: string | null;
        notes: string | null;
      }
    | null,
): { appointment: Appointment; appointmentId: string | null } {
  if (!row) {
    return {
      appointment: {
        title: "Next appointment",
        date: "",
        time: "",
        location: "",
        notes: "",
      },
      appointmentId: null,
    };
  }

  let date = row.appointment_date ?? "";
  let time = row.appointment_time ? row.appointment_time.slice(0, 5) : "";

  if (!date && row.starts_at) {
    const value = new Date(row.starts_at);
    if (!Number.isNaN(value.getTime())) {
      const pad = (part: number) => String(part).padStart(2, "0");
      date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
      if (!time) {
        time = `${pad(value.getHours())}:${pad(value.getMinutes())}`;
      }
    }
  }

  return {
    appointment: {
      title: row.title,
      date,
      time,
      location: row.location ?? "",
      notes: row.notes ?? "",
    },
    appointmentId: row.id,
  };
}

export async function loadCareData(): Promise<CareSnapshot | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const context = await resolveCareContextForUser(user.id);
  if (!context) return null;

  const { careRecipientId, careRecipientName, accessRole, relationship } = context;
  void recordCareWorkspaceOpen(careRecipientId);

  const [
    observationsResult,
    medicationsResult,
    medicationRecordsResult,
    appointmentResult,
    transitionResult,
    savedResult,
  ] = await Promise.all([
    supabase
      .from("care_observations")
      .select("id, kind, data, notes, observed_at")
      .eq("care_recipient_id", careRecipientId)
      .order("observed_at", { ascending: false }),
    supabase
      .from("medications")
      .select("id, name, instructions, time_label")
      .eq("care_recipient_id", careRecipientId)
      .eq("active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("medication_records")
      .select("id, medication_id, status, recorded_at, corrected_at")
      .eq("care_recipient_id", careRecipientId)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("appointments")
      .select(
        "id, title, starts_at, appointment_date, appointment_time, location, notes",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transition_items")
      .select("item_key")
      .eq("care_recipient_id", careRecipientId)
      .not("completed_at", "is", null),
    supabase
      .from("saved_resources")
      .select("resource_id")
      .eq("user_id", user.id),
  ]);

  const errors = [
    observationsResult.error,
    medicationsResult.error,
    medicationRecordsResult.error,
    appointmentResult.error,
    transitionResult.error,
    savedResult.error,
  ].filter(Boolean);

  if (errors.length) throw errors[0];

  const medications: Medication[] = (medicationsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    instructions: row.instructions ?? "",
    time: row.time_label ?? "",
  }));

  const medicationById = new Map(medications.map((item) => [item.id, item]));

  const medicationRecords: MedicationRecord[] = (medicationRecordsResult.data ?? [])
    .map((row) => {
      const medication = medicationById.get(row.medication_id);
      if (!medication) return null;
      return {
        id: row.id,
        medication,
        recordedAt: row.recorded_at,
        ...(row.corrected_at ? { correctedAt: row.corrected_at } : {}),
      };
    })
    .filter((row): row is MedicationRecord => Boolean(row));

  const entries: Entry[] = (observationsResult.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind as TrackerKind,
    values: {
      ...((row.data ?? {}) as Record<string, string>),
      ...(row.notes ? { notes: row.notes } : {}),
    },
    recordedAt: row.observed_at,
  }));

  const { appointment, appointmentId } = appointmentFromRow(
    appointmentResult.data
      ? {
          id: appointmentResult.data.id,
          title: appointmentResult.data.title,
          starts_at: appointmentResult.data.starts_at,
          appointment_date: appointmentResult.data.appointment_date,
          appointment_time: appointmentResult.data.appointment_time,
          location: appointmentResult.data.location,
          notes: appointmentResult.data.notes,
        }
      : null,
  );

  let questions: string[] = [];
  let questionIds: string[] = [];

  if (appointmentId) {
    const { data, error } = await supabase
      .from("appointment_questions")
      .select("id, question")
      .eq("appointment_id", appointmentId)
      .eq("care_recipient_id", careRecipientId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    questions = (data ?? []).map((row) => row.question);
    questionIds = (data ?? []).map((row) => row.id);
  }

  return {
    careRecipientId,
    careRecipientName,
    accessRole,
    relationship,
    entries,
    medications,
    medicationRecords,
    transition: (transitionResult.data ?? [])
      .map((row) => Number(row.item_key))
      .filter((value) => Number.isInteger(value) && value >= 0),
    appointment,
    appointmentId,
    questions,
    questionIds,
    saved: (savedResult.data ?? []).map((row) => row.resource_id),
  };
}

export async function saveObservation(
  kind: TrackerKind,
  values: Record<string, string>,
): Promise<Entry> {
  const { user, careRecipientId } = await requireEditableCareContext();
  const { notes = "", ...data } = values;

  const { data: row, error } = await supabase
    .from("care_observations")
    .insert({
      care_recipient_id: careRecipientId,
      user_id: user.id,
      kind,
      data,
      notes: notes.trim() || null,
      observed_at: new Date().toISOString(),
    })
    .select("id, kind, data, notes, observed_at")
    .single();

  if (error) throw error;

  return {
    id: row.id,
    kind: row.kind as TrackerKind,
    values: {
      ...((row.data ?? {}) as Record<string, string>),
      ...(row.notes ? { notes: row.notes } : {}),
    },
    recordedAt: row.observed_at,
  };
}

export async function createMedication(input: {
  name: string;
  instructions: string;
  time: string;
}): Promise<Medication> {
  const { user, careRecipientId } = await requireEditableCareContext();

  const { data, error } = await supabase
    .from("medications")
    .insert({
      care_recipient_id: careRecipientId,
      user_id: user.id,
      name: input.name.trim(),
      instructions: input.instructions.trim(),
      time_label: input.time.trim(),
      active: true,
    })
    .select("id, name, instructions, time_label")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    instructions: data.instructions ?? "",
    time: data.time_label ?? "",
  };
}

export async function updateMedication(input: Medication): Promise<Medication> {
  const { user, careRecipientId } = await requireEditableCareContext();

  const { data, error } = await supabase
    .from("medications")
    .update({
      name: input.name.trim(),
      instructions: input.instructions.trim(),
      time_label: input.time.trim(),
    })
    .eq("id", input.id)
    .eq("care_recipient_id", careRecipientId)
    .select("id, name, instructions, time_label")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    instructions: data.instructions ?? "",
    time: data.time_label ?? "",
  };
}

export async function recordMedicationDose(
  medication: Medication,
): Promise<MedicationRecord> {
  const { user, careRecipientId } = await requireEditableCareContext();

  const { data, error } = await supabase
    .from("medication_records")
    .insert({
      medication_id: medication.id,
      care_recipient_id: careRecipientId,
      user_id: user.id,
      status: "taken",
      recorded_at: new Date().toISOString(),
    })
    .select("id, recorded_at, corrected_at")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    medication: { ...medication },
    recordedAt: data.recorded_at,
    ...(data.corrected_at ? { correctedAt: data.corrected_at } : {}),
  };
}

export async function correctMedicationDose(recordId: string): Promise<string> {
  const { user, careRecipientId } = await requireEditableCareContext();
  const correctedAt = new Date().toISOString();

  const { error } = await supabase
    .from("medication_records")
    .update({
      status: "corrected",
      corrected_at: correctedAt,
    })
    .eq("id", recordId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
  return correctedAt;
}

function appointmentStart(appointment: Appointment): string | null {
  if (!appointment.date) return null;
  const time = appointment.time || "00:00";
  const value = new Date(`${appointment.date}T${time}:00`);
  if (Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

export async function saveAppointment(
  appointment: Appointment,
  existingId?: string | null,
): Promise<string> {
  const { user, careRecipientId } = await requireEditableCareContext();

  const editableValues = {
    title: appointment.title.trim(),
    starts_at: appointmentStart(appointment),
    appointment_date: appointment.date || null,
    appointment_time: appointment.time ? `${appointment.time}:00` : null,
    location: appointment.location.trim() || null,
    notes: appointment.notes.trim() || null,
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("appointments")
      .update(editableValues)
      .eq("id", existingId)
      .eq("care_recipient_id", careRecipientId)
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      care_recipient_id: careRecipientId,
      user_id: user.id,
      ...editableValues,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function addAppointmentQuestion(input: {
  appointment: Appointment;
  appointmentId: string | null;
  question: string;
  position: number;
}): Promise<{ appointmentId: string; questionId: string }> {
  const { user, careRecipientId } = await requireEditableCareContext();
  const appointmentId =
    input.appointmentId ?? (await saveAppointment(input.appointment, null));

  const { data, error } = await supabase
    .from("appointment_questions")
    .insert({
      appointment_id: appointmentId,
      care_recipient_id: careRecipientId,
      user_id: user.id,
      question: input.question.trim(),
      position: input.position,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { appointmentId, questionId: data.id };
}

export async function removeAppointmentQuestion(questionId: string) {
  const { user, careRecipientId } = await requireEditableCareContext();

  const { error } = await supabase
    .from("appointment_questions")
    .delete()
    .eq("id", questionId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export async function setTransitionItem(index: number, completed: boolean) {
  const { user, careRecipientId } = await requireEditableCareContext();
  const itemKey = String(index);

  const { data: existing, error: existingError } = await supabase
    .from("transition_items")
    .select("id")
    .eq("care_recipient_id", careRecipientId)
    .eq("item_key", itemKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!completed) {
    if (!existing) return;

    const { error } = await supabase
      .from("transition_items")
      .delete()
      .eq("id", existing.id)
      .eq("care_recipient_id", careRecipientId);

    if (error) throw error;
    return;
  }

  if (existing) {
    const { error } = await supabase
      .from("transition_items")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("care_recipient_id", careRecipientId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("transition_items").insert({
    care_recipient_id: careRecipientId,
    user_id: user.id,
    item_key: itemKey,
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export async function setSavedResource(resourceId: string, saved: boolean) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  if (!saved) {
    const { error } = await supabase
      .from("saved_resources")
      .delete()
      .eq("user_id", user.id)
      .eq("resource_id", resourceId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("saved_resources").upsert(
    {
      user_id: user.id,
      resource_id: resourceId,
      saved_at: new Date().toISOString(),
    },
    { onConflict: "user_id,resource_id", ignoreDuplicates: true },
  );

  if (error) throw error;
}

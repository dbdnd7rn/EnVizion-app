import { supabase } from "./supabase";

export const careCommunicationTypes = [
  "phone_call",
  "email",
  "message_portal",
  "in_person",
  "insurance",
  "pharmacy",
  "hospital",
  "home_health",
  "other",
] as const;

export type CareCommunicationType = (typeof careCommunicationTypes)[number];

export const careCommunicationTypeLabels: Record<CareCommunicationType, string> = {
  phone_call: "Phone call",
  email: "Email",
  message_portal: "Message / portal",
  in_person: "In-person conversation",
  insurance: "Insurance",
  pharmacy: "Pharmacy",
  hospital: "Hospital",
  home_health: "Home health",
  other: "Other",
};

export const careCommunicationPriorities = [
  "routine",
  "important",
  "follow_up",
] as const;

export type CareCommunicationPriority =
  (typeof careCommunicationPriorities)[number];

export const careCommunicationPriorityLabels: Record<
  CareCommunicationPriority,
  string
> = {
  routine: "Routine",
  important: "Important",
  follow_up: "Follow-up",
};

export type CareCommunication = {
  id: string;
  careRecipientId: string;
  contactId: string | null;
  communicationType: CareCommunicationType;
  occurredAt: string;
  personSpokenTo: string;
  organizationName: string;
  summary: string;
  outcome: string;
  followUpNeeded: boolean;
  followUpAt: string | null;
  notes: string;
  priority: CareCommunicationPriority;
  tag: string;
  createdAt: string;
  updatedAt: string;
};

export type CareCommunicationInput = Omit<
  CareCommunication,
  "id" | "careRecipientId" | "createdAt" | "updatedAt"
>;

const selectFields =
  "id, care_recipient_id, contact_id, communication_type, occurred_at, person_spoken_to, organization_name, summary, outcome, follow_up_needed, follow_up_at, notes, priority, tag, created_at, updated_at";

function mapCommunication(row: any): CareCommunication {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    contactId: row.contact_id ?? null,
    communicationType: row.communication_type as CareCommunicationType,
    occurredAt: row.occurred_at,
    personSpokenTo: row.person_spoken_to ?? "",
    organizationName: row.organization_name ?? "",
    summary: row.summary,
    outcome: row.outcome ?? "",
    followUpNeeded: Boolean(row.follow_up_needed),
    followUpAt: row.follow_up_at ?? null,
    notes: row.notes ?? "",
    priority: (row.priority as CareCommunicationPriority) ?? "routine",
    tag: row.tag ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clean(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function payload(input: CareCommunicationInput) {
  return {
    contact_id: input.contactId,
    communication_type: input.communicationType,
    occurred_at: input.occurredAt,
    person_spoken_to: clean(input.personSpokenTo),
    organization_name: clean(input.organizationName),
    summary: input.summary.trim(),
    outcome: clean(input.outcome),
    follow_up_needed: input.followUpNeeded,
    follow_up_at: input.followUpNeeded ? input.followUpAt : null,
    notes: clean(input.notes),
    priority: input.priority,
    tag: clean(input.tag),
    updated_at: new Date().toISOString(),
  };
}

export async function loadCareCommunications(
  careRecipientId: string,
): Promise<CareCommunication[]> {
  const { data, error } = await supabase
    .from("care_communications")
    .select(selectFields)
    .eq("care_recipient_id", careRecipientId)
    .order("occurred_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapCommunication);
}

export async function createCareCommunication(
  careRecipientId: string,
  input: CareCommunicationInput,
): Promise<CareCommunication> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("care_communications")
    .insert({
      care_recipient_id: careRecipientId,
      created_by: user.id,
      ...payload(input),
    })
    .select(selectFields)
    .single();

  if (error) throw error;
  return mapCommunication(data);
}

export async function updateCareCommunication(
  careRecipientId: string,
  communicationId: string,
  input: CareCommunicationInput,
): Promise<CareCommunication> {
  const { data, error } = await supabase
    .from("care_communications")
    .update(payload(input))
    .eq("id", communicationId)
    .eq("care_recipient_id", careRecipientId)
    .select(selectFields)
    .single();

  if (error) throw error;
  return mapCommunication(data);
}

export async function deleteCareCommunication(
  careRecipientId: string,
  communicationId: string,
) {
  const { error } = await supabase
    .from("care_communications")
    .delete()
    .eq("id", communicationId)
    .eq("care_recipient_id", careRecipientId);

  if (error) throw error;
}

export function dateTimeInputToIso(date: string, time: string) {
  const dateValue = date.trim();
  const timeValue = time.trim() || "12:00";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error("Use YYYY-MM-DD for the date.");
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue)) {
    throw new Error("Use HH:MM in 24-hour time.");
  }

  const value = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Check the communication date and time.");
  }
  return value.toISOString();
}

export function isoToDateTimeInputs(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

export function careCommunicationSearchText(
  communication: CareCommunication,
  linkedContactText = "",
) {
  return [
    careCommunicationTypeLabels[communication.communicationType],
    careCommunicationPriorityLabels[communication.priority],
    communication.personSpokenTo,
    communication.organizationName,
    communication.summary,
    communication.outcome,
    communication.notes,
    communication.tag,
    linkedContactText,
  ]
    .join(" ")
    .toLowerCase();
}

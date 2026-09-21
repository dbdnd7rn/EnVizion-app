import { loadCareDocuments, type CareDocument } from "./documents";
import { loadCareContacts, careContactCategoryLabels, preferredContactMethodLabels, type CareContact } from "./careContacts";
import { documentCategoryLabels, formatDocumentBytes } from "./documentHelpers";
import { loadCareReminders } from "./reminders";
import type { CareReminder } from "./reminderHelpers";
import type {
  CarePacketSection,
  CarePacketType,
  PacketDocumentReference,
  PacketCareContact,
} from "./carePacketHelpers";
import { supabase } from "./supabase";

export type CarePacketRecipient = {
  displayName: string;
  relationship: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export type CarePacketExportRecord = {
  id: string;
  packetType: CarePacketType;
  includedSections: CarePacketSection[];
  selectedDocumentIds: string[];
  selectedContactIds: string[];
  observationLimit: number;
  status: "started" | "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  failedAt: string | null;
};

function mapExport(row: any): CarePacketExportRecord {
  return {
    id: row.id,
    packetType: row.packet_type as CarePacketType,
    includedSections: (row.included_sections ?? []) as CarePacketSection[],
    selectedDocumentIds: row.selected_document_ids ?? [],
    selectedContactIds: row.selected_contact_ids ?? [],
    observationLimit: Number(row.observation_limit ?? 5),
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    failedAt: row.failed_at ?? null,
  };
}

export function packetDocumentReference(
  document: CareDocument,
): PacketDocumentReference {
  return {
    id: document.id,
    displayName: document.displayName,
    originalName: document.originalName,
    categoryLabel: documentCategoryLabels[document.category],
    sizeLabel: formatDocumentBytes(document.sizeBytes),
  };
}

export function packetCareContactReference(
  contact: CareContact,
): PacketCareContact {
  return {
    id: contact.id,
    providerName: contact.providerName,
    organizationName: contact.organizationName,
    specialty: contact.specialty,
    phone: contact.phone,
    email: contact.email,
    address: contact.address,
    officeHours: contact.officeHours,
    notes: contact.notes,
    categoryLabel: careContactCategoryLabels[contact.category],
    preferredContactLabel:
      preferredContactMethodLabels[contact.preferredContactMethod],
  };
}

export async function loadCarePacketSupportingData(
  careRecipientId: string,
): Promise<{
  recipient: CarePacketRecipient;
  reminders: CareReminder[];
  documents: CareDocument[];
  contacts: CareContact[];
  history: CarePacketExportRecord[];
}> {
  const [recipientResult, reminders, documents, contacts, historyResult] = await Promise.all([
    supabase
      .from("care_recipients")
      .select(
        "display_name, relationship, emergency_contact_name, emergency_contact_phone",
      )
      .eq("id", careRecipientId)
      .single(),
    loadCareReminders(careRecipientId),
    loadCareDocuments(careRecipientId),
    loadCareContacts(careRecipientId),
    supabase
      .from("care_packet_exports")
      .select(
        "id, packet_type, included_sections, selected_document_ids, selected_contact_ids, observation_limit, status, started_at, completed_at, failed_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  if (recipientResult.error) throw recipientResult.error;
  if (historyResult.error) throw historyResult.error;

  return {
    recipient: {
      displayName: recipientResult.data.display_name,
      relationship: recipientResult.data.relationship ?? "",
      emergencyContactName:
        recipientResult.data.emergency_contact_name ?? "",
      emergencyContactPhone:
        recipientResult.data.emergency_contact_phone ?? "",
    },
    reminders,
    documents,
    contacts,
    history: (historyResult.data ?? []).map(mapExport),
  };
}

async function invokePacket<T>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("care-packet", {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function startCarePacketExport(input: {
  careRecipientId: string;
  packetType: CarePacketType;
  sections: CarePacketSection[];
  selectedDocumentIds: string[];
  selectedContactIds: string[];
  observationLimit: number;
}) {
  return invokePacket<{ packetId: string; startedAt: string }>({
    action: "start",
    careRecipientId: input.careRecipientId,
    packetType: input.packetType,
    sections: input.sections,
    selectedDocumentIds: input.selectedDocumentIds,
    selectedContactIds: input.selectedContactIds,
    observationLimit: input.observationLimit,
  });
}

export async function completeCarePacketExport(packetId: string) {
  await invokePacket({ action: "complete", packetId });
}

export async function failCarePacketExport(packetId: string) {
  await invokePacket({ action: "fail", packetId });
}

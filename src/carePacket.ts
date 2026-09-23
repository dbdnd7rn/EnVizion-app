import {
  loadCareContacts,
  careContactCategoryLabels,
  preferredContactMethodLabels,
  type CareContact,
} from "./careContacts";
import {
  loadCareCommunications,
  careCommunicationPriorityLabels,
  careCommunicationTypeLabels,
  type CareCommunication,
} from "./careCommunications";
import { loadCarePlan } from "./carePlan";
import {
  familyUpdatePriorityLabels,
  familyUpdateTypeLabels,
  loadFamilyCommunicationCenter,
} from "./familyCommunication";
import { loadMedicationManagement } from "./medicationManagement";
import { loadCareTransitionWorkspace } from "./careTransition";
import { loadCareTeam } from "./careTeam";
import {
  loadCareDocuments,
  type CareDocument,
} from "./documents";
import {
  documentCategoryLabels,
  formatDocumentBytes,
} from "./documentHelpers";
import { loadCareReminders } from "./reminders";
import type { CareReminder } from "./reminderHelpers";
import type {
  CarePacketSection,
  CarePacketType,
  PacketCareCommunication,
  PacketCareContact,
  PacketDocumentReference,
  PacketEmergencyProfile,
  PacketFamilyUpdate,
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
  selectedCommunicationIds: string[];
  observationLimit: number;
  templateVersion: number;
  receiverNote: string;
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
    selectedCommunicationIds: row.selected_communication_ids ?? [],
    observationLimit: Number(row.observation_limit ?? 5),
    templateVersion: Number(row.template_version ?? 1),
    receiverNote: row.receiver_note ?? "",
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
    sourceName: document.sourceName,
    documentDate: document.documentDate,
    isKeyDocument: document.isKeyDocument,
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

export function packetCareCommunicationReference(
  communication: CareCommunication,
  contact?: CareContact,
): PacketCareCommunication {
  return {
    id: communication.id,
    communicationTypeLabel:
      careCommunicationTypeLabels[communication.communicationType],
    occurredAt: communication.occurredAt,
    personSpokenTo: communication.personSpokenTo,
    organizationName: communication.organizationName,
    summary: communication.summary,
    outcome: communication.outcome,
    followUpNeeded: communication.followUpNeeded,
    followUpAt: communication.followUpAt,
    notes: communication.notes,
    priorityLabel: careCommunicationPriorityLabels[communication.priority],
    tag: communication.tag,
    linkedContactName: contact?.providerName ?? "",
    linkedContactRole: contact
      ? [
          careContactCategoryLabels[contact.category],
          contact.specialty,
          contact.organizationName,
        ]
          .filter(Boolean)
          .join(" · ")
      : "",
  };
}

export async function loadCarePacketSupportingData(
  careRecipientId: string,
) {
  const [
    recipientResult,
    emergencyResult,
    reminders,
    documents,
    contacts,
    communications,
    historyResult,
    carePlan,
    medicationData,
    transitionData,
    familyCenter,
    careTeam,
  ] = await Promise.all([
    supabase
      .from("care_recipients")
      .select(
        "display_name, relationship, emergency_contact_name, emergency_contact_phone",
      )
      .eq("id", careRecipientId)
      .single(),
    supabase
      .from("care_emergency_profiles")
      .select(
        "local_emergency_number, preferred_hospital, allergies, important_conditions, medical_devices, advance_directive_location, emergency_notes, last_reviewed_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .maybeSingle(),
    loadCareReminders(careRecipientId),
    loadCareDocuments(careRecipientId, { includeArchived: false }),
    loadCareContacts(careRecipientId),
    loadCareCommunications(careRecipientId),
    supabase
      .from("care_packet_exports")
      .select(
        "id, packet_type, included_sections, selected_document_ids, selected_contact_ids, selected_communication_ids, observation_limit, template_version, receiver_note, status, started_at, completed_at, failed_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .order("started_at", { ascending: false })
      .limit(10),
    loadCarePlan(careRecipientId),
    loadMedicationManagement(careRecipientId),
    loadCareTransitionWorkspace(careRecipientId),
    loadFamilyCommunicationCenter(careRecipientId),
    loadCareTeam(careRecipientId),
  ]);

  if (recipientResult.error) throw recipientResult.error;
  if (emergencyResult.error) throw emergencyResult.error;
  if (historyResult.error) throw historyResult.error;

  const memberMap = new Map(
    careTeam.members.map((member) => [
      member.userId,
      member.isCurrentUser
        ? `${member.displayName || "Me"} (me)`
        : member.displayName || "Caregiver",
    ]),
  );

  const familyUpdates: PacketFamilyUpdate[] = familyCenter.updates
    .slice(0, 20)
    .map((update) => ({
      title: update.title,
      body: update.body,
      updateTypeLabel: familyUpdateTypeLabels[update.updateType],
      priorityLabel: familyUpdatePriorityLabels[update.priority],
      createdAt: update.createdAt,
      authorName: update.createdBy
        ? memberMap.get(update.createdBy) ?? "Caregiver"
        : "Care team",
    }));

  const emergencyProfile: PacketEmergencyProfile =
    emergencyResult.data
      ? {
          localEmergencyNumber:
            emergencyResult.data.local_emergency_number ?? "",
          preferredHospital: emergencyResult.data.preferred_hospital ?? "",
          allergies: emergencyResult.data.allergies ?? "",
          importantConditions:
            emergencyResult.data.important_conditions ?? "",
          medicalDevices: emergencyResult.data.medical_devices ?? "",
          advanceDirectiveLocation:
            emergencyResult.data.advance_directive_location ?? "",
          emergencyNotes: emergencyResult.data.emergency_notes ?? "",
          lastReviewedAt: emergencyResult.data.last_reviewed_at ?? null,
        }
      : null;

  return {
    recipient: {
      displayName: recipientResult.data.display_name,
      relationship: recipientResult.data.relationship ?? "",
      emergencyContactName:
        recipientResult.data.emergency_contact_name ?? "",
      emergencyContactPhone:
        recipientResult.data.emergency_contact_phone ?? "",
    } satisfies CarePacketRecipient,
    reminders,
    documents,
    contacts,
    communications,
    history: (historyResult.data ?? []).map(mapExport),
    carePlanItems: carePlan.items,
    carePlanCompletions: carePlan.completions,
    managedMedications: medicationData.medications.filter(
      (medication) => medication.active,
    ),
    managedMedicationRecords: medicationData.records,
    latestReconciliation: medicationData.reconciliations[0] ?? null,
    transitionPlan:
      transitionData.plan?.status === "active" ? transitionData.plan : null,
    transitionFollowUps: transitionData.followUps.filter(
      (followUp) => followUp.status === "open",
    ),
    emergencyProfile,
    familyUpdates,
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
  selectedCommunicationIds: string[];
  observationLimit: number;
  receiverNote: string;
}) {
  return invokePacket<{ packetId: string; startedAt: string }>({
    action: "start",
    careRecipientId: input.careRecipientId,
    packetType: input.packetType,
    sections: input.sections,
    selectedDocumentIds: input.selectedDocumentIds,
    selectedContactIds: input.selectedContactIds,
    selectedCommunicationIds: input.selectedCommunicationIds,
    observationLimit: input.observationLimit,
    receiverNote: input.receiverNote.slice(0, 1200),
    templateVersion: 2,
  });
}

export async function completeCarePacketExport(packetId: string) {
  await invokePacket({ action: "complete", packetId });
}

export async function failCarePacketExport(packetId: string) {
  await invokePacket({ action: "fail", packetId });
}

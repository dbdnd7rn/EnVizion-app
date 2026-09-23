import { loadCareContacts, type CareContact } from "./careContacts";
import { loadCareDocuments, type CareDocument } from "./documents";
import {
  loadMedicationManagement,
  type ManagedMedication,
  type MedicationReconciliation,
} from "./medicationManagement";
import {
  loadCareTransitionWorkspace,
  type CareTransitionPlan,
  type CareTransitionFollowUp,
} from "./careTransition";
import { supabase } from "./supabase";

export type CareEmergencyProfile = {
  id: string;
  careRecipientId: string;
  localEmergencyNumber: string;
  preferredHospital: string;
  allergies: string;
  importantConditions: string;
  medicalDevices: string;
  advanceDirectiveLocation: string;
  emergencyNotes: string;
  lastReviewedBy: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmergencyCenterData = {
  profile: CareEmergencyProfile | null;
  recipient: {
    displayName: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  contacts: CareContact[];
  keyDocuments: CareDocument[];
  medications: ManagedMedication[];
  latestReconciliation: MedicationReconciliation | null;
  transitionPlan: CareTransitionPlan | null;
  transitionFollowUps: CareTransitionFollowUp[];
};

function mapProfile(row: any): CareEmergencyProfile {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    localEmergencyNumber: String(row.local_emergency_number ?? ""),
    preferredHospital: String(row.preferred_hospital ?? ""),
    allergies: String(row.allergies ?? ""),
    importantConditions: String(row.important_conditions ?? ""),
    medicalDevices: String(row.medical_devices ?? ""),
    advanceDirectiveLocation: String(row.advance_directive_location ?? ""),
    emergencyNotes: String(row.emergency_notes ?? ""),
    lastReviewedBy: row.last_reviewed_by ?? null,
    lastReviewedAt: row.last_reviewed_at ?? null,
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

export async function loadEmergencyCenterData(
  careRecipientId: string,
): Promise<EmergencyCenterData> {
  const [
    profileResult,
    recipientResult,
    contacts,
    documents,
    medicationData,
    transitionData,
  ] = await Promise.all([
    supabase
      .from("care_emergency_profiles")
      .select(
        "id, care_recipient_id, local_emergency_number, preferred_hospital, allergies, important_conditions, medical_devices, advance_directive_location, emergency_notes, last_reviewed_by, last_reviewed_at, created_at, updated_at",
      )
      .eq("care_recipient_id", careRecipientId)
      .maybeSingle(),
    supabase
      .from("care_recipients")
      .select("display_name, emergency_contact_name, emergency_contact_phone")
      .eq("id", careRecipientId)
      .single(),
    loadCareContacts(careRecipientId),
    loadCareDocuments(careRecipientId, { includeArchived: false }),
    loadMedicationManagement(careRecipientId),
    loadCareTransitionWorkspace(careRecipientId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (recipientResult.error) throw recipientResult.error;

  return {
    profile: profileResult.data ? mapProfile(profileResult.data) : null,
    recipient: {
      displayName: String(recipientResult.data.display_name ?? "Care profile"),
      emergencyContactName: String(
        recipientResult.data.emergency_contact_name ?? "",
      ),
      emergencyContactPhone: String(
        recipientResult.data.emergency_contact_phone ?? "",
      ),
    },
    contacts: contacts.filter((contact) => Boolean(contact.phone)),
    keyDocuments: documents.filter((document) => document.isKeyDocument),
    medications: medicationData.medications.filter(
      (medication) => medication.active,
    ),
    latestReconciliation: medicationData.reconciliations[0] ?? null,
    transitionPlan:
      transitionData.plan?.status === "active" ? transitionData.plan : null,
    transitionFollowUps: transitionData.followUps.filter(
      (followUp) => followUp.status === "open",
    ),
  };
}

export async function saveEmergencyProfile(input: {
  careRecipientId: string;
  id?: string | null;
  localEmergencyNumber: string;
  preferredHospital: string;
  allergies: string;
  importantConditions: string;
  medicalDevices: string;
  advanceDirectiveLocation: string;
  emergencyNotes: string;
  markReviewed?: boolean;
}) {
  const userId = await currentUserId();
  const values = {
    local_emergency_number:
      input.localEmergencyNumber.trim().slice(0, 60) || null,
    preferred_hospital:
      input.preferredHospital.trim().slice(0, 300) || null,
    allergies: input.allergies.trim().slice(0, 3000) || null,
    important_conditions:
      input.importantConditions.trim().slice(0, 3000) || null,
    medical_devices: input.medicalDevices.trim().slice(0, 3000) || null,
    advance_directive_location:
      input.advanceDirectiveLocation.trim().slice(0, 1000) || null,
    emergency_notes: input.emergencyNotes.trim().slice(0, 3000) || null,
    ...(input.markReviewed
      ? {
          last_reviewed_by: userId,
          last_reviewed_at: new Date().toISOString(),
        }
      : {}),
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("care_emergency_profiles")
      .update(values)
      .eq("id", input.id)
      .eq("care_recipient_id", input.careRecipientId)
      .select(
        "id, care_recipient_id, local_emergency_number, preferred_hospital, allergies, important_conditions, medical_devices, advance_directive_location, emergency_notes, last_reviewed_by, last_reviewed_at, created_at, updated_at",
      )
      .single();

    if (error) throw error;
    return mapProfile(data);
  }

  const { data, error } = await supabase
    .from("care_emergency_profiles")
    .insert({
      care_recipient_id: input.careRecipientId,
      created_by: userId,
      ...values,
    })
    .select(
      "id, care_recipient_id, local_emergency_number, preferred_hospital, allergies, important_conditions, medical_devices, advance_directive_location, emergency_notes, last_reviewed_by, last_reviewed_at, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapProfile(data);
}

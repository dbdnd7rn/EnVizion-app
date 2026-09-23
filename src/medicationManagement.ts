import { supabase } from "./supabase";

export type MedicationOutcome = "taken" | "not_taken" | "prn_taken";

export type ManagedMedication = {
  id: string;
  careRecipientId: string;
  name: string;
  instructions: string;
  time: string;
  dose: string;
  route: string;
  purpose: string;
  prescriber: string;
  pharmacy: string;
  isPrn: boolean;
  refillDueOn: string;
  lastReconciledAt: string | null;
  reconciliationNote: string;
  active: boolean;
  discontinuedAt: string | null;
};

export type ManagedMedicationRecord = {
  id: string;
  medicationId: string;
  status: string;
  note: string;
  recordedAt: string;
  correctedAt: string | null;
};

export type MedicationReconciliation = {
  id: string;
  medicationCount: number;
  note: string;
  createdAt: string;
};

function mapMedication(row: any): ManagedMedication {
  return {
    id: String(row.id),
    careRecipientId: String(row.care_recipient_id),
    name: String(row.name),
    instructions: String(row.instructions ?? ""),
    time: String(row.time_label ?? ""),
    dose: String(row.dose ?? ""),
    route: String(row.route ?? ""),
    purpose: String(row.purpose ?? ""),
    prescriber: String(row.prescriber ?? ""),
    pharmacy: String(row.pharmacy ?? ""),
    isPrn: Boolean(row.is_prn),
    refillDueOn: row.refill_due_on ? String(row.refill_due_on) : "",
    lastReconciledAt: row.last_reconciled_at ?? null,
    reconciliationNote: String(row.reconciliation_note ?? ""),
    active: Boolean(row.active),
    discontinuedAt: row.discontinued_at ?? null,
  };
}

function mapRecord(row: any): ManagedMedicationRecord {
  return {
    id: String(row.id),
    medicationId: String(row.medication_id),
    status: String(row.status),
    note: String(row.note ?? ""),
    recordedAt: String(row.recorded_at),
    correctedAt: row.corrected_at ?? null,
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

const medicationSelect =
  "id, care_recipient_id, name, instructions, time_label, dose, route, purpose, prescriber, pharmacy, is_prn, refill_due_on, last_reconciled_at, reconciliation_note, active, discontinued_at";

export async function loadMedicationManagement(careRecipientId: string) {
  const [medicationsResult, recordsResult, reconciliationResult] =
    await Promise.all([
      supabase
        .from("medications")
        .select(medicationSelect)
        .eq("care_recipient_id", careRecipientId)
        .order("active", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("medication_records")
        .select(
          "id, medication_id, status, note, recorded_at, corrected_at",
        )
        .eq("care_recipient_id", careRecipientId)
        .order("recorded_at", { ascending: false })
        .limit(250),
      supabase
        .from("medication_reconciliations")
        .select("id, medication_count, note, created_at")
        .eq("care_recipient_id", careRecipientId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  if (medicationsResult.error) throw medicationsResult.error;
  if (recordsResult.error) throw recordsResult.error;
  if (reconciliationResult.error) throw reconciliationResult.error;

  return {
    medications: (medicationsResult.data ?? []).map(mapMedication),
    records: (recordsResult.data ?? []).map(mapRecord),
    reconciliations: (reconciliationResult.data ?? []).map(
      (row): MedicationReconciliation => ({
        id: String(row.id),
        medicationCount: Number(row.medication_count ?? 0),
        note: String(row.note ?? ""),
        createdAt: String(row.created_at),
      }),
    ),
  };
}

export async function saveManagedMedication(input: {
  careRecipientId: string;
  id?: string | null;
  name: string;
  instructions: string;
  time: string;
  dose: string;
  route: string;
  purpose: string;
  prescriber: string;
  pharmacy: string;
  isPrn: boolean;
  refillDueOn: string;
}) {
  const userId = await currentUserId();
  const values = {
    name: input.name.trim().slice(0, 200),
    instructions: input.instructions.trim().slice(0, 2000),
    time_label: input.time.trim().slice(0, 100),
    dose: input.dose.trim().slice(0, 200) || null,
    route: input.route.trim().slice(0, 200) || null,
    purpose: input.purpose.trim().slice(0, 500) || null,
    prescriber: input.prescriber.trim().slice(0, 300) || null,
    pharmacy: input.pharmacy.trim().slice(0, 300) || null,
    is_prn: input.isPrn,
    refill_due_on: input.refillDueOn.trim() || null,
    active: true,
    discontinued_at: null,
    updated_at: new Date().toISOString(),
  };

  if (!values.name) throw new Error("Add the medication name.");
  if (!values.instructions) {
    throw new Error("Add the directions exactly as provided.");
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("medications")
      .update(values)
      .eq("care_recipient_id", input.careRecipientId)
      .eq("id", input.id)
      .select(medicationSelect)
      .single();

    if (error) throw error;
    return mapMedication(data);
  }

  const { data, error } = await supabase
    .from("medications")
    .insert({
      care_recipient_id: input.careRecipientId,
      user_id: userId,
      ...values,
    })
    .select(medicationSelect)
    .single();

  if (error) throw error;
  return mapMedication(data);
}

export async function discontinueManagedMedication(
  careRecipientId: string,
  medicationId: string,
) {
  const at = new Date().toISOString();
  const { error } = await supabase
    .from("medications")
    .update({
      active: false,
      discontinued_at: at,
      updated_at: at,
    })
    .eq("care_recipient_id", careRecipientId)
    .eq("id", medicationId);

  if (error) throw error;
  return at;
}

export async function recordManagedMedicationOutcome(input: {
  careRecipientId: string;
  medicationId: string;
  status: MedicationOutcome;
  note: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("medication_records")
    .insert({
      medication_id: input.medicationId,
      care_recipient_id: input.careRecipientId,
      user_id: userId,
      status: input.status,
      note: input.note.trim().slice(0, 1000) || null,
      recorded_at: new Date().toISOString(),
    })
    .select(
      "id, medication_id, status, note, recorded_at, corrected_at",
    )
    .single();

  if (error) throw error;
  return mapRecord(data);
}

export async function correctManagedMedicationRecord(
  careRecipientId: string,
  recordId: string,
) {
  const correctedAt = new Date().toISOString();
  const { error } = await supabase
    .from("medication_records")
    .update({ status: "corrected", corrected_at: correctedAt })
    .eq("care_recipient_id", careRecipientId)
    .eq("id", recordId);

  if (error) throw error;
  return correctedAt;
}

export async function reconcileManagedMedicationList(
  careRecipientId: string,
  note: string,
) {
  const { data, error } = await supabase.rpc("reconcile_medication_list", {
    p_care_recipient_id: careRecipientId,
    p_note: note.trim() || null,
  });

  if (error) throw error;
  if (!data) throw new Error("The medication reconciliation was not saved.");
  return String(data);
}

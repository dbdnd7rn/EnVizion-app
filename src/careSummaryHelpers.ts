import type { Appointment } from "./domain";

export type CareSummaryMedication = {
  id: string;
  name: string;
  instructions: string;
  time: string;
  active?: boolean;
  discontinuedAt?: string | null;
};

export type CareSummaryMedicationRecord = {
  id: string;
  medicationId: string;
  status: string;
  note?: string;
  recordedAt: string;
  correctedAt?: string | null;
};

export function isDoseRecordedAsTaken(
  record: CareSummaryMedicationRecord,
): boolean {
  return (
    !record.correctedAt &&
    record.status !== "corrected" &&
    (record.status === "taken" || record.status === "prn_taken")
  );
}

export function recordedAsTakenCount(
  records: CareSummaryMedicationRecord[],
): number {
  return records.filter(isDoseRecordedAsTaken).length;
}

export function appointmentCardState(
  appointmentId: string | null,
  appointment: Appointment,
) {
  if (!appointmentId) {
    return {
      hasAppointment: false,
      title: "No upcoming appointment",
      subtitle: "Add visit details when ready.",
    };
  }

  const details = [
    appointment.date || "Date to be confirmed",
    appointment.time,
    appointment.location,
  ].filter(Boolean);

  return {
    hasAppointment: true,
    title: appointment.title.trim() || "Next appointment",
    subtitle: details.join(" · "),
  };
}

export function medicationHistoryLabel(
  record: CareSummaryMedicationRecord,
): string {
  if (record.correctedAt || record.status === "corrected") {
    return "Corrected / withdrawn";
  }
  if (record.status === "taken") return "Recorded as taken";
  if (record.status === "prn_taken") return "PRN dose recorded as taken";
  if (record.status === "not_taken") return "Recorded as not taken";
  return "Recorded entry";
}

export function careSummaryMedicationLines(
  medications: CareSummaryMedication[],
  records: CareSummaryMedicationRecord[],
): string[] {
  const medicationById = new Map(
    medications.map((medication) => [medication.id, medication]),
  );
  const active = medications.filter(
    (medication) => medication.active !== false,
  );

  return [
    "MEDICATION LIST",
    ...(active.length
      ? active.map(
          (medication) =>
            `${medication.name} | Directions entered: ${medication.instructions || "Not recorded"} | Scheduled time: ${medication.time || "Not recorded"}`,
        )
      : ["No active medications recorded."]),
    "MEDICATION HISTORY (times indicate when entries were recorded)",
    ...(records.length
      ? records.map((record) => {
          const medication = medicationById.get(record.medicationId);
          const parts = [
            medication?.name || "Medication",
            medicationHistoryLabel(record),
            `Entry recorded: ${new Date(record.recordedAt).toLocaleString()}`,
          ];
          if (record.note?.trim()) {
            parts.push(`Note: ${record.note.trim()}`);
          }
          if (record.correctedAt) {
            parts.push(
              `Withdrawn: ${new Date(record.correctedAt).toLocaleString()}`,
            );
          }
          return parts.join(" | ");
        })
      : ["No medication history recorded yet."]),
    "A dose recorded as taken is a caregiver-entered app record. It does not verify medication adherence.",
  ];
}

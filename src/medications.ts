export type Medication = {
  id: string;
  name: string;
  instructions: string;
  time: string;
};
export type MedicationRecord = {
  id: string;
  medication: Medication;
  recordedAt: string;
  correctedAt?: string;
};

export function correctMedicationRecord(
  records: MedicationRecord[],
  id: string,
  at: string,
) {
  return records.map((record) =>
    record.id === id && !record.correctedAt
      ? { ...record, correctedAt: at }
      : record,
  );
}

export function medicationLines(
  medications: Medication[],
  records: MedicationRecord[],
) {
  return [
    "This list is a caregiver record, not a prescription or dosing recommendation.",
    "MEDICATION LIST",
    ...medications.map(
      (m) =>
        `${m.name} | Directions entered: ${m.instructions} | Scheduled time: ${m.time}`,
    ),
    "MEDICATION HISTORY (times indicate when entries were recorded)",
    ...records.map(
      (r) =>
        `${r.medication.name} | ${r.medication.instructions} | Recorded as taken: ${new Date(r.recordedAt).toLocaleString()}${r.correctedAt ? ` | Corrected / withdrawn: ${new Date(r.correctedAt).toLocaleString()}` : ""}`,
    ),
    ...(records.length ? [] : ["No doses recorded yet."]),
  ];
}

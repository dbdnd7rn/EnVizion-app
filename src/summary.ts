import { appointmentLines, trackerFields } from "./domain.ts";
import type { Appointment, Entry } from "./domain.ts";
import { medicationLines } from "./medications.ts";
import type { Medication, MedicationRecord } from "./medications.ts";

export type SummaryData = {
  entries: Entry[];
  medications: Medication[];
  medicationRecords: MedicationRecord[];
  appointment: Appointment;
  questions: string[];
};

export function observationLines(entry: Entry): string[] {
  return [
    `${entry.kind} | Recorded: ${new Date(entry.recordedAt).toLocaleString()}`,
    ...trackerFields[entry.kind]
      .filter((field) => entry.values[field.key]?.trim())
      .map((field) => `${field.label}: ${entry.values[field.key]}`),
    ...(entry.values.notes?.trim() ? [`Notes: ${entry.values.notes}`] : []),
  ];
}

export function careSummaryLines(data: SummaryData): string[] {
  return [
    "Caregiver-entered demo records from this session only. Not a diagnosis, verified medical record, or complete care plan.",
    "APPOINTMENT PREPARATION",
    ...appointmentLines(data.appointment, data.questions),
    "OBSERVATIONS",
    ...(data.entries.length
      ? data.entries.flatMap(observationLines)
      : ["No observations recorded in this session."]),
    ...medicationLines(data.medications, data.medicationRecords),
  ];
}

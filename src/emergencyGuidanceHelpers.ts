import type { EmergencyCenterData } from "./emergencyCenter";

export type EmergencyPreparednessItem = {
  key: "emergency_number" | "primary_contact" | "allergies" |
    "conditions" | "medication_review" | "key_documents";
  label: string;
  complete: boolean;
};

/**
 * The six current preparedness anchors used by the existing 0/6 card.
 * Missing means not documented, not clinically absent or clinically unsafe.
 */
export function emergencyPreparednessItems(
  data: EmergencyCenterData,
): EmergencyPreparednessItem[] {
  return [
    { key: "emergency_number", label: "Local emergency number",
      complete: Boolean(data.profile?.localEmergencyNumber?.trim()) },
    { key: "primary_contact", label: "Primary contact and phone",
      complete: Boolean(data.recipient.emergencyContactName?.trim() &&
        data.recipient.emergencyContactPhone?.trim()) },
    { key: "allergies", label: "Allergies documented",
      complete: Boolean(data.profile?.allergies?.trim()) },
    { key: "conditions", label: "Important conditions documented",
      complete: Boolean(data.profile?.importantConditions?.trim()) },
    { key: "medication_review", label: "Medication list reviewed",
      complete: Boolean(data.latestReconciliation) },
    { key: "key_documents", label: "Emergency/health documents available",
      complete: data.keyDocuments.length > 0 },
  ];
}

/**
 * A saved number is never an instruction to auto-call: it is shown as an
 * explicit dialer action only inside the user-opened guidance screen.
 */
export function safeEmergencyDialNumber(value: string): string | null {
  const cleaned = value.trim().replace(/[\s().-]/g, "");
  return /^\+?[0-9]{3,15}$/.test(cleaned) ? cleaned : null;
}

export const emergencyWarningSigns = [
  { title: "Severe breathing trouble",
    detail: "Gasping, struggling to breathe, or suddenly unable to speak normally." },
  { title: "Persistent chest pressure or pain",
    detail: "Especially with breathlessness, sweating, faintness, or discomfort spreading to the arm or jaw." },
  { title: "Unresponsive, severely confused, or heavy bleeding",
    detail: "Any immediate threat to life needs emergency services." },
] as const;

export const strokeBEFAST = [
  { letter: "B", label: "Balance", detail: "Sudden loss of balance" },
  { letter: "E", label: "Eyes", detail: "Sudden change in vision" },
  { letter: "F", label: "Face", detail: "One side drooping" },
  { letter: "A", label: "Arms", detail: "Weakness or numbness" },
  { letter: "S", label: "Speech", detail: "Slurred or difficult speech" },
  { letter: "T", label: "Time", detail: "Call emergency services immediately" },
] as const;

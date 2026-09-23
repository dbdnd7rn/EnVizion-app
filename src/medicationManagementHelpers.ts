import type {
  ManagedMedication,
  MedicationReconciliation,
} from "./medicationManagement";

export function medicationOutcomeLabel(status: string) {
  if (status === "taken") return "Recorded as taken";
  if (status === "not_taken") return "Recorded as not taken";
  if (status === "prn_taken") return "PRN / as-needed recorded as taken";
  if (status === "corrected") return "Corrected / withdrawn";
  return status.replaceAll("_", " ");
}

export function medicationReconciliationAgeDays(
  reconciliation: MedicationReconciliation | null,
  now = new Date(),
) {
  if (!reconciliation) return null;
  const at = new Date(reconciliation.createdAt).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

export function medicationReconciliationLabel(
  reconciliation: MedicationReconciliation | null,
  now = new Date(),
) {
  const age = medicationReconciliationAgeDays(reconciliation, now);
  if (age == null) return "Not reconciled yet";
  if (age === 0) return "Reconciled today";
  if (age === 1) return "Reconciled yesterday";
  return `Reconciled ${age} days ago`;
}

export function medicationRefillState(
  medication: Pick<ManagedMedication, "refillDueOn" | "active">,
  now = new Date(),
) {
  if (!medication.active || !medication.refillDueOn) return "none" as const;
  const due = new Date(medication.refillDueOn + "T23:59:59").getTime();
  if (!Number.isFinite(due)) return "none" as const;

  const days = Math.ceil((due - now.getTime()) / 86_400_000);
  if (days < 0) return "overdue" as const;
  if (days <= 7) return "soon" as const;
  return "future" as const;
}

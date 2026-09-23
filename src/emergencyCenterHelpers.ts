import type { EmergencyCenterData } from "./emergencyCenter";

export function emergencyProfileCompleteness(data: EmergencyCenterData) {
  const checks = [
    Boolean(data.profile?.localEmergencyNumber),
    Boolean(
      data.recipient.emergencyContactName &&
        data.recipient.emergencyContactPhone,
    ),
    Boolean(data.profile?.allergies),
    Boolean(data.profile?.importantConditions),
    Boolean(data.latestReconciliation),
    Boolean(data.keyDocuments.length),
  ];

  return {
    completed: checks.filter(Boolean).length,
    total: checks.length,
  };
}

export function emergencyReviewLabel(
  lastReviewedAt: string | null | undefined,
  now = new Date(),
) {
  if (!lastReviewedAt) return "Not reviewed yet";
  const at = new Date(lastReviewedAt);
  if (!Number.isFinite(at.getTime())) return "Review date unavailable";

  const days = Math.max(
    0,
    Math.floor((now.getTime() - at.getTime()) / 86_400_000),
  );
  if (days === 0) return "Reviewed today";
  if (days === 1) return "Reviewed yesterday";
  return `Reviewed ${days} days ago`;
}

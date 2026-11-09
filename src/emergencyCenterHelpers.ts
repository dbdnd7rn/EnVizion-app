import type { EmergencyCenterData } from "./emergencyCenter";
import { emergencyPreparednessItems } from "./emergencyGuidanceHelpers.ts";

export function emergencyProfileCompleteness(data: EmergencyCenterData) {
  const checks = emergencyPreparednessItems(data);
  return {
    completed: checks.filter((item) => item.complete).length,
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

import type { CoordinationConflict } from "./careCoordinationConflicts";
import type {
  CoordinationResolution,
  CoordinationResolutionStatus,
} from "./careCoordinationWorkflow";

export function effectiveCoordinationStatus(
  resolution: CoordinationResolution | null | undefined,
  now = new Date(),
): CoordinationResolutionStatus {
  if (!resolution) return "open";
  if (
    resolution.status === "snoozed" &&
    resolution.snoozedUntil &&
    new Date(resolution.snoozedUntil).getTime() <= now.getTime()
  ) {
    return "open";
  }
  return resolution.status;
}

export function resolutionMap(
  resolutions: CoordinationResolution[],
) {
  return new Map(resolutions.map((row) => [row.conflictKey, row]));
}

export function currentActionableConflicts(
  conflicts: CoordinationConflict[],
  resolutions: CoordinationResolution[],
  now = new Date(),
) {
  const map = resolutionMap(resolutions);
  return conflicts.filter(
    (conflict) =>
      effectiveCoordinationStatus(map.get(conflict.id), now) === "open",
  );
}

export function currentSnoozedConflicts(
  conflicts: CoordinationConflict[],
  resolutions: CoordinationResolution[],
  now = new Date(),
) {
  const map = resolutionMap(resolutions);
  return conflicts.filter(
    (conflict) =>
      effectiveCoordinationStatus(map.get(conflict.id), now) === "snoozed",
  );
}

export function currentResolvedConflicts(
  conflicts: CoordinationConflict[],
  resolutions: CoordinationResolution[],
) {
  const map = resolutionMap(resolutions);
  return conflicts.filter(
    (conflict) => map.get(conflict.id)?.status === "resolved",
  );
}

export function coordinationHandlingLabel(
  resolution: CoordinationResolution | null | undefined,
  caregiverName: (userId: string | null) => string,
) {
  if (!resolution?.assignedTo) return "Unassigned";
  return `Handling: ${caregiverName(resolution.assignedTo)}`;
}

export function coordinationHistoryActionLabel(action: string) {
  if (action === "tracking_started") return "Coordination tracking started";
  if (action === "assigned") return "Assigned";
  if (action === "unassigned") return "Assignment cleared";
  if (action === "snoozed") return "Snoozed";
  if (action === "resolved") return "Marked resolved";
  if (action === "reopened") return "Reopened";
  return action;
}

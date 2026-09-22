export type CareTaskAssignmentStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "superseded";

export type CareTaskAssignment = {
  id: string;
  taskId: string;
  careRecipientId: string;
  assignedTo: string;
  assignedBy: string | null;
  status: CareTaskAssignmentStatus;
  responseNote: string;
  respondedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
};

export function latestTaskAssignments(assignments: CareTaskAssignment[]) {
  const latest = new Map<string, CareTaskAssignment>();

  for (const assignment of assignments) {
    const existing = latest.get(assignment.taskId);
    if (
      !existing ||
      new Date(assignment.createdAt).getTime() >
        new Date(existing.createdAt).getTime()
    ) {
      latest.set(assignment.taskId, assignment);
    }
  }

  return latest;
}

export function taskAssignmentLabel(
  assignment: CareTaskAssignment | null | undefined,
  assignedTo: string | null,
) {
  if (!assignedTo) return "Shared / unassigned";
  if (!assignment) return "Legacy assignment";
  if (assignment.status === "pending") return "Awaiting acknowledgement";
  if (assignment.status === "accepted") return "Accepted";
  if (assignment.status === "declined") return "Declined";
  return "Reassigned";
}

export function pendingAssignmentForUser(
  assignment: CareTaskAssignment | null | undefined,
  currentUserId: string | null,
) {
  return Boolean(
    assignment &&
      currentUserId &&
      assignment.assignedTo === currentUserId &&
      assignment.status === "pending",
  );
}

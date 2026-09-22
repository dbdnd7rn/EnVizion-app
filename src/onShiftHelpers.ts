import type { CareTask, CareTaskCompletion } from "./careTasks";
import type { CaregiverShiftSession } from "./onShiftCaregiver";
import { shiftTaskBucket } from "./shiftBoardHelpers";

export function onShiftResponsibilities(
  tasks: CareTask[],
  currentUserId: string | null,
) {
  const open = tasks.filter((task) => task.status === "open");
  const mine = currentUserId
    ? open.filter((task) => task.assignedTo === currentUserId)
    : [];
  const shared = open.filter((task) => task.assignedTo === null);

  const urgent = [...mine, ...shared]
    .filter((task, index, rows) => rows.findIndex((row) => row.id === task.id) === index)
    .filter((task) => {
      const bucket = shiftTaskBucket(task);
      return bucket === "overdue" || bucket === "due_soon";
    })
    .sort(
      (a, b) =>
        new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    );

  return { mine, shared, urgent };
}

export function onShiftCompletions(
  completions: CareTaskCompletion[],
  session: Pick<CaregiverShiftSession, "startedAt">,
) {
  const start = new Date(session.startedAt).getTime();

  return completions
    .filter((item) => new Date(item.completedAt).getTime() >= start)
    .sort(
      (a, b) =>
        new Date(b.completedAt).getTime() -
        new Date(a.completedAt).getTime(),
    );
}

export function onShiftElapsedMinutes(
  session: Pick<CaregiverShiftSession, "startedAt" | "endedAt">,
  now = new Date(),
) {
  const start = new Date(session.startedAt).getTime();
  const end = session.endedAt
    ? new Date(session.endedAt).getTime()
    : now.getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 60_000);
}

export function onShiftDurationLabel(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(safe / 60);
  const remaining = safe % 60;

  if (!hours) return `${remaining} min`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

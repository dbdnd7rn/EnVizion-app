import type { CareTask } from "./careTasks";
import type { CareTaskCompletion } from "./careTasks";

export type ShiftTaskBucket =
  | "overdue"
  | "due_soon"
  | "later_today"
  | "future";

export function sameLocalDay(iso: string, now = new Date()) {
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return false;

  return (
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate()
  );
}

export function shiftTaskBucket(
  task: Pick<CareTask, "status" | "dueAt">,
  now = new Date(),
): ShiftTaskBucket {
  const due = new Date(task.dueAt);

  if (!Number.isFinite(due.getTime())) return "future";
  if (task.status === "open" && due.getTime() < now.getTime()) return "overdue";

  const minutesAway = (due.getTime() - now.getTime()) / 60_000;
  if (task.status === "open" && minutesAway >= 0 && minutesAway <= 60) {
    return "due_soon";
  }

  if (task.status === "open" && sameLocalDay(task.dueAt, now)) {
    return "later_today";
  }

  return "future";
}

export function shiftBoardCounts(
  tasks: Array<Pick<CareTask, "status" | "dueAt" | "assignedTo">>,
  completions: Array<Pick<CareTaskCompletion, "completedAt">>,
  currentUserId: string | null,
  now = new Date(),
) {
  const open = tasks.filter((task) => task.status === "open");
  return {
    open: open.length,
    overdue: open.filter((task) => shiftTaskBucket(task, now) === "overdue").length,
    dueSoon: open.filter((task) => shiftTaskBucket(task, now) === "due_soon").length,
    dueToday: open.filter((task) => {
      const bucket = shiftTaskBucket(task, now);
      return bucket === "due_soon" || bucket === "later_today";
    }).length,
    mine: currentUserId
      ? open.filter((task) => task.assignedTo === currentUserId).length
      : 0,
    completedToday: completions.filter((item) =>
      sameLocalDay(item.completedAt, now),
    ).length,
  };
}

export function shiftSnapshotTask(task: CareTask, assigneeName: string) {
  return {
    id: task.id,
    title: task.title,
    dueAt: task.dueAt,
    category: task.category,
    priority: task.priority,
    recurrence: task.recurrence,
    assignedTo: task.assignedTo,
    assigneeName,
  };
}

export function shiftSnapshotCompletion(
  completion: CareTaskCompletion,
  taskTitle: string,
  completedByName: string,
) {
  return {
    id: completion.id,
    taskId: completion.taskId,
    title: taskTitle,
    completedAt: completion.completedAt,
    completedBy: completion.completedBy,
    completedByName,
    note: completion.note,
  };
}

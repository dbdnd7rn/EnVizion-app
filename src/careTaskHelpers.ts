export const careTaskCategories = [
  "general",
  "daily_care",
  "medication",
  "appointment",
  "provider",
  "communication_follow_up",
  "transition",
  "insurance",
] as const;

export type CareTaskCategory = (typeof careTaskCategories)[number];

export const careTaskCategoryLabels: Record<CareTaskCategory, string> = {
  general: "General care",
  daily_care: "Daily care",
  medication: "Medication",
  appointment: "Appointment",
  provider: "Provider",
  communication_follow_up: "Communication follow-up",
  transition: "Transition home",
  insurance: "Insurance",
};

export const careTaskRecurrences = ["none", "daily", "weekly", "monthly"] as const;
export type CareTaskRecurrence = (typeof careTaskRecurrences)[number];

export const careTaskRecurrenceLabels: Record<CareTaskRecurrence, string> = {
  none: "One time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const careTaskPriorities = ["routine", "important", "high"] as const;
export type CareTaskPriority = (typeof careTaskPriorities)[number];

export const careTaskPriorityLabels: Record<CareTaskPriority, string> = {
  routine: "Routine",
  important: "Important",
  high: "High",
};

export type CareTaskStatus = "open" | "completed" | "cancelled";
export type CareTaskDisplayStatus =
  | "overdue"
  | "due_today"
  | "upcoming"
  | "completed"
  | "cancelled";

export function careTaskDisplayStatus(
  task: { status: CareTaskStatus; dueAt: string },
  now = new Date(),
): CareTaskDisplayStatus {
  if (task.status === "completed") return "completed";
  if (task.status === "cancelled") return "cancelled";

  const due = new Date(task.dueAt);
  if (!Number.isFinite(due.getTime())) return "upcoming";
  if (due.getTime() < now.getTime()) return "overdue";

  const sameDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate();

  return sameDay ? "due_today" : "upcoming";
}

export function careTaskDisplayStatusLabel(status: CareTaskDisplayStatus) {
  if (status === "overdue") return "Overdue";
  if (status === "due_today") return "Due today";
  if (status === "upcoming") return "Upcoming";
  if (status === "completed") return "Completed";
  return "Cancelled";
}

export function careTaskSearchText(task: {
  title: string;
  details: string;
  category: CareTaskCategory;
  priority: CareTaskPriority;
}, linkedText = "") {
  return [
    task.title,
    task.details,
    careTaskCategoryLabels[task.category],
    careTaskPriorityLabels[task.priority],
    linkedText,
  ]
    .join(" ")
    .toLowerCase();
}

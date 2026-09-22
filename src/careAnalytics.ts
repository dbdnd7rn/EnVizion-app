import { supabase } from "./supabase";

export type AnalyticsTask = {
  id: string;
  title: string;
  assignedTo: string | null;
  dueAt: string;
  status: "open" | "completed" | "cancelled";
};

export type AnalyticsTaskCompletion = {
  id: string;
  taskId: string;
  completedBy: string | null;
  completedAt: string;
};

export type AnalyticsShift = {
  id: string;
  caregiverId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "completed" | "cancelled";
};

export type AnalyticsAttendance = {
  id: string;
  shiftId: string;
  caregiverId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  status: "active" | "completed";
  lateMinutes: number;
};

export type AnalyticsCoverageEvent = {
  id: string;
  taskId: string;
  taskDueAt: string;
  assignedTo: string | null;
  detectedAt: string;
};

export type CareAnalyticsData = {
  tasks: AnalyticsTask[];
  completions: AnalyticsTaskCompletion[];
  shifts: AnalyticsShift[];
  attendance: AnalyticsAttendance[];
  coverageEvents: AnalyticsCoverageEvent[];
};

export async function loadCareAnalyticsData(input: {
  careRecipientId: string;
  startIso: string;
  endIso: string;
}) {
  const attendanceStart = new Date(
    new Date(input.startIso).getTime() - 36 * 60 * 60_000,
  ).toISOString();

  const [tasks, completions, shifts, attendance, coverageEvents] =
    await Promise.all([
      supabase
        .from("care_tasks")
        .select("id, title, assigned_to, due_at, status")
        .eq("care_recipient_id", input.careRecipientId)
        .limit(2000),
      supabase
        .from("care_task_completions")
        .select("id, task_id, completed_by, completed_at")
        .eq("care_recipient_id", input.careRecipientId)
        .gte("completed_at", input.startIso)
        .lt("completed_at", input.endIso)
        .order("completed_at", { ascending: true })
        .limit(2000),
      supabase
        .from("care_shifts")
        .select("id, caregiver_id, starts_at, ends_at, status")
        .eq("care_recipient_id", input.careRecipientId)
        .lt("starts_at", input.endIso)
        .gt("ends_at", input.startIso)
        .order("starts_at", { ascending: true })
        .limit(1000),
      supabase
        .from("care_shift_attendance")
        .select(
          "id, shift_id, caregiver_id, checked_in_at, checked_out_at, attendance_status, late_minutes",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .gte("checked_in_at", attendanceStart)
        .lt("checked_in_at", input.endIso)
        .order("checked_in_at", { ascending: true })
        .limit(1000),
      supabase
        .from("care_coverage_events")
        .select(
          "id, task_id, task_due_at, assigned_to, detected_at",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .gte("detected_at", input.startIso)
        .lt("detected_at", input.endIso)
        .order("detected_at", { ascending: true })
        .limit(1000),
    ]);

  for (const result of [tasks, completions, shifts, attendance, coverageEvents]) {
    if (result.error) throw result.error;
  }

  return {
    tasks: (tasks.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      assignedTo: row.assigned_to ?? null,
      dueAt: row.due_at,
      status: row.status,
    })) as AnalyticsTask[],
    completions: (completions.data ?? []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      completedBy: row.completed_by ?? null,
      completedAt: row.completed_at,
    })) as AnalyticsTaskCompletion[],
    shifts: (shifts.data ?? []).map((row: any) => ({
      id: row.id,
      caregiverId: row.caregiver_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    })) as AnalyticsShift[],
    attendance: (attendance.data ?? []).map((row: any) => ({
      id: row.id,
      shiftId: row.shift_id,
      caregiverId: row.caregiver_id,
      checkedInAt: row.checked_in_at,
      checkedOutAt: row.checked_out_at ?? null,
      status: row.attendance_status,
      lateMinutes: Number(row.late_minutes ?? 0),
    })) as AnalyticsAttendance[],
    coverageEvents: (coverageEvents.data ?? []).map((row: any) => ({
      id: row.id,
      taskId: row.task_id,
      taskDueAt: row.task_due_at,
      assignedTo: row.assigned_to ?? null,
      detectedAt: row.detected_at,
    })) as AnalyticsCoverageEvent[],
  } satisfies CareAnalyticsData;
}

export async function recordWeeklyAnalyticsReport(
  careRecipientId: string,
  startIso: string,
  endIso: string,
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Please sign in again.");

  const { error } = await supabase.from("care_audit_events").insert({
    care_recipient_id: careRecipientId,
    actor_user_id: user.id,
    action: "weekly_coordination_report_generated",
    entity_type: "care_analytics",
    entity_id: careRecipientId,
    summary: `Weekly coordination report generated · ${startIso} → ${endIso}`,
  });

  if (error) throw error;
}

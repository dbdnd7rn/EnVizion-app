import type { AgendaAppointment } from "./careAgenda";
import type { CareShift } from "./careSchedule";
import type { CareTask } from "./careTasks";
import type { CareCommunication } from "./careCommunications";
import type { CoordinationConflict } from "./careCoordinationConflicts";
import type { MedicationRecord } from "./medications";

export type DashboardAttentionKind =
  | "overdue_task"
  | "time_sensitive_coordination"
  | "due_soon_task"
  | "communication_follow_up";

export type DashboardAttentionItem = {
  id: string;
  kind: DashboardAttentionKind;
  title: string;
  detail: string;
  occurredAt: string;
  target:
    | "CareTasks"
    | "CareCoordinationInbox"
    | "CareCommunicationLog";
};

function validTime(value: string | null | undefined) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function dashboardAppointmentStart(appointment: AgendaAppointment) {
  if (appointment.startsAt) {
    const time = validTime(appointment.startsAt);
    if (time !== null) return new Date(time).toISOString();
  }

  if (!appointment.appointmentDate) return null;
  const time = appointment.appointmentTime?.slice(0, 5) || "12:00";
  const parsed = new Date(`${appointment.appointmentDate}T${time}:00`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function nextDashboardAppointment(
  appointments: AgendaAppointment[],
  now = new Date(),
) {
  const nowMs = now.getTime();

  return (
    appointments
      .map((appointment) => ({
        appointment,
        startsAt: dashboardAppointmentStart(appointment),
      }))
      .filter(
        (
          row,
        ): row is {
          appointment: AgendaAppointment;
          startsAt: string;
        } =>
          row.startsAt !== null &&
          new Date(row.startsAt).getTime() >= nowMs,
      )
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )[0] ?? null
  );
}

export function dashboardShiftStatus(
  shifts: CareShift[],
  now = new Date(),
) {
  const nowMs = now.getTime();
  const scheduled = shifts
    .filter((shift) => shift.status === "scheduled")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );

  const active =
    scheduled.find((shift) => {
      const start = new Date(shift.startsAt).getTime();
      const end = new Date(shift.endsAt).getTime();
      return start <= nowMs && end > nowMs;
    }) ?? null;

  const next =
    scheduled.find((shift) => new Date(shift.startsAt).getTime() > nowMs) ??
    null;

  return { active, next };
}

export function dashboardTaskBuckets(
  tasks: CareTask[],
  now = new Date(),
  dueSoonMinutes = 120,
) {
  const nowMs = now.getTime();
  const soonCutoff = nowMs + dueSoonMinutes * 60_000;
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const open = tasks
    .filter((task) => task.status === "open")
    .slice()
    .sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    );

  return {
    overdue: open.filter(
      (task) => new Date(task.dueAt).getTime() < nowMs,
    ),
    dueSoon: open.filter((task) => {
      const due = new Date(task.dueAt).getTime();
      return due >= nowMs && due <= soonCutoff;
    }),
    dueToday: open.filter((task) => {
      const due = new Date(task.dueAt).getTime();
      return due >= nowMs && due <= endOfDay.getTime();
    }),
    open,
  };
}

export function dashboardRecentCommunications(
  communications: CareCommunication[],
  limit = 3,
) {
  return communications
    .slice()
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .slice(0, limit);
}

export function dashboardMedicationActivity(
  records: MedicationRecord[],
  now = new Date(),
) {
  const valid = records
    .filter((record) => !record.correctedAt)
    .slice()
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );

  const sameDay = (value: string) => {
    const date = new Date(value);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  };

  return {
    todayCount: valid.filter((record) => sameDay(record.recordedAt)).length,
    latest: valid[0] ?? null,
  };
}

export function dashboardAttentionItems(input: {
  tasks: CareTask[];
  conflicts: CoordinationConflict[];
  communications: CareCommunication[];
  now?: Date;
  limit?: number;
}) {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 5;
  const buckets = dashboardTaskBuckets(input.tasks, now);
  const nowMs = now.getTime();
  const followUpCutoff = nowMs + 2 * 60 * 60_000;
  const rows: Array<DashboardAttentionItem & { order: number }> = [];

  for (const task of buckets.overdue) {
    rows.push({
      id: `task-overdue:${task.id}`,
      kind: "overdue_task",
      title: task.title,
      detail: `Overdue since ${new Date(task.dueAt).toLocaleString()}.`,
      occurredAt: task.dueAt,
      target: "CareTasks",
      order: 0,
    });
  }

  for (const conflict of input.conflicts.filter(
    (item) => item.priority === "time_sensitive",
  )) {
    rows.push({
      id: `coordination:${conflict.id}`,
      kind: "time_sensitive_coordination",
      title: conflict.title,
      detail: conflict.detail,
      occurredAt: conflict.startsAt,
      target: "CareCoordinationInbox",
      order: 1,
    });
  }

  for (const task of buckets.dueSoon) {
    rows.push({
      id: `task-soon:${task.id}`,
      kind: "due_soon_task",
      title: task.title,
      detail: `Due ${new Date(task.dueAt).toLocaleString()}.`,
      occurredAt: task.dueAt,
      target: "CareTasks",
      order: 2,
    });
  }

  for (const communication of input.communications) {
    if (!communication.followUpNeeded || !communication.followUpAt) continue;
    const followUp = new Date(communication.followUpAt).getTime();
    if (!Number.isFinite(followUp) || followUp > followUpCutoff) continue;

    rows.push({
      id: `follow-up:${communication.id}`,
      kind: "communication_follow_up",
      title: communication.summary,
      detail:
        followUp < nowMs
          ? `Follow-up overdue since ${new Date(
              communication.followUpAt,
            ).toLocaleString()}.`
          : `Follow-up due ${new Date(
              communication.followUpAt,
            ).toLocaleString()}.`,
      occurredAt: communication.followUpAt,
      target: "CareCommunicationLog",
      order: 3,
    });
  }

  return rows
    .sort(
      (a, b) =>
        a.order - b.order ||
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
    )
    .slice(0, limit)
    .map(({ order: _order, ...item }) => item);
}

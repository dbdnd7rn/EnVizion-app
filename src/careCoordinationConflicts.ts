import type { CareAgendaData } from "./careAgenda";
import type {
  CareShift,
  CaregiverAvailability,
} from "./careSchedule";
import { intervalsOverlap } from "./careScheduleHelpers.ts";

export const coordinationConflictKinds = [
  "shift_overlap",
  "appointment_double_booking",
  "task_without_coverage",
  "follow_up_collision",
  "long_scheduled_day",
  "assigned_unavailable",
] as const;

export type CoordinationConflictKind =
  (typeof coordinationConflictKinds)[number];

export type CoordinationConflictPriority = "time_sensitive" | "review";

export type CoordinationConflict = {
  id: string;
  kind: CoordinationConflictKind;
  priority: CoordinationConflictPriority;
  title: string;
  detail: string;
  startsAt: string;
  relatedIds: string[];
  caregiverId: string | null;
  fixTarget:
    | "CareSchedule"
    | "Appointments"
    | "CareTasks"
    | "CareCommunicationLog";
};

export const coordinationConflictKindLabels: Record<
  CoordinationConflictKind,
  string
> = {
  shift_overlap: "Overlapping shifts",
  appointment_double_booking: "Double-booked appointments",
  task_without_coverage: "Task without coverage",
  follow_up_collision: "Follow-up collision",
  long_scheduled_day: "Long scheduled day",
  assigned_unavailable: "Assigned caregiver unavailable",
};

function ms(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function appointmentIso(
  appointment: CareAgendaData["appointments"][number],
) {
  if (appointment.startsAt) {
    const parsed = new Date(appointment.startsAt);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }

  if (!appointment.appointmentDate || !appointment.appointmentTime) return null;

  const value = new Date(
    `${appointment.appointmentDate}T${appointment.appointmentTime.slice(0, 5)}:00`,
  );
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function localDayKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

function overlapMinutes(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const start = Math.max(ms(startA), ms(startB));
  const end = Math.min(ms(endA), ms(endB));
  if (![start, end].every(Number.isFinite) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

function coverageForTask(
  task: CareAgendaData["tasks"][number],
  shifts: CareShift[],
) {
  const due = ms(task.dueAt);
  if (!Number.isFinite(due)) return null;

  return (
    shifts.find((shift) => {
      if (shift.status !== "scheduled") return false;
      const start = ms(shift.startsAt);
      const end = ms(shift.endsAt);
      if (!(start <= due && end >= due)) return false;
      return !task.assignedTo || shift.caregiverId === task.assignedTo;
    }) ?? null
  );
}

export function detectCoordinationConflicts(input: {
  agenda: CareAgendaData;
  shifts: CareShift[];
  availability: CaregiverAvailability[];
  rangeStart: string;
  rangeEnd: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const rangeStart = ms(input.rangeStart);
  const rangeEnd = ms(input.rangeEnd);
  const conflicts: CoordinationConflict[] = [];
  const activeShifts = input.shifts.filter(
    (shift) =>
      shift.status === "scheduled" &&
      ms(shift.endsAt) >= rangeStart &&
      ms(shift.startsAt) < rangeEnd,
  );

  // Same caregiver assigned to two overlapping shifts.
  for (let i = 0; i < activeShifts.length; i += 1) {
    for (let j = i + 1; j < activeShifts.length; j += 1) {
      const a = activeShifts[i];
      const b = activeShifts[j];
      if (
        a.caregiverId !== b.caregiverId ||
        !intervalsOverlap(a.startsAt, a.endsAt, b.startsAt, b.endsAt)
      ) {
        continue;
      }

      const minutes = overlapMinutes(
        a.startsAt,
        a.endsAt,
        b.startsAt,
        b.endsAt,
      );

      conflicts.push({
        id: `shift_overlap:${[a.id, b.id].sort().join(":")}:${a.startsAt}:${a.endsAt}:${b.startsAt}:${b.endsAt}`,
        kind: "shift_overlap",
        priority: "time_sensitive",
        title: "One caregiver is scheduled in two overlapping shifts",
        detail: `${a.label} and ${b.label} overlap by ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        startsAt: ms(a.startsAt) <= ms(b.startsAt) ? a.startsAt : b.startsAt,
        relatedIds: [a.id, b.id],
        caregiverId: a.caregiverId,
        fixTarget: "CareSchedule",
      });
    }
  }

  // Same recorded appointment time. We do not infer duration.
  const appointments = input.agenda.appointments
    .map((appointment) => ({
      appointment,
      iso: appointmentIso(appointment),
    }))
    .filter(
      (
        item,
      ): item is {
        appointment: CareAgendaData["appointments"][number];
        iso: string;
      } => Boolean(item.iso),
    )
    .filter(
      (item) => ms(item.iso) >= rangeStart && ms(item.iso) < rangeEnd,
    );

  for (let i = 0; i < appointments.length; i += 1) {
    for (let j = i + 1; j < appointments.length; j += 1) {
      const a = appointments[i];
      const b = appointments[j];
      if (ms(a.iso) !== ms(b.iso)) continue;

      conflicts.push({
        id: `appointment_double_booking:${[
          a.appointment.id,
          b.appointment.id,
        ]
          .sort()
          .join(":")}:${a.iso}`,
        kind: "appointment_double_booking",
        priority: "time_sensitive",
        title: "Two appointments share the same recorded time",
        detail: `${a.appointment.title} and ${b.appointment.title} are both recorded for ${new Date(
          a.iso,
        ).toLocaleString()}.`,
        startsAt: a.iso,
        relatedIds: [a.appointment.id, b.appointment.id],
        caregiverId: null,
        fixTarget: "Appointments",
      });
    }
  }

  // Upcoming task with no scheduled shift covering the due time.
  for (const task of input.agenda.tasks) {
    const due = ms(task.dueAt);
    if (
      task.status !== "open" ||
      !Number.isFinite(due) ||
      due < Math.max(rangeStart, now.getTime()) ||
      due >= rangeEnd ||
      coverageForTask(task, input.shifts)
    ) {
      continue;
    }

    conflicts.push({
      id: `task_without_coverage:${task.id}:${task.dueAt}`,
      kind: "task_without_coverage",
      priority: due <= now.getTime() + 24 * 60 * 60_000 ? "time_sensitive" : "review",
      title: "Care task has no matching scheduled caregiver coverage",
      detail: `${task.title} is due ${new Date(task.dueAt).toLocaleString()}${
        task.assignedTo ? " and requires its assigned caregiver." : "."
      }`,
      startsAt: task.dueAt,
      relatedIds: [task.id],
      caregiverId: task.assignedTo,
      fixTarget: "CareTasks",
    });
  }

  // Assigned task lands inside an explicit unavailable window.
  for (const task of input.agenda.tasks) {
    if (task.status !== "open" || !task.assignedTo) continue;
    const due = ms(task.dueAt);
    if (!Number.isFinite(due) || due < rangeStart || due >= rangeEnd) continue;

    const unavailable = input.availability.find(
      (window) =>
        window.caregiverId === task.assignedTo &&
        window.status === "unavailable" &&
        ms(window.startsAt) <= due &&
        ms(window.endsAt) >= due,
    );

    if (!unavailable) continue;

    conflicts.push({
      id: `assigned_unavailable:${task.id}:${task.dueAt}:${unavailable.id}:${unavailable.startsAt}:${unavailable.endsAt}`,
      kind: "assigned_unavailable",
      priority: due <= now.getTime() + 24 * 60 * 60_000 ? "time_sensitive" : "review",
      title: "A task is due while its assigned caregiver is unavailable",
      detail: `${task.title} falls inside an Unavailable window for the assigned caregiver.`,
      startsAt: task.dueAt,
      relatedIds: [task.id, unavailable.id],
      caregiverId: task.assignedTo,
      fixTarget: "CareSchedule",
    });
  }

  // Follow-up scheduled within 60 minutes of an appointment.
  for (const followUp of input.agenda.followUps) {
    const followUpTime = ms(followUp.followUpAt);
    if (
      !Number.isFinite(followUpTime) ||
      followUpTime < rangeStart ||
      followUpTime >= rangeEnd
    ) {
      continue;
    }

    for (const item of appointments) {
      const delta = Math.abs(followUpTime - ms(item.iso));
      if (delta > 60 * 60_000) continue;

      conflicts.push({
        id: `follow_up_collision:${followUp.id}:${followUp.followUpAt}:${item.appointment.id}:${item.iso}`,
        kind: "follow_up_collision",
        priority: "review",
        title: "A follow-up sits close to an appointment",
        detail: `${followUp.summary} is within 60 minutes of ${item.appointment.title}. Check whether one needs to move.`,
        startsAt:
          followUpTime <= ms(item.iso) ? followUp.followUpAt : item.iso,
        relatedIds: [followUp.id, item.appointment.id],
        caregiverId: null,
        fixTarget: "CareCommunicationLog",
      });
    }
  }

  // Planning threshold: more than 12 scheduled hours in one local day.
  const byCaregiverDay = new Map<string, CareShift[]>();
  for (const shift of activeShifts) {
    const key = `${shift.caregiverId}:${localDayKey(shift.startsAt)}`;
    const rows = byCaregiverDay.get(key) ?? [];
    rows.push(shift);
    byCaregiverDay.set(key, rows);
  }

  for (const [key, shifts] of byCaregiverDay) {
    const [caregiverId] = key.split(":");
    const dayStart = new Date(shifts[0].startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const scheduledMinutes = shifts.reduce(
      (total, shift) =>
        total +
        overlapMinutes(
          shift.startsAt,
          shift.endsAt,
          dayStart.toISOString(),
          dayEnd.toISOString(),
        ),
      0,
    );

    if (scheduledMinutes <= 12 * 60) continue;

    conflicts.push({
      id: `long_scheduled_day:${key}`,
      kind: "long_scheduled_day",
      priority: "review",
      title: "Caregiver has a long scheduled day",
      detail: `EnVizion counts ${Math.floor(scheduledMinutes / 60)}h ${scheduledMinutes % 60}m of scheduled care on ${dayStart.toLocaleDateString()}. The planning flag is set above 12 hours.`,
      startsAt: dayStart.toISOString(),
      relatedIds: shifts.map((shift) => shift.id),
      caregiverId,
      fixTarget: "CareSchedule",
    });
  }

  return conflicts.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === "time_sensitive" ? -1 : 1;
    }
    return ms(a.startsAt) - ms(b.startsAt);
  });
}

export function coordinationConflictCounts(conflicts: CoordinationConflict[]) {
  return {
    total: conflicts.length,
    timeSensitive: conflicts.filter(
      (conflict) => conflict.priority === "time_sensitive",
    ).length,
    review: conflicts.filter((conflict) => conflict.priority === "review").length,
  };
}

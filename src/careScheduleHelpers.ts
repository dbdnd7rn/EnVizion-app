import type { CareTask } from "./careTasks";
import type {
  CareShift,
  CaregiverAvailability,
} from "./careSchedule";

export type AvailabilityFit = "covered" | "preferred" | "conflict" | "unspecified";

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  const as = time(aStart);
  const ae = time(aEnd);
  const bs = time(bStart);
  const be = time(bEnd);
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

export function shiftAvailabilityFit(
  shift: Pick<CareShift, "caregiverId" | "startsAt" | "endsAt">,
  availability: CaregiverAvailability[],
): AvailabilityFit {
  const caregiverWindows = availability.filter(
    (item) =>
      item.caregiverId === shift.caregiverId &&
      intervalsOverlap(
        shift.startsAt,
        shift.endsAt,
        item.startsAt,
        item.endsAt,
      ),
  );

  if (caregiverWindows.some((item) => item.status === "unavailable")) {
    return "conflict";
  }

  const fullyCovering = caregiverWindows.filter(
    (item) =>
      time(item.startsAt) <= time(shift.startsAt) &&
      time(item.endsAt) >= time(shift.endsAt),
  );

  if (fullyCovering.some((item) => item.status === "preferred")) {
    return "preferred";
  }

  if (fullyCovering.some((item) => item.status === "available")) {
    return "covered";
  }

  return "unspecified";
}

export function coveringShiftForTask(
  task: Pick<CareTask, "dueAt" | "assignedTo">,
  shifts: CareShift[],
) {
  const due = time(task.dueAt);
  if (!Number.isFinite(due)) return null;

  return (
    shifts.find((shift) => {
      if (shift.status !== "scheduled") return false;
      const starts = time(shift.startsAt);
      const ends = time(shift.endsAt);
      if (!(starts <= due && ends >= due)) return false;
      return !task.assignedTo || shift.caregiverId === task.assignedTo;
    }) ?? null
  );
}

export function uncoveredUpcomingTasks(
  tasks: CareTask[],
  shifts: CareShift[],
  now = new Date(),
  horizonDays = 7,
) {
  const horizon = now.getTime() + horizonDays * 24 * 60 * 60_000;

  return tasks
    .filter((task) => {
      if (task.status !== "open") return false;
      const due = time(task.dueAt);
      return (
        Number.isFinite(due) &&
        due >= now.getTime() &&
        due <= horizon &&
        !coveringShiftForTask(task, shifts)
      );
    })
    .sort((a, b) => time(a.dueAt) - time(b.dueAt));
}

export function activeCaregiversOnDuty(
  shifts: CareShift[],
  now = new Date(),
) {
  const current = now.getTime();
  return shifts.filter(
    (shift) =>
      shift.status === "scheduled" &&
      time(shift.startsAt) <= current &&
      time(shift.endsAt) >= current,
  );
}

export function upcomingScheduledShifts(
  shifts: CareShift[],
  now = new Date(),
  horizonDays = 7,
) {
  const horizon = now.getTime() + horizonDays * 24 * 60 * 60_000;
  return shifts
    .filter((shift) => {
      const starts = time(shift.startsAt);
      return (
        shift.status === "scheduled" &&
        Number.isFinite(starts) &&
        starts <= horizon &&
        time(shift.endsAt) >= now.getTime()
      );
    })
    .sort((a, b) => time(a.startsAt) - time(b.startsAt));
}

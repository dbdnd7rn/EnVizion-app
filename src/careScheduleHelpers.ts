import type { CareTask } from "./careTasks";
import type {
  CareShift,
  CaregiverAvailability,
  CaregiverAvailabilityRule,
} from "./careSchedule";

export type AvailabilityFit = "covered" | "preferred" | "conflict" | "unspecified";

type ZonedLocalParts = {
  date: string;
  serialDay: number;
  isoWeekday: number;
  minuteOfDay: number;
};

function parseClockMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return NaN;
  }
  return hours * 60 + minutes;
}

function zonedLocalParts(value: string, timezone: string): ZonedLocalParts | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const values = new Map(parts.map((part) => [part.type, part.value]));
    const year = Number(values.get("year"));
    const month = Number(values.get("month"));
    const day = Number(values.get("day"));
    const hour = Number(values.get("hour"));
    const minute = Number(values.get("minute"));

    if (
      ![year, month, day, hour, minute].every(Number.isFinite)
    ) {
      return null;
    }

    const serialDay = Math.floor(
      Date.UTC(year, month - 1, day) / 86_400_000,
    );
    const weekdayRaw = new Date(serialDay * 86_400_000).getUTCDay();
    const isoWeekday = weekdayRaw === 0 ? 7 : weekdayRaw;

    return {
      date: `${String(year).padStart(4, "0")}-${String(month).padStart(
        2,
        "0",
      )}-${String(day).padStart(2, "0")}`,
      serialDay,
      isoWeekday,
      minuteOfDay: hour * 60 + minute,
    };
  } catch {
    return null;
  }
}

function isoWeekdayFromSerialDay(serialDay: number) {
  const day = new Date(serialDay * 86_400_000).getUTCDay();
  return day === 0 ? 7 : day;
}

function dateStringFromSerialDay(serialDay: number) {
  return new Date(serialDay * 86_400_000).toISOString().slice(0, 10);
}

export function recurringAvailabilityRuleRelation(
  rule: CaregiverAvailabilityRule,
  startsAt: string,
  endsAt: string,
): "covers" | "overlaps" | null {
  const start = zonedLocalParts(startsAt, rule.timezone);
  const end = zonedLocalParts(endsAt, rule.timezone);
  const ruleStart = parseClockMinutes(rule.startLocalTime);
  const ruleEnd = parseClockMinutes(rule.endLocalTime);

  if (
    !start ||
    !end ||
    !Number.isFinite(ruleStart) ||
    !Number.isFinite(ruleEnd)
  ) {
    return null;
  }

  const requestStart = start.serialDay * 1440 + start.minuteOfDay;
  const requestEnd = end.serialDay * 1440 + end.minuteOfDay;

  for (const serialDay of [start.serialDay, start.serialDay - 1]) {
    const isoWeekday = isoWeekdayFromSerialDay(serialDay);
    if (!rule.daysOfWeek.includes(isoWeekday)) continue;

    const occurrenceDate = dateStringFromSerialDay(serialDay);
    if (occurrenceDate < rule.effectiveFrom) continue;
    if (rule.effectiveUntil && occurrenceDate > rule.effectiveUntil) continue;

    const occurrenceStart = serialDay * 1440 + ruleStart;
    const overnight = ruleEnd < ruleStart;
    const occurrenceEnd =
      serialDay * 1440 + ruleEnd + (overnight ? 1440 : 0);

    if (occurrenceStart <= requestStart && occurrenceEnd >= requestEnd) {
      return "covers";
    }

    if (occurrenceStart < requestEnd && requestStart < occurrenceEnd) {
      return "overlaps";
    }
  }

  return null;
}

export function recurringAvailabilityFit(
  caregiverId: string,
  startsAt: string,
  endsAt: string,
  rules: CaregiverAvailabilityRule[],
): AvailabilityFit {
  const rows = rules.filter((rule) => rule.caregiverId === caregiverId);

  if (
    rows.some(
      (rule) =>
        rule.status === "unavailable" &&
        recurringAvailabilityRuleRelation(rule, startsAt, endsAt) !== null,
    )
  ) {
    return "conflict";
  }

  if (
    rows.some(
      (rule) =>
        rule.status === "preferred" &&
        recurringAvailabilityRuleRelation(rule, startsAt, endsAt) === "covers",
    )
  ) {
    return "preferred";
  }

  if (
    rows.some(
      (rule) =>
        rule.status === "available" &&
        recurringAvailabilityRuleRelation(rule, startsAt, endsAt) === "covers",
    )
  ) {
    return "covered";
  }

  return "unspecified";
}

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
  recurringRules: CaregiverAvailabilityRule[] = [],
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

  const recurringFit = recurringAvailabilityFit(
    shift.caregiverId,
    shift.startsAt,
    shift.endsAt,
    recurringRules,
  );

  if (
    caregiverWindows.some((item) => item.status === "unavailable") ||
    recurringFit === "conflict"
  ) {
    return "conflict";
  }

  const fullyCovering = caregiverWindows.filter(
    (item) =>
      time(item.startsAt) <= time(shift.startsAt) &&
      time(item.endsAt) >= time(shift.endsAt),
  );

  if (
    fullyCovering.some((item) => item.status === "preferred") ||
    recurringFit === "preferred"
  ) {
    return "preferred";
  }

  if (
    fullyCovering.some((item) => item.status === "available") ||
    recurringFit === "covered"
  ) {
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

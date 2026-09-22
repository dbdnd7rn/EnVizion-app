import type { CareReminder } from "./reminderHelpers";
import type { Medication } from "./medications";
import type { CareAgendaData } from "./careAgenda";

export const agendaCategories = [
  "appointment",
  "task",
  "shift",
  "reminder",
  "medication",
  "follow_up",
  "handoff",
] as const;

export type AgendaCategory = (typeof agendaCategories)[number];
export type AgendaView = "day" | "week";

export type AgendaEvent = {
  id: string;
  sourceId: string;
  category: AgendaCategory;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  completed: boolean;
  cancelled: boolean;
  sourceLabel: string;
};

export const agendaCategoryLabels: Record<AgendaCategory, string> = {
  appointment: "Appointments",
  task: "Tasks",
  shift: "Caregiver shifts",
  reminder: "Reminders",
  medication: "Medication list times",
  follow_up: "Follow-ups",
  handoff: "Handoffs",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}

export function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function agendaRange(
  view: AgendaView,
  anchor = new Date(),
  offset = 0,
) {
  const start = startOfLocalDay(anchor);

  if (view === "day") {
    start.setDate(start.getDate() + offset);
  } else {
    const mondayDistance = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayDistance + offset * 7);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + (view === "day" ? 1 : 7));

  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label:
      view === "day"
        ? start.toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })
        : `${start.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })} – ${new Date(end.getTime() - 1).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`,
  };
}

function inRange(value: string, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function appointmentTimestamp(
  appointment: CareAgendaData["appointments"][number],
) {
  if (appointment.startsAt) {
    const value = new Date(appointment.startsAt);
    if (Number.isFinite(value.getTime())) {
      return { iso: value.toISOString(), allDay: false };
    }
  }

  if (!appointment.appointmentDate) return null;

  const time = appointment.appointmentTime?.slice(0, 5) || "12:00";
  const value = new Date(`${appointment.appointmentDate}T${time}:00`);
  if (!Number.isFinite(value.getTime())) return null;

  return {
    iso: value.toISOString(),
    allDay: !appointment.appointmentTime,
  };
}

function reminderOccurrences(
  reminder: CareReminder,
  start: Date,
  end: Date,
): string[] {
  if (reminder.completedAt || reminder.dismissedAt) return [];

  const first = new Date(reminder.snoozedUntil ?? reminder.scheduledFor);
  if (!Number.isFinite(first.getTime())) return [];

  if (reminder.recurrence === "none") {
    return inRange(first.toISOString(), start, end)
      ? [first.toISOString()]
      : [];
  }

  const stepDays = reminder.recurrence === "daily" ? 1 : 7;
  const cursor = new Date(first);
  let guard = 0;

  while (cursor < start && guard < 800) {
    cursor.setDate(cursor.getDate() + stepDays);
    guard += 1;
  }

  const rows: string[] = [];
  while (cursor < end && rows.length < 31) {
    rows.push(cursor.toISOString());
    cursor.setDate(cursor.getDate() + stepDays);
  }

  return rows;
}

export function parseMedicationTime(value: string) {
  const text = value.trim();
  const match24 = /(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s|$)/.exec(text);
  if (match24) {
    return {
      hour: Number(match24[1]),
      minute: Number(match24[2]),
    };
  }

  const match12 = /(?:^|\s)(1[0-2]|0?\d)(?::([0-5]\d))?\s*(am|pm)(?:\s|$)/i.exec(
    text,
  );
  if (!match12) return null;

  let hour = Number(match12[1]) % 12;
  if (match12[3].toLowerCase() === "pm") hour += 12;

  return {
    hour,
    minute: Number(match12[2] ?? 0),
  };
}

function medicationEvents(
  medications: Medication[],
  start: Date,
  end: Date,
): AgendaEvent[] {
  const rows: AgendaEvent[] = [];

  for (
    let day = new Date(start), dayIndex = 0;
    day < end && dayIndex < 8;
    day.setDate(day.getDate() + 1), dayIndex += 1
  ) {
    for (const medication of medications) {
      const parsed = parseMedicationTime(medication.time);
      if (!parsed) continue;

      const eventDate = new Date(day);
      eventDate.setHours(parsed.hour, parsed.minute, 0, 0);

      if (eventDate < start || eventDate >= end) continue;

      rows.push({
        id: `medication:${medication.id}:${localDayKey(eventDate)}`,
        sourceId: medication.id,
        category: "medication",
        title: medication.name,
        subtitle: medication.time
          ? `Medication list time: ${medication.time}`
          : "Medication list time",
        startsAt: eventDate.toISOString(),
        endsAt: null,
        allDay: false,
        completed: false,
        cancelled: false,
        sourceLabel: "Medication list",
      });
    }
  }

  return rows;
}

export function buildAgendaEvents(input: {
  data: CareAgendaData;
  reminders: CareReminder[];
  medications: Medication[];
  rangeStart: Date;
  rangeEnd: Date;
  caregiverName?: (userId: string | null) => string;
}) {
  const caregiverName =
    input.caregiverName ?? ((userId: string | null) => (userId ? "Caregiver" : "Care team"));
  const rows: AgendaEvent[] = [];

  for (const appointment of input.data.appointments) {
    const stamp = appointmentTimestamp(appointment);
    if (!stamp || !inRange(stamp.iso, input.rangeStart, input.rangeEnd)) continue;

    rows.push({
      id: `appointment:${appointment.id}`,
      sourceId: appointment.id,
      category: "appointment",
      title: appointment.title,
      subtitle: [appointment.location, appointment.notes].filter(Boolean).join(" · "),
      startsAt: stamp.iso,
      endsAt: null,
      allDay: stamp.allDay,
      completed: false,
      cancelled: false,
      sourceLabel: "Appointment",
    });
  }

  for (const task of input.data.tasks) {
    if (!inRange(task.dueAt, input.rangeStart, input.rangeEnd)) continue;

    rows.push({
      id: `task:${task.id}`,
      sourceId: task.id,
      category: "task",
      title: task.title,
      subtitle: [
        task.assignedTo ? caregiverName(task.assignedTo) : "Shared responsibility",
        task.priority ? `${task.priority} priority` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      startsAt: task.dueAt,
      endsAt: null,
      allDay: false,
      completed: task.status === "completed",
      cancelled: task.status === "cancelled",
      sourceLabel: "Care task",
    });
  }

  for (const shift of input.data.shifts) {
    if (!inRange(shift.startsAt, input.rangeStart, input.rangeEnd)) continue;

    rows.push({
      id: `shift:${shift.id}`,
      sourceId: shift.id,
      category: "shift",
      title: shift.label,
      subtitle: caregiverName(shift.caregiverId),
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      allDay: false,
      completed: shift.status === "completed",
      cancelled: shift.status === "cancelled",
      sourceLabel: "Caregiver shift",
    });
  }

  for (const handoff of input.data.handoffs) {
    if (!inRange(handoff.createdAt, input.rangeStart, input.rangeEnd)) continue;

    rows.push({
      id: `handoff:${handoff.id}`,
      sourceId: handoff.id,
      category: "handoff",
      title: handoff.shiftLabel,
      subtitle: handoff.handoffTo
        ? `Handed to ${caregiverName(handoff.handoffTo)}`
        : "Shared caregiver handoff",
      startsAt: handoff.createdAt,
      endsAt: null,
      allDay: false,
      completed: true,
      cancelled: false,
      sourceLabel: "Handoff",
    });
  }

  for (const followUp of input.data.followUps) {
    if (!inRange(followUp.followUpAt, input.rangeStart, input.rangeEnd)) continue;

    rows.push({
      id: `follow_up:${followUp.id}`,
      sourceId: followUp.id,
      category: "follow_up",
      title: followUp.summary,
      subtitle: [
        followUp.organizationName,
        followUp.personSpokenTo,
        followUp.priority ? `${followUp.priority} priority` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      startsAt: followUp.followUpAt,
      endsAt: null,
      allDay: false,
      completed: false,
      cancelled: false,
      sourceLabel: "Communication follow-up",
    });
  }

  for (const reminder of input.reminders) {
    for (const occurrence of reminderOccurrences(
      reminder,
      input.rangeStart,
      input.rangeEnd,
    )) {
      rows.push({
        id: `reminder:${reminder.id}:${occurrence}`,
        sourceId: reminder.id,
        category: "reminder",
        title: reminder.title,
        subtitle: reminder.note,
        startsAt: occurrence,
        endsAt: null,
        allDay: false,
        completed: false,
        cancelled: false,
        sourceLabel: "Reminder",
      });
    }
  }

  rows.push(
    ...medicationEvents(input.medications, input.rangeStart, input.rangeEnd),
  );

  return rows.sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
      a.title.localeCompare(b.title),
  );
}

export function visibleAgendaEvents(
  events: AgendaEvent[],
  categories: AgendaCategory[],
) {
  const allowed = new Set(categories);
  return events.filter(
    (event) =>
      allowed.has(event.category) && !event.cancelled,
  );
}

export function agendaByDay(events: AgendaEvent[]) {
  const rows = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    const key = localDayKey(event.startsAt);
    const current = rows.get(key) ?? [];
    current.push(event);
    rows.set(key, current);
  }
  return rows;
}

export function nextAgendaEvent(
  events: AgendaEvent[],
  now = new Date(),
) {
  return (
    events.find(
      (event) =>
        !event.completed &&
        !event.cancelled &&
        new Date(event.startsAt).getTime() >= now.getTime(),
    ) ?? null
  );
}

export function isAgendaEventPast(event: AgendaEvent, now = new Date()) {
  return new Date(event.endsAt ?? event.startsAt).getTime() < now.getTime();
}

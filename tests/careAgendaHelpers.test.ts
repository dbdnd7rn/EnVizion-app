import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agendaByDay,
  agendaRange,
  buildAgendaEvents,
  nextAgendaEvent,
  parseMedicationTime,
  visibleAgendaEvents,
} from "../src/careAgendaHelpers.ts";

test("agendaRange supports day and Monday-to-Sunday week views", () => {
  const now = new Date("2026-09-22T12:00:00Z");
  const day = agendaRange("day", now, 0);
  assert.equal((day.end.getTime() - day.start.getTime()) / 86_400_000, 1);

  const week = agendaRange("week", now, 0);
  assert.equal(week.start.getDay(), 1);
  assert.equal((week.end.getTime() - week.start.getTime()) / 86_400_000, 7);
});

test("medication time parser accepts common 24-hour and am/pm labels", () => {
  assert.deepEqual(parseMedicationTime("08:30"), { hour: 8, minute: 30 });
  assert.deepEqual(parseMedicationTime("8:30 pm"), { hour: 20, minute: 30 });
  assert.equal(parseMedicationTime("with breakfast"), null);
});

test("agenda builder expands daily reminders and medication list times", () => {
  const rangeStart = new Date("2026-09-21T00:00:00Z");
  const rangeEnd = new Date("2026-09-23T00:00:00Z");

  const events = buildAgendaEvents({
    data: {
      appointments: [],
      tasks: [],
      shifts: [],
      handoffs: [],
      followUps: [],
    },
    reminders: [
      {
        id: "r1",
        careRecipientId: "c1",
        createdBy: "u1",
        title: "Check supplies",
        note: "",
        reminderType: "general",
        scheduledFor: "2026-09-21T09:00:00Z",
        timezone: "UTC",
        recurrence: "daily",
        notifyScope: "care_team",
        completedAt: null,
        dismissedAt: null,
        snoozedUntil: null,
        createdAt: "2026-09-20T00:00:00Z",
        updatedAt: "2026-09-20T00:00:00Z",
      },
    ],
    medications: [
      {
        id: "m1",
        name: "Example medicine",
        instructions: "Caregiver-entered label text",
        time: "08:00",
      },
    ],
    rangeStart,
    rangeEnd,
  });

  assert.equal(events.filter((item) => item.category === "reminder").length, 2);
  assert.equal(events.filter((item) => item.category === "medication").length, 2);
});

test("agenda builder merges operational care sources in time order", () => {
  const events = buildAgendaEvents({
    data: {
      appointments: [
        {
          id: "a1",
          title: "Clinic review",
          startsAt: "2026-09-22T14:00:00Z",
          appointmentDate: null,
          appointmentTime: null,
          location: "Clinic",
          notes: "",
        },
      ],
      tasks: [
        {
          id: "t1",
          title: "Call insurer",
          details: "",
          dueAt: "2026-09-22T10:00:00Z",
          priority: "normal",
          status: "open",
          assignedTo: null,
        },
      ],
      shifts: [
        {
          id: "s1",
          caregiverId: "u1",
          label: "Morning care",
          startsAt: "2026-09-22T08:00:00Z",
          endsAt: "2026-09-22T12:00:00Z",
          status: "scheduled",
        },
      ],
      handoffs: [],
      followUps: [],
    },
    reminders: [],
    medications: [],
    rangeStart: new Date("2026-09-22T00:00:00Z"),
    rangeEnd: new Date("2026-09-23T00:00:00Z"),
    caregiverName: () => "Alex",
  });

  assert.deepEqual(
    events.map((item) => item.category),
    ["shift", "task", "appointment"],
  );
});

test("agenda filters, day groups, and next-event selector stay deterministic", () => {
  const events = [
    {
      id: "1",
      sourceId: "1",
      category: "task",
      title: "Past",
      subtitle: "",
      startsAt: "2026-09-22T08:00:00Z",
      endsAt: null,
      allDay: false,
      completed: true,
      cancelled: false,
      sourceLabel: "Task",
    },
    {
      id: "2",
      sourceId: "2",
      category: "appointment",
      title: "Next",
      subtitle: "",
      startsAt: "2026-09-22T11:00:00Z",
      endsAt: null,
      allDay: false,
      completed: false,
      cancelled: false,
      sourceLabel: "Appointment",
    },
    {
      id: "3",
      sourceId: "3",
      category: "shift",
      title: "Cancelled",
      subtitle: "",
      startsAt: "2026-09-22T12:00:00Z",
      endsAt: null,
      allDay: false,
      completed: false,
      cancelled: true,
      sourceLabel: "Shift",
    },
  ] as any;

  const visible = visibleAgendaEvents(events, ["task", "appointment", "shift"]);
  assert.equal(visible.length, 2);
  assert.equal(agendaByDay(visible).get("2026-09-22")?.length, 2);
  assert.equal(
    nextAgendaEvent(visible, new Date("2026-09-22T10:00:00Z"))?.title,
    "Next",
  );
});

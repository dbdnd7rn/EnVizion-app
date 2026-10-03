import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCareAgendaIcs,
  calendarExportFilename,
} from "../src/deviceCalendarHelpers.ts";

test("calendar export creates multiple iCal events and excludes medication list times", () => {
  const body = buildCareAgendaIcs({
    careRecipientName: "Mom",
    calendarLabel: "Mom care week",
    events: [
      {
        id: "appointment:a1",
        sourceId: "a1",
        category: "appointment",
        title: "Cardiology review",
        subtitle: "Main clinic",
        startsAt: "2026-10-05T09:00:00.000Z",
        endsAt: null,
        allDay: false,
        completed: false,
        cancelled: false,
        sourceLabel: "Appointment",
      },
      {
        id: "task:t1",
        sourceId: "t1",
        category: "task",
        title: "Collect prescription",
        subtitle: "",
        startsAt: "2026-10-05T11:00:00.000Z",
        endsAt: null,
        allDay: false,
        completed: false,
        cancelled: false,
        sourceLabel: "Care task",
      },
      {
        id: "medication:m1:2026-10-05",
        sourceId: "m1",
        category: "medication",
        title: "Example medicine",
        subtitle: "Medication list time: 08:00",
        startsAt: "2026-10-05T08:00:00.000Z",
        endsAt: null,
        allDay: false,
        completed: false,
        cancelled: false,
        sourceLabel: "Medication list",
      },
    ],
  });

  assert.equal((body.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(body, /SUMMARY:Cardiology review/);
  assert.match(body, /SUMMARY:Collect prescription/);
  assert.doesNotMatch(body, /Example medicine/);
  assert.match(body, /Care profile: Mom/);
});

test("calendar export keeps all-day dates in DATE format", () => {
  const body = buildCareAgendaIcs({
    careRecipientName: "Dad",
    calendarLabel: "Care day",
    events: [
      {
        id: "appointment:a2",
        sourceId: "a2",
        category: "appointment",
        title: "Clinic date",
        subtitle: "",
        startsAt: "2026-10-06T12:00:00.000Z",
        endsAt: null,
        allDay: true,
        completed: false,
        cancelled: false,
        sourceLabel: "Appointment",
      },
    ],
  });

  assert.match(body, /DTSTART;VALUE=DATE:20261006/);
  assert.match(body, /DTEND;VALUE=DATE:20261007/);
});

test("calendar export filename is safe and view-specific", () => {
  assert.equal(
    calendarExportFilename("Mom / Home", "week"),
    "envizion-mom-home-week-agenda.ics",
  );
});

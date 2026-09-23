import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeCaregiversOnDuty,
  coveringShiftForTask,
  intervalsOverlap,
  recurringAvailabilityFit,
  recurringAvailabilityRuleRelation,
  shiftAvailabilityFit,
  uncoveredUpcomingTasks,
} from "../src/careScheduleHelpers.ts";

test("interval overlap handles touching and intersecting windows", () => {
  assert.equal(
    intervalsOverlap(
      "2026-09-22T08:00:00Z",
      "2026-09-22T12:00:00Z",
      "2026-09-22T11:00:00Z",
      "2026-09-22T13:00:00Z",
    ),
    true,
  );
  assert.equal(
    intervalsOverlap(
      "2026-09-22T08:00:00Z",
      "2026-09-22T12:00:00Z",
      "2026-09-22T12:00:00Z",
      "2026-09-22T13:00:00Z",
    ),
    false,
  );
});

test("availability flags unavailable conflicts before preferred coverage", () => {
  const shift = {
    caregiverId: "u1",
    startsAt: "2026-09-22T08:00:00Z",
    endsAt: "2026-09-22T12:00:00Z",
  };

  assert.equal(
    shiftAvailabilityFit(shift as any, [
      {
        caregiverId: "u1",
        startsAt: "2026-09-22T07:00:00Z",
        endsAt: "2026-09-22T13:00:00Z",
        status: "preferred",
      },
      {
        caregiverId: "u1",
        startsAt: "2026-09-22T10:00:00Z",
        endsAt: "2026-09-22T11:00:00Z",
        status: "unavailable",
      },
    ] as any),
    "conflict",
  );
});

test("task coverage respects assigned caregiver", () => {
  const shifts = [
    {
      id: "s1",
      caregiverId: "u2",
      startsAt: "2026-09-22T08:00:00Z",
      endsAt: "2026-09-22T16:00:00Z",
      status: "scheduled",
    },
    {
      id: "s2",
      caregiverId: "u1",
      startsAt: "2026-09-22T12:00:00Z",
      endsAt: "2026-09-22T18:00:00Z",
      status: "scheduled",
    },
  ] as any;

  assert.equal(
    coveringShiftForTask(
      { dueAt: "2026-09-22T10:00:00Z", assignedTo: "u1" } as any,
      shifts,
    ),
    null,
  );
  assert.equal(
    coveringShiftForTask(
      { dueAt: "2026-09-22T14:00:00Z", assignedTo: "u1" } as any,
      shifts,
    )?.id,
    "s2",
  );
});

test("uncovered upcoming tasks only includes open tasks without coverage", () => {
  const now = new Date("2026-09-22T08:00:00Z");
  const tasks = [
    { id: "covered", status: "open", dueAt: "2026-09-22T10:00:00Z", assignedTo: null },
    { id: "gap", status: "open", dueAt: "2026-09-22T20:00:00Z", assignedTo: null },
    { id: "done", status: "completed", dueAt: "2026-09-22T20:00:00Z", assignedTo: null },
  ] as any;
  const shifts = [
    {
      id: "s1",
      caregiverId: "u1",
      startsAt: "2026-09-22T08:00:00Z",
      endsAt: "2026-09-22T12:00:00Z",
      status: "scheduled",
    },
  ] as any;

  assert.deepEqual(
    uncoveredUpcomingTasks(tasks, shifts, now).map((task) => task.id),
    ["gap"],
  );
});

test("on-duty list only returns active overlapping scheduled shifts", () => {
  const now = new Date("2026-09-22T10:00:00Z");
  const shifts = [
    { id: "on", startsAt: "2026-09-22T08:00:00Z", endsAt: "2026-09-22T12:00:00Z", status: "scheduled" },
    { id: "later", startsAt: "2026-09-22T13:00:00Z", endsAt: "2026-09-22T18:00:00Z", status: "scheduled" },
    { id: "cancelled", startsAt: "2026-09-22T08:00:00Z", endsAt: "2026-09-22T12:00:00Z", status: "cancelled" },
  ] as any;

  assert.deepEqual(activeCaregiversOnDuty(shifts, now).map((shift) => shift.id), ["on"]);
});


function recurringRule(overrides: Record<string, unknown> = {}) {
  return {
    id: "rule-1",
    careRecipientId: "care-1",
    caregiverId: "u1",
    createdBy: "u1",
    daysOfWeek: [1, 2, 3, 4, 5],
    startLocalTime: "18:00",
    endLocalTime: "22:00",
    timezone: "Africa/Blantyre",
    status: "available",
    effectiveFrom: "2026-09-01",
    effectiveUntil: null,
    note: "",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...overrides,
  } as any;
}

test("recurring weekday availability matches the caregiver local timezone", () => {
  const rule = recurringRule({
    daysOfWeek: [3],
    status: "preferred",
  });

  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-23T16:30:00Z",
      "2026-09-23T19:30:00Z",
      [rule],
    ),
    "preferred",
  );

  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-24T16:30:00Z",
      "2026-09-24T19:30:00Z",
      [rule],
    ),
    "unspecified",
  );
});

test("recurring weekend rules stay separate from weekdays", () => {
  const rule = recurringRule({
    daysOfWeek: [6, 7],
    startLocalTime: "08:00",
    endLocalTime: "18:00",
    status: "available",
  });

  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-26T07:00:00Z",
      "2026-09-26T12:00:00Z",
      [rule],
    ),
    "covered",
  );
  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-25T07:00:00Z",
      "2026-09-25T12:00:00Z",
      [rule],
    ),
    "unspecified",
  );
});

test("overnight recurring availability carries into the following local day", () => {
  const rule = recurringRule({
    daysOfWeek: [3],
    startLocalTime: "22:00",
    endLocalTime: "06:00",
    status: "available",
  });

  assert.equal(
    recurringAvailabilityRuleRelation(
      rule,
      "2026-09-23T21:00:00Z",
      "2026-09-24T03:00:00Z",
    ),
    "covers",
  );
  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-23T21:00:00Z",
      "2026-09-24T03:00:00Z",
      [rule],
    ),
    "covered",
  );
});

test("America New York recurring rules follow local clock time", () => {
  const rule = recurringRule({
    daysOfWeek: [1],
    startLocalTime: "18:00",
    endLocalTime: "22:00",
    timezone: "America/New_York",
    status: "preferred",
  });

  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-11-02T23:30:00Z",
      "2026-11-03T02:30:00Z",
      [rule],
    ),
    "preferred",
  );
});

test("recurring unavailable overrides recurring preferred coverage", () => {
  const preferred = recurringRule({
    id: "preferred",
    daysOfWeek: [3],
    status: "preferred",
  });
  const unavailable = recurringRule({
    id: "unavailable",
    daysOfWeek: [3],
    startLocalTime: "19:00",
    endLocalTime: "20:00",
    status: "unavailable",
  });

  assert.equal(
    recurringAvailabilityFit(
      "u1",
      "2026-09-23T16:30:00Z",
      "2026-09-23T19:30:00Z",
      [preferred, unavailable],
    ),
    "conflict",
  );
});

test("one-time unavailable exception overrides a weekly preferred rule", () => {
  const shift = {
    caregiverId: "u1",
    startsAt: "2026-09-23T16:30:00Z",
    endsAt: "2026-09-23T19:30:00Z",
  };
  const preferred = recurringRule({
    daysOfWeek: [3],
    status: "preferred",
  });

  assert.equal(
    shiftAvailabilityFit(
      shift as any,
      [
        {
          caregiverId: "u1",
          startsAt: "2026-09-23T17:00:00Z",
          endsAt: "2026-09-23T18:00:00Z",
          status: "unavailable",
        },
      ] as any,
      [preferred],
    ),
    "conflict",
  );
});

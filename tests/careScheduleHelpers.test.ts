import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeCaregiversOnDuty,
  coveringShiftForTask,
  intervalsOverlap,
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

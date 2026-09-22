import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actualCoverageNow,
  attendanceDurationMinutes,
  shiftAttendanceState,
} from "../src/shiftAttendanceHelpers.ts";

const now = new Date("2026-09-22T10:30:00Z");

test("attendance state marks missed check-in after 15 minutes", () => {
  const shift = {
    startsAt: "2026-09-22T10:00:00Z",
    endsAt: "2026-09-22T14:00:00Z",
    status: "scheduled",
  } as any;

  assert.equal(shiftAttendanceState(shift, null, now), "late_no_checkin");
});

test("active late attendance stays distinct from on-time attendance", () => {
  const shift = {
    startsAt: "2026-09-22T10:00:00Z",
    endsAt: "2026-09-22T14:00:00Z",
    status: "scheduled",
  } as any;

  assert.equal(
    shiftAttendanceState(
      shift,
      {
        checkedInAt: "2026-09-22T10:12:00Z",
        checkedOutAt: null,
        status: "active",
        lateMinutes: 12,
      } as any,
      now,
    ),
    "active_late",
  );
});

test("actual coverage compares scheduled shifts with active check-ins", () => {
  const shifts = [
    {
      id: "s1",
      startsAt: "2026-09-22T10:00:00Z",
      endsAt: "2026-09-22T14:00:00Z",
      status: "scheduled",
    },
    {
      id: "s2",
      startsAt: "2026-09-22T10:00:00Z",
      endsAt: "2026-09-22T12:00:00Z",
      status: "scheduled",
    },
  ] as any;

  const result = actualCoverageNow(
    shifts,
    [
      {
        shiftId: "s1",
        status: "active",
        checkedOutAt: null,
      },
    ] as any,
    now,
  );

  assert.deepEqual(result.scheduledNow.map((item) => item.id), ["s1", "s2"]);
  assert.deepEqual(result.checkedInNow.map((item) => item.id), ["s1"]);
  assert.deepEqual(result.missingCheckIn.map((item) => item.id), ["s2"]);
});

test("attendance duration uses checkout when complete", () => {
  assert.equal(
    attendanceDurationMinutes(
      {
        checkedInAt: "2026-09-22T08:00:00Z",
        checkedOutAt: "2026-09-22T10:30:00Z",
      } as any,
      now,
    ),
    150,
  );
});

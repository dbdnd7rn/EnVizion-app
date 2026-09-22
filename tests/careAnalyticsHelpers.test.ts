import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCaregiverAnalytics,
  clippedMinutes,
  formatHours,
  missedCheckInShiftIds,
  scheduledSharePercent,
  weekPeriod,
  weeklyAnalyticsSummary,
} from "../src/careAnalyticsHelpers.ts";

test("weekPeriod starts on Monday and spans seven days", () => {
  const period = weekPeriod(0, new Date("2026-09-22T12:00:00Z"));
  assert.equal(period.start.getDay(), 1);
  assert.equal(
    (period.end.getTime() - period.start.getTime()) / 86_400_000,
    7,
  );
});

test("clippedMinutes only counts time inside the reporting window", () => {
  assert.equal(
    clippedMinutes(
      "2026-09-21T23:00:00Z",
      "2026-09-22T02:00:00Z",
      "2026-09-22T00:00:00Z",
      "2026-09-23T00:00:00Z",
      new Date("2026-09-23T00:00:00Z"),
    ),
    120,
  );
});

test("missed check-in requires a started non-cancelled shift with no attendance", () => {
  const ids = missedCheckInShiftIds(
    [
      {
        id: "missed",
        caregiverId: "u1",
        startsAt: "2026-09-22T08:00:00Z",
        endsAt: "2026-09-22T12:00:00Z",
        status: "scheduled",
      },
      {
        id: "cancelled",
        caregiverId: "u1",
        startsAt: "2026-09-22T08:00:00Z",
        endsAt: "2026-09-22T12:00:00Z",
        status: "cancelled",
      },
    ] as any,
    [],
    "2026-09-22T00:00:00Z",
    "2026-09-23T00:00:00Z",
    new Date("2026-09-22T09:00:00Z"),
  );
  assert.deepEqual(ids, ["missed"]);
});

test("caregiver analytics combines shifts attendance completions and gap events", () => {
  const rows = buildCaregiverAnalytics(
    {
      tasks: [],
      shifts: [
        {
          id: "s1",
          caregiverId: "u1",
          startsAt: "2026-09-22T08:00:00Z",
          endsAt: "2026-09-22T12:00:00Z",
          status: "completed",
        },
      ],
      attendance: [
        {
          id: "a1",
          shiftId: "s1",
          caregiverId: "u1",
          checkedInAt: "2026-09-22T08:15:00Z",
          checkedOutAt: "2026-09-22T11:45:00Z",
          status: "completed",
          lateMinutes: 15,
        },
      ],
      completions: [
        {
          id: "c1",
          taskId: "t1",
          completedBy: "u1",
          completedAt: "2026-09-22T10:00:00Z",
        },
      ],
      coverageEvents: [
        {
          id: "g1",
          taskId: "t2",
          taskDueAt: "2026-09-22T13:00:00Z",
          assignedTo: "u1",
          detectedAt: "2026-09-22T09:00:00Z",
        },
      ],
    },
    ["u1"],
    "2026-09-22T00:00:00Z",
    "2026-09-23T00:00:00Z",
    new Date("2026-09-23T00:00:00Z"),
  );

  assert.equal(rows[0].scheduledMinutes, 240);
  assert.equal(rows[0].actualMinutes, 210);
  assert.equal(rows[0].completedTasks, 1);
  assert.equal(rows[0].lateCheckIns, 1);
  assert.equal(rows[0].lateMinutes, 15);
  assert.equal(rows[0].coverageGapEvents, 1);
});

test("weekly summary and workload share stay arithmetic, not subjective scores", () => {
  const rows = [
    {
      caregiverId: "u1",
      scheduledMinutes: 360,
      actualMinutes: 330,
      completedTasks: 3,
      lateCheckIns: 1,
      lateMinutes: 10,
      missedCheckIns: 0,
      coverageGapEvents: 1,
    },
    {
      caregiverId: "u2",
      scheduledMinutes: 120,
      actualMinutes: 120,
      completedTasks: 1,
      lateCheckIns: 0,
      lateMinutes: 0,
      missedCheckIns: 0,
      coverageGapEvents: 0,
    },
  ];

  assert.equal(scheduledSharePercent(rows[0], rows), 75);
  assert.equal(formatHours(330), "5h 30m");

  const summary = weeklyAnalyticsSummary(rows, {
    tasks: [],
    shifts: [],
    attendance: [],
    completions: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] as any,
    coverageEvents: [{ id: "g" }] as any,
  });

  assert.equal(summary.scheduledMinutes, 480);
  assert.equal(summary.actualMinutes, 450);
  assert.equal(summary.completedTasks, 4);
  assert.equal(summary.coverageGapEvents, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sameLocalDay,
  shiftBoardCounts,
  shiftTaskBucket,
} from "../src/shiftBoardHelpers.ts";

const now = new Date("2026-09-22T12:00:00.000Z");

test("shift buckets separate overdue, due-soon, today, and future work", () => {
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: "2026-09-22T11:30:00.000Z" }, now),
    "overdue",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: "2026-09-22T12:45:00.000Z" }, now),
    "due_soon",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: "2026-09-22T18:00:00.000Z" }, now),
    "later_today",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: "2026-09-23T08:00:00.000Z" }, now),
    "future",
  );
});

test("shift board counts responsibility and completion activity", () => {
  const counts = shiftBoardCounts(
    [
      { status: "open", dueAt: "2026-09-22T11:00:00.000Z", assignedTo: "u1" },
      { status: "open", dueAt: "2026-09-22T12:30:00.000Z", assignedTo: "u1" },
      { status: "open", dueAt: "2026-09-22T18:00:00.000Z", assignedTo: "u2" },
      { status: "completed", dueAt: "2026-09-22T08:00:00.000Z", assignedTo: "u1" },
    ] as any,
    [
      { completedAt: "2026-09-22T09:00:00.000Z" },
      { completedAt: "2026-09-21T20:00:00.000Z" },
    ] as any,
    "u1",
    now,
  );

  assert.deepEqual(counts, {
    open: 3,
    overdue: 1,
    dueSoon: 1,
    dueToday: 2,
    mine: 2,
    completedToday: 1,
  });
});

test("sameLocalDay only matches the local calendar date", () => {
  assert.equal(sameLocalDay("2026-09-22T18:00:00.000Z", now), true);
  assert.equal(sameLocalDay("2026-09-23T00:00:00.000Z", now), false);
});

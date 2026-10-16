import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sameLocalDay,
  shiftBoardCounts,
  shiftTaskBucket,
} from "../src/shiftBoardHelpers.ts";

// These helpers compare local calendar days, so fixtures must use local times.
const localTimestamp = (date: string, time: string) =>
  new Date(`${date}T${time}`).toISOString();

const now = new Date(localTimestamp("2026-09-22", "12:00:00"));

test("shift buckets separate overdue, due-soon, today, and future work", () => {
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: localTimestamp("2026-09-22", "11:30:00") }, now),
    "overdue",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: localTimestamp("2026-09-22", "12:45:00") }, now),
    "due_soon",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: localTimestamp("2026-09-22", "18:00:00") }, now),
    "later_today",
  );
  assert.equal(
    shiftTaskBucket({ status: "open", dueAt: localTimestamp("2026-09-23", "08:00:00") }, now),
    "future",
  );
});

test("shift board counts responsibility and completion activity", () => {
  const counts = shiftBoardCounts(
    [
      { status: "open", dueAt: localTimestamp("2026-09-22", "11:00:00"), assignedTo: "u1" },
      { status: "open", dueAt: localTimestamp("2026-09-22", "12:30:00"), assignedTo: "u1" },
      { status: "open", dueAt: localTimestamp("2026-09-22", "18:00:00"), assignedTo: "u2" },
      { status: "completed", dueAt: localTimestamp("2026-09-22", "08:00:00"), assignedTo: "u1" },
    ] as any,
    [
      { completedAt: localTimestamp("2026-09-22", "09:00:00") },
      { completedAt: localTimestamp("2026-09-21", "20:00:00") },
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
  assert.equal(sameLocalDay(localTimestamp("2026-09-22", "18:00:00"), now), true);
  assert.equal(sameLocalDay(localTimestamp("2026-09-23", "00:00:00"), now), false);
});

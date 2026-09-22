import { test } from "node:test";
import assert from "node:assert/strict";
import {
  onShiftCompletions,
  onShiftDurationLabel,
  onShiftElapsedMinutes,
  onShiftResponsibilities,
} from "../src/onShiftHelpers.ts";

test("on-shift responsibilities separate mine from shared work", () => {
  const result = onShiftResponsibilities(
    [
      {
        id: "mine",
        status: "open",
        assignedTo: "caregiver-1",
        dueAt: "2099-01-01T12:00:00.000Z",
      },
      {
        id: "shared",
        status: "open",
        assignedTo: null,
        dueAt: "2099-01-01T13:00:00.000Z",
      },
      {
        id: "other",
        status: "open",
        assignedTo: "caregiver-2",
        dueAt: "2099-01-01T14:00:00.000Z",
      },
      {
        id: "done",
        status: "completed",
        assignedTo: "caregiver-1",
        dueAt: "2099-01-01T10:00:00.000Z",
      },
    ] as any,
    "caregiver-1",
  );

  assert.deepEqual(result.mine.map((task) => task.id), ["mine"]);
  assert.deepEqual(result.shared.map((task) => task.id), ["shared"]);
});

test("on-shift urgent work only includes overdue or due-soon mine/shared tasks", () => {
  const realNow = Date.now;
  Date.now = () => new Date("2026-09-22T12:00:00.000Z").getTime();

  try {
    const result = onShiftResponsibilities(
      [
        {
          id: "mine-overdue",
          status: "open",
          assignedTo: "caregiver-1",
          dueAt: "2026-09-22T11:00:00.000Z",
        },
        {
          id: "shared-soon",
          status: "open",
          assignedTo: null,
          dueAt: "2026-09-22T12:30:00.000Z",
        },
        {
          id: "other-overdue",
          status: "open",
          assignedTo: "caregiver-2",
          dueAt: "2026-09-22T11:30:00.000Z",
        },
      ] as any,
      "caregiver-1",
    );

    assert.deepEqual(
      result.urgent.map((task) => task.id),
      ["mine-overdue", "shared-soon"],
    );
  } finally {
    Date.now = realNow;
  }
});

test("on-shift completion history starts at takeover time", () => {
  const result = onShiftCompletions(
    [
      {
        id: "before",
        completedAt: "2026-09-22T09:59:59.000Z",
      },
      {
        id: "after",
        completedAt: "2026-09-22T10:00:01.000Z",
      },
    ] as any,
    {
      startedAt: "2026-09-22T10:00:00.000Z",
    },
  );

  assert.deepEqual(result.map((item) => item.id), ["after"]);
});

test("on-shift duration uses the active clock and formats caregiver-friendly time", () => {
  const minutes = onShiftElapsedMinutes(
    {
      startedAt: "2026-09-22T10:00:00.000Z",
      endedAt: null,
    },
    new Date("2026-09-22T12:35:00.000Z"),
  );

  assert.equal(minutes, 155);
  assert.equal(onShiftDurationLabel(minutes), "2h 35m");
  assert.equal(onShiftDurationLabel(45), "45 min");
});

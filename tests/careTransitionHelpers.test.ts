import test from "node:test";
import assert from "node:assert/strict";
import {
  transitionFollowUpCounts,
  transitionFollowUpTiming,
} from "../src/careTransitionHelpers.ts";

const base = {
  id: "f1",
  planId: "p1",
  careRecipientId: "c1",
  title: "Primary care follow-up",
  provider: "",
  details: "",
  completedBy: null,
  completedAt: null,
  createdAt: "2026-09-24T00:00:00Z",
  updatedAt: "2026-09-24T00:00:00Z",
};

test("transition follow-up counts separate open and completed work", () => {
  const rows = [
    {
      ...base,
      dueAt: "2026-09-25T10:00:00Z",
      status: "open" as const,
    },
    {
      ...base,
      id: "f2",
      dueAt: null,
      status: "completed" as const,
    },
  ];

  assert.deepEqual(transitionFollowUpCounts(rows), {
    total: 2,
    open: 1,
    completed: 1,
  });
});

test("transition follow-up timing flags overdue and due-soon work", () => {
  const now = new Date("2026-09-24T10:00:00Z");
  assert.equal(
    transitionFollowUpTiming(
      { status: "open", dueAt: "2026-09-24T09:00:00Z" },
      now,
    ),
    "overdue",
  );
  assert.equal(
    transitionFollowUpTiming(
      { status: "open", dueAt: "2026-09-25T10:00:00Z" },
      now,
    ),
    "soon",
  );
});

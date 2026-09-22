import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coordinationHandlingLabel,
  currentActionableConflicts,
  currentResolvedConflicts,
  currentSnoozedConflicts,
  effectiveCoordinationStatus,
} from "../src/careCoordinationWorkflowHelpers.ts";

const conflict = {
  id: "task_without_coverage:t1:2026-09-22T16:00:00Z",
  kind: "task_without_coverage",
  priority: "time_sensitive",
  title: "Care task has no matching scheduled caregiver coverage",
  detail: "Example",
  startsAt: "2026-09-22T16:00:00Z",
  relatedIds: ["t1"],
  caregiverId: "u1",
  fixTarget: "CareTasks",
} as any;

function resolution(status: "open" | "snoozed" | "resolved", snoozedUntil: string | null = null) {
  return {
    id: "r1",
    careRecipientId: "c1",
    conflictKey: conflict.id,
    conflictKind: conflict.kind,
    conflictTitle: conflict.title,
    conflictStartsAt: conflict.startsAt,
    status,
    assignedTo: null,
    snoozedUntil,
    resolvedAt: status === "resolved" ? "2026-09-22T12:00:00Z" : null,
    resolvedBy: status === "resolved" ? "u1" : null,
    createdBy: "u1",
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-09-22T12:00:00Z",
  } as any;
}

test("expired snooze becomes actionable without rewriting history", () => {
  const row = resolution("snoozed", "2026-09-22T11:00:00Z");
  assert.equal(
    effectiveCoordinationStatus(row, new Date("2026-09-22T12:00:00Z")),
    "open",
  );
});

test("active snooze keeps a current conflict out of the action inbox", () => {
  const row = resolution("snoozed", "2026-09-22T15:00:00Z");
  const now = new Date("2026-09-22T12:00:00Z");
  assert.equal(currentActionableConflicts([conflict], [row], now).length, 0);
  assert.equal(currentSnoozedConflicts([conflict], [row], now).length, 1);
});

test("resolved conflict stays in current resolved workflow", () => {
  const row = resolution("resolved");
  assert.equal(currentResolvedConflicts([conflict], [row]).length, 1);
  assert.equal(
    currentActionableConflicts(
      [conflict],
      [row],
      new Date("2026-09-22T12:00:00Z"),
    ).length,
    0,
  );
});

test("assignment label exposes who is handling the issue", () => {
  const row = { ...resolution("open"), assignedTo: "u2" };
  assert.equal(
    coordinationHandlingLabel(row, (id) => (id === "u2" ? "Alex" : "Caregiver")),
    "Handling: Alex",
  );
  assert.equal(coordinationHandlingLabel(null, () => "Caregiver"), "Unassigned");
});

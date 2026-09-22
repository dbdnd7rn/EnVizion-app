import { test } from "node:test";
import assert from "node:assert/strict";
import {
  latestTaskAssignments,
  pendingAssignmentForUser,
  taskAssignmentLabel,
  type CareTaskAssignment,
} from "../src/careTaskAssignmentHelpers.ts";

function assignment(
  overrides: Partial<CareTaskAssignment> = {},
): CareTaskAssignment {
  return {
    id: "assignment-1",
    taskId: "task-1",
    careRecipientId: "care-1",
    assignedTo: "user-1",
    assignedBy: "user-2",
    status: "pending",
    responseNote: "",
    respondedAt: null,
    supersededAt: null,
    createdAt: "2026-09-22T10:00:00.000Z",
    ...overrides,
  };
}

test("latest assignment wins without rewriting older history", () => {
  const latest = latestTaskAssignments([
    assignment({
      id: "old",
      status: "superseded",
      createdAt: "2026-09-22T09:00:00.000Z",
    }),
    assignment({
      id: "new",
      assignedTo: "user-3",
      status: "pending",
      createdAt: "2026-09-22T11:00:00.000Z",
    }),
  ]);

  assert.equal(latest.get("task-1")?.id, "new");
  assert.equal(latest.get("task-1")?.assignedTo, "user-3");
});

test("tasks assigned before acknowledgement rollout stay visibly legacy", () => {
  assert.equal(taskAssignmentLabel(undefined, "user-1"), "Legacy assignment");
  assert.equal(taskAssignmentLabel(undefined, null), "Shared / unassigned");
});

test("assignment labels expose pending and accepted state", () => {
  assert.equal(
    taskAssignmentLabel(assignment({ status: "pending" }), "user-1"),
    "Awaiting acknowledgement",
  );
  assert.equal(
    taskAssignmentLabel(assignment({ status: "accepted" }), "user-1"),
    "Accepted",
  );
});

test("only the pending assignee gets the response controls", () => {
  const pending = assignment();

  assert.equal(pendingAssignmentForUser(pending, "user-1"), true);
  assert.equal(pendingAssignmentForUser(pending, "user-2"), false);
  assert.equal(
    pendingAssignmentForUser(
      assignment({ status: "accepted" }),
      "user-1",
    ),
    false,
  );
});

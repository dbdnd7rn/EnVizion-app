import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canAcceptHandoff,
  latestAcceptableHandoff,
  takeoverResponsibilities,
} from "../src/shiftTakeoverHelpers.ts";

function handoff(overrides: Record<string, unknown> = {}) {
  return {
    id: "handoff-1",
    careRecipientId: "care-1",
    createdBy: "outgoing",
    handoffTo: "incoming",
    shiftLabel: "Evening handoff",
    note: "",
    openTaskSnapshot: [],
    completedTaskSnapshot: [],
    briefingVersion: 2,
    requiresAcknowledgement: true,
    briefingWindowStart: "2026-09-22T08:00:00.000Z",
    medicationActivitySnapshot: [],
    communicationSnapshot: [],
    coordinationSnapshot: [],
    nextAppointmentSnapshot: null,
    followUpSnapshot: [],
    createdAt: "2026-09-22T12:00:00.000Z",
    ...overrides,
  } as any;
}

test("direct handoff can only be accepted by the intended incoming caregiver", () => {
  const value = handoff();

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "incoming",
      readOnly: false,
    }),
    true,
  );

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "someone-else",
      readOnly: false,
    }),
    false,
  );
});

test("historical handoffs do not suddenly require takeover acknowledgement", () => {
  const value = handoff({ requiresAcknowledgement: false });

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "incoming",
      readOnly: false,
    }),
    false,
  );
});

test("outgoing caregiver, viewers, and already accepted handoffs cannot accept takeover", () => {
  const value = handoff({ handoffTo: null });

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "outgoing",
      readOnly: false,
    }),
    false,
  );

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "incoming",
      readOnly: true,
    }),
    false,
  );

  assert.equal(
    canAcceptHandoff({
      handoff: value,
      currentUserId: "incoming",
      readOnly: false,
      acknowledgement: {
        id: "ack-1",
        handoffId: value.id,
      } as any,
    }),
    false,
  );
});

test("latest acceptable handoff skips one that already has an acknowledgement", () => {
  const newest = handoff({
    id: "newest",
    handoffTo: null,
    createdAt: "2026-09-22T12:00:00.000Z",
  });
  const older = handoff({
    id: "older",
    handoffTo: null,
    createdAt: "2026-09-22T10:00:00.000Z",
  });

  const result = latestAcceptableHandoff({
    handoffs: [newest, older],
    acknowledgements: [
      {
        id: "ack-newest",
        handoffId: newest.id,
      } as any,
    ],
    currentUserId: "incoming",
    readOnly: false,
  });

  assert.equal(result?.id, "older");
});

test("takeover responsibilities keep assigned, shared, and other-caregiver work separate", () => {
  const tasks = [
    { id: "mine", status: "open", assignedTo: "incoming" },
    { id: "shared", status: "open", assignedTo: null },
    { id: "other", status: "open", assignedTo: "someone-else" },
    { id: "done", status: "completed", assignedTo: "incoming" },
  ] as any;

  const result = takeoverResponsibilities(tasks, "incoming");

  assert.deepEqual(result.mine.map((task) => task.id), ["mine"]);
  assert.deepEqual(result.shared.map((task) => task.id), ["shared"]);
  assert.deepEqual(
    result.assignedElsewhere.map((task) => task.id),
    ["other"],
  );
});

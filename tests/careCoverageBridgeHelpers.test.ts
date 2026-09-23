import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCareCoverageBridge,
  coverageBridgeStateLabel,
  coverageMinutesLabel,
} from "../src/careCoverageBridgeHelpers.ts";

const now = new Date("2026-09-23T09:00:00.000Z");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    careRecipientId: "care-1",
    caregiverId: "caregiver-a",
    sourceHandoffId: "handoff-in",
    sourceAcknowledgementId: "ack-in",
    startedAt: "2026-09-23T08:00:00.000Z",
    endedAt: null,
    endNote: "",
    outgoingHandoffId: null,
    createdAt: "2026-09-23T08:00:00.000Z",
    updatedAt: "2026-09-23T08:00:00.000Z",
    ...overrides,
  } as any;
}

function attendance(overrides: Record<string, unknown> = {}) {
  return {
    id: "attendance-1",
    careRecipientId: "care-1",
    shiftId: "shift-current",
    caregiverId: "caregiver-a",
    checkedInAt: "2026-09-23T08:00:00.000Z",
    checkedOutAt: null,
    checkInNote: "",
    checkOutNote: "",
    status: "active",
    lateMinutes: 0,
    automaticHandoffId: null,
    createdAt: "2026-09-23T08:00:00.000Z",
    updatedAt: "2026-09-23T08:00:00.000Z",
    ...overrides,
  } as any;
}

function shift(
  id: string,
  caregiverId: string,
  startsAt: string,
  endsAt: string,
) {
  return {
    id,
    careRecipientId: "care-1",
    caregiverId,
    createdBy: "owner-1",
    label: id === "shift-current" ? "Morning care" : "Next caregiver",
    startsAt,
    endsAt,
    status: "scheduled",
    note: "",
    completedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-22T09:00:00.000Z",
    updatedAt: "2026-09-22T09:00:00.000Z",
  } as any;
}

function handoff(
  id: string,
  handoffTo: string | null,
  createdAt = "2026-09-23T08:30:00.000Z",
) {
  return {
    id,
    careRecipientId: "care-1",
    createdBy: "caregiver-a",
    handoffTo,
    shiftLabel: "Morning to midday handoff",
    note: "",
    openTaskSnapshot: [],
    completedTaskSnapshot: [],
    briefingVersion: 2,
    requiresAcknowledgement: true,
    briefingWindowStart: "2026-09-23T08:00:00.000Z",
    medicationActivitySnapshot: [],
    communicationSnapshot: [],
    coordinationSnapshot: [],
    nextAppointmentSnapshot: null,
    followUpSnapshot: [],
    createdAt,
  } as any;
}

test("coverage bridge identifies a seamless next caregiver transition", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-b",
        "2026-09-23T12:03:00.000Z",
        "2026-09-23T16:00:00.000Z",
      ),
    ],
    handoffs: [handoff("handoff-1", "caregiver-b")],
    acknowledgements: [],
    now,
  });

  assert.equal(result.state, "seamless_transition");
  assert.equal(result.currentCaregiverId, "caregiver-a");
  assert.equal(result.nextShift?.caregiverId, "caregiver-b");
  assert.equal(result.handoffMatchesNextCaregiver, true);
  assert.equal(result.gapMinutes, 0);
});

test("coverage bridge measures a future coverage gap", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-b",
        "2026-09-23T13:15:00.000Z",
        "2026-09-23T17:00:00.000Z",
      ),
    ],
    handoffs: [],
    acknowledgements: [],
    now,
  });

  assert.equal(result.state, "gap_ahead");
  assert.equal(result.gapMinutes, 75);
  assert.equal(coverageMinutesLabel(result.gapMinutes), "1h 15m");
});

test("coverage bridge measures planned overlap without calling it a gap", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-b",
        "2026-09-23T11:30:00.000Z",
        "2026-09-23T15:00:00.000Z",
      ),
    ],
    handoffs: [],
    acknowledgements: [],
    now,
  });

  assert.equal(result.state, "overlap_ahead");
  assert.equal(result.overlapMinutes, 30);
  assert.equal(result.gapMinutes, 0);
});

test("scheduled time without takeover or check-in remains uncovered now", () => {
  const result = buildCareCoverageBridge({
    sessions: [],
    attendance: [],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T10:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-b",
        "2026-09-23T11:00:00.000Z",
        "2026-09-23T15:00:00.000Z",
      ),
    ],
    handoffs: [],
    acknowledgements: [],
    now,
  });

  assert.equal(result.state, "uncovered_now");
  assert.equal(result.currentCoverageSource, "scheduled");
  assert.equal(result.gapMinutes, 120);
  assert.equal(
    coverageBridgeStateLabel(result.state),
    "No confirmed coverage right now",
  );
});

test("active care with no future scheduled shift is explicit", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
    ],
    handoffs: [],
    acknowledgements: [],
    now,
  });

  assert.equal(result.state, "no_next_shift");
  assert.equal(result.nextShift, null);
});

test("coverage bridge flags when handoff target and next scheduled caregiver differ", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-c",
        "2026-09-23T12:00:00.000Z",
        "2026-09-23T16:00:00.000Z",
      ),
    ],
    handoffs: [handoff("handoff-1", "caregiver-b")],
    acknowledgements: [],
    now,
  });

  assert.equal(result.pendingHandoff?.id, "handoff-1");
  assert.equal(result.handoffMatchesNextCaregiver, false);
});

test("acknowledged handoffs are not treated as pending bridge work", () => {
  const result = buildCareCoverageBridge({
    sessions: [session()],
    attendance: [attendance()],
    shifts: [
      shift(
        "shift-current",
        "caregiver-a",
        "2026-09-23T08:00:00.000Z",
        "2026-09-23T12:00:00.000Z",
      ),
      shift(
        "shift-next",
        "caregiver-b",
        "2026-09-23T12:00:00.000Z",
        "2026-09-23T16:00:00.000Z",
      ),
    ],
    handoffs: [handoff("handoff-1", "caregiver-b")],
    acknowledgements: [
      {
        id: "ack-1",
        careRecipientId: "care-1",
        handoffId: "handoff-1",
        acceptedBy: "caregiver-b",
        note: "",
        acceptedAt: "2026-09-23T08:45:00.000Z",
        createdAt: "2026-09-23T08:45:00.000Z",
      } as any,
    ],
    now,
  });

  assert.equal(result.pendingHandoff, null);
  assert.equal(result.handoffMatchesNextCaregiver, null);
});

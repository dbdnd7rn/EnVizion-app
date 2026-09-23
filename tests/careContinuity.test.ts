import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCareContinuityTimeline,
  continuityEventCounts,
} from "../src/careContinuityHelpers.ts";

test("continuity timeline merges durable shift events newest first", () => {
  const events = buildCareContinuityTimeline({
    sessions: [
      {
        id: "session-1",
        careRecipientId: "care-1",
        caregiverId: "user-a",
        sourceHandoffId: "handoff-0",
        sourceAcknowledgementId: "ack-0",
        startedAt: "2026-09-23T08:00:00.000Z",
        endedAt: "2026-09-23T10:00:00.000Z",
        endNote: "Morning shift complete.",
        outgoingHandoffId: "handoff-1",
        createdAt: "2026-09-23T08:00:00.000Z",
        updatedAt: "2026-09-23T10:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "note-1",
        careRecipientId: "care-1",
        sessionId: "session-1",
        createdBy: "user-a",
        body: "Called pharmacy about refill.",
        createdAt: "2026-09-23T09:00:00.000Z",
      },
    ],
    handoffs: [
      {
        id: "handoff-1",
        careRecipientId: "care-1",
        createdBy: "user-a",
        handoffTo: "user-b",
        shiftLabel: "Morning to afternoon",
        note: "Refill follow-up remains open.",
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
        createdAt: "2026-09-23T10:00:00.000Z",
      },
    ],
    acknowledgements: [
      {
        id: "ack-1",
        careRecipientId: "care-1",
        handoffId: "handoff-1",
        acceptedBy: "user-b",
        note: "Taking over now.",
        acceptedAt: "2026-09-23T10:05:00.000Z",
        createdAt: "2026-09-23T10:05:00.000Z",
      },
    ],
    attendance: [
      {
        id: "attendance-1",
        careRecipientId: "care-1",
        shiftId: "shift-1",
        caregiverId: "user-a",
        checkedInAt: "2026-09-23T07:55:00.000Z",
        checkedOutAt: "2026-09-23T10:02:00.000Z",
        checkInNote: "",
        checkOutNote: "Left after handoff.",
        status: "completed",
        lateMinutes: 0,
        automaticHandoffId: null,
        createdAt: "2026-09-23T07:55:00.000Z",
        updatedAt: "2026-09-23T10:02:00.000Z",
      },
    ],
  });

  assert.equal(events[0].kind, "handoff_acknowledged");
  assert.equal(events[1].kind, "attendance_checkout");
  assert.equal(events[events.length - 1].kind, "attendance_checkin");
  assert.ok(events.some((event) => event.kind === "shift_note"));
  assert.ok(events.some((event) => event.kind === "handoff_created"));
});

test("continuity counts group handoffs, shift changes, and notes", () => {
  const events = buildCareContinuityTimeline({
    sessions: [
      {
        id: "session-1",
        careRecipientId: "care-1",
        caregiverId: "user-a",
        sourceHandoffId: "handoff-0",
        sourceAcknowledgementId: "ack-0",
        startedAt: "2026-09-23T08:00:00.000Z",
        endedAt: null,
        endNote: "",
        outgoingHandoffId: null,
        createdAt: "2026-09-23T08:00:00.000Z",
        updatedAt: "2026-09-23T08:00:00.000Z",
      },
    ],
    notes: [
      {
        id: "note-1",
        careRecipientId: "care-1",
        sessionId: "session-1",
        createdBy: "user-a",
        body: "Shift note",
        createdAt: "2026-09-23T08:10:00.000Z",
      },
    ],
    handoffs: [],
    acknowledgements: [],
    attendance: [],
  });

  const counts = continuityEventCounts(events);
  assert.equal(counts.total, 2);
  assert.equal(counts.shiftChanges, 1);
  assert.equal(counts.notes, 1);
  assert.equal(counts.handoffs, 0);
});

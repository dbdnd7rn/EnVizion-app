import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOnShiftActivityTimeline,
  onShiftActivityCounts,
} from "../src/onShiftActivityHelpers.ts";

const session = {
  id: "session-1",
  startedAt: "2026-09-22T08:00:00.000Z",
};

test("on-shift timeline keeps only events from the active shift", () => {
  const items = buildOnShiftActivityTimeline({
    session,
    notes: [
      {
        id: "note-1",
        careRecipientId: "care-1",
        sessionId: "session-1",
        createdBy: "user-1",
        body: "Family updated.",
        createdAt: "2026-09-22T09:00:00.000Z",
      },
      {
        id: "note-old",
        careRecipientId: "care-1",
        sessionId: "session-1",
        createdBy: "user-1",
        body: "Old note.",
        createdAt: "2026-09-22T07:59:00.000Z",
      },
    ],
    taskCompletions: [
      {
        id: "completion-1",
        taskId: "task-1",
        careRecipientId: "care-1",
        completedBy: "user-1",
        completedAt: "2026-09-22T08:30:00.000Z",
        note: "Done.",
        createdAt: "2026-09-22T08:30:00.000Z",
      },
    ],
    tasks: [
      {
        id: "task-1",
        careRecipientId: "care-1",
        createdBy: "user-1",
        assignedTo: "user-1",
        category: "general",
        title: "Confirm transport",
        details: "",
        dueAt: "2026-09-22T10:00:00.000Z",
        timezone: "Africa/Blantyre",
        recurrence: "none",
        priority: "routine",
        status: "open",
        medicationId: null,
        appointmentId: null,
        contactId: null,
        communicationId: null,
        lastCompletedAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: "2026-09-21T12:00:00.000Z",
        updatedAt: "2026-09-21T12:00:00.000Z",
      },
    ],
    medicationRecords: [],
    communications: [],
  });

  assert.equal(items.some((item) => item.id === "note-note-old"), false);
  assert.equal(items.some((item) => item.title === "Confirm transport"), true);
  assert.equal(items.at(-1)?.type, "shift_start");
});

test("medication corrections appear as a separate activity", () => {
  const items = buildOnShiftActivityTimeline({
    session,
    notes: [],
    taskCompletions: [],
    tasks: [],
    medicationRecords: [
      {
        id: "med-record-1",
        medication: {
          id: "med-1",
          name: "Medication A",
          instructions: "",
          time: "",
        },
        recordedAt: "2026-09-22T08:15:00.000Z",
        correctedAt: "2026-09-22T08:45:00.000Z",
      },
    ],
    communications: [],
  });

  assert.equal(items.filter((item) => item.type === "medication_recorded").length, 1);
  assert.equal(items.filter((item) => item.type === "medication_corrected").length, 1);
  assert.equal(items[0].type, "medication_corrected");
});

test("communication and note activity is ordered newest first", () => {
  const items = buildOnShiftActivityTimeline({
    session,
    notes: [
      {
        id: "note-1",
        careRecipientId: "care-1",
        sessionId: "session-1",
        createdBy: "user-1",
        body: "Shift note",
        createdAt: "2026-09-22T09:15:00.000Z",
      },
    ],
    taskCompletions: [],
    tasks: [],
    medicationRecords: [],
    communications: [
      {
        id: "comm-1",
        careRecipientId: "care-1",
        contactId: null,
        communicationType: "phone_call",
        occurredAt: "2026-09-22T09:30:00.000Z",
        personSpokenTo: "Nurse",
        organizationName: "Clinic",
        summary: "Called clinic",
        outcome: "Awaiting reply",
        followUpNeeded: true,
        followUpAt: "2026-09-22T12:00:00.000Z",
        notes: "",
        priority: "follow_up",
        tag: "",
        createdAt: "2026-09-22T09:30:00.000Z",
        updatedAt: "2026-09-22T09:30:00.000Z",
      },
    ],
  });

  assert.equal(items[0].type, "communication");
  assert.equal(items[1].type, "shift_note");

  const counts = onShiftActivityCounts(items);
  assert.equal(counts.communication, 1);
  assert.equal(counts.shift_note, 1);
  assert.equal(counts.shift_start, 1);
  assert.equal(counts.total, 3);
});

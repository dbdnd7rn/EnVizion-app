import { test } from "node:test";
import assert from "node:assert/strict";
import {
  handoffAppointmentSnapshot,
  handoffBriefingCounts,
  handoffCommunicationActivity,
  handoffFollowUps,
  handoffMedicationActivity,
  handoffWindowStart,
} from "../src/shiftBriefingHelpers.ts";

const now = new Date("2026-09-22T12:00:00.000Z");

test("handoff window starts at the latest previous handoff", () => {
  assert.equal(
    handoffWindowStart(
      [
        { createdAt: "2026-09-22T08:00:00.000Z" },
        { createdAt: "2026-09-22T10:30:00.000Z" },
      ],
      now,
    ),
    "2026-09-22T10:30:00.000Z",
  );
});

test("first handoff falls back to the start of the local day", () => {
  const value = new Date(handoffWindowStart([], now));
  assert.equal(value.getFullYear(), now.getFullYear());
  assert.equal(value.getMonth(), now.getMonth());
  assert.equal(value.getDate(), now.getDate());
  assert.equal(value.getHours(), 0);
  assert.equal(value.getMinutes(), 0);
});

test("medication briefing keeps records changed during the window including corrections", () => {
  const rows = handoffMedicationActivity(
    [
      {
        id: "before-but-corrected",
        medication: {
          id: "med-1",
          name: "Medication A",
          instructions: "As recorded",
          time: "08:00",
        },
        recordedAt: "2026-09-22T08:00:00.000Z",
        correctedAt: "2026-09-22T11:00:00.000Z",
      },
      {
        id: "current",
        medication: {
          id: "med-2",
          name: "Medication B",
          instructions: "As recorded",
          time: "11:30",
        },
        recordedAt: "2026-09-22T11:30:00.000Z",
      },
      {
        id: "old",
        medication: {
          id: "med-3",
          name: "Medication C",
          instructions: "As recorded",
          time: "07:00",
        },
        recordedAt: "2026-09-22T07:00:00.000Z",
      },
    ],
    "2026-09-22T10:00:00.000Z",
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["current", "before-but-corrected"],
  );
  assert.equal(rows[1].correctedAt, "2026-09-22T11:00:00.000Z");
});

test("communication briefing includes only communication recorded since the prior handoff", () => {
  const rows = handoffCommunicationActivity(
    [
      {
        id: "new",
        occurredAt: "2026-09-22T11:00:00.000Z",
        summary: "Spoke with pharmacy",
      },
      {
        id: "old",
        occurredAt: "2026-09-22T08:00:00.000Z",
        summary: "Older call",
      },
    ] as any,
    "2026-09-22T10:00:00.000Z",
  );

  assert.deepEqual(rows.map((row) => row.id), ["new"]);
});

test("handoff follows explicit follow-up flags and preserves the next appointment snapshot", () => {
  const followUps = handoffFollowUps(
    [
      {
        id: "follow",
        followUpNeeded: true,
        followUpAt: "2026-09-22T13:00:00.000Z",
        summary: "Call insurer",
        personSpokenTo: "Case manager",
        organizationName: "Insurer",
        priority: "follow_up",
      },
      {
        id: "none",
        followUpNeeded: false,
        followUpAt: "2026-09-22T13:30:00.000Z",
        summary: "No follow-up",
      },
    ] as any,
    now,
  );

  const appointment = handoffAppointmentSnapshot({
    appointment: {
      id: "a1",
      title: "Cardiology",
      location: "Clinic",
      notes: "Bring papers",
    },
    startsAt: "2026-09-23T09:00:00.000Z",
  });

  const counts = handoffBriefingCounts({
    openTasks: [{ id: "t1" }],
    completedTasks: [],
    medications: [],
    communications: [],
    coordination: [],
    followUps,
    nextAppointment: appointment,
  });

  assert.deepEqual(followUps.map((row) => row.id), ["follow"]);
  assert.equal(appointment?.title, "Cardiology");
  assert.equal(counts.followUps, 1);
  assert.equal(counts.hasNextAppointment, true);
});

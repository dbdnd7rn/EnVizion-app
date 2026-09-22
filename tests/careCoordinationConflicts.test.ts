import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coordinationConflictCounts,
  detectCoordinationConflicts,
} from "../src/careCoordinationConflicts.ts";

const baseAgenda = {
  appointments: [],
  tasks: [],
  shifts: [],
  handoffs: [],
  followUps: [],
};

test("detects overlapping shifts for the same caregiver only", () => {
  const conflicts = detectCoordinationConflicts({
    agenda: baseAgenda,
    shifts: [
      {
        id: "s1",
        caregiverId: "u1",
        startsAt: "2026-09-22T08:00:00Z",
        endsAt: "2026-09-22T12:00:00Z",
        status: "scheduled",
        label: "Morning",
      },
      {
        id: "s2",
        caregiverId: "u1",
        startsAt: "2026-09-22T11:00:00Z",
        endsAt: "2026-09-22T13:00:00Z",
        status: "scheduled",
        label: "Midday",
      },
      {
        id: "s3",
        caregiverId: "u2",
        startsAt: "2026-09-22T11:00:00Z",
        endsAt: "2026-09-22T13:00:00Z",
        status: "scheduled",
        label: "Other caregiver",
      },
    ] as any,
    availability: [],
    rangeStart: "2026-09-22T00:00:00Z",
    rangeEnd: "2026-09-23T00:00:00Z",
    now: new Date("2026-09-22T07:00:00Z"),
  });

  assert.equal(
    conflicts.filter((item) => item.kind === "shift_overlap").length,
    1,
  );
});

test("same appointment timestamp is treated as double-booked", () => {
  const conflicts = detectCoordinationConflicts({
    agenda: {
      ...baseAgenda,
      appointments: [
        {
          id: "a1",
          title: "Cardiology",
          startsAt: "2026-09-22T14:00:00Z",
          appointmentDate: null,
          appointmentTime: null,
          location: "",
          notes: "",
        },
        {
          id: "a2",
          title: "Primary care",
          startsAt: "2026-09-22T14:00:00Z",
          appointmentDate: null,
          appointmentTime: null,
          location: "",
          notes: "",
        },
      ],
    },
    shifts: [],
    availability: [],
    rangeStart: "2026-09-22T00:00:00Z",
    rangeEnd: "2026-09-23T00:00:00Z",
  });

  assert.equal(
    conflicts.some((item) => item.kind === "appointment_double_booking"),
    true,
  );
});

test("uncovered assigned task and unavailable assignment are both visible", () => {
  const conflicts = detectCoordinationConflicts({
    agenda: {
      ...baseAgenda,
      tasks: [
        {
          id: "t1",
          title: "Call pharmacy",
          details: "",
          dueAt: "2026-09-22T16:00:00Z",
          priority: "high",
          status: "open",
          assignedTo: "u1",
        },
      ],
    },
    shifts: [],
    availability: [
      {
        id: "v1",
        caregiverId: "u1",
        startsAt: "2026-09-22T15:00:00Z",
        endsAt: "2026-09-22T18:00:00Z",
        status: "unavailable",
      },
    ] as any,
    rangeStart: "2026-09-22T00:00:00Z",
    rangeEnd: "2026-09-23T00:00:00Z",
    now: new Date("2026-09-22T12:00:00Z"),
  });

  assert.equal(
    conflicts.some((item) => item.kind === "task_without_coverage"),
    true,
  );
  assert.equal(
    conflicts.some((item) => item.kind === "assigned_unavailable"),
    true,
  );
});

test("follow-up within sixty minutes of appointment is a review conflict", () => {
  const conflicts = detectCoordinationConflicts({
    agenda: {
      ...baseAgenda,
      appointments: [
        {
          id: "a1",
          title: "Clinic",
          startsAt: "2026-09-22T14:00:00Z",
          appointmentDate: null,
          appointmentTime: null,
          location: "",
          notes: "",
        },
      ],
      followUps: [
        {
          id: "f1",
          summary: "Insurance follow-up",
          followUpAt: "2026-09-22T14:45:00Z",
          priority: "routine",
          organizationName: "",
          personSpokenTo: "",
        },
      ],
    },
    shifts: [],
    availability: [],
    rangeStart: "2026-09-22T00:00:00Z",
    rangeEnd: "2026-09-23T00:00:00Z",
  });

  const conflict = conflicts.find(
    (item) => item.kind === "follow_up_collision",
  );
  assert.equal(conflict?.priority, "review");
});

test("more than twelve scheduled hours creates a planning flag", () => {
  const conflicts = detectCoordinationConflicts({
    agenda: baseAgenda,
    shifts: [
      {
        id: "s1",
        caregiverId: "u1",
        startsAt: "2026-09-22T06:00:00Z",
        endsAt: "2026-09-22T13:00:00Z",
        status: "scheduled",
        label: "Early",
      },
      {
        id: "s2",
        caregiverId: "u1",
        startsAt: "2026-09-22T13:00:00Z",
        endsAt: "2026-09-22T19:30:00Z",
        status: "scheduled",
        label: "Late",
      },
    ] as any,
    availability: [],
    rangeStart: "2026-09-22T00:00:00Z",
    rangeEnd: "2026-09-23T00:00:00Z",
  });

  assert.equal(
    conflicts.some((item) => item.kind === "long_scheduled_day"),
    true,
  );
  const counts = coordinationConflictCounts(conflicts);
  assert.equal(counts.review >= 1, true);
});

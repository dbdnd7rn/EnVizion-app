import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardAttentionItems,
  dashboardMedicationActivity,
  dashboardRecentCommunications,
  dashboardShiftStatus,
  dashboardTaskBuckets,
  nextDashboardAppointment,
} from "../src/careDashboardHelpers.ts";

const now = new Date("2026-09-22T12:00:00.000Z");

test("dashboard chooses an active caregiver shift before the next shift", () => {
  const result = dashboardShiftStatus(
    [
      {
        id: "s2",
        status: "scheduled",
        startsAt: "2026-09-22T18:00:00.000Z",
        endsAt: "2026-09-22T22:00:00.000Z",
      },
      {
        id: "s1",
        status: "scheduled",
        startsAt: "2026-09-22T08:00:00.000Z",
        endsAt: "2026-09-22T14:00:00.000Z",
      },
    ] as any,
    now,
  );

  assert.equal(result.active?.id, "s1");
  assert.equal(result.next?.id, "s2");
});

test("dashboard finds the next future appointment across recorded visit formats", () => {
  const result = nextDashboardAppointment(
    [
      {
        id: "a1",
        title: "Past visit",
        startsAt: "2026-09-22T10:00:00.000Z",
      },
      {
        id: "a3",
        title: "Later visit",
        startsAt: "2026-09-24T08:00:00.000Z",
      },
      {
        id: "a2",
        title: "Tomorrow visit",
        startsAt: "2026-09-23T09:00:00.000Z",
      },
    ] as any,
    now,
  );

  assert.equal(result?.appointment.id, "a2");
});

test("dashboard separates overdue, due-soon, and due-today care tasks", () => {
  const result = dashboardTaskBuckets(
    [
      {
        id: "overdue",
        status: "open",
        dueAt: "2026-09-22T11:00:00.000Z",
      },
      {
        id: "soon",
        status: "open",
        dueAt: "2026-09-22T13:00:00.000Z",
      },
      {
        id: "later",
        status: "open",
        dueAt: "2026-09-22T19:00:00.000Z",
      },
      {
        id: "done",
        status: "completed",
        dueAt: "2026-09-22T11:00:00.000Z",
      },
    ] as any,
    now,
  );

  assert.deepEqual(result.overdue.map((task) => task.id), ["overdue"]);
  assert.deepEqual(result.dueSoon.map((task) => task.id), ["soon"]);
  assert.deepEqual(
    result.dueToday.map((task) => task.id),
    ["soon", "later"],
  );
});

test("dashboard attention orders overdue work before coordination and due-soon work", () => {
  const rows = dashboardAttentionItems({
    tasks: [
      {
        id: "overdue",
        title: "Call pharmacy",
        status: "open",
        dueAt: "2026-09-22T11:00:00.000Z",
      },
      {
        id: "soon",
        title: "Prepare transport",
        status: "open",
        dueAt: "2026-09-22T13:00:00.000Z",
      },
    ] as any,
    conflicts: [
      {
        id: "conflict",
        title: "Care task has no coverage",
        detail: "Coverage needs review.",
        priority: "time_sensitive",
        startsAt: "2026-09-22T12:30:00.000Z",
      },
    ] as any,
    communications: [],
    now,
  });

  assert.deepEqual(
    rows.map((row) => row.kind),
    ["overdue_task", "time_sensitive_coordination", "due_soon_task"],
  );
});

test("dashboard medication and communication activity ignores corrected entries and keeps newest updates first", () => {
  const medication = dashboardMedicationActivity(
    [
      {
        id: "m-old",
        medication: { id: "m1", name: "Medication A" },
        recordedAt: "2026-09-22T08:00:00.000Z",
        correctedAt: "2026-09-22T09:00:00.000Z",
      },
      {
        id: "m-new",
        medication: { id: "m1", name: "Medication A" },
        recordedAt: "2026-09-22T10:00:00.000Z",
      },
    ] as any,
    now,
  );

  const communication = dashboardRecentCommunications(
    [
      { id: "c1", occurredAt: "2026-09-21T10:00:00.000Z" },
      { id: "c2", occurredAt: "2026-09-22T09:00:00.000Z" },
    ] as any,
    2,
  );

  assert.equal(medication.todayCount, 1);
  assert.equal(medication.latest?.id, "m-new");
  assert.deepEqual(communication.map((row) => row.id), ["c2", "c1"]);
});

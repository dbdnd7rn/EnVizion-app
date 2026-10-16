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

// These helpers compare local calendar days, so fixtures must use local times.
const localTimestamp = (date: string, time: string) =>
  new Date(`${date}T${time}`).toISOString();

const now = new Date(localTimestamp("2026-09-22", "12:00:00"));

test("dashboard chooses an active caregiver shift before the next shift", () => {
  const result = dashboardShiftStatus(
    [
      {
        id: "s2",
        status: "scheduled",
        startsAt: localTimestamp("2026-09-22", "18:00:00"),
        endsAt: localTimestamp("2026-09-22", "22:00:00"),
      },
      {
        id: "s1",
        status: "scheduled",
        startsAt: localTimestamp("2026-09-22", "08:00:00"),
        endsAt: localTimestamp("2026-09-22", "14:00:00"),
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
        startsAt: localTimestamp("2026-09-22", "10:00:00"),
      },
      {
        id: "a3",
        title: "Later visit",
        startsAt: localTimestamp("2026-09-24", "08:00:00"),
      },
      {
        id: "a2",
        title: "Tomorrow visit",
        startsAt: localTimestamp("2026-09-23", "09:00:00"),
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
        dueAt: localTimestamp("2026-09-22", "11:00:00"),
      },
      {
        id: "soon",
        status: "open",
        dueAt: localTimestamp("2026-09-22", "13:00:00"),
      },
      {
        id: "later",
        status: "open",
        dueAt: localTimestamp("2026-09-22", "19:00:00"),
      },
      {
        id: "done",
        status: "completed",
        dueAt: localTimestamp("2026-09-22", "11:00:00"),
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
        dueAt: localTimestamp("2026-09-22", "11:00:00"),
      },
      {
        id: "soon",
        title: "Prepare transport",
        status: "open",
        dueAt: localTimestamp("2026-09-22", "13:00:00"),
      },
    ] as any,
    conflicts: [
      {
        id: "conflict",
        title: "Care task has no coverage",
        detail: "Coverage needs review.",
        priority: "time_sensitive",
        startsAt: localTimestamp("2026-09-22", "12:30:00"),
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
        recordedAt: localTimestamp("2026-09-22", "08:00:00"),
        correctedAt: localTimestamp("2026-09-22", "09:00:00"),
      },
      {
        id: "m-new",
        medication: { id: "m1", name: "Medication A" },
        recordedAt: localTimestamp("2026-09-22", "10:00:00"),
      },
    ] as any,
    now,
  );

  const communication = dashboardRecentCommunications(
    [
      { id: "c1", occurredAt: localTimestamp("2026-09-21", "10:00:00") },
      { id: "c2", occurredAt: localTimestamp("2026-09-22", "09:00:00") },
    ] as any,
    2,
  );

  assert.equal(medication.todayCount, 1);
  assert.equal(medication.latest?.id, "m-new");
  assert.deepEqual(communication.map((row) => row.id), ["c2", "c1"]);
});

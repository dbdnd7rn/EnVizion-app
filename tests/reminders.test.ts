import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localDateTimeToIso,
  reminderLocalParts,
  reminderStatus,
  type CareReminder,
} from "../src/reminderHelpers.ts";

function reminder(overrides: Partial<CareReminder> = {}): CareReminder {
  return {
    id: "r1",
    careRecipientId: "care-1",
    createdBy: "user-1",
    title: "Care reminder",
    note: "",
    reminderType: "general",
    scheduledFor: "2026-09-21T18:00:00.000Z",
    timezone: "Africa/Blantyre",
    recurrence: "none",
    notifyScope: "creator",
    completedAt: null,
    dismissedAt: null,
    snoozedUntil: null,
    createdAt: "2026-09-20T18:00:00.000Z",
    updatedAt: "2026-09-20T18:00:00.000Z",
    ...overrides,
  };
}

test("local reminder date-time parser rejects impossible dates", () => {
  assert.equal(localDateTimeToIso("2026-02-31", "09:30"), null);
  assert.equal(localDateTimeToIso("2026-09-21", "25:00"), null);
});

test("local reminder date-time parser returns an ISO timestamp", () => {
  const value = localDateTimeToIso("2026-09-21", "20:30");
  assert.ok(value);
  assert.equal(Number.isFinite(new Date(value!).getTime()), true);
});

test("reminder local parts can round-trip a valid timestamp", () => {
  const iso = localDateTimeToIso("2026-09-21", "20:30");
  assert.ok(iso);
  assert.deepEqual(reminderLocalParts(iso!), {
    date: "2026-09-21",
    time: "20:30",
  });
});

test("reminder status prioritizes completed and dismissed state", () => {
  const now = new Date("2026-09-21T20:00:00.000Z");
  assert.equal(
    reminderStatus(reminder({ completedAt: "2026-09-21T19:00:00.000Z" }), now),
    "completed",
  );
  assert.equal(
    reminderStatus(reminder({ dismissedAt: "2026-09-21T19:00:00.000Z" }), now),
    "dismissed",
  );
});

test("reminder status respects a snoozed occurrence without moving the base schedule", () => {
  const now = new Date("2026-09-21T20:00:00.000Z");
  assert.equal(
    reminderStatus(
      reminder({
        scheduledFor: "2026-09-21T19:00:00.000Z",
        snoozedUntil: "2026-09-21T21:00:00.000Z",
      }),
      now,
    ),
    "upcoming",
  );
});

test("reminder status distinguishes due from upcoming", () => {
  const now = new Date("2026-09-21T20:00:00.000Z");
  assert.equal(
    reminderStatus(reminder({ scheduledFor: "2026-09-21T19:00:00.000Z" }), now),
    "due",
  );
  assert.equal(
    reminderStatus(reminder({ scheduledFor: "2026-09-21T21:00:00.000Z" }), now),
    "upcoming",
  );
});

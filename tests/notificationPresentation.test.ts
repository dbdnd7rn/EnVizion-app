import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterNotifications,
  notificationDestination,
  unreadSummary,
} from "../src/notificationPresentation.ts";

test("notification filters keep all rows or only unread rows", () => {
  const rows = [
    { id: "read", readAt: "2026-10-01T12:00:00.000Z" },
    { id: "unread", readAt: null },
  ];

  assert.deepEqual(
    filterNotifications(rows, "all").map((row) => row.id),
    ["read", "unread"],
  );
  assert.deepEqual(
    filterNotifications(rows, "unread").map((row) => row.id),
    ["unread"],
  );
});

test("notification destinations preserve supported account navigation", () => {
  assert.deepEqual(
    notificationDestination({
      audience: "staff",
      kind: "support_reply",
      entityType: "support_request",
      entityId: "req-1",
      readAt: null,
    }),
    {
      route: "StaffSupportThread",
      params: { requestId: "req-1" },
    },
  );

  assert.deepEqual(
    notificationDestination({
      audience: "caregiver",
      kind: "care_task_assignment",
      entityType: "care_task",
      entityId: "task-1",
      readAt: null,
    }),
    { route: "CareTasks" },
  );

  assert.deepEqual(
    notificationDestination({
      audience: "caregiver",
      kind: "handover",
      entityType: "care_advocate_handover",
      entityId: "care-1",
      readAt: null,
    }),
    {
      route: "AdvocateHandover",
      activateCareRecipientId: "care-1",
    },
  );
});

test("unsupported caregiver notifications have no destination", () => {
  assert.equal(
    notificationDestination({
      audience: "caregiver",
      kind: "unknown",
      entityType: "unknown",
      entityId: null,
      readAt: null,
    }),
    null,
  );
});

test("unread summary is concise and pluralized", () => {
  assert.equal(unreadSummary(0), "You're all caught up.");
  assert.equal(unreadSummary(1), "1 unread update");
  assert.equal(unreadSummary(4), "4 unread updates");
});

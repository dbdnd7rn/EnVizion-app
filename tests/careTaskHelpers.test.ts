import { test } from "node:test";
import assert from "node:assert/strict";
import {
  careTaskDisplayStatus,
  careTaskDisplayStatusLabel,
  careTaskSearchText,
} from "../src/careTaskHelpers.ts";

const now = new Date("2026-09-22T12:00:00.000Z");

test("open tasks become overdue after the due time", () => {
  assert.equal(
    careTaskDisplayStatus(
      { status: "open", dueAt: "2026-09-22T11:59:00.000Z" },
      now,
    ),
    "overdue",
  );
});

test("open tasks due later today are marked due today", () => {
  assert.equal(
    careTaskDisplayStatus(
      { status: "open", dueAt: "2026-09-22T18:00:00.000Z" },
      now,
    ),
    "due_today",
  );
});

test("completed and cancelled task states override due time", () => {
  assert.equal(
    careTaskDisplayStatus(
      { status: "completed", dueAt: "2026-09-20T08:00:00.000Z" },
      now,
    ),
    "completed",
  );
  assert.equal(
    careTaskDisplayStatus(
      { status: "cancelled", dueAt: "2026-09-20T08:00:00.000Z" },
      now,
    ),
    "cancelled",
  );
});

test("future open tasks are upcoming", () => {
  assert.equal(
    careTaskDisplayStatus(
      { status: "open", dueAt: "2026-09-23T08:00:00.000Z" },
      now,
    ),
    "upcoming",
  );
});

test("care task search includes category, priority, details, and linked text", () => {
  const searchable = careTaskSearchText(
    {
      title: "Call cardiology",
      details: "Confirm follow-up appointment",
      category: "provider",
      priority: "important",
    },
    "Dr Rivera Heart Center",
  );

  assert.match(searchable, /call cardiology/);
  assert.match(searchable, /provider/);
  assert.match(searchable, /important/);
  assert.match(searchable, /dr rivera heart center/);
});

test("display labels stay caregiver friendly", () => {
  assert.equal(careTaskDisplayStatusLabel("due_today"), "Due today");
  assert.equal(careTaskDisplayStatusLabel("overdue"), "Overdue");
});

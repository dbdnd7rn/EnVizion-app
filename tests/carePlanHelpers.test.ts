import test from "node:test";
import assert from "node:assert/strict";
import {
  carePlanCompletionForItemToday,
  carePlanItemIsForToday,
  carePlanLocalDateKey,
  carePlanTodaySummary,
  carePlanWeekdayIso,
} from "../src/carePlanHelpers.ts";

const item = {
  id: "item-1",
  careRecipientId: "care-1",
  createdBy: "user-1",
  title: "Morning mobility",
  category: "mobility" as const,
  details: "",
  localTime: "08:00",
  timezone: "UTC",
  daysOfWeek: [1, 3, 5],
  priority: "routine" as const,
  assignedTo: null,
  active: true,
  createdAt: "2026-09-20T00:00:00Z",
  updatedAt: "2026-09-20T00:00:00Z",
};

test("care plan local date and weekday respect the item timezone", () => {
  const monday = new Date("2026-09-28T08:00:00.000Z");
  assert.equal(carePlanLocalDateKey(monday, "UTC"), "2026-09-28");
  assert.equal(carePlanWeekdayIso(monday, "UTC"), 1);
  assert.equal(carePlanItemIsForToday(item, monday), true);
});

test("today completion matches item and local date", () => {
  const now = new Date("2026-09-28T08:00:00.000Z");
  const completion = {
    id: "done-1",
    careRecipientId: "care-1",
    itemId: "item-1",
    completedBy: "user-2",
    completedOn: "2026-09-28",
    note: "",
    completedAt: "2026-09-28T08:30:00Z",
  };

  assert.equal(
    carePlanCompletionForItemToday(item, [completion], now)?.id,
    "done-1",
  );
  assert.deepEqual(carePlanTodaySummary([item], [completion], now), {
    total: 1,
    completed: 1,
    remaining: 0,
  });
});

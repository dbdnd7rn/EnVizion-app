import test from "node:test";
import assert from "node:assert/strict";
import {
  addLocalDateDays,
  localMondayDate,
  weeklyCoverageDraftSlots,
  weeklyCoverageNeeds,
  weeklyCoverageResponseCounts,
  weeklyCoverageWindow,
} from "../src/weeklyCoveragePlanHelpers.ts";

function need(overrides: Record<string, unknown> = {}) {
  return {
    id: "need-1",
    source: "coverage_requirement",
    sourceId: "source-1",
    label: "Morning care",
    startsAt: "2026-09-23T06:00:00Z",
    endsAt: "2026-09-23T08:00:00Z",
    note: "",
    taskDueAt: null,
    taskAssignedTo: null,
    taskPriority: null,
    exactWindow: true,
    candidates: [],
    recommendedUserId: "caregiver-1",
    ...overrides,
  } as any;
}

test("weekly coverage uses Monday as the local week boundary", () => {
  assert.equal(
    localMondayDate(new Date("2026-09-23T12:00:00Z")),
    "2026-09-21",
  );
  assert.equal(
    localMondayDate(new Date("2026-09-27T12:00:00Z")),
    "2026-09-21",
  );
  assert.equal(addLocalDateDays("2026-09-21", 7), "2026-09-28");
});

test("weekly coverage window spans one local Monday-to-Monday week", () => {
  const window = weeklyCoverageWindow("2026-09-21");
  assert.equal(window.weekStart, "2026-09-21");
  assert.equal(window.weekEnd, "2026-09-28");
  assert.equal(
    new Date(window.endsAt).getTime() - new Date(window.startsAt).getTime(),
    7 * 24 * 60 * 60_000,
  );
});

test("weekly approval includes exact coverage needs and excludes task-only suggestions", () => {
  const rows = weeklyCoverageNeeds(
    [
      need(),
      need({
        id: "request",
        source: "coverage_request",
        sourceId: "request-1",
        startsAt: "2026-09-27T20:00:00Z",
        endsAt: "2026-09-28T04:00:00Z",
      }),
      need({
        id: "task",
        source: "task",
        sourceId: "task-1",
        exactWindow: false,
      }),
      need({
        id: "next-week",
        startsAt: "2026-09-28T06:00:00Z",
        endsAt: "2026-09-28T08:00:00Z",
      }),
    ],
    "2026-09-21T00:00:00Z",
    "2026-09-28T00:00:00Z",
  );

  assert.deepEqual(
    rows.map((row) => row.id),
    ["need-1", "request"],
  );
});

test("weekly draft keeps an explicit unassigned slot while defaulting untouched slots to recommendations", () => {
  const needs = [
    need(),
    need({
      id: "need-2",
      sourceId: "source-2",
      label: "Evening care",
      startsAt: "2026-09-24T16:00:00Z",
      endsAt: "2026-09-24T18:00:00Z",
      recommendedUserId: "caregiver-2",
    }),
  ];

  const slots = weeklyCoverageDraftSlots(needs, {
    "need-1": null,
  });

  assert.equal(slots[0].caregiverId, null);
  assert.equal(slots[1].caregiverId, "caregiver-2");
  assert.equal(slots[0].sourceType, "coverage_requirement");
});

test("weekly approval response counts keep pending, declined, and open coverage distinct", () => {
  const counts = weeklyCoverageResponseCounts([
    "accepted",
    "accepted",
    "pending",
    "declined",
    "open_coverage",
    "cancelled",
    "proposed",
  ]);

  assert.deepEqual(counts, {
    total: 7,
    accepted: 2,
    pending: 1,
    declined: 1,
    openCoverage: 1,
    proposed: 1,
    cancelled: 1,
  });
});

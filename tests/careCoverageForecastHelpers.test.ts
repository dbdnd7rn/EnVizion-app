import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCoverageForecast,
  coverageForecastCounts,
  coverageForecastRiskLabel,
} from "../src/careCoverageForecastHelpers.ts";

function candidate(
  id: string,
  fit: "preferred" | "available" | "unspecified" | "scheduled_conflict" | "unavailable_conflict",
  assignable: boolean,
) {
  return {
    userId: id,
    displayName: id,
    isCurrentUser: false,
    fit,
    declined: false,
    assignable,
    availabilityNote: "",
    overlappingShiftLabel: "",
  };
}

function need(
  id: string,
  candidates: ReturnType<typeof candidate>[],
  startsAt = "2026-09-28T14:00:00.000Z",
) {
  return {
    id,
    source: "coverage_requirement" as const,
    sourceId: "req-1",
    label: "Afternoon care",
    startsAt,
    endsAt: "2026-09-28T16:00:00.000Z",
    note: "",
    taskDueAt: null,
    taskAssignedTo: null,
    taskPriority: null,
    exactWindow: true,
    candidates,
    recommendedUserId:
      candidates.find((item) => item.assignable)?.userId ?? null,
  };
}

const occurrences = [
  {
    requirementId: "req-1",
    careRecipientId: "recipient-1",
    label: "Afternoon care",
    startsAt: "2026-09-28T14:00:00.000Z",
    endsAt: "2026-09-28T16:00:00.000Z",
    timezone: "UTC",
    note: "",
  },
];

test("forecast flags uncovered care with no assignable caregiver as high attention", () => {
  const result = buildCoverageForecast({
    needs: [need("gap-1", [candidate("A", "unspecified", false)])],
    occurrences,
    gapPatterns: [],
    now: new Date("2026-09-24T10:00:00.000Z"),
  });

  assert.equal(result[0]?.risk, "high");
  assert.equal(result[0]?.assignableCount, 0);
  assert.equal(coverageForecastRiskLabel(result[0]!.risk), "High attention");
});

test("forecast treats a single assignable caregiver as elevated", () => {
  const result = buildCoverageForecast({
    needs: [need("gap-1", [candidate("A", "preferred", true)])],
    occurrences,
    gapPatterns: [],
    now: new Date("2026-09-24T10:00:00.000Z"),
  });

  assert.equal(result[0]?.risk, "elevated");
});

test("repeated historical gap patterns raise an otherwise strong window to watch", () => {
  const result = buildCoverageForecast({
    needs: [
      need("gap-1", [
        candidate("A", "preferred", true),
        candidate("B", "available", true),
      ]),
    ],
    occurrences,
    gapPatterns: [
      {
        weekdayIso: 1,
        localHour: 14,
        gapCount: 1,
        totalGapMinutes: 120,
      },
    ],
    now: new Date("2026-09-24T10:00:00.000Z"),
  });

  assert.equal(result[0]?.risk, "watch");
  assert.equal(result[0]?.historicalGapCount, 1);
});

test("forecast counts keep operational risk levels separate", () => {
  const counts = coverageForecastCounts([
    {
      id: "1",
      sourceId: "r",
      label: "A",
      startsAt: "2026-09-28T10:00:00Z",
      endsAt: "2026-09-28T11:00:00Z",
      risk: "high",
      assignableCount: 0,
      unspecifiedCount: 1,
      conflictCount: 0,
      historicalGapCount: 0,
      recommendedCaregiverName: null,
      reasons: [],
    },
    {
      id: "2",
      sourceId: "r",
      label: "B",
      startsAt: "2026-09-29T10:00:00Z",
      endsAt: "2026-09-29T11:00:00Z",
      risk: "stable",
      assignableCount: 2,
      unspecifiedCount: 0,
      conflictCount: 0,
      historicalGapCount: 0,
      recommendedCaregiverName: "A",
      reasons: [],
    },
  ]);

  assert.deepEqual(counts, {
    total: 2,
    high: 1,
    elevated: 0,
    watch: 0,
    stable: 1,
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  forecastResolutionCounts,
  forecastResolutionStateLabel,
  forecastResolutionTypeLabel,
} from "../src/careCoverageForecastResolutionHelpers.ts";

test("forecast resolution labels distinguish progress from secured coverage", () => {
  assert.equal(
    forecastResolutionStateLabel("in_progress"),
    "Resolution in progress",
  );
  assert.equal(
    forecastResolutionStateLabel("resolved"),
    "Coverage secured",
  );
  assert.equal(
    forecastResolutionTypeLabel("scheduled_shift"),
    "Scheduled caregiver shift",
  );
});

test("forecast resolution counts preserve the lifecycle", () => {
  const base = {
    alertId: "a",
    requirementId: "r",
    label: "Morning care",
    startsAt: "2026-09-25T08:00:00Z",
    endsAt: "2026-09-25T10:00:00Z",
    riskLevel: "high" as const,
    originalAssignableCount: 0,
    resolutionType: null,
    resolutionSummary: "",
    resolvedAt: null,
    createdAt: "2026-09-24T00:00:00Z",
  };

  const rows = [
    { ...base, currentState: "active" as const },
    {
      ...base,
      alertId: "b",
      currentState: "resolved" as const,
      resolutionType: "scheduled_shift",
      resolvedAt: "2026-09-24T08:00:00Z",
    },
  ];

  assert.deepEqual(forecastResolutionCounts(rows), {
    total: 2,
    active: 1,
    improved: 0,
    in_progress: 0,
    resolved: 1,
    expired: 0,
  });
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  emergencyProfileCompleteness,
  emergencyReviewLabel,
} from "../src/emergencyCenterHelpers.ts";

test("emergency completeness counts the preparedness anchors", () => {
  const data: any = {
    profile: {
      localEmergencyNumber: "911",
      allergies: "Penicillin",
      importantConditions: "CHF",
    },
    recipient: {
      emergencyContactName: "Alex",
      emergencyContactPhone: "5551234",
    },
    latestReconciliation: { id: "r1" },
    keyDocuments: [{ id: "d1" }],
  };

  assert.deepEqual(emergencyProfileCompleteness(data), {
    completed: 6,
    total: 6,
  });
});

test("emergency review label is human readable", () => {
  assert.equal(
    emergencyReviewLabel(
      "2026-09-23T09:00:00Z",
      new Date("2026-09-24T10:00:00Z"),
    ),
    "Reviewed yesterday",
  );
});

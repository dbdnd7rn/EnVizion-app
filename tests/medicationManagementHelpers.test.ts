import test from "node:test";
import assert from "node:assert/strict";
import {
  medicationOutcomeLabel,
  medicationReconciliationLabel,
  medicationRefillState,
} from "../src/medicationManagementHelpers.ts";

test("medication outcome labels preserve neutral caregiver language", () => {
  assert.equal(medicationOutcomeLabel("taken"), "Recorded as taken");
  assert.equal(
    medicationOutcomeLabel("not_taken"),
    "Recorded as not taken",
  );
  assert.equal(
    medicationOutcomeLabel("prn_taken"),
    "PRN / as-needed recorded as taken",
  );
});

test("medication reconciliation age is easy to understand", () => {
  const reconciliation = {
    id: "r1",
    medicationCount: 4,
    note: "",
    createdAt: "2026-09-23T08:00:00.000Z",
  };

  assert.equal(
    medicationReconciliationLabel(
      reconciliation,
      new Date("2026-09-24T09:00:00.000Z"),
    ),
    "Reconciled yesterday",
  );
});

test("refill state distinguishes due-soon from overdue", () => {
  const base = {
    careRecipientId: "care",
    id: "med",
    name: "Medicine",
    instructions: "",
    time: "",
    dose: "",
    route: "",
    purpose: "",
    prescriber: "",
    pharmacy: "",
    isPrn: false,
    lastReconciledAt: null,
    reconciliationNote: "",
    active: true,
    discontinuedAt: null,
  };

  assert.equal(
    medicationRefillState(
      { ...base, refillDueOn: "2026-09-29" },
      new Date("2026-09-24T00:00:00Z"),
    ),
    "soon",
  );
  assert.equal(
    medicationRefillState(
      { ...base, refillDueOn: "2026-09-20" },
      new Date("2026-09-24T00:00:00Z"),
    ),
    "overdue",
  );
});

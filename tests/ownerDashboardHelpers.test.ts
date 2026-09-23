import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerDocumentStatus,
  ownerReconciliationStatus,
} from "../src/ownerDashboardHelpers.ts";

test("owner document status counts key and review-attention records", () => {
  const docs: any[] = [
    {
      isKeyDocument: true,
      reviewDueOn: "2026-10-01",
      archivedAt: null,
    },
    {
      isKeyDocument: false,
      reviewDueOn: "2027-01-01",
      archivedAt: null,
    },
    {
      isKeyDocument: true,
      reviewDueOn: "",
      archivedAt: "2026-09-20T00:00:00Z",
    },
  ];

  assert.deepEqual(
    ownerDocumentStatus(docs, new Date("2026-09-24T00:00:00Z")),
    {
      keyDocuments: 1,
      reviewAttention: 1,
      archived: 1,
    },
  );
});

test("owner reconciliation status flags old medication reviews", () => {
  assert.equal(
    ownerReconciliationStatus(
      "2026-09-23T00:00:00Z",
      new Date("2026-09-24T00:00:00Z"),
    ).needsReview,
    false,
  );

  assert.equal(
    ownerReconciliationStatus(
      "2026-09-10T00:00:00Z",
      new Date("2026-09-24T00:00:00Z"),
    ).needsReview,
    true,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  familyCommunicationSummary,
  familyUpdateAcknowledgedByUser,
} from "../src/familyCommunicationHelpers.ts";

const updates: any[] = [
  {
    id: "u1",
    priority: "needs_acknowledgement",
    requiresAcknowledgement: true,
  },
  {
    id: "u2",
    priority: "important",
    requiresAcknowledgement: false,
  },
];

const acknowledgements: any[] = [
  {
    id: "a1",
    updateId: "u1",
    acknowledgedBy: "user-1",
  },
];

test("family acknowledgement helper is user-specific", () => {
  assert.equal(
    familyUpdateAcknowledgedByUser(
      "u1",
      "user-1",
      acknowledgements,
    ),
    true,
  );
  assert.equal(
    familyUpdateAcknowledgedByUser(
      "u1",
      "user-2",
      acknowledgements,
    ),
    false,
  );
});

test("family communication summary tracks outstanding acknowledgement", () => {
  assert.deepEqual(
    familyCommunicationSummary(
      updates,
      acknowledgements,
      "user-2",
    ),
    {
      total: 2,
      important: 1,
      needsMyAcknowledgement: 1,
    },
  );
});

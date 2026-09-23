import test from "node:test";
import assert from "node:assert/strict";
import { careSyncLabel } from "../src/careResilience.ts";

test("stale sync label makes last-loaded behavior explicit", () => {
  assert.match(
    careSyncLabel({
      status: "stale",
      lastSyncedAt: "2026-09-24T08:00:00Z",
    }),
    /showing the last loaded care data/i,
  );
});

test("loading sync label is concise", () => {
  assert.equal(
    careSyncLabel({ status: "loading", lastSyncedAt: null }),
    "Refreshing care data…",
  );
});

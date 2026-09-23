import test from "node:test";
import assert from "node:assert/strict";
import { sessionExpiryLabel } from "../src/sessionSecurityHelpers.ts";

test("session expiry helper describes upcoming refresh", () => {
  assert.equal(
    sessionExpiryLabel(
      "2026-09-24T10:30:00Z",
      new Date("2026-09-24T10:00:00Z"),
    ),
    "Session refresh in about 30 minutes",
  );
});

test("session expiry helper handles missing values", () => {
  assert.equal(sessionExpiryLabel(null), "Session expiry unavailable");
});

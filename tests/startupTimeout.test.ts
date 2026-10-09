import test from "node:test";
import assert from "node:assert/strict";
import { withStartupTimeout } from "../src/startupTimeout.ts";

test("startup completes immediately when an account request succeeds", async () => {
  assert.equal(
    await withStartupTimeout(Promise.resolve("authenticated"), 100, "Too slow"),
    "authenticated",
  );
});

test("a stalled startup request becomes a retryable timeout instead of an infinite spinner", async () => {
  const pending = new Promise<string>(() => {});
  await assert.rejects(
    withStartupTimeout(pending, 10, "Account verification is taking longer than expected."),
    /Account verification is taking longer than expected/,
  );
});

test("startup preserves a real request error instead of masking it as a timeout", async () => {
  await assert.rejects(
    withStartupTimeout(Promise.reject(new Error("Network offline")), 100, "Too slow"),
    /Network offline/,
  );
});

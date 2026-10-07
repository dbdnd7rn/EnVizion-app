import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUIET_MOMENT_MS,
  formatQuietMomentClock,
  quietMomentElapsedMs,
  quietMomentProgress,
  quietMomentRemainingSeconds,
} from "../src/spiritualWellnessHelpers.ts";

test("quiet moment elapsed time is based on wall-clock time and clamps at one minute", () => {
  assert.equal(quietMomentElapsedMs(1_000, 1_000), 0);
  assert.equal(quietMomentElapsedMs(1_000, 31_250), 30_250);
  assert.equal(quietMomentElapsedMs(1_000, 90_000), QUIET_MOMENT_MS);
});

test("quiet moment remaining display stays accurate between interval ticks", () => {
  assert.equal(quietMomentRemainingSeconds(0), 60);
  assert.equal(quietMomentRemainingSeconds(999), 60);
  assert.equal(quietMomentRemainingSeconds(1_001), 59);
  assert.equal(quietMomentRemainingSeconds(59_999), 1);
  assert.equal(quietMomentRemainingSeconds(60_000), 0);
});

test("quiet moment progress matches actual elapsed time", () => {
  assert.equal(quietMomentProgress(0), 0);
  assert.equal(quietMomentProgress(15_000), 0.25);
  assert.equal(quietMomentProgress(30_000), 0.5);
  assert.equal(quietMomentProgress(60_000), 1);
  assert.equal(quietMomentProgress(90_000), 1);
});

test("quiet moment clock formats a one-minute countdown", () => {
  assert.equal(formatQuietMomentClock(60), "1:00");
  assert.equal(formatQuietMomentClock(9), "0:09");
  assert.equal(formatQuietMomentClock(0), "0:00");
});

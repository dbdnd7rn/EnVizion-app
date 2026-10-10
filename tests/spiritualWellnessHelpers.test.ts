import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUIET_MOMENT_MS,
  FAITH_VERSE_INTERVAL_MS,
  FAITH_VERSES,
  faithVerseAt,
  faithVerseNextUpdateMs,
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

test("verse stays stable during a window and changes exactly at each 12-hour boundary", () => {
  const start = Date.UTC(2026, 9, 10);
  assert.equal(FAITH_VERSE_INTERVAL_MS, 43_200_000);
  assert.deepEqual(faithVerseAt(start), faithVerseAt(start + FAITH_VERSE_INTERVAL_MS - 1));
  assert.notDeepEqual(faithVerseAt(start), faithVerseAt(start + FAITH_VERSE_INTERVAL_MS));
  assert.notDeepEqual(faithVerseAt(start + FAITH_VERSE_INTERVAL_MS), faithVerseAt(start + 2 * FAITH_VERSE_INTERVAL_MS));
  assert.equal(faithVerseNextUpdateMs(start), start + FAITH_VERSE_INTERVAL_MS);
  assert.equal(faithVerseNextUpdateMs(start + FAITH_VERSE_INTERVAL_MS - 1), start + FAITH_VERSE_INTERVAL_MS);
  assert.equal(faithVerseNextUpdateMs(start + FAITH_VERSE_INTERVAL_MS), start + 2 * FAITH_VERSE_INTERVAL_MS);
});

test("reopening and resuming after missed windows selects the current verse without replaying stale ones", () => {
  const start = Date.UTC(2026, 9, 10);
  assert.deepEqual(faithVerseAt(start + 1000), faithVerseAt(start + 600_000));
  const resumed = start + 7 * FAITH_VERSE_INTERVAL_MS + 1234;
  assert.deepEqual(faithVerseAt(resumed), faithVerseAt(start + 7 * FAITH_VERSE_INTERVAL_MS));
  assert.equal(faithVerseNextUpdateMs(resumed), start + 8 * FAITH_VERSE_INTERVAL_MS);
});

test("scripture rotation has no adjacent duplicates, even when the collection wraps", () => {
  assert.equal(new Set(FAITH_VERSES.map((verse) => verse.reference)).size, FAITH_VERSES.length);
  for (let slot = 0; slot < FAITH_VERSES.length; slot += 1) {
    assert.notDeepEqual(faithVerseAt(slot * FAITH_VERSE_INTERVAL_MS), faithVerseAt((slot + 1) * FAITH_VERSE_INTERVAL_MS));
  }
  assert.deepEqual(faithVerseAt(0), faithVerseAt(FAITH_VERSES.length * FAITH_VERSE_INTERVAL_MS));
});

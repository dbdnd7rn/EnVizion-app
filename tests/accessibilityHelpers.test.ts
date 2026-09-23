import test from "node:test";
import assert from "node:assert/strict";
import {
  accessibilityReadiness,
  fontScaleLabel,
  MINIMUM_TOUCH_TARGET,
} from "../src/accessibilityHelpers.ts";

test("accessibility touch target contract stays at least 44 points", () => {
  assert.equal(MINIMUM_TOUCH_TARGET >= 44, true);
});

test("font scale helper distinguishes larger text", () => {
  assert.equal(fontScaleLabel(1), "Standard system text");
  assert.equal(fontScaleLabel(1.2), "Larger system text");
  assert.equal(fontScaleLabel(1.6), "Large system text");
});

test("readiness reports system states without changing them", () => {
  assert.deepEqual(
    accessibilityReadiness({
      fontScale: 1.3,
      reduceMotion: true,
      screenReader: true,
    }),
    {
      fontScaleLabel: "Larger system text",
      respectsReduceMotion: true,
      screenReaderActive: true,
      minimumTouchTarget: 44,
    },
  );
});

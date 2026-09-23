import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageHourLabel,
  coverageMinutesLabel,
  coveragePercentWidth,
  coverageWeekdayLabel,
} from "../src/careCoverageInsightsHelpers.ts";

test("coverage insight time labels stay compact", () => {
  assert.equal(coverageMinutesLabel(18), "18 min");
  assert.equal(coverageMinutesLabel(60), "1h");
  assert.equal(coverageMinutesLabel(95), "1h 35m");
  assert.equal(coverageMinutesLabel(null), "No completed data yet");
});

test("coverage insight weekday and hour labels are human readable", () => {
  assert.equal(coverageWeekdayLabel(1), "Monday");
  assert.equal(coverageWeekdayLabel(7), "Sunday");
  assert.equal(coverageHourLabel(0), "12:00 AM");
  assert.equal(coverageHourLabel(13), "1:00 PM");
});

test("coverage percentage bars are bounded", () => {
  assert.equal(coveragePercentWidth(null), 0);
  assert.equal(coveragePercentWidth(-5), 0);
  assert.equal(coveragePercentWidth(62.5), 62.5);
  assert.equal(coveragePercentWidth(140), 100);
});

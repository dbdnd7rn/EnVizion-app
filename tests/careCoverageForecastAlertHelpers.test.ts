import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageForecastAlertLevelLabel,
  coverageForecastHorizonLabel,
} from "../src/careCoverageForecastAlertHelpers.ts";

test("forecast alert severity labels are explicit", () => {
  assert.equal(coverageForecastAlertLevelLabel("high"), "High only");
  assert.equal(
    coverageForecastAlertLevelLabel("elevated"),
    "High + Elevated",
  );
});

test("forecast warning horizon labels stay human readable", () => {
  assert.equal(coverageForecastHorizonLabel(3), "3 days ahead");
  assert.equal(coverageForecastHorizonLabel(21), "21 days ahead");
});

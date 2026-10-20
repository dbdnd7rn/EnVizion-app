import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  GLUCOSE_TIMING_OPTIONS, canonicalGlucose, glucoseDisplay,
  glucoseHistoryEntries, glucoseToMgDl, storedGlucoseMgDl,
} from "../src/glucoseHelpers.ts";

test("timing dropdown choices are defined and meaningful", () => {
  assert.deepEqual(GLUCOSE_TIMING_OPTIONS, [
    "Before breakfast", "After a meal", "Before bedtime", "Fasting",
  ]);
});
test("canonical storage and displayed conversions are accurate", () => {
  assert.equal(glucoseDisplay(180.182, "mmol/L"), "10");
  assert.equal(glucoseDisplay(glucoseToMgDl(5.5, "mmol/L"), "mg/dL"), "99.1");
  const stored = canonicalGlucose({glucose: "5.5", timing: "Fasting"}, "mmol/L");
  assert.equal(stored.glucose_unit, "mg/dL");
  assert.equal(storedGlucoseMgDl(stored), 99.1);
  assert.equal(stored.timing, "Fasting");
});
test("canonical conversion avoids round trip display drift", () => {
  const canonical = glucoseToMgDl(5.55, "mmol/L");
  for (let i = 0; i < 50; i++) {
    assert.equal(glucoseDisplay(canonical, "mmol/L"), "5.55");
    assert.equal(glucoseDisplay(canonical, "mg/dL"), "100");
  }
});
test("existing untagged mg/dL-only readings are retained, invalid units ignored", () => {
  assert.equal(storedGlucoseMgDl({glucose:"103"}), 103);
  assert.equal(storedGlucoseMgDl({glucose:"8",glucose_unit:"mmol/L"}), 144.1456);
  assert.equal(storedGlucoseMgDl({glucose:"8",glucose_unit:"unknown"}), null);
});
test("filters chronological records without mixing tracker kinds", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const entries = [
    {id:"old",kind:"Blood sugar" as const,values:{glucose:"110"},recordedAt:"2026-08-20T09:00:00Z"},
    {id:"new",kind:"Blood sugar" as const,values:{glucose:"100"},recordedAt:"2026-10-20T09:00:00Z"},
    {id:"other",kind:"Vitals" as const,values:{glucose:"120"},recordedAt:"2026-10-20T09:00:00Z"},
    {id:"mid",kind:"Blood sugar" as const,values:{glucose:"105"},recordedAt:"2026-10-19T09:00:00Z"},
  ];
  assert.deepEqual(glucoseHistoryEntries(entries,7,now).map(x=>x.id),["new","mid"]);
  assert.deepEqual(glucoseHistoryEntries(entries,null,now).map(x=>x.id),["new","mid","old"]);
});
test("blood sugar interface uses a real timing picker and patient-scoped persistence", () => {
  const screen=readFileSync(new URL("../src/screens/CareScreens.tsx",import.meta.url),"utf8");
  const backend=readFileSync(new URL("../src/backend.ts",import.meta.url),"utf8");
  assert.match(screen,/function BloodSugarTimingPicker/);
  assert.match(screen,/accessibilityState=\{\{ expanded: open/);
  assert.match(screen,/GLUCOSE_TIMING_OPTIONS\.map/);
  assert.match(screen,/glucoseHistoryExpanded/);
  assert.match(backend,/requireEditableCareContext\(\)/);
  assert.match(backend,/care_recipient_id: careRecipientId/);
  assert.match(backend,/user_id: user\.id/);
});

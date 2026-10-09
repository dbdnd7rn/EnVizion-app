import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../src/screens/EmergencyCenterScreen.tsx", import.meta.url),
  "utf8",
);

test("all emergency profile tiles open focused detail views instead of full edit form", () => {
  const routes = ["hospital", "allergies", "conditions", "directive",
    "bloodType", "codeStatus", "poa", "language"];
  for (const route of routes) {
    assert.match(source, new RegExp('onPress=\\{\\(\\) => openProfileDetail\\("' + route + '"\\)\\}'));
    assert.match(source, new RegExp('activeDetail === "' + route + '"'));
  }
  assert.match(source, /setEditing\(true\)/);
});

test("emergency detail back and cancel preserve scroll and avoid accidental data writes", () => {
  assert.match(source, /<Modal visible=\{activeDetail !== null\}/);
  assert.match(source, /onRequestClose=\{closeProfileDetail\}/);
  assert.match(source, /accessibilityLabel="Back to Emergency profile"/);
  assert.match(source, /if \(detailDirty\)/);
  assert.match(source, /Discard unsaved changes\?/);
  assert.match(source, /setConfirmDiscardDetail\(true\)/);
  assert.match(source, /function discardDetail\(\)/);
  assert.match(source, /applyProfile\(data\)/);
  assert.match(source, /setActiveDetail\(null\)/);
});

test("emergency detail respects roles and uses existing Supabase save API", () => {
  assert.match(source, /readOnly =/);
  assert.match(source, /state\.accessRole === "viewer"/);
  assert.match(source, /state\.accessRole === "patient"/);
  assert.match(source, /saveEmergencyProfile\(\{/);
  assert.match(source, /markReviewed,/);
  assert.match(source, /onPress=\{\(\) => void save\(false\)\}/);
  assert.match(source, /if \(readOnly\) \{/);
  assert.match(source, /!readOnly && \(/);
});

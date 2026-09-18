import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEntry, resourceHtml, trackerFields } from "../src/domain.ts";
test("vitals require both blood pressure values", () => {
  assert.match(validateEntry("Vitals", { systolic: "120" })!, /Diastolic/);
  assert.equal(
    validateEntry("Vitals", { systolic: "120", diastolic: "80" }),
    null,
  );
});
test("reject invalid numbers without interpreting clinical risk", () => {
  for (const glucose of ["-2", "0", "abc", "Infinity", "12abc"])
    assert.ok(
      validateEntry("Blood sugar", { glucose, timing: "Before breakfast" }),
    );
  assert.equal(
    validateEntry("Blood sugar", {
      glucose: "110.5",
      timing: "Before breakfast",
    }),
    null,
  );
});
test("all trackers enforce their required observations", () => {
  for (const kind of Object.keys(
    trackerFields,
  ) as (keyof typeof trackerFields)[])
    assert.ok(validateEntry(kind, {}));
  assert.ok(
    validateEntry("Behavior & memory", {
      observed: "Different today",
      onset: "  ",
    }),
  );
});
test("printable resources escape user supplied markup", () => {
  const html = resourceHtml("<script>alert(1)</script>", [
    "<img src=x onerror=alert(1)>",
    "A & B",
  ]);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("A &amp; B"));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentLines,
  validateAppointment,
  validateEntry,
  resourceHtml,
  trackerFields,
} from "../src/domain.ts";
test("vitals require both blood pressure values", () => {
  assert.match(validateEntry("Vitals", { systolic: "120" })!, /Diastolic/);
  assert.equal(
    validateEntry("Vitals", { systolic: "120", diastolic: "80" }),
    null,
  );
});
test("reject invalid numbers without interpreting clinical risk", () => {
  for (const glucose of [
    "-2",
    "0",
    "abc",
    "Infinity",
    "12abc",
    "9".repeat(400),
  ])
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
test("appointment dates and times represent real calendar values", () => {
  const visit = {
    title: "Follow-up",
    date: "2028-02-29",
    time: "14:30",
    location: "",
    notes: "",
  };
  assert.equal(validateAppointment(visit), null);
  assert.ok(validateAppointment({ ...visit, date: "2027-02-29" }));
  assert.ok(validateAppointment({ ...visit, date: "2028-04-31" }));
  assert.ok(validateAppointment({ ...visit, time: "24:00" }));
  assert.ok(validateAppointment({ ...visit, title: "  " }));
  assert.equal(validateAppointment({ ...visit, date: "", time: "" }), null);
});
test("appointment sheets contain edited visit details and current questions", () => {
  const lines = appointmentLines(
    {
      title: "Care review",
      date: "2026-10-12",
      time: "09:30",
      location: "Clinic A",
      notes: "Bring the list",
    },
    ["Who should we call?"],
  );
  const html = resourceHtml("Appointment plan", lines);
  for (const expected of [
    "Care review",
    "2026-10-12",
    "09:30",
    "Clinic A",
    "Bring the list",
    "Who should we call?",
  ])
    assert.ok(html.includes(expected));
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
import {
  correctMedicationRecord,
  medicationLines,
} from "../src/medications.ts";
test("medication corrections preserve the original and do not alter other doses", () => {
  const medication = {
    id: "m1",
    name: "Sample medicine",
    instructions: "Sample label",
    time: "Morning",
  };
  const records = [
    {
      id: "r1",
      medication: { ...medication },
      recordedAt: "2026-09-19T08:00:00Z",
    },
    {
      id: "r2",
      medication: { ...medication },
      recordedAt: "2026-09-19T09:00:00Z",
    },
  ];
  const corrected = correctMedicationRecord(
    records,
    "r1",
    "2026-09-19T10:00:00Z",
  );
  assert.equal(corrected[0].correctedAt, "2026-09-19T10:00:00Z");
  assert.equal(corrected[1].correctedAt, undefined);
  assert.equal(corrected[0].recordedAt, records[0].recordedAt);
  assert.equal("correctedAt" in records[0], false);
  assert.deepEqual(
    correctMedicationRecord(corrected, "r1", "2026-09-19T11:00:00Z"),
    corrected,
  );
  medication.name = "Edited name";
  const lines = medicationLines([medication], corrected).join("\n");
  assert.ok(lines.includes("Edited name"));
  assert.ok(lines.includes("Sample medicine"));
  assert.ok(lines.includes("Corrected / withdrawn"));
});

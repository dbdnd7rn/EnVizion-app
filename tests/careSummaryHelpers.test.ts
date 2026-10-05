import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentCardState,
  careSummaryMedicationLines,
  medicationHistoryLabel,
  recordedAsTakenCount,
} from "../src/careSummaryHelpers.ts";

test("care summary counts only uncorrected taken and PRN-taken dose records", () => {
  const count = recordedAsTakenCount([
    {
      id: "1",
      medicationId: "m1",
      status: "taken",
      recordedAt: "2026-10-01T08:00:00.000Z",
    },
    {
      id: "2",
      medicationId: "m1",
      status: "prn_taken",
      recordedAt: "2026-10-01T10:00:00.000Z",
    },
    {
      id: "3",
      medicationId: "m1",
      status: "not_taken",
      recordedAt: "2026-10-01T12:00:00.000Z",
    },
    {
      id: "4",
      medicationId: "m1",
      status: "corrected",
      recordedAt: "2026-10-01T13:00:00.000Z",
      correctedAt: "2026-10-01T13:05:00.000Z",
    },
    {
      id: "5",
      medicationId: "m1",
      status: "taken",
      recordedAt: "2026-10-01T14:00:00.000Z",
      correctedAt: "2026-10-01T14:05:00.000Z",
    },
  ]);

  assert.equal(count, 2);
});

test("care summary distinguishes no appointment from a saved appointment with no date", () => {
  const appointment = {
    title: "Cardiology review",
    date: "",
    time: "09:30",
    location: "Clinic A",
    notes: "",
  };

  const none = appointmentCardState(null, appointment);
  assert.equal(none.hasAppointment, false);
  assert.equal(none.title, "No upcoming appointment");

  const undated = appointmentCardState("appointment-1", appointment);
  assert.equal(undated.hasAppointment, true);
  assert.equal(undated.title, "Cardiology review");
  assert.match(undated.subtitle, /Date to be confirmed/);
  assert.match(undated.subtitle, /09:30/);
});

test("medication history labels do not turn not-taken records into adherence claims", () => {
  assert.equal(
    medicationHistoryLabel({
      id: "1",
      medicationId: "m1",
      status: "not_taken",
      recordedAt: "2026-10-01T08:00:00.000Z",
    }),
    "Recorded as not taken",
  );
  assert.equal(
    medicationHistoryLabel({
      id: "2",
      medicationId: "m1",
      status: "taken",
      recordedAt: "2026-10-01T08:00:00.000Z",
      correctedAt: "2026-10-01T09:00:00.000Z",
    }),
    "Corrected / withdrawn",
  );
});

test("print medication lines retain history, corrections, notes and explanatory wording", () => {
  const lines = careSummaryMedicationLines(
    [
      {
        id: "m1",
        name: "Medication A",
        instructions: "Take as directed",
        time: "Morning",
        active: true,
      },
    ],
    [
      {
        id: "r1",
        medicationId: "m1",
        status: "not_taken",
        note: "Supply unavailable",
        recordedAt: "2026-10-01T08:00:00.000Z",
      },
      {
        id: "r2",
        medicationId: "m1",
        status: "corrected",
        recordedAt: "2026-10-01T09:00:00.000Z",
        correctedAt: "2026-10-01T09:05:00.000Z",
      },
    ],
  );

  const output = lines.join("\n");
  assert.match(output, /Medication A/);
  assert.match(output, /Recorded as not taken/);
  assert.match(output, /Supply unavailable/);
  assert.match(output, /Corrected \/ withdrawn/);
  assert.match(output, /Withdrawn:/);
  assert.match(output, /does not verify medication adherence/i);
});

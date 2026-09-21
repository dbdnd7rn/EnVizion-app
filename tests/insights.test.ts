import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appointmentPreparation,
  buildCareTimeline,
  buildDailyActivity,
  medicationStats,
  numericSeries,
} from "../src/insights.ts";
import type { Entry } from "../src/domain.ts";
import type { MedicationRecord } from "../src/medications.ts";

const entries: Entry[] = [
  {
    id: "v1",
    kind: "Vitals",
    values: { systolic: "120", diastolic: "80" },
    recordedAt: "2026-09-20T08:00:00Z",
  },
  {
    id: "v2",
    kind: "Vitals",
    values: { systolic: "124", diastolic: "82" },
    recordedAt: "2026-09-21T08:00:00Z",
  },
  {
    id: "g1",
    kind: "Blood sugar",
    values: { glucose: "105", timing: "Before breakfast" },
    recordedAt: "2026-09-21T09:00:00Z",
  },
];

const medicationRecords: MedicationRecord[] = [
  {
    id: "m1",
    medication: {
      id: "med-1",
      name: "Example medication",
      instructions: "Take as directed",
      time: "Morning",
    },
    recordedAt: "2026-09-21T07:00:00Z",
  },
  {
    id: "m2",
    medication: {
      id: "med-1",
      name: "Example medication",
      instructions: "Take as directed",
      time: "Morning",
    },
    recordedAt: "2026-09-20T07:00:00Z",
    correctedAt: "2026-09-20T10:00:00Z",
  },
];

test("daily activity excludes corrected medication entries", () => {
  const activity = buildDailyActivity(
    entries,
    medicationRecords,
    2,
    new Date("2026-09-21T12:00:00Z"),
  );

  assert.equal(activity.length, 2);
  assert.equal(activity[0].observations, 1);
  assert.equal(activity[0].medicationRecords, 0);
  assert.equal(activity[1].observations, 2);
  assert.equal(activity[1].medicationRecords, 1);
});

test("numeric series returns chronological numeric tracker values", () => {
  const series = numericSeries(entries, "Vitals", "systolic");
  assert.deepEqual(
    series.map((point) => point.value),
    [120, 124],
  );
});

test("appointment preparation counts organization items only", () => {
  const result = appointmentPreparation(
    {
      title: "Follow-up",
      date: "2026-10-01",
      time: "",
      location: "Clinic",
      notes: "",
    },
    ["Ask about next steps"],
  );

  assert.equal(result.ready, 3);
  assert.equal(result.total, 5);
});

test("medication stats separate current records from corrected entries", () => {
  const stats = medicationStats(medicationRecords);
  assert.equal(stats.recordedCount, 1);
  assert.equal(stats.correctedCount, 1);
  assert.equal(stats.latestRecordedAt, "2026-09-21T07:00:00Z");
});

test("care timeline merges observations and medication history newest first", () => {
  const timeline = buildCareTimeline(entries, medicationRecords);
  assert.equal(timeline[0].title, "Blood sugar");
  assert.equal(timeline[1].title, "Vitals");
  assert.equal(timeline.some((item) => item.corrected), true);
});

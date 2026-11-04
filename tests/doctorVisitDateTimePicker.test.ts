import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  doctorVisitCalendarDays,
  doctorVisitDateLabel,
  doctorVisitSchedulingError,
  doctorVisitTimeLabel,
  formatDoctorVisitDate,
  formatDoctorVisitTime,
  moveDoctorVisitMonth,
  parseDoctorVisitDate,
  parseDoctorVisitTime,
} from "../src/doctorVisitDateTimeHelpers.ts";

test("calendar dates are strictly validated, including leap-year handling", () => {
  assert.ok(parseDoctorVisitDate("2026-11-08"));
  assert.equal(parseDoctorVisitDate("2026-11-31"), null);
  assert.equal(parseDoctorVisitDate("2027-02-29"), null);
  assert.ok(parseDoctorVisitDate("2028-02-29"));
  assert.equal(parseDoctorVisitDate("2026-1-08"), null);
  assert.equal(formatDoctorVisitDate(2026, 10, 8), "2026-11-08");
  assert.match(doctorVisitDateLabel("2026-11-08"), /2026/);
  assert.equal(doctorVisitDateLabel("bad"), "Choose date");
});

test("month navigation handles year boundary and generates aligned calendar days", () => {
  const november = new Date(2026, 10, 1, 12);
  const cells = doctorVisitCalendarDays(november);
  assert.equal(cells[0], 1); // Nov 1, 2026 is a Sunday
  assert.equal(cells.filter(value => value !== null).length, 30);
  assert.equal(cells.length % 7, 0);
  const next = moveDoctorVisitMonth(new Date(2026, 11, 1, 12), 1);
  assert.equal(next.getFullYear(), 2027);
  assert.equal(next.getMonth(), 0);
  const previous = moveDoctorVisitMonth(next, -1);
  assert.equal(previous.getFullYear(), 2026);
  assert.equal(previous.getMonth(), 11);
});

test("time picker permits exact valid minutes but never 13:60", () => {
  assert.deepEqual(parseDoctorVisitTime("13:56"), { hour: 13, minute: 56 });
  assert.deepEqual(parseDoctorVisitTime("00:00"), { hour: 0, minute: 0 });
  assert.deepEqual(parseDoctorVisitTime("23:59"), { hour: 23, minute: 59 });
  assert.equal(parseDoctorVisitTime("13:60"), null);
  assert.equal(parseDoctorVisitTime("24:00"), null);
  assert.equal(parseDoctorVisitTime("13:7"), null);
  assert.equal(formatDoctorVisitTime(13, 56), "13:56");
  assert.equal(formatDoctorVisitTime(0, 0), "00:00");
  assert.throws(() => formatDoctorVisitTime(13, 60), RangeError);
  assert.equal(doctorVisitTimeLabel("13:56"), "1:56 PM");
  assert.equal(doctorVisitTimeLabel("13:60"), "Choose time");
});

test("invalid date/time returns targeted errors and valid selection remains compatible with Supabase ISO conversion", () => {
  assert.match(doctorVisitSchedulingError("2026-11-31", "13:30") ?? "", /date/i);
  assert.match(doctorVisitSchedulingError("2026-11-08", "13:60") ?? "", /minutes/i);
  assert.equal(doctorVisitSchedulingError("2026-11-08", "13:30"), null);
});

test("create visit uses tappable cross-platform calendar and exact time selection instead of typing", () => {
  const screen = readFileSync(new URL("../src/screens/DoctorVisitCompanionScreen.tsx", import.meta.url), "utf8");
  const picker = readFileSync(new URL("../src/components/DoctorVisitSchedulePicker.tsx", import.meta.url), "utf8");
  assert.match(screen, /<DoctorVisitSchedulePicker/);
  assert.match(screen, /doctorVisitSchedulingError\(visitDate, visitTime\)/);
  assert.match(screen, /setFormError\(validationError\)/);
  assert.match(screen, /accessibilityRole="alert"/);
  assert.match(screen, /onPress=\{\(\) => void createVisit\(\)\}/);
  assert.doesNotMatch(screen, /label="Visit time \(HH:MM\)"/);
  assert.doesNotMatch(screen, /label="Visit date \(YYYY-MM-DD\)"/);
  assert.match(picker, /accessibilityLabel="Previous month"/);
  assert.match(picker, /accessibilityLabel="Next month"/);
  assert.match(picker, /doctorVisitCalendarDays\(calendarMonth\)/);
  assert.match(picker, /ScrollView nestedScrollEnabled/);
  assert.match(picker, /minutes\.map\(minute =>/);
  assert.match(picker, /hours\.map\(hour =>/);
  assert.match(picker, /onTimeChange\(formatDoctorVisitTime\(draftHour, draftMinute\)\)/);
  assert.match(picker, /onDateChange\(value\)/);
  assert.match(screen, /await createDoctorVisit\(\{/);
  assert.match(screen, /addDoctorVisitQuestion\(\{/);
  assert.match(screen, /Generate AI draft/);
});

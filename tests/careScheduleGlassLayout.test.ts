import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const screen = readFileSync(new URL("../src/screens/CareScheduleScreen.tsx", import.meta.url), "utf8");
const design = readFileSync(new URL("../src/screens/CareScheduleDesign.tsx", import.meta.url), "utf8");

test("caregiver schedule defaults to the first-reference compact glass overview", () => {
  for (const key of [
    "ScheduleHero", "CurrentCoverageCard", "ScheduleQuickAction",
    "ScheduleOverviewTile", "Next 7 days", "Availability", "Shift swap requests",
    "Coverage planning is coordination support.",
  ]) assert.ok(screen.includes(key), key);
  for (const label of ["Schedule a shift", "Add weekly pattern", "Add one-time availability", "Coverage requests"]) {
    assert.ok(screen.includes(label), label);
  }
  assert.match(design, /Plan caregiver coverage with clarity/);
  assert.match(design, /CalendarArtwork/);
  assert.match(design, /backgroundColor: "#FAF4FDEB"/);
});

test("all schedule details remain reachable via named expandable cards", () => {
  for (const panel of ["shifts", "gaps", "attendance", "weekly", "windows", "swaps", "more"]) {
    assert.ok(screen.includes(`detailPanel === "${panel}"`), panel);
  }
  assert.match(screen, /setShiftFormOpen\(true\)/);
  assert.match(screen, /setRecurringFormOpen\(true\)/);
  assert.match(screen, /setAvailabilityFormOpen\(true\)/);
  assert.match(screen, /detailPanel === "more" &&/);
});

test("scheduling, live data, permissions and real attendance actions are preserved", () => {
  for (const token of [
    "loadCareSchedule", "loadCareTeam", "loadCareTasks", "loadShiftAttendance",
    "actualCoverageNow", "uncoveredUpcomingTasks", "upcomingScheduledShifts",
    "createCareShift", "cancelCareShift", "startShiftAttendance", "endShiftAttendance",
    "createCaregiverAvailabilityRule", "deleteCaregiverAvailabilityRule",
    "createCaregiverAvailability", "deleteCaregiverAvailability",
    "requestCareShiftSwap", "respondToCareShiftSwap",
    "state.accessRole === \"viewer\"", "state.accessRole === \"patient\"",
  ]) assert.ok(screen.includes(token), token);
  assert.match(screen, /coverageGaps\.length/);
  assert.match(screen, /upcomingShifts\.length/);
  assert.match(screen, /recurringAvailability\.length/);
  assert.match(screen, /futureAvailability\.length/);
});

test("advanced coordination navigation is discoverable without duplicate primary buttons", () => {
  for (const link of [
    "CareShiftBoard", "CareAnalytics", "CareCoverageRequirements",
    "WeeklyCoveragePlan", "SmartCoveragePlanner", "CareCoverageRequests",
  ]) assert.ok(screen.includes(`n.navigate("${link}")`), link);
  assert.match(screen, /More planning tools/);
});

test("reduced motion is honored and no UI screenshot is used as an interactive page", () => {
  assert.match(design, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(design, /reduceMotionChanged/);
  assert.match(design, /react-native-svg/);
  assert.doesNotMatch(design, /ImageBackground|source=\{require/);
});

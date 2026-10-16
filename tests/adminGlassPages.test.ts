import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const notifications = readFileSync(new URL("../src/screens/NotificationSettingsScreen.tsx", import.meta.url), "utf8");
const staff = readFileSync(new URL("../src/screens/StaffManagementScreen.tsx", import.meta.url), "utf8");
const pilot = readFileSync(new URL("../src/screens/PilotAdminScreen.tsx", import.meta.url), "utf8");
const glass = readFileSync(new URL("../src/components/AdminGlassUi.tsx", import.meta.url), "utf8");

test("notification glass tabs preserve all categories and quiet-hours validation", () => {
  for (const key of ['"delivery"', '"forecast"', '"quiet"']) assert.match(notifications, new RegExp("tab === " + key));
  for (const name of [
    "reminderPush", "supportPush", "coachingPush", "careTeamPush",
    "taskPush", "coordinationPush", "coordinationDigestEnabled",
    "coverageForecastAlertsEnabled", "coverageForecastAlertLevel",
    "coverageForecastHorizonDays", "quietHoursEnabled", "quietStart", "quietEnd",
  ]) assert.match(notifications, new RegExp(name));
  assert.match(notifications, /saveNotificationPreferences/);
  assert.match(notifications, /validQuietTime/);
  assert.match(notifications, /registerNativePush/);
  assert.match(notifications, /disableNativePushDevices/);
  assert.match(notifications, /Platform\.OS === "web"/);
  assert.match(notifications, /Try again/);
});

test("staff admin retains server-mediated invitations, role updates and audit", () => {
  for (const key of ['"people"', '"invite"', '"activity"']) assert.match(staff, new RegExp("tab === " + key));
  for (const action of ["inviteStaffMember", "loadManagedStaff", "loadStaffAdminAudit", "updateManagedStaff"])
    assert.match(staff, new RegExp(action));
  assert.match(staff, /item\.isCurrentUser/);
  assert.match(staff, /confirmAccess === item\.userId/);
  assert.match(staff, /setConfirmAccess\(item\.userId\)/);
  assert.match(staff, /AdminGlassHero/);
});

test("pilot tabs retain governance, participants, diagnostics and consent workflows", () => {
  for (const key of ['"overview"', '"participants"', '"governance"'])
    assert.match(pilot, new RegExp("tab === " + key));
  for (const action of [
    "loadPilotSummary", "loadPilotCohortProgress", "loadPilotOperations",
    "loadPilotParticipants", "loadPilotFeedback", "loadProgramDocuments",
    "loadPilotAdminAudit", "invitePilotParticipant", "updatePilotParticipant",
    "closeoutPilotParticipant", "publishProgramDocument", "retireProgramDocument",
    "saveProgramDocument", "resolvePilotDiagnostic", "updatePilotFeedback",
  ]) assert.match(pilot, new RegExp(action));
  assert.match(pilot, /membership\.role !== "admin"/);
  assert.match(pilot, /participant\.readyForActivation/);
  assert.match(pilot, /launchReadiness/);
  assert.match(pilot, /Privacy boundary/);
});

test("shared glass admin art supports reduced motion and dark mode", () => {
  assert.match(glass, /useAppearance/);
  assert.match(glass, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(glass, /reduceMotionChanged/);
  assert.match(glass, /pointerEvents="none"/);
  assert.match(glass, /AdminGlassHero/);
  assert.match(glass, /AdminGlassMetric/);
  assert.match(glass, /AdminGlassTabs/);
});
